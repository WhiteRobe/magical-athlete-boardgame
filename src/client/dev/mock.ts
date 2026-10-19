import { Game } from '../../shared/engine';
import { aiAnswer, aiPick } from '../../shared/ai';
import type { Answer, CharId, GameConfig, GameEvent, Request } from '../../shared/types';
import type { ClientMsg, ServerMsg, PendingView } from '../../shared/protocol';

type GameMsg = Extract<ServerMsg, { type: 'game' }>;

/** 本地模拟房间：用真引擎在浏览器里跑一局，AI 立即作答。仅开发用。 */
export class LocalRoom {
  g: Game;
  private picks: Record<number, CharId[]> = {};
  constructor(private cfg: GameConfig, public you: number | null, private onMsg: (m: GameMsg) => void, private stepDelay = 0) {
    this.g = Game.create(cfg);
  }

  /** 开发用：所有座位（含你）由 AI 代答，快进到 stop 成立（事件丢弃，start() 时全量同步） */
  fastForward(stop: (g: Game) => boolean) {
    this.g.takeEvents();
    let guard = 0;
    while (this.g.pending && !stop(this.g) && guard++ < 20000) {
      const req = this.g.pending;
      if (req.kind === 'pick') {
        const picks: Record<number, CharId[]> = {};
        for (const s of req.seats) picks[s] = aiPick(this.g, s, req.count);
        this.g.answer({ kind: 'pick', picks });
      } else this.g.answer(aiAnswer(this.g, req));
    }
    return this;
  }

  start() {
    const events = this.g.takeEvents();
    this.emit([], true);
    setTimeout(() => {
      this.emit(events, false);
      this.advance();
    }, 50);
  }

  private pendingView(): PendingView | null {
    const req = this.g.pending;
    if (!req) return null;
    const deadline = Date.now() + 45000;
    if (req.kind === 'pick') {
      if (this.you !== null && !(this.you in this.picks)) return { mine: true, req, deadline };
      return { mine: false, kind: 'pick', seat: null, deadline };
    }
    if (req.seat === this.you) return { mine: true, req, deadline };
    return { mine: false, kind: req.kind, seat: req.seat, deadline };
  }

  private emit(events: GameEvent[], full: boolean) {
    this.onMsg({
      type: 'game',
      seq: this.g.seq,
      events,
      full,
      state: structuredClone(this.g.state),
      pending: this.pendingView(),
      picked: Object.keys(this.picks).map(Number),
      you: this.you,
    });
  }

  private isHuman(req: Request) {
    return req.kind !== 'pick' && req.seat === this.you;
  }

  /** 让 AI 作答直到轮到真人 */
  advance() {
    const events: GameEvent[] = [];
    let guard = 0;
    while (this.g.pending && guard++ < 5000) {
      const req = this.g.pending;
      if (req.kind === 'pick') {
        for (const s of req.seats) if (s !== this.you && !this.picks[s]) this.picks[s] = aiPick(this.g, s, req.count);
        if (req.seats.some((s) => !this.picks[s])) break;
        const r = this.g.answer({ kind: 'pick', picks: this.picks });
        this.picks = {};
        if (r.ok) events.push(...r.events);
        continue;
      }
      if (this.isHuman(req)) break;
      const r = this.g.answer(aiAnswer(this.g, req));
      if (!r.ok) throw new Error(r.error);
      events.push(...r.events);
      if (this.stepDelay && events.length > 40) break;
    }
    this.emit(events, false);
    if (this.stepDelay && this.g.pending && !(this.g.pending.kind !== 'pick' && this.g.pending.seat === this.you)) {
      setTimeout(() => this.advance(), this.stepDelay);
    }
  }

  handle(m: ClientMsg) {
    if (m.type === 'answer') {
      const r = this.g.answer(m.answer as Answer);
      if (!r.ok) return console.warn(r.error);
      this.emit(r.events, false);
      setTimeout(() => this.advance(), 20);
    } else if (m.type === 'pick' && this.you !== null) {
      this.picks[this.you] = m.cards;
      this.emit([], false);
      setTimeout(() => this.advance(), 20);
    } else if (m.type === 'rematch') {
      this.g = Game.create({ ...this.cfg, seed: (this.cfg.seed + 1) >>> 0 });
      this.picks = {};
      this.start();
    }
  }
}
