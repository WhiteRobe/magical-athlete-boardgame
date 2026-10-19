import type { CharId, GameState, Racer } from '../../shared/types';

/** 与引擎 powerOf 一致：模仿猫复制领先者（排除自己与其他模仿猫，按当前行动者起顺时针优先级），自己独自领先则无能力 */
export function copycatTarget(s: GameState, r: Racer): { power: CharId | null; from: Racer | null } {
  const race = s.race;
  if (!race || r.done !== 0) return { power: null, from: null };
  const act = race.racers.filter((x) => x.done === 0);
  const max = Math.max(...act.map((x) => x.pos));
  const n = s.players.length;
  const cs = race.racers[race.current]?.seat ?? 0;
  const rank = (x: Racer) => ((x.seat - cs + n) % n) * 100 + x.idx;
  const leaders = act.filter((x) => x.pos === max && x !== r && x.power !== 'copycat').sort((a, b) => rank(a) - rank(b));
  return leaders.length ? { power: leaders[0].power, from: leaders[0] } : { power: null, from: null };
}

/** 运动员当前生效的能力（含模仿猫复制结果）；已离场为 null */
export function effectivePower(s: GameState, r: Racer): CharId | null {
  if (r.done !== 0) return null;
  return r.power === 'copycat' ? copycatTarget(s, r).power : r.power;
}

/** 预言是否仍然有效：当前还拥有幕后主脑能力 */
export function predictionValid(s: GameState, r: Racer): boolean {
  return r.prediction !== undefined && effectivePower(s, r) === 'mastermind';
}

/** 引擎 power 事件 note（内部键）→ 中文说明；未知键不显示 */
const NOTE_TEXT: Record<string, string> = {
  predict: '预言冠军',
  hit: '预言成真！',
  pull: '大家过来玩',
  bonus: '人多力量大',
  skip: '骄傲了，原地休息',
  six: '掷出 6，滚回起点',
  chips: '赛前获得 4 分',
};
export function noteText(note: string | undefined): string | undefined {
  return note ? NOTE_TEXT[note] : undefined;
}
