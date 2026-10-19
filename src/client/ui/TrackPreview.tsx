import type { Spaces, TrackId } from '../../shared/types';
import { FIXED_TRACKS, TRACK_NAME } from '../../shared/characters';
import { effectText, themeOf } from '../art/themes';

const ICON: Record<string, string> = { star: '⭐', trip: '💫', portal: '🌀' };

/** 赛道特殊格预览条：1..29 格，特殊格带图标；随机赛道显示「开赛时揭晓」 */
export function TrackPreview({ track, spaces, compact }: { track: TrackId; spaces?: Spaces; compact?: boolean }) {
  const sp = spaces ?? FIXED_TRACKS[track];
  const th = themeOf(track);
  if (!sp) {
    return (
      <div class="track-preview mystery">
        <span class="tp-title">{TRACK_NAME[track]}</span>
        <span>🎲 特殊格随机生成，开赛时揭晓！</span>
      </div>
    );
  }
  const list = Object.entries(sp).map(([k, v]) => [Number(k), v] as const).sort((a, b) => a[0] - b[0]);
  return (
    <div class="track-preview">
      <div class="tp-cells">
        {Array.from({ length: 29 }, (_, i) => i + 1).map((i) => {
          const e = sp[i];
          const icon = !e ? '' : e.kind === 'arrow' ? (e.delta > 0 ? `+${e.delta}` : `${e.delta}`) : e.kind === 'portal' ? `🌀` : ICON[e.kind];
          const bg = !e ? th.dom : e.kind === 'trip' ? '#ffb3a6' : e.kind === 'star' ? '#fff0a6' : e.kind === 'portal' ? '#e2d4ff' : e.delta > 0 ? '#b8f5d0' : '#ffc2c2';
          return (
            <span class="tp-cell" style={{ background: bg }} title={e ? `${i} 格：${effectText(e)}` : `${i} 格`}>
              {icon || (i % 5 === 0 ? i : '')}
            </span>
          );
        })}
      </div>
      {!compact && list.length > 0 && (
        <div class="tp-list">
          {list.map(([k, v]) => <span class="tag">{k} 格 {effectText(v)}</span>)}
        </div>
      )}
      {list.length === 0 && <div class="tp-list"><span class="tag">没有机关，拼实力</span></div>}
    </div>
  );
}
