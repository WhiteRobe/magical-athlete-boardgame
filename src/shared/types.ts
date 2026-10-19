// 引擎、服务端、客户端共用的类型。引擎是纯函数式的：同样的 seed + 同样的回答序列 → 同样的结果。

export const CHAR_IDS = [
  'alchemist', 'babayaga', 'banana', 'blimp', 'centaur', 'cheerleader',
  'coach', 'copycat', 'dicemonger', 'duelist', 'egg', 'flipflop',
  'genius', 'gunk', 'hare', 'heckler', 'hugebaby', 'hypnotist',
  'inchworm', 'lackey', 'leaptoad', 'legs', 'lovableloser', 'magician',
  'mastermind', 'mouth', 'partyanimal', 'rocket', 'romantic', 'scoocher',
  'sisyphus', 'skipper', 'stickler', 'suckerfish', 'thirdwheel', 'twin',
] as const;
export type CharId = (typeof CHAR_IDS)[number];

export type TrackId = 'mild' | 'wild' | 'carnival' | 'random';

/** 特殊格：星 +1 分；摔倒；箭头再移动 delta 格；传送门瞬移到 to（单向） */
export type SpaceEffect =
  | { kind: 'star' }
  | { kind: 'trip' }
  | { kind: 'arrow'; delta: number }
  | { kind: 'portal'; to: number };
export type Spaces = Record<number, SpaceEffect>;
export type AiLevel = 'easy' | 'normal';

/** 终点：位置 >= FINISH 即冲线。0 = Start，1..29 为格子。 */
export const FINISH = 30;
export const GOLD = [3, 4, 4, 5];
export const SILVER = [1, 2, 2, 3];
export const TRACK_ORDER: TrackId[] = ['mild', 'wild', 'carnival', 'random'];

export interface SeatConfig {
  name: string;
  /** 非空表示 AI 座位 */
  ai?: AiLevel;
}

export interface GameConfig {
  seed: number;
  seats: SeatConfig[]; // 2..6
}

export interface PlayerState {
  seat: number;
  name: string;
  ai?: AiLevel;
  hand: CharId[]; // 还没上场的运动员
  used: CharId[];
  gold: number[];
  silver: number[];
  bronze: number;
}

export interface Racer {
  /** 本场比赛内唯一序号，也是行动顺序 */
  idx: number;
  seat: number;
  card: CharId; // 印刷的角色
  power: CharId | null; // 生效能力（Egg/Twin 会替换；null = 无能力）
  pos: number;
  tripped: boolean;
  /** 1/2 = 冲线名次；'out' = 被淘汰 */
  done: 0 | 1 | 2 | 'out';
  turns: number;
  prediction?: number; // Mastermind 预测的运动员 idx
}

export type Phase = 'draft' | 'pick' | 'race' | 'end';

export interface RaceState {
  no: number; // 0..3
  track: TrackId;
  /** 本场赛道的特殊格（随机赛道每局不同，客户端以此为准渲染） */
  spaces: Spaces;
  racers: Racer[];
  current: number; // 当前行动运动员 idx
  finishers: number[]; // 冲线顺序（racer idx）
  eliminated: number[]; // 被淘汰顺序
  places: [number | null, number | null]; // 第 1/2 名所属 seat
}

export interface RaceResult {
  no: number;
  track: TrackId;
  winners: { card: CharId; power: CharId | null; seat: number; place: 1 | 2 }[];
}

export interface GameState {
  phase: Phase;
  players: PlayerState[];
  deckCount: number;
  /** 选秀中当前公开的牌池 */
  pool: CharId[];
  /** 选秀顺序（seat 序列）与当前位置 */
  draftOrder: number[];
  draftIdx: number;
  firstSeat: number;
  race: RaceState | null;
  results: RaceResult[];
  /** 每场每人上场人数：2 人局为 2，其余为 1 */
  perRace: number;
}

// ---------- 决策请求 ----------

export type Request =
  | { kind: 'draft'; seat: number; options: CharId[] }
  /** 同时决策：所有 seats 各自选 perRace 名运动员（顺序即行动顺序） */
  | { kind: 'pick'; seats: number[]; count: number }
  | { kind: 'egg'; seat: number; racer: number; options: CharId[] }
  | { kind: 'twin'; seat: number; racer: number; options: CharId[] }
  | { kind: 'mastermind'; seat: number; racer: number; options: number[] }
  /** 主移动：掷骰（Genius 可附预测），或 Legs / Flip Flop 替代 */
  | { kind: 'main'; seat: number; racer: number; legs: boolean; swap: number[]; predict: boolean }
  /** 掷骰后：保留 / 重掷 / Alchemist 改 4 / Rocket 翻倍 */
  | { kind: 'afterRoll'; seat: number; racer: number; value: number; options: AfterRollOption[] }
  | { kind: 'cheer'; seat: number; racer: number; targets: number[] }
  | { kind: 'hypnotist'; seat: number; racer: number; options: number[] }
  | { kind: 'thirdwheel'; seat: number; racer: number; options: number[] }
  | { kind: 'duel'; seat: number; racer: number; target: number }
  | { kind: 'follow'; seat: number; racer: number; target: number; to: number };

export type AfterRollOption = 'keep' | 'reroll' | 'alchemist' | 'rocket';

export type Answer =
  | { kind: 'draft'; card: CharId }
  | { kind: 'pick'; picks: Record<number, CharId[]> }
  | { kind: 'egg'; card: CharId }
  | { kind: 'twin'; card: CharId | null }
  | { kind: 'mastermind'; target: number }
  | { kind: 'main'; mode: 'roll'; predict?: number }
  | { kind: 'main'; mode: 'legs' }
  | { kind: 'main'; mode: 'swap'; target: number }
  | { kind: 'afterRoll'; choice: AfterRollOption }
  | { kind: 'cheer'; use: boolean }
  | { kind: 'hypnotist'; target: number | null }
  | { kind: 'thirdwheel'; space: number | null }
  | { kind: 'duel'; use: boolean }
  | { kind: 'follow'; use: boolean };

/** 单人决策时由哪个 seat 回答 */
export function requestSeat(r: Request): number | null {
  return r.kind === 'pick' ? null : r.seat;
}

// ---------- 事件（驱动客户端动画） ----------

export type GameEvent =
  | { t: 'draftStart'; round: number; pool: CharId[]; order: number[] }
  | { t: 'drafted'; seat: number; card: CharId }
  | { t: 'raceStart'; no: number; track: TrackId; spaces: Spaces; racers: { idx: number; seat: number; card: CharId }[]; first: number }
  | { t: 'powerSwap'; racer: number; power: CharId | null; via: CharId } // Egg / Twin
  | { t: 'turn'; racer: number }
  | { t: 'roll'; racer: number; value: number; reroll?: boolean }
  | { t: 'duelRoll'; a: number; av: number; b: number; bv: number; winner: number }
  | { t: 'move'; racer: number; path: number[]; main?: boolean }
  | { t: 'place'; racer: number; to: number } // 被 Huge Baby 挤到身后一格（不算移动）
  | { t: 'warp'; racer: number; to: number }
  | { t: 'blocked'; racer: number } // Stickler 取消移动
  | { t: 'trip'; racer: number }
  | { t: 'standUp'; racer: number }
  | { t: 'skip'; racer: number; reason: 'hare' | 'inchworm' | 'tripped' }
  | { t: 'power'; racer: number; power: CharId; note?: string }
  | { t: 'space'; racer: number; space: number; kind: SpaceEffect['kind'] }
  | { t: 'bronze'; seat: number; delta: number }
  | { t: 'eliminate'; racer: number; by: number }
  | { t: 'finish'; racer: number; place: 1 | 2 }
  | { t: 'predict'; racer: number; target: number }
  | { t: 'raceEnd'; no: number; places: [number | null, number | null]; gold: number; silver: number; reason: 'finish' | 'mastermind' | 'lastStanding' | 'loop' }
  | { t: 'gameEnd'; scores: number[]; winners: number[] };

export function playerScore(p: PlayerState): number {
  return p.gold.reduce((a, b) => a + b, 0) + p.silver.reduce((a, b) => a + b, 0) + p.bronze;
}
