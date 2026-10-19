import type { CharId } from '../../shared/types';

/** 每个角色的配色：主体 / 点缀 / 头像底色。3D 棋子与 SVG 头像共用，保证风格一致。 */
export interface Palette {
  body: string;
  accent: string;
  bg: string;
}

export const PAL: Record<CharId, Palette> = {
  alchemist: { body: '#7b5cd6', accent: '#4ee08a', bg: '#d9ccff' },
  babayaga: { body: '#8a5a3b', accent: '#ffb627', bg: '#f3dcc0' },
  banana: { body: '#ffd84a', accent: '#6b4a1f', bg: '#fff3b8' },
  blimp: { body: '#ff8fa3', accent: '#8892a6', bg: '#ffe0e6' },
  centaur: { body: '#b8763e', accent: '#f2c79a', bg: '#f4dcc0' },
  cheerleader: { body: '#ff5d8f', accent: '#ffd23f', bg: '#ffd6e3' },
  coach: { body: '#e63946', accent: '#f1faee', bg: '#ffd4d4' },
  copycat: { body: '#3ac0c0', accent: '#ffefc2', bg: '#c8f2f0' },
  dicemonger: { body: '#fffaf0', accent: '#2b1b4d', bg: '#e8e0ff' },
  duelist: { body: '#f4f4f8', accent: '#e63946', bg: '#dfe6f5' },
  egg: { body: '#fffdf4', accent: '#ffcc33', bg: '#fff0c4' },
  flipflop: { body: '#4cc9f0', accent: '#ff7a2f', bg: '#d0f1fb' },
  genius: { body: '#ff9ec7', accent: '#2b1b4d', bg: '#ffe0ef' },
  gunk: { body: '#7bd43c', accent: '#4a8f1d', bg: '#dcf7c4' },
  hare: { body: '#eae4ff', accent: '#ff8fb1', bg: '#d6f3ff' },
  heckler: { body: '#ff6b3d', accent: '#ffd23f', bg: '#ffe0cf' },
  hugebaby: { body: '#ffcfa8', accent: '#9ad0ff', bg: '#ffeedd' },
  hypnotist: { body: '#5b3cc4', accent: '#ff5df0', bg: '#e6d9ff' },
  inchworm: { body: '#9be15d', accent: '#ff8a5b', bg: '#e4f9cf' },
  lackey: { body: '#33334d', accent: '#ffffff', bg: '#dcdcec' },
  leaptoad: { body: '#2fb36b', accent: '#f6e05e', bg: '#cdf3dc' },
  legs: { body: '#ffb000', accent: '#e63946', bg: '#fff0c2' },
  lovableloser: { body: '#8fb8ff', accent: '#ffffff', bg: '#dce8ff' },
  magician: { body: '#262036', accent: '#e63946', bg: '#e3d6ff' },
  mastermind: { body: '#a8a4c8', accent: '#6c4bf4', bg: '#e2e0f2' },
  mouth: { body: '#c33a4b', accent: '#c0c7d6', bg: '#ffd8dc' },
  partyanimal: { body: '#ff7ad9', accent: '#3ddc97', bg: '#ffe0f6' },
  rocket: { body: '#f4f4f8', accent: '#ff5d3d', bg: '#dff3ff' },
  romantic: { body: '#ff4f7b', accent: '#2fb36b', bg: '#ffd9e3' },
  scoocher: { body: '#c9a26b', accent: '#f08cc0', bg: '#f5e6cd' },
  sisyphus: { body: '#e8b48a', accent: '#8d8d99', bg: '#ece5dc' },
  skipper: { body: '#2a6fdb', accent: '#ffffff', bg: '#d4e4ff' },
  stickler: { body: '#ffd166', accent: '#2b1b4d', bg: '#fff2cc' },
  suckerfish: { body: '#6c8ebf', accent: '#d7e3f5', bg: '#d2e3f7' },
  thirdwheel: { body: '#ff7a2f', accent: '#3a3a4a', bg: '#ffe1cc' },
  twin: { body: '#3ddc97', accent: '#a66cff', bg: '#d6f7e8' },
};

/** 6 个玩家色 */
export const SEAT_COLORS = ['#ff7a2f', '#4cc9f0', '#3ddc97', '#ff5d8f', '#a66cff', '#ffd23f'];
export const INK = '#2b1b4d';

/** 背景色上的高对比文字/点子颜色 */
export function contrastOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const L = 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
  return L > 0.36 ? INK : '#ffffff';
}
