import type { TrackId } from '../../shared/types';
import { TRACK_ORDER } from '../../shared/types';
import type { SpaceEffect, Spaces } from '../../shared/types';

/** 赛道主题：按 TrackId 映射。新增赛道时在这里加一项即可（缺省回退到第一条赛道的主题）。 */
export interface TrackTheme {
  /** 场景氛围：决定装饰物种类 */
  ambient: 'meadow' | 'swamp' | 'carnival' | 'mystic';
  /** 格子配色轮换（糖果色）；缺省用 tile */
  tilePalette?: string[];
  /** 开赛时特殊格做「翻牌揭晓」动画 */
  reveal?: boolean;
  grass: string;
  grass2: string;
  rim: string; // 岛屿草皮边缘
  dirt: string;
  dirt2: string;
  tile: string;
  tileSide: string;
  tree: string;
  tree2: string;
  trunk: string;
  deco: string; // 花 / 蘑菇点缀
  water?: string; // 沼泽水洼
  path: string; // 格子下方的小路
  flowers: string[];
  glow?: string; // 沼泽发光蘑菇 / 萤火虫
  dom: string; // DOM 降级赛道格子底色
}

export const THEMES: Record<TrackId, TrackTheme> = {
  mild: {
    ambient: 'meadow',
    grass: '#8fdc6a', grass2: '#74c957', rim: '#5aae45', dirt: '#b07a4a', dirt2: '#8a5a3b',
    tile: '#fff4d6', tileSide: '#e3c99a', tree: '#3fae5a', tree2: '#58c46b', trunk: '#8a5a3b', deco: '#ff8fb1',
    path: '#f0d6a0', flowers: ['#ff8fb1', '#ffd23f', '#ffffff', '#a66cff'],
    dom: '#b8e986',
  },
  wild: {
    ambient: 'swamp',
    grass: '#5ccfb0', grass2: '#45b89b', rim: '#2f8f7a', dirt: '#6b4fa0', dirt2: '#4b3478',
    tile: '#efe6ff', tileSide: '#b9a5e8', tree: '#a66cff', tree2: '#c08cff', trunk: '#4b3478', deco: '#ffd23f',
    water: '#2f6f8f', path: '#8e7cc6', flowers: ['#ffd23f', '#ff5df0', '#7cf0ff'], glow: '#7cf0ff',
    dom: '#6fd3b3',
  },
  carnival: {
    ambient: 'carnival',
    grass: '#ffd6e8', grass2: '#ffc2dc', rim: '#ff8fb8', dirt: '#ffb26b', dirt2: '#e8884a',
    tile: '#ffffff', tileSide: '#f2c4dc', tree: '#ff7ad9', tree2: '#ffd23f', trunk: '#8a5a3b', deco: '#4cc9f0',
    path: '#fff2a8', flowers: ['#ff5d8f', '#4cc9f0', '#ffd23f', '#3ddc97', '#a66cff'],
    tilePalette: ['#fff0f6', '#e8f8ff', '#fffbe0', '#eafff3', '#f3eaff'],
    dom: '#ffd6e8',
  },
  random: {
    ambient: 'mystic',
    grass: '#4b3a8f', grass2: '#5a48a6', rim: '#2e2366', dirt: '#2b1b4d', dirt2: '#1d1236',
    tile: '#e9e2ff', tileSide: '#8f7cd6', tree: '#7c5cff', tree2: '#ff5df0', trunk: '#2e2366', deco: '#7cf0ff',
    path: '#6a58c2', flowers: ['#7cf0ff', '#ffd23f', '#ff5df0'], glow: '#ffd23f',
    reveal: true,
    dom: '#b9a5e8',
  },
};

export function themeOf(t: TrackId | undefined): TrackTheme {
  return (t && THEMES[t]) || THEMES[TRACK_ORDER[0]];
}

/** 一条赛道上各类机关的数量，用于开场横幅文案 */
export function trackSummary(spaces: Spaces): string {
  const n = { star: 0, trip: 0, arrow: 0, portal: 0 };
  for (const e of Object.values(spaces)) n[e.kind]++;
  if (!n.star && !n.trip && !n.arrow && !n.portal) return '没有机关，拼实力！';
  return [n.trip && `${n.trip} 个绊脚格`, n.arrow && `${n.arrow} 个箭头格`, n.portal && `${n.portal} 个传送门`, n.star && `${n.star} 个星星格`].filter(Boolean).join(' · ') + '，小心！';
}

/** 特殊格的简短中文说明 */
export function effectText(e: SpaceEffect): string {
  switch (e.kind) {
    case 'star': return '⭐ +1 分';
    case 'trip': return '💫 摔倒';
    case 'arrow': return e.delta > 0 ? `➡️ 前进 ${e.delta}` : `⬅️ 后退 ${-e.delta}`;
    case 'portal': return `🌀 传送到 ${e.to}`;
  }
}
