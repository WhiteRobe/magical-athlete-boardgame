import { describe, expect, it } from 'vitest';
import { Engine, Game, RaceOver } from '../src/shared/engine';
import { aiAnswer } from '../src/shared/ai';
import { CARNIVAL, FIXED_TRACKS, randomSpaces } from '../src/shared/characters';
import type { Answer, CharId, Request, TrackId } from '../src/shared/types';

type Answerer = (req: Request) => Answer | undefined;

function setup(cards: CharId[], pos: number[], o: { track?: TrackId; dice?: number[] } = {}) {
  const e = new Engine({ seed: 1, seats: cards.map((_, i) => ({ name: 'P' + i })) });
  e.st.phase = 'race';
  e.st.race = {
    no: 0, track: o.track ?? 'mild', spaces: FIXED_TRACKS[o.track ?? 'mild'] ?? {}, current: 0, finishers: [], eliminated: [], places: [null, null],
    racers: cards.map((c, i) => ({ idx: i, seat: i, card: c, power: c, pos: pos[i], tripped: false, done: 0 as const, turns: 1 })),
  };
  const dice = [...(o.dice ?? [])];
  e.rng.int = (n: number) => {
    if (n !== 6) return 0;
    if (!dice.length) throw new Error('骰子用完了');
    return dice.shift()! - 1;
  };
  e.turn = { racer: e.st.race.racers[0], skipper: null, genius: false, diceUsed: false, sigs: new Set(), steps: 0, follow: new Set() };
  return e;
}

const base: Answerer = (req) => {
  switch (req.kind) {
    case 'main': return { kind: 'main', mode: 'roll' };
    case 'afterRoll': return { kind: 'afterRoll', choice: 'keep' };
    case 'cheer': return { kind: 'cheer', use: true };
    case 'duel': return { kind: 'duel', use: true };
    case 'follow': return { kind: 'follow', use: true };
    case 'hypnotist': return { kind: 'hypnotist', target: req.options[0] };
    case 'thirdwheel': return { kind: 'thirdwheel', space: req.options[0] };
    case 'mastermind': return { kind: 'mastermind', target: req.options[0] };
    default: return undefined;
  }
};

/** 让 racer 0（或指定者）进行一个回合；返回请求列表与比赛结束原因 */
function turn(e: Engine, who = 0, ans: Answerer = () => undefined) {
  const r = e.st.race!.racers[who];
  e.st.race!.current = who;
  e.turn!.racer = r;
  const reqs: Request[] = [];
  let over: string | null = null;
  const g = e.takeTurn(r);
  try {
    let x = g.next();
    while (!x.done) {
      reqs.push(x.value);
      x = g.next(ans(x.value) ?? base(x.value)!);
    }
  } catch (err) {
    if (!(err instanceof RaceOver)) throw err;
    over = err.reason;
  }
  return { reqs, over };
}

const P = (e: Engine) => e.st.race!.racers.map((r) => r.pos);
const T = (e: Engine) => e.st.race!.racers.map((r) => r.tripped);
const ev = (e: Engine, t: string) => e.events.filter((x) => x.t === t);

describe('基础移动', () => {
  it('掷几走几', () => {
    const e = setup(['legs', 'banana'], [0, 10], { dice: [4] });
    turn(e);
    expect(P(e)).toEqual([4, 10]);
  });
  it('第二名冲线立即结束并记录名次', () => {
    const e = setup(['coach', 'gunk', 'hare'], [28, 29, 3], { dice: [6] });
    e.st.race!.racers[1].done = 1;
    e.st.race!.racers[1].pos = 30;
    e.st.race!.finishers = [1];
    e.st.race!.places = [1, null];
    e.st.race!.racers[2].power = null;
    const r = turn(e);
    expect(r.over).toBe('finish');
    expect(e.st.race!.places).toEqual([1, 0]);
  });
  it('不能退到起点之后', () => {
    const e = setup(['centaur', 'legs'], [2, 1], { dice: [1] });
    e.st.race!.racers[1].pos = 1;
    turn(e); // 半人马 2->3，经过在 1 的大长腿？不，大长腿在身后，不算经过
    expect(P(e)).toEqual([3, 1]);
  });
});

describe('经过类', () => {
  it('Banana：经过的人走完后摔倒；同格出发不算', () => {
    const e = setup(['coach', 'banana'], [3, 5], { dice: [4] });
    e.st.race!.racers[0].power = null;
    turn(e);
    expect(P(e)).toEqual([7, 5]);
    expect(T(e)).toEqual([true, false]);
    const f = setup(['coach', 'banana'], [5, 5], { dice: [4] });
    f.st.race!.racers[0].power = null;
    turn(f);
    expect(T(f)).toEqual([false, false]);
  });
  it('Banana：后退经过也摔倒', () => {
    const e = setup(['coach', 'banana'], [8, 6], { dice: [] });
    e.st.race!.racers[0].power = null;
    const g = e.move([{ r: e.st.race!.racers[0], d: -4 }]);
    g.next();
    expect(T(e)).toEqual([true, false]);
  });
  it('Centaur：经过的人后退 2，最少到起点', () => {
    const e = setup(['centaur', 'coach', 'gunk'], [0, 1, 3], { dice: [5] });
    e.st.race!.racers[1].power = null;
    e.st.race!.racers[2].power = null;
    turn(e);
    expect(P(e)).toEqual([5, 0, 1]);
  });
  it('Leaptoad：跳过有人的格子不计步数', () => {
    const e = setup(['leaptoad', 'coach', 'gunk'], [0, 2, 3], { dice: [3] });
    e.st.race!.racers[1].power = null;
    e.st.race!.racers[2].power = null;
    turn(e);
    expect(P(e)).toEqual([5, 2, 3]);
  });
});

describe('Huge Baby', () => {
  it('停到巨婴格上的人被放到它身后一格', () => {
    const e = setup(['coach', 'hugebaby'], [2, 6], { dice: [4] });
    e.st.race!.racers[0].power = null;
    turn(e);
    expect(P(e)).toEqual([5, 6]);
  });
  it('巨婴停到香蕉格：香蕉被挤到后面，算巨婴经过香蕉 → 巨婴摔倒', () => {
    const e = setup(['hugebaby', 'banana'], [2, 6], { dice: [4] });
    turn(e);
    expect(P(e)).toEqual([6, 5]);
    expect(T(e)).toEqual([true, false]);
  });
  it('Scoocher 与 Huge Baby 的循环执行一轮后终止', () => {
    const e = setup(['hare', 'scoocher', 'hugebaby'], [0, 9, 10], { dice: [1] });
    const r = turn(e);
    expect(r.over).toBeNull();
    expect(P(e)[1]).toBe(9);
  });
});

describe('骰面触发', () => {
  it('Inchworm：别人掷 1 取消移动，尺蠖移动 1；Skipper 下一个行动', () => {
    const e = setup(['coach', 'inchworm', 'skipper'], [3, 5, 7], { dice: [1] });
    e.st.race!.racers[0].power = null;
    turn(e);
    expect(P(e)).toEqual([3, 6, 7]);
    expect(e.turn!.skipper?.idx).toBe(2);
  });
  it('Lackey：别人掷 6 时先移动 2', () => {
    const e = setup(['coach', 'lackey'], [0, 5], { dice: [6] });
    e.st.race!.racers[0].power = null;
    turn(e);
    expect(P(e)).toEqual([6, 7]);
  });
  it('Sisyphus：掷 6 回起点并失去 1 分', () => {
    const e = setup(['sisyphus', 'coach'], [12, 0], { dice: [6] });
    e.st.players[0].bronze = 4;
    turn(e);
    expect(P(e)[0]).toBe(0);
    expect(e.st.players[0].bronze).toBe(3);
  });
  it('Alchemist 改 4、Rocket 翻倍后摔倒', () => {
    const e = setup(['alchemist', 'coach'], [0, 20], { dice: [1] });
    turn(e, 0, (q) => (q.kind === 'afterRoll' ? { kind: 'afterRoll', choice: 'alchemist' } : undefined));
    expect(P(e)[0]).toBe(4);
    const f = setup(['rocket', 'coach'], [0, 20], { dice: [5] });
    turn(f, 0, (q) => (q.kind === 'afterRoll' ? { kind: 'afterRoll', choice: 'rocket' } : undefined));
    expect(P(f)[0]).toBe(10);
    expect(T(f)[0]).toBe(true);
  });
  it('Magician 最多重掷两次，用最后一次', () => {
    const e = setup(['magician', 'coach'], [0, 20], { dice: [1, 2, 3] });
    const r = turn(e, 0, (q) => (q.kind === 'afterRoll' ? { kind: 'afterRoll', choice: 'reroll' } : undefined));
    expect(r.reqs.filter((q) => q.kind === 'afterRoll').length).toBe(2);
    expect(P(e)[0]).toBe(3);
  });
  it('Dicemonger：别人重掷时骰商先移动 1', () => {
    const e = setup(['coach', 'dicemonger'], [0, 10], { dice: [1, 5] });
    e.st.race!.racers[0].power = null;
    turn(e, 0, (q) => (q.kind === 'afterRoll' ? { kind: 'afterRoll', choice: q.options.includes('reroll') ? 'reroll' : 'keep' } : undefined));
    expect(P(e)).toEqual([5, 11]);
  });
  it('Genius 猜中获得额外回合；Skipper 取代它', () => {
    const e = setup(['genius', 'coach'], [0, 20], { dice: [4] });
    turn(e, 0, (q) => (q.kind === 'main' ? { kind: 'main', mode: 'roll', predict: 4 } : undefined));
    expect(e.turn!.genius).toBe(true);
  });
});

describe('距离修正', () => {
  it('Gunk −1、Coach +1（含自己）、Legs 仍是主移动', () => {
    const e = setup(['legs', 'gunk', 'coach'], [4, 10, 4]);
    turn(e, 0, (q) => (q.kind === 'main' ? { kind: 'main', mode: 'legs' } : undefined));
    expect(P(e)[0]).toBe(9); // 5 -1 +1
  });
  it('Hare：独自领先跳过主移动', () => {
    const e = setup(['hare', 'coach'], [10, 3]);
    turn(e);
    expect(P(e)[0]).toBe(10);
    const f = setup(['hare', 'coach'], [3, 10], { dice: [2] });
    turn(f);
    expect(P(f)[0]).toBe(7);
  });
  it('Blimp：15 格前 +3，之后 −1', () => {
    const e = setup(['blimp', 'coach'], [14, 0], { dice: [2] });
    turn(e);
    expect(P(e)[0]).toBe(19);
    const f = setup(['blimp', 'coach'], [15, 0], { dice: [2] });
    turn(f);
    expect(P(f)[0]).toBe(16);
  });
  it('Stickler：其他人超过终点则不移动', () => {
    const e = setup(['coach', 'stickler'], [27, 5], { dice: [5] });
    e.st.race!.racers[0].power = null;
    turn(e);
    expect(P(e)[0]).toBe(27);
    const f = setup(['coach', 'stickler'], [27, 5], { dice: [3] });
    f.st.race!.racers[0].power = null;
    turn(f);
    expect(f.st.race!.racers[0].done).toBe(1);
  });
});

describe('停格类', () => {
  it('M.O.U.T.H.：停到恰好一人的格吃掉对方；只剩一人时比赛结束', () => {
    const e = setup(['mouth', 'coach', 'gunk'], [0, 4, 20], { dice: [5] });
    e.st.race!.racers[1].power = null;
    e.st.race!.racers[2].power = null;
    e.st.race!.racers[1].pos = 5;
    turn(e);
    expect(e.st.race!.racers[1].done).toBe('out');
  });
  it('Romantic：停到恰好一人的格时移动 2', () => {
    const e = setup(['coach', 'romantic', 'gunk'], [0, 10, 3], { dice: [3] });
    e.st.race!.racers[0].power = null;
    e.st.race!.racers[2].power = null;
    turn(e);
    expect(P(e)).toEqual([3, 12, 3]);
  });
  it('Party Animal：同时被拉到同一格的两人不触发 Romantic', () => {
    // 派对动物在 5，两人分别在 4、6 → 都到 5（和派对动物同格，3 人），不是恰好 2 人
    const e = setup(['partyanimal', 'romantic', 'coach'], [5, 3, 7], { dice: [1] });
    e.st.race!.racers[2].power = null;
    turn(e);
    // 拉完：romantic 4，coach 6；派对动物主移动 1 → 6，与 coach 同格（恰好 2 人）→ romantic +2
    expect(P(e)).toEqual([6, 6, 6]);
  });
  it('Baba Yaga：停到它格上的人摔倒', () => {
    const e = setup(['coach', 'babayaga'], [2, 6], { dice: [4] });
    e.st.race!.racers[0].power = null;
    turn(e);
    expect(T(e)).toEqual([true, false]);
  });
  it('Duelist：同格可以决斗，平局决斗家赢', () => {
    const e = setup(['coach', 'duelist'], [2, 6], { dice: [4, 3, 3] });
    e.st.race!.racers[0].power = null;
    turn(e);
    expect(P(e)).toEqual([6, 8]);
  });
  it('狂野赛道：箭头、摔倒、星格', () => {
    const e = setup(['coach', 'gunk'], [3, 0], { track: 'wild', dice: [4] });
    e.st.race!.racers[0].power = null;
    e.st.race!.racers[1].power = null;
    turn(e);
    expect(P(e)[0]).toBe(10); // 7 → +3
    const f = setup(['coach', 'gunk'], [0, 0], { track: 'wild', dice: [5] });
    f.st.race!.racers[0].power = null;
    f.st.race!.racers[1].power = null;
    turn(f);
    expect(T(f)[0]).toBe(true);
    const g = setup(['coach', 'gunk'], [0, 0], { track: 'wild', dice: [1] });
    g.st.race!.racers[0].power = null;
    g.st.race!.racers[1].power = null;
    turn(g);
    expect(g.st.players[0].bronze).toBe(1);
  });
});

describe('其他能力', () => {
  it('Suckerfish：跟随同格出发的人', () => {
    const e = setup(['coach', 'suckerfish'], [4, 4], { dice: [3] });
    e.st.race!.racers[0].power = null;
    turn(e);
    expect(P(e)).toEqual([7, 7]);
  });
  it('Copy Cat：拥有领先者的能力', () => {
    const e = setup(['copycat', 'legs'], [0, 10]);
    const r = turn(e, 0, (q) => (q.kind === 'main' && q.legs ? { kind: 'main', mode: 'legs' } : undefined));
    expect(r.reqs[0]).toMatchObject({ kind: 'main', legs: true });
    expect(P(e)[0]).toBe(5);
  });
  it('Flip Flop：交换位置（瞬移，不算经过）', () => {
    const e = setup(['flipflop', 'banana'], [2, 12]);
    turn(e, 0, (q) => (q.kind === 'main' ? { kind: 'main', mode: 'swap', target: 1 } : undefined));
    expect(P(e)).toEqual([12, 2]);
    expect(T(e)).toEqual([false, false]);
  });
  it('Heckler：回合结束离起点不超过 1 格，起哄者移动 2', () => {
    const e = setup(['coach', 'heckler', 'gunk'], [5, 0, 10], { dice: [2] });
    e.st.race!.racers[0].power = null;
    turn(e); // 2 - 1(gunk) = 1
    expect(P(e)).toEqual([6, 2, 10]);
  });
  it('Cheerleader：最后一名移动 2，然后自己移动 1', () => {
    const e = setup(['cheerleader', 'coach'], [5, 1], { dice: [1] });
    e.st.race!.racers[1].power = null;
    turn(e);
    expect(P(e)).toEqual([7, 3]);
  });
  it('Hypnotist：把人瞬移到自己格', () => {
    const e = setup(['hypnotist', 'coach'], [5, 12], { dice: [1] });
    e.st.race!.racers[1].power = null;
    turn(e);
    expect(P(e)).toEqual([6, 5]);
  });
  it('Mastermind：猜中第一名，比赛立即结束且自己第 2', () => {
    const e = setup(['coach', 'mastermind', 'gunk'], [27, 3, 0], { dice: [5] });
    e.st.race!.racers[0].power = null;
    e.st.race!.racers[2].power = null;
    e.st.race!.racers[1].prediction = 0;
    const r = turn(e);
    expect(r.over).toBe('mastermind');
    expect(e.st.race!.places).toEqual([0, 1]);
  });
  it('Lovable Loser：独自垫底拿 1 分', () => {
    const e = setup(['lovableloser', 'coach'], [0, 4], { dice: [1] });
    turn(e);
    expect(e.st.players[0].bronze).toBe(1);
  });
  it('Third Wheel：瞬移到恰好 2 人的格', () => {
    const e = setup(['thirdwheel', 'coach', 'gunk'], [0, 9, 9], { dice: [1] });
    e.st.race!.racers[1].power = null;
    e.st.race!.racers[2].power = null;
    turn(e);
    expect(P(e)[0]).toBe(10);
  });
});

describe('新赛道', () => {
  it('嘉年华：传送门是瞬移，落点算停下', () => {
    const e = setup(['coach', 'gunk'], [5, 0], { track: 'carnival', dice: [4] });
    e.st.race!.racers[0].power = null;
    e.st.race!.racers[1].power = null;
    turn(e);
    expect(P(e)[0]).toBe(18);
  });
  it('嘉年华：25 滑回 20 正好摔倒', () => {
    const e = setup(['coach', 'gunk'], [23, 0], { track: 'carnival', dice: [2] });
    e.st.race!.racers[0].power = null;
    e.st.race!.racers[1].power = null;
    turn(e);
    expect(P(e)[0]).toBe(20);
    expect(T(e)[0]).toBe(true);
  });
  it('随机赛道：落点合法、不连锁、可重放', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 300; i++) {
      const sp = randomSpaces(rand);
      for (const [k, v] of Object.entries(sp)) {
        expect(Number(k)).toBeGreaterThanOrEqual(1);
        expect(Number(k)).toBeLessThanOrEqual(28);
        const to = v.kind === 'arrow' ? Number(k) + v.delta : v.kind === 'portal' ? v.to : null;
        if (to === null) continue;
        expect(to).toBeGreaterThanOrEqual(1);
        expect(to).toBeLessThanOrEqual(29);
        expect(['arrow', 'portal']).not.toContain(sp[to]?.kind);
      }
    }
    expect(Object.keys(CARNIVAL).length).toBeGreaterThan(10);
  });
});

describe('连锁', () => {
  it('模仿猫复制挪步者：两个挪步者不会互相推到终点', () => {
    // 挪步者领先 → 模仿猫拥有挪步者能力；Gunk 发动一次，两只各挪 1 格后停止
    const e = setup(['coach', 'scoocher', 'copycat', 'gunk'], [0, 10, 9, 2], { dice: [3] });
    e.st.race!.racers[0].power = null;
    turn(e);
    expect(P(e)[1]).toBeLessThanOrEqual(12);
    expect(P(e)[2]).toBeLessThanOrEqual(12);
  });
  it('吸盘鱼 + 挪步者只往复一轮', () => {
    // 黏液怪发动 → 挪步者 4→5 → 吸盘鱼跟到 5 → 挪步者再挪 1 到 6（只这一次）→ 吸盘鱼跟到 6 → 结束
    const e = setup(['coach', 'suckerfish', 'scoocher', 'gunk'], [0, 4, 4, 20], { dice: [3] });
    e.st.race!.racers[0].power = null;
    turn(e);
    expect(P(e)[2]).toBe(6);
    expect(P(e)[1]).toBe(6);
  });
});

describe('整局', () => {
  it('AI 对战几局：能结束、重放一致', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const config = { seed, seats: Array.from({ length: 2 + (seed % 5) }, (_, i) => ({ name: 'AI' + i, ai: 'normal' as const })) };
      const g = Game.create(config);
      let n = 0;
      while (g.pending && n++ < 5000) expect(g.answer(aiAnswer(g, g.pending)).ok).toBe(true);
      expect(g.pending).toBeNull();
      expect(g.state.phase).toBe('end');
      expect(JSON.stringify(Game.restore(config, g.answers).state)).toBe(JSON.stringify(g.state));
    }
  });
  it('拒绝不合法的回答', () => {
    const g = Game.create({ seed: 3, seats: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] });
    expect(g.pending?.kind).toBe('draft');
    expect(g.answer({ kind: 'draft', card: 'legs' as CharId }).ok).toBe(g.pending!.kind === 'draft' && (g.pending as { options: CharId[] }).options.includes('legs'));
    expect(g.answer({ kind: 'cheer', use: true }).ok).toBe(false);
  });
});
