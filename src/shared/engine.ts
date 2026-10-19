// 规则引擎：纯 TS、确定性。整局逻辑写成一个生成器，遇到需要玩家决策时 yield Request，
// 拿到 Answer 后继续。持久化只需保存 config + answers，恢复时重放即可。
import { CHAR_IDS, FINISH, GOLD, SILVER, TRACK_ORDER, playerScore } from './types';
import type {
  AfterRollOption, Answer, CharId, GameConfig, GameEvent, GameState, PlayerState, RaceState, Racer, Request,
} from './types';
import { FIXED_TRACKS, randomSpaces } from './characters';

type Gen<T = void> = Generator<Request, T, Answer>;

export class RaceOver {
  constructor(readonly reason: 'finish' | 'mastermind' | 'lastStanding' | 'loop') {}
}

/** mulberry32 */
class Rng {
  constructor(public s: number) {}
  next(): number {
    let t = (this.s = (this.s + 0x6d2b79f5) | 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(n: number): number {
    return Math.floor(this.next() * n);
  }
  shuffle<T>(a: T[]): T[] {
    for (let i = a.length - 1; i > 0; i--) {
      const j = this.int(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
}

/** 一次移动/瞬移之后要结算的后果 */
interface Conseq {
  owner: Racer | null; // null = 赛道格（最高优先级）
  key: string;
  check(): boolean;
  run(): Gen;
}

interface TurnCtx {
  racer: Racer;
  skipper: Racer | null;
  genius: boolean;
  diceUsed: boolean;
  sigs: Set<string>;
  steps: number;
  /** 本回合已同意跟随的 Suckerfish→目标，之后自动跟随不再询问 */
  follow: Set<string>;
}

export class Engine {
  st: GameState;
  rng: Rng;
  deck: CharId[];
  events: GameEvent[] = [];
  turn: TurnCtx | null = null;
  /** 已发动、等待触发 Scoocher 的能力来源 */
  scoochQ: { r: Racer; p: CharId }[] = [];

  constructor(readonly config: GameConfig) {
    this.rng = new Rng(config.seed >>> 0 || 1);
    this.deck = this.rng.shuffle([...CHAR_IDS]);
    const n = config.seats.length;
    this.st = {
      phase: 'draft',
      players: config.seats.map((s, seat): PlayerState => ({
        seat, name: s.name, ai: s.ai, hand: [], used: [], gold: [], silver: [], bronze: 0,
      })),
      deckCount: this.deck.length,
      pool: [],
      draftOrder: [],
      draftIdx: 0,
      firstSeat: 0,
      race: null,
      results: [],
      perRace: n === 2 ? 2 : 1,
    };
  }

  emit(e: GameEvent) {
    this.events.push(e);
  }

  get race(): RaceState {
    return this.st.race!;
  }

  // ================= 整局 =================

  *run(): Gen {
    const n = this.st.players.length;
    // 选秀
    const f = this.rng.int(n);
    const rounds: number[][] = [];
    if (n === 2) {
      const o = 1 - f;
      rounds.push([f, o, o, f, f, o, o, f], [o, f, f, o, o, f, f, o]);
    } else {
      for (let k = 0; k < 2; k++) {
        const fwd = Array.from({ length: n }, (_, i) => (f + k + i) % n);
        rounds.push([...fwd, ...[...fwd].reverse()]);
      }
    }
    for (let k = 0; k < rounds.length; k++) {
      const order = rounds[k];
      this.st.pool = this.deck.splice(0, order.length);
      this.st.deckCount = this.deck.length;
      this.st.draftOrder = order;
      this.st.draftIdx = 0;
      this.emit({ t: 'draftStart', round: k, pool: [...this.st.pool], order });
      for (let i = 0; i < order.length; i++) {
        this.st.draftIdx = i;
        const seat = order[i];
        const a = yield { kind: 'draft', seat, options: [...this.st.pool] };
        const card = (a as Extract<Answer, { kind: 'draft' }>).card;
        this.st.pool.splice(this.st.pool.indexOf(card), 1);
        this.st.players[seat].hand.push(card);
        this.emit({ t: 'drafted', seat, card });
      }
    }
    this.st.pool = [];
    this.st.draftOrder = [];

    this.st.firstSeat = this.rng.int(n);
    for (let no = 0; no < 4; no++) yield* this.runRace(no);

    this.st.phase = 'end';
    const scores = this.st.players.map(playerScore);
    const max = Math.max(...scores);
    this.emit({ t: 'gameEnd', scores, winners: scores.flatMap((s, i) => (s === max ? [i] : [])) });
  }

  *runRace(no: number): Gen {
    const st = this.st;
    const n = st.players.length;
    st.phase = 'pick';
    const a = (yield { kind: 'pick', seats: st.players.map((p) => p.seat), count: st.perRace }) as Extract<Answer, { kind: 'pick' }>;

    const racers: Racer[] = [];
    for (const p of st.players) {
      for (const card of a.picks[p.seat]) {
        p.hand.splice(p.hand.indexOf(card), 1);
        p.used.push(card);
        racers.push({ idx: racers.length, seat: p.seat, card, power: card, pos: 0, tripped: false, done: 0, turns: 0 });
      }
    }
    const first = racers.find((r) => r.seat === st.firstSeat)!;
    const track = TRACK_ORDER[no];
    const spaces = FIXED_TRACKS[track] ?? randomSpaces(() => this.rng.next());
    st.race = {
      no, track, spaces, racers, current: first.idx, finishers: [], eliminated: [], places: [null, null],
    };
    st.phase = 'race';
    this.emit({ t: 'raceStart', no, track, spaces, racers: racers.map((r) => ({ idx: r.idx, seat: r.seat, card: r.card })), first: first.idx });
    const bronzeBefore = st.players.map((p) => p.bronze);

    let reason: RaceOver['reason'] = 'finish';
    try {
      // 赛前能力，从先手开始
      for (const r of this.orderFrom(first)) yield* this.preRace(r);
      yield* this.turnLoop(first);
    } catch (e) {
      if (!(e instanceof RaceOver)) throw e;
      reason = e.reason;
    }
    this.turn = null;
    this.scoochQ = [];

    // 计分
    const race = this.race;
    const [p1, p2] = race.places;
    if (p1 !== null) st.players[p1].gold.push(GOLD[no]);
    if (p2 !== null) st.players[p2].silver.push(SILVER[no]);
    const winners: GameState['results'][number]['winners'] = [];
    race.finishers.forEach((idx, i) => {
      const r = race.racers[idx];
      if (i < 2) winners.push({ card: r.card, power: r.power, seat: r.seat, place: (i + 1) as 1 | 2 });
    });
    st.results.push({ no, track: race.track, winners });
    this.emit({ t: 'raceEnd', no, places: [p1, p2], gold: GOLD[no], silver: SILVER[no], reason });

    // 下一场先手
    if (n === 2) {
      const gain = st.players.map((p, i) =>
        p.bronze - bronzeBefore[i] + (p1 === i ? GOLD[no] : 0) + (p2 === i ? SILVER[no] : 0));
      st.firstSeat = gain[0] === gain[1] ? this.rng.int(2) : gain[0] < gain[1] ? 0 : 1;
    } else {
      st.firstSeat = this.lastPlaceSeat();
    }
  }

  /** 最落后（或最先被淘汰）的运动员所属玩家；并列取从本场先手起顺时针最近的 */
  lastPlaceSeat(): number {
    const race = this.race;
    if (race.eliminated.length) return race.racers[race.eliminated[0]].seat;
    const onTrack = race.racers.filter((r) => r.done === 0);
    if (!onTrack.length) return this.st.firstSeat;
    const min = Math.min(...onTrack.map((r) => r.pos));
    const n = this.st.players.length;
    const tied = onTrack.filter((r) => r.pos === min).map((r) => r.seat);
    tied.sort((a, b) => ((a - this.st.firstSeat + n) % n) - ((b - this.st.firstSeat + n) % n));
    return tied[0];
  }

  *preRace(r: Racer, via?: CharId): Gen {
    const p = r.power;
    if (p === 'egg' && !via) {
      const options = this.deck.splice(0, 3);
      this.st.deckCount = this.deck.length;
      if (!options.length) return;
      const a = (yield { kind: 'egg', seat: r.seat, racer: r.idx, options }) as Extract<Answer, { kind: 'egg' }>;
      r.power = a.card;
      this.emit({ t: 'powerSwap', racer: r.idx, power: a.card, via: 'egg' });
      yield* this.preRace(r, 'egg');
    } else if (p === 'twin' && via !== 'twin') {
      const options = [...new Set(this.st.results.flatMap((x) => x.winners.filter((w) => w.place === 1).map((w) => w.card)))];
      if (!options.length) return;
      const a = (yield { kind: 'twin', seat: r.seat, racer: r.idx, options }) as Extract<Answer, { kind: 'twin' }>;
      if (!a.card) return;
      const w = this.st.results.flatMap((x) => x.winners).find((x) => x.card === a.card && x.place === 1)!;
      r.power = w.power;
      this.emit({ t: 'powerSwap', racer: r.idx, power: w.power, via: 'twin' });
      if (w.power) yield* this.preRace(r, 'twin');
    } else if (p === 'sisyphus') {
      this.emit({ t: 'power', racer: r.idx, power: 'sisyphus', note: 'chips' });
      this.bronze(r.seat, 4);
    }
  }

  *turnLoop(first: Racer): Gen {
    const racers = this.race.racers;
    let cur: Racer | undefined = first;
    let turns = 0;
    while (cur) {
      // 兜底：能力互相牵制导致没人能冲线时（如两个催眠师轮流把人拉回摔倒格），比赛结束，剩余名次无人得分（D19）
      if (++turns > 400) throw new RaceOver('loop');
      this.race.current = cur.idx;
      const t: TurnCtx = { racer: cur, skipper: null, genius: false, diceUsed: false, sigs: new Set(), steps: 0, follow: new Set() };
      this.turn = t;
      yield* this.takeTurn(cur);
      this.checkEnd();
      if (t.skipper && t.skipper.done === 0) cur = t.skipper;
      else if (!(t.genius && cur.done === 0)) cur = this.nextActive(cur);
    }
    // 没有可行动的运动员（理论上 checkEnd 已经结束比赛）
    throw new RaceOver('lastStanding');
  }

  nextActive(r: Racer): Racer | undefined {
    const rs = this.race.racers;
    for (let k = 1; k <= rs.length; k++) {
      const x = rs[(r.idx + k) % rs.length];
      if (x.done === 0) return x;
    }
    return undefined;
  }

  // ================= 辅助判断 =================

  active(): Racer[] {
    return this.race.racers.filter((r) => r.done === 0);
  }

  powerOf(r: Racer): CharId | null {
    if (r.done !== 0) return null;
    if (r.power !== 'copycat') return r.power;
    const act = this.active();
    const max = Math.max(...act.map((x) => x.pos));
    const leaders = this.byPriority(act.filter((x) => x.pos === max && x !== r && x.power !== 'copycat'));
    // 自己独自领先时没有能力（规则书未写，见 rules-decisions）
    return leaders.length ? leaders[0].power : null;
  }

  has(r: Racer, p: CharId): boolean {
    return this.powerOf(r) === p;
  }

  withPower(p: CharId): Racer[] {
    return this.byPriority(this.active().filter((r) => this.powerOf(r) === p));
  }

  at(pos: number, except?: Racer): Racer[] {
    return this.active().filter((r) => r.pos === pos && r !== except);
  }

  /** 当前行动玩家优先，然后顺时针 */
  byPriority(rs: Racer[]): Racer[] {
    const n = this.st.players.length;
    const cs = this.race.racers[this.race.current].seat;
    const rank = (r: Racer) => ((r.seat - cs + n) % n) * 100 + r.idx;
    return [...rs].sort((a, b) => rank(a) - rank(b));
  }

  orderFrom(first: Racer): Racer[] {
    const rs = this.race.racers;
    return rs.map((_, k) => rs[(first.idx + k) % rs.length]);
  }

  aloneInLead(r: Racer): boolean {
    const act = this.active();
    const max = Math.max(...act.map((x) => x.pos));
    return r.pos === max && act.filter((x) => x.pos === max).length === 1;
  }

  lastPlace(): Racer[] {
    const act = this.active();
    const min = Math.min(...act.map((x) => x.pos));
    return act.filter((x) => x.pos === min);
  }

  // ================= 原子效果 =================

  bronze(seat: number, delta: number) {
    const p = this.st.players[seat];
    const d = Math.max(delta, -p.bronze);
    if (!d) return;
    p.bronze += d;
    this.emit({ t: 'bronze', seat, delta: d });
  }

  trip(r: Racer) {
    if (r.done !== 0 || r.tripped) return;
    r.tripped = true;
    this.emit({ t: 'trip', racer: r.idx });
  }

  /** 能力发动：记事件，并让 Scoocher 稍后挪一格 */
  power(r: Racer, p: CharId, note?: string) {
    this.emit({ t: 'power', racer: r.idx, power: p, note });
    this.scoochQ.push({ r, p });
  }

  *flushScooch(): Gen {
    while (this.scoochQ.length) {
      const { r: src, p } = this.scoochQ.shift()!;
      for (const s of this.withPower('scoocher')) {
        if (s === src || s.done !== 0) continue;
        if (!this.guard('scooch' + s.idx)) continue;
        // 吸盘鱼跟随 ↔ 挪步者挪动 会无限往复：同一对每回合只结算一次（D18）
        if (p === 'suckerfish' && this.turn) {
          const k = `sf${src.idx}>${s.idx}`;
          if (this.turn.follow.has(k)) continue;
          this.turn.follow.add(k);
        }
        // Scoocher 自己挪动不再触发其他 Scoocher（模仿猫复制挪步者时会互相推到终点，见 D17）
        this.emit({ t: 'power', racer: s.idx, power: 'scoocher' });
        yield* this.move([{ r: s, d: 1 }]);
      }
    }
  }

  /** 循环保护：同一回合内同一触发在完全相同的局面下第二次出现时跳过 */
  guard(key: string): boolean {
    const t = this.turn;
    if (!t) return true;
    if (++t.steps > 3000) throw new RaceOver('loop');
    const sig = key + '|' + this.race.racers.map((r) => `${r.pos}${r.tripped ? 't' : ''}${r.done}`).join(',');
    if (t.sigs.has(sig)) return false;
    t.sigs.add(sig);
    return true;
  }

  roll(r: Racer, reroll = false): number {
    const v = this.rng.int(6) + 1;
    this.emit({ t: 'roll', racer: r.idx, value: v, reroll: reroll || undefined });
    return v;
  }

  finish(r: Racer) {
    const race = this.race;
    if (r.done !== 0) return;
    const place = (race.finishers.length + 1) as 1 | 2;
    r.pos = FINISH;
    r.done = place;
    r.tripped = false;
    race.finishers.push(r.idx);
    race.places[place - 1] = r.seat;
    this.emit({ t: 'finish', racer: r.idx, place });
    if (place === 1) {
      // Mastermind：第一名出现时，猜中者拿第 2 名，比赛立即结束
      for (const m of this.byPriority(race.racers.filter((x) => x.prediction !== undefined))) {
        const hasMM = m === r ? (m.power === 'mastermind') : this.has(m, 'mastermind');
        if (hasMM && m.prediction === r.idx) {
          this.emit({ t: 'power', racer: m.idx, power: 'mastermind', note: 'hit' });
          if (m !== r) {
            m.done = 2;
            m.tripped = false;
            race.finishers.push(m.idx);
          }
          race.places[1] = m.seat;
          throw new RaceOver('mastermind');
        }
      }
    }
    if (place === 2) throw new RaceOver('finish');
  }

  eliminate(r: Racer, by: Racer) {
    if (r.done !== 0) return;
    r.done = 'out';
    r.tripped = false;
    this.race.eliminated.push(r.idx);
    this.emit({ t: 'eliminate', racer: r.idx, by: by.idx });
    this.checkEnd();
  }

  /** 场上只剩 1 人（或没人）时结束 */
  checkEnd() {
    const race = this.race;
    const act = this.active();
    if (act.length > 1) return;
    if (act.length === 1) {
      const r = act[0];
      const place = (race.finishers.length + 1) as 1 | 2;
      r.done = place;
      r.tripped = false;
      race.finishers.push(r.idx);
      race.places[place - 1] = r.seat;
      this.emit({ t: 'finish', racer: r.idx, place });
    }
    throw new RaceOver('lastStanding');
  }

  // ================= 回合 =================

  *takeTurn(r: Racer): Gen {
    this.emit({ t: 'turn', racer: r.idx });
    const startPos = r.pos;
    const firstTurn = r.turns === 0;
    r.turns++;
    const p = this.powerOf(r);
    const hareSkip = p === 'hare' && this.aloneInLead(r);
    const blimp = p === 'blimp' ? (r.pos < 15 ? 3 : -1) : 0;

    // ---- 主移动前 ----
    if (p === 'mastermind' && firstTurn) {
      const options = this.active().map((x) => x.idx);
      const a = (yield { kind: 'mastermind', seat: r.seat, racer: r.idx, options }) as Extract<Answer, { kind: 'mastermind' }>;
      r.prediction = a.target;
      this.emit({ t: 'predict', racer: r.idx, target: a.target });
      this.power(r, 'mastermind', 'predict');
    } else if (p === 'lovableloser') {
      const last = this.lastPlace();
      if (last.length === 1 && last[0] === r) {
        this.power(r, 'lovableloser');
        this.bronze(r.seat, 1);
      }
    } else if (p === 'cheerleader') {
      const targets = this.lastPlace();
      const a = (yield { kind: 'cheer', seat: r.seat, racer: r.idx, targets: targets.map((x) => x.idx) }) as Extract<Answer, { kind: 'cheer' }>;
      if (a.use) {
        this.power(r, 'cheerleader');
        yield* this.move(targets.map((x) => ({ r: x, d: 2 })));
        if (r.done === 0) yield* this.move([{ r, d: 1 }]);
      }
    } else if (p === 'hypnotist') {
      const options = this.active().filter((x) => x !== r && x.pos !== r.pos).map((x) => x.idx);
      if (options.length) {
        const a = (yield { kind: 'hypnotist', seat: r.seat, racer: r.idx, options }) as Extract<Answer, { kind: 'hypnotist' }>;
        if (a.target !== null) {
          this.power(r, 'hypnotist');
          yield* this.warp([{ r: this.race.racers[a.target], to: r.pos }]);
        }
      }
    } else if (p === 'partyanimal') {
      const movers = this.active().filter((x) => x !== r && x.pos !== r.pos);
      if (movers.length) {
        this.power(r, 'partyanimal', 'pull');
        yield* this.move(movers.map((x) => ({ r: x, d: Math.sign(r.pos - x.pos) })));
      }
    } else if (p === 'thirdwheel') {
      const counts = new Map<number, number>();
      for (const x of this.active()) counts.set(x.pos, (counts.get(x.pos) ?? 0) + 1);
      const options = [...counts].filter(([pos, c]) => c === 2 && pos !== r.pos).map(([pos]) => pos).sort((a, b) => a - b);
      if (options.length) {
        const a = (yield { kind: 'thirdwheel', seat: r.seat, racer: r.idx, options }) as Extract<Answer, { kind: 'thirdwheel' }>;
        if (a.space !== null) {
          this.power(r, 'thirdwheel');
          yield* this.warp([{ r, to: a.space }]);
        }
      }
    }
    yield* this.flushScooch();

    // ---- 主移动 ----
    if (r.done === 0) {
      if (hareSkip) {
        this.power(r, 'hare', 'skip');
        this.emit({ t: 'skip', racer: r.idx, reason: 'hare' });
      } else if (r.tripped) {
        r.tripped = false;
        this.emit({ t: 'standUp', racer: r.idx });
      } else {
        yield* this.mainMove(r, blimp);
      }
      yield* this.flushScooch();
    }

    // ---- 回合结束：Heckler ----
    if (r.done === 0 && Math.abs(r.pos - startPos) <= 1) {
      for (const h of this.withPower('heckler')) {
        if (h.done !== 0 || !this.guard('heckle' + h.idx)) continue;
        this.power(h, 'heckler');
        yield* this.move([{ r: h, d: 2 }]);
        yield* this.flushScooch();
      }
    }
  }

  *mainMove(r: Racer, blimp: number): Gen {
    const t = this.turn!;
    const p = this.powerOf(r);
    const swap = p === 'flipflop' ? this.active().filter((x) => x !== r).map((x) => x.idx) : [];
    const a = (yield {
      kind: 'main', seat: r.seat, racer: r.idx, legs: p === 'legs', swap, predict: p === 'genius',
    }) as Extract<Answer, { kind: 'main' }>;

    if (a.mode === 'swap') {
      const o = this.race.racers[a.target];
      const [rp, op] = [r.pos, o.pos];
      this.power(r, 'flipflop');
      yield* this.warp([{ r, to: op }, { r: o, to: rp }]);
      return;
    }

    let base: number;
    let rocketTrip = false;
    if (a.mode === 'legs') {
      this.power(r, 'legs');
      base = 5;
    } else {
      let v = this.roll(r);
      let magicLeft = p === 'magician' ? 2 : 0;
      let choice: AfterRollOption = 'keep';
      for (;;) {
        const dicemongers = this.withPower('dicemonger');
        const options: AfterRollOption[] = ['keep'];
        if (magicLeft > 0 || (dicemongers.length && !t.diceUsed)) options.push('reroll');
        if (p === 'alchemist' && v <= 2) options.push('alchemist');
        if (p === 'rocket') options.push('rocket');
        if (options.length === 1) break;
        const b = (yield { kind: 'afterRoll', seat: r.seat, racer: r.idx, value: v, options }) as Extract<Answer, { kind: 'afterRoll' }>;
        choice = b.choice;
        if (choice !== 'reroll') break;
        if (magicLeft > 0) {
          magicLeft--;
          this.power(r, 'magician');
        } else {
          t.diceUsed = true;
          for (const d of dicemongers) {
            if (d === r) continue;
            this.power(d, 'dicemonger');
            yield* this.move([{ r: d, d: 1 }]);
          }
        }
        yield* this.flushScooch();
        if (r.done !== 0) return;
        v = this.roll(r, true);
        choice = 'keep';
      }
      base = v;
      if (choice === 'alchemist') {
        this.power(r, 'alchemist');
        base = 4;
      } else if (choice === 'rocket') {
        this.power(r, 'rocket');
        base = v * 2;
        rocketTrip = true;
      }
      if (a.predict !== undefined) this.emit({ t: 'predict', racer: r.idx, target: a.predict });

      // ---- 骰面触发 ----
      if (p === 'sisyphus' && v === 6) {
        this.power(r, 'sisyphus', 'six');
        yield* this.warp([{ r, to: 0 }]);
        this.bronze(r.seat, -1);
        return;
      }
      let cancelled = false;
      for (const x of this.byPriority(this.active())) {
        const xp = this.powerOf(x);
        if (xp === 'inchworm' && x !== r && v === 1) {
          cancelled = true;
          this.emit({ t: 'skip', racer: r.idx, reason: 'inchworm' });
          this.power(x, 'inchworm');
          yield* this.move([{ r: x, d: 1 }]);
        } else if (xp === 'skipper' && v === 1 && !t.skipper) {
          t.skipper = x;
          this.power(x, 'skipper');
        } else if (xp === 'lackey' && x !== r && v === 6) {
          this.power(x, 'lackey');
          yield* this.move([{ r: x, d: 2 }]);
        }
      }
      if (p === 'genius' && a.predict === v) {
        t.genius = true;
        this.power(r, 'genius');
      }
      yield* this.flushScooch();
      if (cancelled || r.done !== 0) return;
    }

    // ---- 距离修正 ----
    let dist = base;
    for (const c of this.withPower('coach')) {
      if (c.pos === r.pos) {
        dist += 1;
        this.power(c, 'coach');
      }
    }
    for (const g of this.withPower('gunk')) {
      if (g !== r) {
        dist -= 1;
        this.power(g, 'gunk');
      }
    }
    if (p === 'hare') {
      dist += 2;
      this.power(r, 'hare');
    }
    if (blimp) {
      dist += blimp;
      this.power(r, 'blimp');
    }
    if (p === 'partyanimal') {
      const k = this.at(r.pos, r).length;
      if (k) {
        dist += k;
        this.power(r, 'partyanimal', 'bonus');
      }
    }
    yield* this.move([{ r, d: dist }], true);
    if (rocketTrip) this.trip(r);
  }

  // ================= 移动与结算 =================

  /** 同时移动一组运动员（单人移动也走这里） */
  *move(list: { r: Racer; d: number }[], main = false): Gen {
    list = list.filter((m) => m.d !== 0 && m.r.done === 0);
    if (!list.length) return;
    const racers = this.race.racers;
    const before = new Map(racers.map((r) => [r, r.pos]));
    const group = new Set(list.map((m) => m.r));
    const occupied = new Set(this.active().filter((x) => !group.has(x)).map((x) => x.pos));
    const sticklers = this.withPower('stickler');

    const moved: Racer[] = [];
    for (const { r, d } of list) {
      const leap = this.has(r, 'leaptoad');
      const dir = Math.sign(d);
      let steps = Math.abs(d);
      let pos = r.pos;
      const path: number[] = [];
      let hops = 0;
      while (steps > 0) {
        pos += dir;
        if (pos <= 0) { pos = 0; path.push(0); break; }
        if (pos >= FINISH) { pos = FINISH + Math.max(0, steps - 1); path.push(FINISH); break; }
        path.push(pos);
        if (leap && occupied.has(pos)) { hops++; continue; }
        steps--;
      }
      if (pos > FINISH && sticklers.some((s) => s !== r)) {
        this.emit({ t: 'blocked', racer: r.idx });
        this.power(sticklers.find((s) => s !== r)!, 'stickler');
        continue;
      }
      if (pos === r.pos) continue;
      r.pos = Math.min(pos, FINISH);
      this.emit({ t: 'move', racer: r.idx, path, main: main || undefined });
      for (let i = 0; i < hops; i++) this.power(r, 'leaptoad');
      moved.push(r);
    }
    if (!moved.length) {
      yield* this.flushScooch();
      return;
    }

    // Suckerfish：和移动者同格出发的可以跟到新位置
    const followers: Racer[] = [];
    const arrivers = new Set<Racer>();
    for (const m of moved) {
      for (const s of this.withPower('suckerfish')) {
        if (group.has(s) || followers.includes(s) || s.pos !== before.get(m) || s === m) continue;
        const fk = `${s.idx}>${m.idx}`;
        const t = this.turn;
        let use = !!t?.follow.has(fk);
        if (!use) use = ((yield { kind: 'follow', seat: s.seat, racer: s.idx, target: m.idx, to: m.pos }) as Extract<Answer, { kind: 'follow' }>).use;
        if (!use || s.done !== 0) continue;
        t?.follow.add(fk);
        const from = s.pos;
        s.pos = m.pos;
        const path: number[] = [];
        for (let p = from; p !== s.pos; ) path.push((p += Math.sign(s.pos - from)));
        this.emit({ t: 'move', racer: s.idx, path });
        this.power(s, 'suckerfish');
        followers.push(s);
      }
    }
    const all = [...moved, ...followers];
    for (const r of all) arrivers.add(r);

    // 冲线（被跟随者名次在前）
    for (const m of moved) {
      if (m.pos >= FINISH) this.finish(m);
      for (const s of followers) if (s.pos >= FINISH && s.done === 0 && s.pos === m.pos) this.finish(s);
    }

    // Huge Baby：除起点外没人能和它同格
    this.babyPlace(arrivers);

    // 经过判定
    const cons: Conseq[] = [];
    for (const m of all) {
      const b = before.get(m)!;
      const passed = racers
        .filter((o) => o !== m && o.done !== 'out' && before.get(o)! < FINISH)
        .filter((o) => (b < before.get(o)! && m.pos > o.pos) || (b > before.get(o)! && m.pos < o.pos))
        .sort((x, y) => (m.pos > b ? before.get(x)! - before.get(y)! : before.get(y)! - before.get(x)!));
      for (const o of passed) {
        if (this.has(o, 'banana')) {
          const self = this;
          cons.push({
            owner: o, key: `banana${o.idx}>${m.idx}`,
            check: () => this.has(o, 'banana') && m.done === 0,
            *run() { self.power(o, 'banana'); self.trip(m); },
          });
        }
        if (this.has(m, 'centaur')) {
          const self = this;
          cons.push({
            owner: m, key: `centaur${m.idx}>${o.idx}`,
            check: () => o.done === 0,
            *run() { self.power(m, 'centaur'); yield* self.move([{ r: o, d: -2 }]); },
          });
        }
      }
    }
    cons.push(...this.stopConseqs(arrivers));
    yield* this.resolve(cons);
  }

  /** 瞬移：不算移动，但算停下 */
  *warp(list: { r: Racer; to: number }[]): Gen {
    const arrivers = new Set<Racer>();
    for (const { r, to } of list) {
      if (r.done !== 0) continue;
      r.pos = to;
      this.emit({ t: 'warp', racer: r.idx, to });
      arrivers.add(r);
    }
    this.babyPlace(arrivers);
    yield* this.resolve(this.stopConseqs(arrivers));
  }

  /** 把和 Huge Baby 同格的人放到它身后一格（不算移动、算停下），会加入 arrivers */
  babyPlace(arrivers: Set<Racer>) {
    for (const h of this.withPower('hugebaby')) {
      if (h.pos === 0) continue;
      const others = this.at(h.pos, h);
      if (!others.length) continue;
      this.power(h, 'hugebaby');
      for (const o of others) {
        o.pos = h.pos - 1;
        this.emit({ t: 'place', racer: o.idx, to: o.pos });
        arrivers.add(o);
      }
    }
  }

  /** 停格后果：赛道格、Romantic、M.O.U.T.H.、Baba Yaga、Duelist */
  stopConseqs(arrivers: Set<Racer>): Conseq[] {
    const out: Conseq[] = [];
    const self = this;
    const spaces = this.race.spaces;
    for (const a of arrivers) {
      if (a.done !== 0) continue;
      const pos = a.pos;
      const here = () => a.done === 0 && a.pos === pos;
      /** 和 a 同格、且不是同组同时到达的人 */
      const mates = () => this.at(pos, a).filter((o) => !arrivers.has(o));
      const eff = spaces[pos];
      if (eff) {
        out.push({
          owner: null, key: `space${a.idx}@${pos}`, check: here,
          *run() {
            self.emit({ t: 'space', racer: a.idx, space: pos, kind: eff.kind });
            if (eff.kind === 'star') self.bronze(a.seat, 1);
            else if (eff.kind === 'trip') self.trip(a);
            else if (eff.kind === 'arrow') yield* self.move([{ r: a, d: eff.delta }]);
            else yield* self.warp([{ r: a, to: eff.to }]);
          },
        });
      }
      // Romantic：停下后该格恰好 2 人（另一人不是同组到达）
      for (const R of this.withPower('romantic')) {
        const ok = () => {
          if (!here() || !this.has(R, 'romantic')) return false;
          const others = this.at(pos, a);
          return others.length === 1 && !arrivers.has(others[0]);
        };
        if (ok()) out.push({
          owner: R, key: `romantic${R.idx}:${a.idx}@${pos}`, check: ok,
          *run() { self.power(R, 'romantic'); yield* self.move([{ r: R, d: 2 }]); },
        });
      }
      // M.O.U.T.H.：我停到恰好有另一人的格
      if (this.has(a, 'mouth')) {
        const ok = () => here() && this.has(a, 'mouth') && this.at(pos, a).length === 1 && mates().length === 1;
        if (ok()) out.push({
          owner: a, key: `mouth${a.idx}@${pos}`, check: ok,
          *run() { const v = self.at(pos, a)[0]; self.power(a, 'mouth'); self.eliminate(v, a); },
        });
      }
      // Baba Yaga：停到我格上的人摔倒；我停到别人格上，他们摔倒
      if (this.has(a, 'babayaga')) {
        const ok = () => here() && this.has(a, 'babayaga') && mates().some((o) => !o.tripped);
        if (ok()) out.push({
          owner: a, key: `baba${a.idx}@${pos}`, check: ok,
          *run() { self.power(a, 'babayaga'); for (const o of mates()) self.trip(o); },
        });
      }
      for (const y of mates()) {
        if (!this.has(y, 'babayaga')) continue;
        const ok = () => here() && y.pos === pos && this.has(y, 'babayaga') && !a.tripped;
        out.push({ owner: y, key: `baba${y.idx}>${a.idx}`, check: ok, *run() { self.power(y, 'babayaga'); self.trip(a); } });
      }
      // Duelist：有人和我同格
      const duel = (d: Racer, o: Racer) => {
        const ok = () => here() && d.done === 0 && o.done === 0 && d.pos === o.pos && this.has(d, 'duelist');
        out.push({ owner: d, key: `duel${d.idx}:${o.idx}@${pos}`, check: ok, run: () => this.duel(d, o) });
      };
      if (this.has(a, 'duelist')) for (const o of mates()) duel(a, o);
      for (const y of mates()) if (this.has(y, 'duelist')) duel(y, a);
    }
    return out;
  }

  *duel(d: Racer, o: Racer): Gen {
    const a = (yield { kind: 'duel', seat: d.seat, racer: d.idx, target: o.idx }) as Extract<Answer, { kind: 'duel' }>;
    if (!a.use) return;
    this.power(d, 'duelist');
    const dv = this.rng.int(6) + 1;
    const ov = this.rng.int(6) + 1;
    const winner = dv >= ov ? d : o;
    this.emit({ t: 'duelRoll', a: d.idx, av: dv, b: o.idx, bv: ov, winner: winner.idx });
    yield* this.move([{ r: winner, d: 2 }]);
  }

  /** 按优先级结算后果；每个后果执行前重新检查条件（机会不等人） */
  *resolve(cons: Conseq[]): Gen {
    const order = (c: Conseq) => (c.owner ? 1 : 0);
    const owners = this.byPriority(cons.filter((c) => c.owner).map((c) => c.owner!));
    const rank = (c: Conseq) => (c.owner ? owners.indexOf(c.owner) : -1);
    const sorted = cons.map((c, i) => ({ c, i })).sort((x, y) => order(x.c) - order(y.c) || rank(x.c) - rank(y.c) || x.i - y.i);
    for (const { c } of sorted) {
      if (!c.check() || !this.guard(c.key)) continue;
      yield* c.run();
      yield* this.flushScooch();
    }
    yield* this.flushScooch();
  }
}

// ================= 对外 API =================

export class Game {
  readonly answers: Answer[] = [];
  pending: Request | null = null;
  private engine: Engine;
  private gen: Gen;
  private started = false;

  private constructor(readonly config: GameConfig) {
    this.engine = new Engine(config);
    this.gen = this.engine.run();
  }

  static create(config: GameConfig): Game {
    const g = new Game(config);
    g.step(undefined);
    return g;
  }

  static restore(config: GameConfig, answers: Answer[]): Game {
    const g = Game.create(config);
    for (const a of answers) {
      const r = g.answer(a);
      if (!r.ok) throw new Error('replay failed: ' + r.error);
    }
    g.engine.events = [];
    return g;
  }

  get state(): GameState {
    return this.engine.st;
  }

  get seq(): number {
    return this.answers.length;
  }

  takeEvents(): GameEvent[] {
    const e = this.engine.events;
    this.engine.events = [];
    return e;
  }

  answer(a: Answer): { ok: true; events: GameEvent[] } | { ok: false; error: string } {
    const req = this.pending;
    if (!req) return { ok: false, error: '游戏已结束' };
    const err = validate(this.engine, req, a);
    if (err) return { ok: false, error: err };
    this.answers.push(a);
    this.step(a);
    return { ok: true, events: this.takeEvents() };
  }

  private step(a: Answer | undefined) {
    const r = this.started ? this.gen.next(a!) : this.gen.next();
    this.started = true;
    this.pending = r.done ? null : r.value;
  }
}

function validate(e: Engine, req: Request, a: Answer): string | null {
  if (a.kind !== req.kind) return '决策类型不匹配';
  const racers = e.st.race?.racers ?? [];
  const live = (i: number) => racers[i]?.done === 0;
  switch (req.kind) {
    case 'draft':
      return req.options.includes((a as { card: CharId }).card) ? null : '不能选这张牌';
    case 'pick': {
      const picks = (a as Extract<Answer, { kind: 'pick' }>).picks;
      for (const seat of req.seats) {
        const cs = picks?.[seat];
        const hand = e.st.players[seat].hand;
        if (!Array.isArray(cs) || cs.length !== req.count || new Set(cs).size !== cs.length || cs.some((c) => !hand.includes(c))) {
          return `座位 ${seat + 1} 的出场选择无效`;
        }
      }
      return null;
    }
    case 'egg':
      return req.options.includes((a as { card: CharId }).card) ? null : '无效选择';
    case 'twin': {
      const c = (a as { card: CharId | null }).card;
      return c === null || req.options.includes(c) ? null : '无效选择';
    }
    case 'mastermind':
      return req.options.includes((a as { target: number }).target) ? null : '无效目标';
    case 'main': {
      const m = a as Extract<Answer, { kind: 'main' }>;
      if (m.mode === 'legs') return req.legs ? null : '不能使用大长腿';
      if (m.mode === 'swap') return req.swap.includes(m.target) && live(m.target) ? null : '无效交换目标';
      if (m.mode === 'roll') {
        if (m.predict === undefined) return null;
        return req.predict && Number.isInteger(m.predict) && m.predict >= 1 && m.predict <= 6 ? null : '无效预测';
      }
      return '无效主移动';
    }
    case 'afterRoll':
      return req.options.includes((a as { choice: AfterRollOption }).choice) ? null : '无效选择';
    case 'cheer':
    case 'duel':
    case 'follow':
      return typeof (a as { use: boolean }).use === 'boolean' ? null : '无效选择';
    case 'hypnotist': {
      const t = (a as { target: number | null }).target;
      return t === null || req.options.includes(t) ? null : '无效目标';
    }
    case 'thirdwheel': {
      const s = (a as { space: number | null }).space;
      return s === null || req.options.includes(s) ? null : '无效格子';
    }
  }
}
