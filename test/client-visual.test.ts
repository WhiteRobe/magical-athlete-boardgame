import { describe, it, expect } from 'vitest';
import { Game } from '../src/shared/engine';
import { aiAnswer } from '../src/shared/ai';
import { applyVisual, describe as describeEvent } from '../src/client/game/describe';
import { playerScore, type GameState } from '../src/shared/types';

// 客户端的增量展示状态（applyVisual）必须与引擎的权威状态一致，否则动画播完会「跳」。
function check(seed: number, n: number) {
  const g = Game.create({ seed, seats: Array.from({ length: n }, (_, i) => ({ name: `P${i}`, ai: 'normal' as const })) });
  let view: GameState = structuredClone(g.state);
  // create() 期间产生的事件（第一轮选秀开始）
  for (const e of g.takeEvents()) view = applyVisual(view, e);
  let steps = 0;
  while (g.pending && steps++ < 20000) {
    const r = g.answer(aiAnswer(g, g.pending));
    if (!r.ok) throw new Error(r.error);
    for (const e of r.events) {
      describeEvent(view, e); // 不抛异常
      view = applyVisual(view, e);
    }
    const s = g.state;
    expect(view.players.map(playerScore)).toEqual(s.players.map(playerScore));
    if (s.race && view.race && s.phase === 'race') {
      for (const r of s.race.racers) {
        const v = view.race.racers[r.idx];
        expect({ idx: r.idx, pos: Math.min(r.pos, 30), done: r.done, tripped: !r.done && r.tripped }).toEqual({ idx: v.idx, pos: Math.min(v.pos, 30), done: v.done, tripped: !v.done && v.tripped });
      }
    }
  }
  expect(g.pending).toBeNull();
  expect(view.phase).toBe('end');
}

describe('client visual reducer', () => {
  for (const [seed, n] of [[1, 4], [2, 2], [3, 6], [4, 3], [5, 5]] as const) {
    it(`seed ${seed}, ${n} players`, () => check(seed, n));
  }
});
