import { describe, it, expect } from 'vitest';
import { copycatTarget, noteText, predictionValid } from '../src/client/game/powers';
import type { GameState, Racer } from '../src/shared/types';

const racer = (idx: number, seat: number, power: Racer['power'], pos: number, extra: Partial<Racer> = {}): Racer =>
  ({ idx, seat, card: power ?? 'egg', power, pos, tripped: false, done: 0, turns: 0, ...extra });

function state(racers: Racer[], current = 0): GameState {
  return {
    phase: 'race', players: [0, 1, 2, 3].map((s) => ({ seat: s, name: `P${s}`, hand: [], used: [], gold: [], silver: [], bronze: 0 })),
    deckCount: 0, pool: [], draftOrder: [], draftIdx: 0, firstSeat: 0, results: [], perRace: 1,
    race: { no: 0, track: 'mild', spaces: {}, racers, current, finishers: [], eliminated: [], places: [null, null] },
  };
}

describe('客户端能力推断', () => {
  it('模仿猫复制领先者，按当前行动玩家起顺时针优先', () => {
    const rs = [racer(0, 0, 'copycat', 2), racer(1, 1, 'hare', 8), racer(2, 2, 'gunk', 8), racer(3, 3, 'legs', 3)];
    expect(copycatTarget(state(rs, 0), rs[0]).power).toBe('hare');
    expect(copycatTarget(state(rs, 2), rs[0]).power).toBe('gunk');
  });
  it('模仿猫独自领先时没有能力，且不复制其他模仿猫', () => {
    const rs = [racer(0, 0, 'copycat', 9), racer(1, 1, 'hare', 3)];
    expect(copycatTarget(state(rs), rs[0]).power).toBeNull();
    const rs2 = [racer(0, 0, 'copycat', 1), racer(1, 1, 'copycat', 5), racer(2, 2, 'legs', 3)];
    expect(copycatTarget(state(rs2), rs2[0]).power).toBeNull();
  });
  it('主脑预测在失去能力后失效', () => {
    const rs = [racer(0, 0, 'mastermind', 0, { prediction: 1 }), racer(1, 1, 'hare', 3)];
    expect(predictionValid(state(rs), rs[0])).toBe(true);
    rs[0].done = 'out';
    expect(predictionValid(state(rs), rs[0])).toBe(false);
  });
  it('能力 note 翻成中文，未知键不显示', () => {
    expect(noteText('pull')).toBe('大家过来玩');
    expect(noteText('predict')).toBe('预言冠军');
    expect(noteText('???')).toBeUndefined();
    expect(noteText(undefined)).toBeUndefined();
  });
});
