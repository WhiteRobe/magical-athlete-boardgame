import type { CharId, SpaceEffect, Spaces, TrackId } from './types';

export interface CharInfo {
  id: CharId;
  en: string;
  name: string; // 中文名
  skill: string; // 技能名
  text: string; // 能力说明（中文，自行改写）
  /** AI 用的粗略强度 1..10 */
  tier: number;
}

const C = (id: CharId, en: string, name: string, skill: string, text: string, tier: number): CharInfo => ({ id, en, name, skill, text, tier });

export const CHARS: Record<CharId, CharInfo> = {
  alchemist: C('alchemist', 'Alchemist', '炼金术士', '点石成金', '主移动掷出 1 或 2 时，可以改为移动 4。', 7),
  babayaga: C('babayaga', 'Baba Yaga', '芭芭雅嘎', '鸡脚狂奔', '停到我所在格的运动员会摔倒；我停到别人的格上时，对方也摔倒。', 5),
  banana: C('banana', 'Banana', '香蕉', '滑一跤', '经过我的运动员都会摔倒。', 4),
  blimp: C('blimp', 'Blimp', '飞艇', '顺风飘', '回合开始时若还没到第二个弯道（15 格），主移动 +3；到了或过了则 −1。', 7),
  centaur: C('centaur', 'Centaur', '半人马', '蹄子踢', '我经过的运动员后退 2 格。', 6),
  cheerleader: C('cheerleader', 'Cheerleader', '啦啦队长', '加油加油', '主移动前，可以让最后一名移动 2 格；这样做的话我再移动 1 格。', 5),
  coach: C('coach', 'Coach', '教练', '冲冲冲', '和我同格的所有运动员（包括我）主移动 +1。', 5),
  copycat: C('copycat', 'Copy Cat', '模仿猫', '照猫画虎', '我拥有当前领先运动员的能力（不含赛前能力）。', 6),
  dicemonger: C('dicemonger', 'Dicemonger', '骰商', '骰子买卖', '任何人每回合可以重掷一次主移动骰；别人这样做时，我移动 1 格。', 5),
  duelist: C('duelist', 'Duelist', '决斗家', '决斗！', '有人和我同格时，我可以发起决斗：双方掷骰，点大者移动 2 格，平局我赢。', 5),
  egg: C('egg', 'Egg', '蛋蛋', '炒蛋', '赛前从牌堆抽 3 名运动员，选 1 名，本场拥有它的能力。', 6),
  flipflop: C('flipflop', 'Flip Flop', '人字拖', '翻来覆去', '可以不掷主移动骰，改为和另一名运动员交换位置。', 7),
  genius: C('genius', 'Genius', '天才', '我算到了', '可以预测主移动点数；猜对的话本回合后再进行一个回合。', 6),
  gunk: C('gunk', 'Gunk', '黏液怪', '黏糊糊', '其他运动员主移动 −1。', 6),
  hare: C('hare', 'Hare', '野兔', '骄兵', '主移动 +2；但回合开始时如果我独自领先，就跳过主移动。', 7),
  heckler: C('heckler', 'Heckler', '起哄者', '幸灾乐祸', '任何运动员回合结束时如果离本回合起点不超过 1 格，我移动 2 格。', 5),
  hugebaby: C('hugebaby', 'Huge Baby', '巨婴', '超级巨大', '除起点外没人能和我同格；有人要来时，改放到我身后一格。', 6),
  hypnotist: C('hypnotist', 'Hypnotist', '催眠师', '嘶——', '主移动前，可以把一名运动员瞬移到我所在格。', 6),
  inchworm: C('inchworm', 'Inchworm', '尺蠖', '扭一扭', '其他运动员主移动掷出 1 时，对方取消这次移动，我移动 1 格。', 5),
  lackey: C('lackey', 'Lackey', '跟班', '遵命老爷', '其他运动员主移动掷出 6 时，我先移动 2 格。', 5),
  leaptoad: C('leaptoad', 'Leaptoad', '跳跳蛙', '蛙跳', '移动时跳过有其他运动员的格子（不计步数）。', 6),
  legs: C('legs', 'Legs', '大长腿', '慢跑', '可以不掷主移动骰，改为移动 5 格。', 8),
  lovableloser: C('lovableloser', 'Lovable Loser', '可爱输家', '哎呀呀', '主移动前，如果我独自垫底，获得 1 分。', 5),
  magician: C('magician', 'Magician', '魔术师', '变！', '主移动最多可以重掷两次。', 6),
  mastermind: C('mastermind', 'Mastermind', '幕后主脑', '一切尽在掌握', '第一个回合开始时预测谁会赢；猜中则比赛立即结束，我拿第 2 名。', 6),
  mouth: C('mouth', 'M.O.U.T.H.', '大嘴巴', '啊呜', '我停到恰好有另一名运动员的格时，把它吃掉（淘汰出本场）。', 6),
  partyanimal: C('partyanimal', 'Party Animal', '派对动物', '人气磁铁', '主移动前，所有运动员朝我移动 1 格；和我同格的每名运动员让我主移动 +1。', 6),
  rocket: C('rocket', 'Rocket Scientist', '火箭科学家', '轰隆', '掷出主移动骰后，可以改为移动两倍点数；这样做的话移动后摔倒。', 7),
  romantic: C('romantic', 'Romantic', '浪漫主义者', '啊，爱情！', '每当有人停到恰好有另一名运动员的格，我移动 2 格。', 5),
  scoocher: C('scoocher', 'Scoocher', '挪步者', '蹭蹭蹭', '每当其他运动员的能力发动，我移动 1 格。', 6),
  sisyphus: C('sisyphus', 'Sisyphus', '西西弗斯', '推石不止', '赛前获得 4 分；主移动掷出 6 时改为瞬移回起点并失去 1 分。', 5),
  skipper: C('skipper', 'Skipper', '船长', '抢舵', '任何人主移动掷出 1 时，下一个行动的是我。', 5),
  stickler: C('stickler', 'Stickler', '较真者', '其实吧……', '其他运动员必须恰好走到终点才能冲线，走多了就原地不动。', 5),
  suckerfish: C('suckerfish', 'Suckerfish', '吸盘鱼', '蹭车', '和我同格的运动员移动时，我可以跟到它的新位置。', 6),
  thirdwheel: C('thirdwheel', 'Third Wheel', '电灯泡', '硬挤', '主移动前，可以瞬移到恰好有 2 名运动员的格子。', 6),
  twin: C('twin', 'Twin', '双胞胎', '照搬', '赛前可以选一名之前比赛的冠军，本场用它的能力。', 5),
};

/** 狂野面（官方）*/
export const WILD: Spaces = {
  1: { kind: 'star' },
  5: { kind: 'trip' },
  7: { kind: 'arrow', delta: 3 },
  11: { kind: 'arrow', delta: 1 },
  13: { kind: 'star' },
  16: { kind: 'arrow', delta: -4 },
  17: { kind: 'trip' },
  23: { kind: 'arrow', delta: 2 },
  24: { kind: 'arrow', delta: -2 },
  26: { kind: 'trip' },
};

/**
 * 欢乐嘉年华（原创）：前半段甜头多，后半段陷阱密。
 * 4→7 星、9 传送到 18、13 退回 10、21 传送回 12、25 滑回 20 正好摔倒、28 弹射冲线。
 */
export const CARNIVAL: Spaces = {
  2: { kind: 'star' },
  4: { kind: 'arrow', delta: 3 },
  6: { kind: 'trip' },
  7: { kind: 'star' },
  9: { kind: 'portal', to: 18 },
  11: { kind: 'trip' },
  13: { kind: 'arrow', delta: -3 },
  14: { kind: 'star' },
  16: { kind: 'arrow', delta: 2 },
  20: { kind: 'trip' },
  21: { kind: 'portal', to: 12 },
  22: { kind: 'star' },
  25: { kind: 'arrow', delta: -5 },
  27: { kind: 'trip' },
  28: { kind: 'arrow', delta: 2 },
};

export const FIXED_TRACKS: Partial<Record<TrackId, Spaces>> = { mild: {}, wild: WILD, carnival: CARNIVAL };

/**
 * 随机赛道：1..29 格中随机放置特殊格。rand 返回 [0,1)，由引擎的种子 RNG 提供以保证可重放。
 * 约束：箭头/传送门的落点在 1..29 且是普通格、星或摔倒格（不会连锁到另一个箭头/传送门）；29 号格保持普通。
 */
export function randomSpaces(rand: () => number): Spaces {
  const int = (a: number, b: number) => a + Math.floor(rand() * (b - a + 1));
  for (;;) {
    const sp: Spaces = {};
    const free = () => {
      for (let k = 0; k < 50; k++) {
        const p = int(1, 28);
        if (!sp[p]) return p;
      }
      return -1;
    };
    const put = (n: number, f: () => SpaceEffect) => {
      for (let i = 0; i < n; i++) {
        const p = free();
        if (p > 0) sp[p] = f();
      }
    };
    put(int(3, 5), () => ({ kind: 'trip' }));
    put(int(2, 3), () => ({ kind: 'star' }));
    put(int(2, 3), () => ({ kind: 'arrow', delta: int(1, 4) }));
    put(int(2, 3), () => ({ kind: 'arrow', delta: -int(1, 4) }));
    put(1, () => ({ kind: 'portal', to: 0 }));
    if (rand() < 0.5) put(1, () => ({ kind: 'portal', to: 0 }));
    // 传送门目标：前进或后退 4..9 格
    let ok = true;
    for (const [k, e] of Object.entries(sp)) {
      const p = Number(k);
      if (e.kind === 'portal') e.to = p + (rand() < 0.6 ? 1 : -1) * int(4, 9);
      const to = e.kind === 'arrow' ? p + e.delta : e.kind === 'portal' ? e.to : null;
      if (to === null) continue;
      const t = sp[to];
      if (to < 1 || to > 29 || (t && (t.kind === 'arrow' || t.kind === 'portal'))) ok = false;
    }
    // 传送门的落点之后可能又被别的格占上，最后再检查一遍
    if (ok) return sp;
  }
}

/** 固定赛道的特殊格；随机赛道请读 race.spaces */
export function spaceEffect(track: TrackId, pos: number): SpaceEffect | undefined {
  return FIXED_TRACKS[track]?.[pos];
}

export const TRACK_NAME: Record<TrackId, string> = { mild: '温和赛道', wild: '狂野赛道', carnival: '欢乐嘉年华', random: '随机赛道' };
