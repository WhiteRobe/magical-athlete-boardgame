import type { GameEvent, GameState } from '../../shared/types';
import { FINISH, TRACK_ORDER } from '../../shared/types';
import { themeOf } from '../art/themes';
import { CHARS } from '../../shared/characters';
import type { BoardApi } from '../game/board';
import { applyVisual } from '../game/describe';
import { SEAT_COLORS, contrastOn } from '../art/palette';
import { sfx } from '../audio';
import { Avatar } from '../art/Avatar';
import { render, h } from 'preact';

// WebGL 不可用时的降级赛道：DOM 网格 + CSS 3D 骰子。
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const DICE_ROT: Record<number, string> = {
  1: 'rotateX(0deg) rotateY(0deg)',
  2: 'rotateX(-90deg)',
  3: 'rotateY(-90deg)',
  4: 'rotateY(90deg)',
  5: 'rotateX(90deg)',
  6: 'rotateY(180deg)',
};

const seatOf = (s: GameState, idx: number) => s.race?.racers.find((r) => r.idx === idx)?.seat ?? 0;

export function createDomBoard(container: HTMLElement): BoardApi {
  const root = document.createElement('div');
  root.className = 'dom-board';
  container.insertBefore(root, container.firstChild);
  const diceWrap = document.createElement('div');
  diceWrap.className = 'dice-css-wrap';
  diceWrap.style.display = 'none';
  const FACE_TR: Record<number, string> = {
    1: 'translateZ(35px)', 6: 'rotateY(180deg) translateZ(35px)', 2: 'rotateX(90deg) translateZ(35px)',
    5: 'rotateX(-90deg) translateZ(35px)', 3: 'rotateY(90deg) translateZ(35px)', 4: 'rotateY(-90deg) translateZ(35px)',
  };
  const PIP: Record<number, number[]> = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
  const dieHtml = `<div class="dice-css">${[1, 6, 2, 5, 3, 4]
    .map((v) => `<div class="f" style="transform:${FACE_TR[v]}">${Array.from({ length: 9 }, (_, k) => `<i class="${PIP[v].includes(k) ? 'on' : ''}"></i>`).join('')}</div>`)
    .join('')}</div>`;
  diceWrap.innerHTML = dieHtml + dieHtml;
  container.appendChild(diceWrap);
  const diceEls = [...diceWrap.children] as HTMLElement[];
  function colorDie(el: HTMLElement, seat: number) {
    const c = SEAT_COLORS[seat % 6];
    el.style.setProperty('--die', c);
    el.style.setProperty('--pip', contrastOn(c));
  }
  async function roll(vals: [number, number][], sp: number) {
    diceWrap.style.display = '';
    sfx('shake');
    diceEls.forEach((el, i) => {
      el.style.display = i < vals.length ? '' : 'none';
      if (i < vals.length) colorDie(el, vals[i][1]);
      el.style.transition = 'none';
      el.style.transform = `rotateX(${720 + i * 90}deg) rotateY(${540 + i * 180}deg)`;
    });
    await sleep(30);
    vals.forEach(([v], i) => {
      diceEls[i].style.transition = '';
      diceEls[i].style.transform = DICE_ROT[v];
    });
    await sleep(1000 / sp);
    sfx('diceHit');
    await sleep(500 / sp);
  }
  let state: GameState | null = null;
  let selectable: number[] | null = null;
  let spaces: number[] | null = null;

  function draw(s: GameState) {
    state = s;
    const race = s.race;
    const track = race?.track ?? TRACK_ORDER[0];
    const theme = themeOf(track);
    const cells: preact.VNode<any>[] = [];
    for (let i = 0; i <= FINISH; i++) {
      const fx = i < FINISH && i > 0 ? race?.spaces?.[i] : undefined;
      const here = race?.racers.filter((r) => (i === FINISH ? r.done === 1 || r.done === 2 : !r.done && Math.min(r.pos, 29) === i)) ?? [];
      cells.push(
        h(
          'div',
          {
            class: `dom-cell ${i === FINISH ? 'finish' : ''}`,
            style: { background: i === FINISH ? undefined : theme.dom, ...(spaces?.includes(i) ? { outline: '4px solid #a66cff', cursor: 'pointer' } : {}) },
            onClick: () => spaces?.includes(i) && api.onPickSpace(i),
          },
          h('span', { class: 'no' }, i === 0 ? '起' : i === FINISH ? '终' : i),
          fx && h('span', { class: 'fx' }, fx.kind === 'star' ? '⭐' : fx.kind === 'trip' ? '⚠️' : fx.kind === 'portal' ? `🌀${fx.to}` : fx.delta > 0 ? `→${fx.delta}` : `←${-fx.delta}`),
          ...here.map((r) =>
            h(
              'div',
              {
                class: `dom-piece ${r.tripped ? 'tripped' : ''}`,
                title: CHARS[r.card].name,
                style: {
                  borderRadius: '50%',
                  boxShadow: `0 0 0 2px ${SEAT_COLORS[r.seat % 6]}${selectable?.includes(r.idx) ? ', 0 0 0 5px #fff' : ''}${race?.current === r.idx ? ', 0 0 10px 3px #ffd23f' : ''}`,
                  cursor: 'pointer',
                },
                onClick: () => api.onPick(r.idx),
              },
              h(Avatar, { id: r.card }),
            ),
          ),
        ),
      );
    }
    render(h('div', { class: 'dom-track' }, cells), root);
  }

  async function play(e: GameEvent, s: GameState, sp: number) {
    const after = applyVisual(s, e);
    switch (e.t) {
      case 'roll':
        await roll([[e.value, seatOf(s, e.racer)]], sp);
        break;
      case 'duelRoll':
        await roll([[e.av, seatOf(s, e.a)], [e.bv, seatOf(s, e.b)]], sp);
        break;
      case 'move':
        for (let i = 1; i < e.path.length; i++) {
          const step = applyVisual(s, { ...e, path: e.path.slice(0, i + 1) });
          draw(step);
          sfx('hop', i);
          await sleep(180 / sp);
        }
        break;
      case 'trip':
        sfx('trip');
        break;
      case 'power':
        sfx('power');
        await sleep(500 / sp);
        break;
      case 'eliminate':
        sfx('chomp');
        break;
      case 'warp':
        sfx('warp');
        break;
      default:
        await sleep(150 / sp);
    }
    draw(after);
  }

  const api: BoardApi = {
    onPick: () => {},
    onPickSpace: () => {},
    sync: draw,
    play,
    setSelectable(i) {
      selectable = i;
      if (state) draw(state);
    },
    setSelectableSpaces(sp) {
      spaces = sp;
      if (state) draw(state);
    },
    dispose() {
      render(null, root);
      root.remove();
      diceWrap.remove();
    },
  };
  return api;
}
