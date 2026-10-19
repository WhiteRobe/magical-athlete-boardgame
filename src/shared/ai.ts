// AI 决策。普通 AI 用简单启发式；简单 AI 随机。必须确定性（不用 Math.random），
// 随机性由局面推出的伪随机数提供，保证服务端重放一致（AI 回答本身也会写入日志）。
import { CHARS } from './characters';
import type { Game } from './engine';
import { CHAR_IDS, FINISH } from './types';
import type { AfterRollOption, Answer, CharId, GameState, Racer, Request } from './types';

function hash(...xs: number[]): number {
  let h = 2166136261;
  for (const x of xs) {
    h ^= x;
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

function pickRand<T>(g: Game, arr: T[], salt = 0): T {
  return arr[Math.floor(hash(g.config.seed, g.seq, salt) * arr.length)];
}

const tier = (c: CharId) => CHARS[c].tier;

function racerOf(s: GameState, idx: number): Racer {
  return s.race!.racers[idx];
}

/** 超时默认：保守选择 */
export function defaultAnswer(g: Game, req: Request): Answer {
  switch (req.kind) {
    case 'draft': return { kind: 'draft', card: pickRand(g, req.options) };
    case 'pick': return { kind: 'pick', picks: Object.fromEntries(req.seats.map((s) => [s, aiPick(g, s, req.count, 'easy')])) };
    case 'egg': return { kind: 'egg', card: req.options[0] };
    case 'twin': return { kind: 'twin', card: req.options[0] ?? null };
    case 'mastermind': return { kind: 'mastermind', target: req.options[0] };
    case 'main': return req.legs ? { kind: 'main', mode: 'legs' } : { kind: 'main', mode: 'roll' };
    case 'afterRoll': return { kind: 'afterRoll', choice: req.options.includes('alchemist') ? 'alchemist' : 'keep' };
    case 'cheer': return { kind: 'cheer', use: false };
    case 'hypnotist': return { kind: 'hypnotist', target: null };
    case 'thirdwheel': return { kind: 'thirdwheel', space: null };
    case 'duel': return { kind: 'duel', use: true };
    case 'follow': return { kind: 'follow', use: racerOf(g.state, req.racer).pos < req.to };
  }
}

export function aiPick(g: Game, seat: number, count: number, level = g.state.players[seat].ai ?? 'normal'): CharId[] {
  const hand = [...g.state.players[seat].hand];
  if (level === 'easy') {
    const out: CharId[] = [];
    for (let i = 0; i < count; i++) out.push(hand.splice(Math.floor(hash(g.config.seed, g.seq, seat, i) * hand.length), 1)[0]);
    return out;
  }
  // 强的留到后面：按强度升序，带一点随机
  const w = (c: CharId) => tier(c) + hash(g.config.seed, seat, CHAR_IDS.indexOf(c)) * 1.5;
  hand.sort((a, b) => w(a) - w(b));
  return hand.slice(0, count);
}

export function aiAnswer(g: Game, req: Request): Answer {
  const s = g.state;
  const seat = req.kind === 'pick' ? -1 : req.seat;
  const level = seat >= 0 ? s.players[seat].ai ?? 'normal' : 'normal';
  if (req.kind === 'pick') {
    return { kind: 'pick', picks: Object.fromEntries(req.seats.map((x) => [x, aiPick(g, x, req.count)])) };
  }
  if (level === 'easy') return easy(g, req);

  const race = s.race;
  const me = race && 'racer' in req ? racerOf(s, req.racer) : null;
  const others = race ? race.racers.filter((r) => r.done === 0 && r !== me) : [];

  switch (req.kind) {
    case 'draft': {
      const best = [...req.options].sort((a, b) => tier(b) - tier(a));
      return { kind: 'draft', card: hash(g.config.seed, g.seq) < 0.8 ? best[0] : best[Math.min(1, best.length - 1)] };
    }
    case 'egg':
    case 'twin':
      return { kind: req.kind, card: [...req.options].sort((a, b) => tier(b) - tier(a))[0] } as Answer;
    case 'mastermind': {
      // 预测强度最高的（含自己）
      const cands = req.options.map((i) => racerOf(s, i));
      cands.sort((a, b) => tier(b.card) - tier(a.card));
      return { kind: 'mastermind', target: cands[0].idx };
    }
    case 'main': {
      if (req.legs) return { kind: 'main', mode: 'legs' };
      if (req.swap.length && me) {
        const lead = req.swap.map((i) => racerOf(s, i)).sort((a, b) => b.pos - a.pos)[0];
        if (lead.pos - me.pos >= 5) return { kind: 'main', mode: 'swap', target: lead.idx };
      }
      return req.predict ? { kind: 'main', mode: 'roll', predict: 1 + Math.floor(hash(g.config.seed, g.seq) * 6) } : { kind: 'main', mode: 'roll' };
    }
    case 'afterRoll': {
      const v = req.value;
      const has = (o: AfterRollOption) => req.options.includes(o);
      if (has('alchemist')) return { kind: 'afterRoll', choice: 'alchemist' };
      if (has('rocket') && me && (v >= 4 || me.pos + 2 * v >= FINISH)) return { kind: 'afterRoll', choice: 'rocket' };
      const bad = v <= 2 || (me?.power === 'sisyphus' && v === 6) || (v === 1 && others.some((o) => o.power === 'inchworm'));
      if (has('reroll') && bad) return { kind: 'afterRoll', choice: 'reroll' };
      return { kind: 'afterRoll', choice: 'keep' };
    }
    case 'cheer': {
      if (!me) return { kind: 'cheer', use: false };
      const ts = req.targets.map((i) => racerOf(s, i));
      return { kind: 'cheer', use: ts.includes(me) || ts.every((t) => t.seat === me.seat || me.pos - t.pos >= 6) };
    }
    case 'hypnotist': {
      if (!me) return { kind: 'hypnotist', target: null };
      const lead = req.options.map((i) => racerOf(s, i)).sort((a, b) => b.pos - a.pos)[0];
      return { kind: 'hypnotist', target: lead && lead.pos > me.pos && lead.seat !== me.seat ? lead.idx : null };
    }
    case 'thirdwheel': {
      const best = Math.max(...req.options);
      return { kind: 'thirdwheel', space: me && best > me.pos ? best : null };
    }
    case 'duel':
      return { kind: 'duel', use: true };
    case 'follow':
      return { kind: 'follow', use: !!me && req.to > me.pos };
  }
}

function easy(g: Game, req: Exclude<Request, { kind: 'pick' }>): Answer {
  const coin = hash(g.config.seed, g.seq, 7) < 0.5;
  switch (req.kind) {
    case 'draft': return { kind: 'draft', card: pickRand(g, req.options) };
    case 'egg': return { kind: 'egg', card: pickRand(g, req.options) };
    case 'twin': return { kind: 'twin', card: coin ? pickRand(g, req.options) : null };
    case 'mastermind': return { kind: 'mastermind', target: pickRand(g, req.options) };
    case 'main':
      if (req.legs && coin) return { kind: 'main', mode: 'legs' };
      if (req.swap.length && coin) return { kind: 'main', mode: 'swap', target: pickRand(g, req.swap) };
      return { kind: 'main', mode: 'roll', predict: req.predict ? 1 + Math.floor(hash(g.seq) * 6) : undefined };
    case 'afterRoll': return { kind: 'afterRoll', choice: pickRand(g, req.options) };
    case 'cheer': return { kind: 'cheer', use: coin };
    case 'hypnotist': return { kind: 'hypnotist', target: coin ? pickRand(g, req.options) : null };
    case 'thirdwheel': return { kind: 'thirdwheel', space: coin ? pickRand(g, req.options) : null };
    case 'duel': return { kind: 'duel', use: coin };
    case 'follow': return { kind: 'follow', use: coin };
  }
}
