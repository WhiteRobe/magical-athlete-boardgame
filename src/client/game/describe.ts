import type { GameEvent, GameState, Racer, CharId } from '../../shared/types';
import { CHARS, TRACK_NAME } from '../../shared/characters';
import { effectivePower, noteText } from './powers';

function rname(s: GameState, idx: number): string {
  const r = s.race?.racers.find((x) => x.idx === idx);
  if (!r) return `#${idx}`;
  return `${CHARS[r.card].name}`;
}
function pname(s: GameState, seat: number) {
  return s.players[seat]?.name ?? `玩家${seat + 1}`;
}
const cn = (c: CharId | null) => (c ? CHARS[c].name : '无');

/** 事件 → 中文日志；返回 null 表示不记录。hot 表示高亮。 */
export function describe(s: GameState, e: GameEvent): { text: string; hot?: boolean } | null {
  switch (e.t) {
    case 'draftStart':
      return { text: `第 ${e.round + 1} 轮选秀开始，翻开 ${e.pool.length} 张`, hot: true };
    case 'drafted':
      return { text: `${pname(s, e.seat)} 选了 ${CHARS[e.card].name}` };
    case 'raceStart':
      return { text: `第 ${e.no + 1} 场比赛 · ${TRACK_NAME[e.track]}`, hot: true };
    case 'powerSwap':
      return { text: `${rname(s, e.racer)} 通过「${CHARS[e.via].skill}」获得了 ${cn(e.power)} 的能力`, hot: true };
    case 'turn':
      return null;
    case 'roll':
      return { text: `${rname(s, e.racer)} ${e.reroll ? '重掷' : '掷出'} ${e.value} 点` };
    case 'duelRoll':
      return { text: `决斗！${rname(s, e.a)} ${e.av} 点 vs ${rname(s, e.b)} ${e.bv} 点，${rname(s, e.winner)} 获胜`, hot: true };
    case 'move': {
      const d = e.path.length ? e.path[e.path.length - 1] : 0;
      const from = e.path.length > 1 ? e.path[0] : undefined;
      const steps = e.path.length - 1;
      if (steps <= 0) return null;
      const back = from !== undefined && d < from;
      return { text: `${rname(s, e.racer)} ${back ? '后退' : '前进'}${e.main ? '' : ''}到第 ${Math.min(d, 30) >= 30 ? '终点' : d + ' 格'}` };
    }
    case 'place':
      return { text: `${rname(s, e.racer)} 被挤到第 ${e.to} 格` };
    case 'warp':
      return { text: `${rname(s, e.racer)} 瞬移到${e.to === 0 ? '起点' : `第 ${e.to} 格`}` };
    case 'blocked':
      return { text: `${rname(s, e.racer)} 没法恰好到终点，原地不动` };
    case 'trip':
      return { text: `${rname(s, e.racer)} 摔倒了！` };
    case 'standUp':
      return { text: `${rname(s, e.racer)} 爬了起来` };
    case 'skip':
      return { text: `${rname(s, e.racer)} ${e.reason === 'hare' ? '骄傲地停下来打盹' : e.reason === 'inchworm' ? '被尺蠖截胡，这次不动' : '这回合用来起身'}` };
    case 'power':
      return { text: `${rname(s, e.racer)} 发动「${CHARS[e.power].skill}」${noteText(e.note) ? '：' + noteText(e.note) : ''}`, hot: true };
    case 'space':
      return { text: `${rname(s, e.racer)} 踩到${{ star: '星星格', trip: '绊脚格', arrow: '箭头格', portal: '传送门' }[e.kind]}` };
    case 'bronze':
      return { text: `${pname(s, e.seat)} ${e.delta > 0 ? '获得' : '失去'} ${Math.abs(e.delta)} 分铜币` };
    case 'eliminate':
      return { text: `${rname(s, e.racer)} 被 ${rname(s, e.by)} 一口吃掉了！`, hot: true };
    case 'finish':
      return { text: `${rname(s, e.racer)} 冲线！第 ${e.place} 名`, hot: true };
    case 'predict': {
      const r = s.race?.racers.find((x) => x.idx === e.racer);
      if (r && effectivePower(s, r) === 'genius') return { text: `${rname(s, e.racer)} 预测自己会掷出 ${e.target} 点`, hot: true };
      return { text: `${rname(s, e.racer)} 预言 ${rname(s, e.target)} 会赢`, hot: true };
    }
    case 'raceEnd':
      return {
        text: `第 ${e.no + 1} 场结束：${e.places[0] != null ? pname(s, e.places[0]) + ' 得金 ' + e.gold : '金牌空缺'}，${e.places[1] != null ? pname(s, e.places[1]) + ' 得银 ' + e.silver : '银牌空缺'}`,
        hot: true,
      };
    case 'gameEnd':
      return { text: `比赛全部结束！`, hot: true };
  }
}

/** 动画播放期间对展示状态做的增量修改，让 HUD 跟着动画走。播完后会被权威 state 覆盖。 */
export function applyVisual(s: GameState, e: GameEvent): GameState {
  const n: GameState = structuredClone(s);
  const R = (i: number): Racer | undefined => n.race?.racers.find((r) => r.idx === i);
  switch (e.t) {
    case 'draftStart':
      n.phase = 'draft';
      n.pool = [...e.pool];
      n.draftOrder = [...e.order];
      n.draftIdx = 0;
      break;
    case 'drafted':
      n.pool = n.pool.filter((c) => c !== e.card);
      n.players[e.seat].hand.push(e.card);
      n.draftIdx++;
      break;
    case 'raceStart':
      n.phase = 'race';
      n.race = {
        no: e.no,
        track: e.track,
        spaces: e.spaces ?? {},
        current: e.first,
        finishers: [],
        eliminated: [],
        places: [null, null],
        racers: e.racers.map((r) => ({ idx: r.idx, seat: r.seat, card: r.card, power: r.card, pos: 0, tripped: false, done: 0, turns: 0 })),
      };
      for (const r of e.racers) {
        const p = n.players[r.seat];
        p.hand = p.hand.filter((c) => c !== r.card);
        if (!p.used.includes(r.card)) p.used.push(r.card);
      }
      break;
    case 'powerSwap': {
      const r = R(e.racer);
      if (r) r.power = e.power;
      break;
    }
    case 'turn':
      if (n.race) n.race.current = e.racer;
      break;
    case 'move': {
      const r = R(e.racer);
      if (r && e.path.length) r.pos = Math.min(30, e.path[e.path.length - 1]);
      break;
    }
    case 'place':
    case 'warp': {
      const r = R(e.racer);
      if (r) r.pos = e.to;
      break;
    }
    case 'trip': {
      const r = R(e.racer);
      if (r) r.tripped = true;
      break;
    }
    case 'standUp': {
      const r = R(e.racer);
      if (r) r.tripped = false;
      break;
    }
    case 'eliminate': {
      const r = R(e.racer);
      if (r) r.done = 'out';
      n.race?.eliminated.push(e.racer);
      break;
    }
    case 'finish': {
      const r = R(e.racer);
      if (r) {
        r.done = e.place;
        r.pos = 30;
      }
      n.race?.finishers.push(e.racer);
      break;
    }
    case 'bronze':
      n.players[e.seat].bronze = Math.max(0, n.players[e.seat].bronze + e.delta);
      break;
    case 'raceEnd':
      if (e.places[0] != null) n.players[e.places[0]].gold.push(e.gold);
      if (e.places[1] != null) n.players[e.places[1]].silver.push(e.silver);
      if (n.race) n.race.places = e.places;
      break;
    case 'predict': {
      const r = R(e.racer);
      if (r && effectivePower(s, r) !== 'genius') r.prediction = e.target;
      break;
    }
    case 'gameEnd':
      n.phase = 'end';
      break;
  }
  return n;
}

/** 每个事件的动画大致时长（毫秒，1× 速度），用于节奏。 */
export function eventDuration(e: GameEvent): number {
  switch (e.t) {
    case 'roll':
      return 1300;
    case 'duelRoll':
      return 1600;
    case 'move':
      return 120 + Math.max(0, e.path.length - 1) * 230;
    case 'warp':
      return 700;
    case 'place':
      return 350;
    case 'trip':
      return 700;
    case 'power':
      return 900;
    case 'eliminate':
      return 1100;
    case 'finish':
      return 1200;
    case 'raceStart':
      return 1500;
    case 'raceEnd':
      return 600;
    case 'drafted':
      return 450;
    default:
      return 250;
  }
}
