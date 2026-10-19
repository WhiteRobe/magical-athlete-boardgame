import { CHAR_IDS } from '../../shared/types';
import { Card } from '../ui/common';
import { TopBar } from '../ui/TopBar';
import { CHARS, TRACK_NAME } from '../../shared/characters';
import { TRACK_ORDER } from '../../shared/types';
import { TrackPreview } from '../ui/TrackPreview';

export function Codex() {
  return (
    <>
      <TopBar />
      <div class="page">
        <div class="lobby-head">
          <h2>角色图鉴 · {CHAR_IDS.length} 名运动员</h2>
          <div class="spacer" />
          <button class="btn ghost small" onClick={() => history.back()}>返回</button>
        </div>
        <div class="panel" style={{ marginBottom: '16px', lineHeight: 1.7, fontSize: '14px' }}>
          <b>怎么玩：</b>蛇形选秀，每人组 4 名运动员的队伍；共 4 场比赛（温和 → 狂野 → 欢乐嘉年华 → 随机赛道），每场每人暗选 1 名上场。
          轮到你就掷骰前进，各种能力会互相搅局。第 2 名冲线时比赛立即结束：冠军得金牌（3/4/4/5 分），亚军得银牌（1/2/2/3 分），
          途中还能拿铜币（1 分）。四场后总分最高者获胜。
        </div>
        <div class="panel col" style={{ marginBottom: '16px', gap: '12px' }}>
          <b>四场赛道</b>
          {TRACK_ORDER.map((t, i) => (
            <div class="col" style={{ gap: '4px' }}>
              <div style={{ fontWeight: 800 }}>第 {i + 1} 场 · {TRACK_NAME[t]}{t === 'carnival' ? '（原创：前半段甜头多、后半段陷阱密，还有传送门）' : t === 'random' ? '（每局随机生成，开赛时揭晓）' : ''}</div>
              <TrackPreview track={t} />
            </div>
          ))}
        </div>
        <div class="codex-grid">
          {[...CHAR_IDS].sort((a, b) => CHARS[a].name.localeCompare(CHARS[b].name, 'zh')).map((id) => <Card id={id} key={id} />)}
        </div>
      </div>
    </>
  );
}
