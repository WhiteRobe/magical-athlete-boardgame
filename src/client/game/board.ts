import type { GameEvent, GameState } from '../../shared/types';

/** 赛道渲染器接口：3D（three）与 DOM 降级两种实现。 */
export interface BoardApi {
  /** 无动画地对齐到状态 */
  sync(state: GameState): void;
  /** 播放一个事件的动画。state 为该事件发生前的展示状态。 */
  play(e: GameEvent, state: GameState, speed: number): Promise<void>;
  /** 进入「选目标」模式：高亮可选棋子；null 取消 */
  setSelectable(idxs: number[] | null): void;
  /** 让某格高亮可点（电灯泡选格子） */
  setSelectableSpaces(spaces: number[] | null): void;
  onPick: (racerIdx: number) => void;
  /** 镜头模式（DOM 版无） */
  readonly view?: 'follow' | 'overview';
  setView?(m: 'follow' | 'overview'): void;
  onPickSpace: (space: number) => void;
  dispose(): void;
}

export type BoardFactory = (container: HTMLElement) => BoardApi;
