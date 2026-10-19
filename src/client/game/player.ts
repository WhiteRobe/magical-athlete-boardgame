import { signal, computed } from '@preact/signals';
import type { GameEvent, GameState } from '../../shared/types';
import type { PendingView, ServerMsg } from '../../shared/protocol';
import type { BoardApi } from './board';
import { applyVisual, describe, eventDuration } from './describe';
import { sfx } from '../audio';
import { CHARS, TRACK_NAME } from '../../shared/characters';
import { trackSummary } from '../art/themes';
import { effectivePower } from './powers';

type GameMsg = Extract<ServerMsg, { type: 'game' }>;
export interface LogLine {
  id: number;
  text: string;
  hot?: boolean;
}
export interface Banner {
  id: number;
  title: string;
  sub?: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
let lid = 0;

/**
 * 对局播放器：接收服务端 game 消息，把增量事件排队逐个交给 BoardApi 播放，
 * 同时维护随动画推进的展示状态（view）。队列空闲时才把 pending 交给 UI。
 */
export class GamePlayer {
  view = signal<GameState | null>(null);
  you = signal<number | null>(null);
  seq = signal(0);
  private latestPending = signal<PendingView | null>(null);
  picked = signal<number[]>([]);
  busy = signal(false);
  log = signal<LogLine[]>([]);
  banner = signal<Banner | null>(null);
  /** 天才本回合的点数预测 */
  genius = signal<{ racer: number; value: number } | null>(null);
  speed = signal<number>(Number(localStorage.getItem('ma-speed')) || 1);
  /** 动画进行中隐藏决策面板 */
  pending = computed(() => (this.busy.value ? null : this.latestPending.value));
  /** 最近一次 game 消息的权威状态 */
  private queue: { events: GameEvent[]; msg: GameMsg }[] = [];
  private running = false;
  private skipping = false;
  board: BoardApi | null = null;
  onRaceEvent?: (e: GameEvent) => void;

  setBoard(b: BoardApi | null) {
    this.board = b;
    if (b && this.view.value) b.sync(this.view.value);
  }

  setSpeed(n: number) {
    this.speed.value = n;
    localStorage.setItem('ma-speed', String(n));
  }

  ingest(msg: GameMsg) {
    this.you.value = msg.you;
    if (msg.full || !this.view.value) {
      this.queue = [];
      if (this.running) this.skipping = true; // 正在播放的动画尽快结束
      this.applyFinal(msg);
      return;
    }
    this.queue.push({ events: msg.events, msg });
    this.run();
  }

  /** 跳过当前所有动画 */
  skip() {
    this.skipping = true;
  }

  private applyFinal(msg: GameMsg) {
    this.view.value = msg.state;
    this.seq.value = msg.seq;
    this.picked.value = msg.picked;
    const wasMine = this.latestPending.value?.mine;
    this.latestPending.value = msg.pending;
    this.board?.sync(msg.state);
    if (msg.pending?.mine && !wasMine) sfx('yourTurn');
  }

  private async run() {
    if (this.running) return;
    this.running = true;
    this.busy.value = true;
    try {
      while (this.queue.length) {
        const { events, msg } = this.queue.shift()!;
        // 派人选择进度等不需要动画的更新
        this.picked.value = msg.picked;
        for (const e of events) {
          const fast = this.skipping || document.hidden || this.queue.length > 6;
          await this.playOne(e, fast);
        }
        this.applyFinal(msg);
        if (!this.queue.length) this.skipping = false;
      }
    } finally {
      this.running = false;
      this.busy.value = false;
      this.skipping = false;
    }
  }

  private async playOne(e: GameEvent, fast: boolean) {
    const before = this.view.value!;
    const line = describe(before, e);
    if (line) this.pushLog(line.text, line.hot);
    this.onRaceEvent?.(e);
    // 开赛：先切到比赛阶段，派人面板立刻收起，赛道开场 / 翻牌揭晓动画不被遮住
    if (e.t === 'raceStart') this.view.value = applyVisual(before, e);
    if (!fast) {
      this.sideEffects(e, before);
      const sp = this.speed.value;
      if (this.board && isBoardEvent(e)) await this.board.play(e, before, sp);
      else await sleep(eventDuration(e) / sp);
    }
    this.view.value = applyVisual(before, e);
    if (fast && this.board && isBoardEvent(e)) this.board.sync(this.view.value);
  }

  private sideEffects(e: GameEvent, s: GameState) {
    switch (e.t) {
      case 'turn':
        this.genius.value = null;
        break;
      case 'predict': {
        const r = s.race?.racers.find((x) => x.idx === e.racer);
        if (r && effectivePower(s, r) === 'genius') this.genius.value = { racer: e.racer, value: e.target };
        break;
      }
      case 'raceStart':
        this.showBanner(`第 ${e.no + 1} 场 · ${TRACK_NAME[e.track] ?? ''}`, trackSummary(e.spaces ?? {}));
        sfx('fanfare');
        break;
      case 'finish': {
        const r = s.race?.racers.find((x) => x.idx === e.racer);
        if (r) this.showBanner(`${CHARS[r.card].name} 冲线！`, `第 ${e.place} 名`);
        sfx('cheer');
        break;
      }
      case 'bronze':
        if (e.delta > 0) sfx('coin');
        break;
      case 'drafted':
        sfx('card');
        break;
      case 'gameEnd':
        sfx('fanfare');
        break;
    }
  }

  showBanner(title: string, sub?: string) {
    const b = { id: ++lid, title, sub };
    this.banner.value = b;
    setTimeout(() => {
      if (this.banner.value?.id === b.id) this.banner.value = null;
    }, 1900);
  }

  pushLog(text: string, hot?: boolean) {
    const l = this.log.value;
    this.log.value = [...(l.length > 120 ? l.slice(-100) : l), { id: ++lid, text, hot }];
  }
}

function isBoardEvent(e: GameEvent) {
  return e.t !== 'draftStart' && e.t !== 'drafted' && e.t !== 'bronze' && e.t !== 'gameEnd';
}
