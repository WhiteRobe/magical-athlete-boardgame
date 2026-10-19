import { useEffect, useMemo, useRef } from 'preact/hooks';
import { createGallery } from './gallery';
import { FIXED_TRACKS, randomSpaces } from '../../shared/characters';
import { CHAR_IDS, TRACK_ORDER } from '../../shared/types';
import { Avatar } from '../art/Avatar';
import { GamePlayer } from '../game/player';
import { GameView } from '../game/GameView';
import { LocalRoom } from './mock';
import type { RoomInfo } from '../../shared/protocol';
import type { AiLevel, CharId, GameState, TrackId } from '../../shared/types';
import { startMusic } from '../audio';

/**
 * 开发路由：
 *  #/dev/race      全 AI 观战（4 人）
 *  #/dev/play      你 + 3 个 AI
 *  #/dev/play2     你 + 1 个 AI（2 人局）
 *  #/dev/play6     你 + 5 个 AI
 *  可加 ?seed=123 ：#/dev/play?seed=7
 *  ?track=carnival ：快进到该赛道那一场的派人阶段（AI 代打前几场），开赛时播放赛道开场
 *  ?at=end ：快进到终局结算
 */
export function DevPage({ what }: { what: string }) {
  if (what.startsWith('pieces')) return <Gallery pitch={Number(what.split('=')[1]) || 0.35} />;
  if (what.startsWith('board')) return <BoardDemo q={what.split('?')[1] ?? ''} />;
  if (what === 'avatars') return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', padding: '12px' }}>{CHAR_IDS.map((id) => <div style={{ width: '120px', textAlign: 'center', color: '#fff' }}><Avatar id={id} size={110} /><div>{id}</div></div>)}</div>;
  return <Game what={what} />;
}

function Gallery({ pitch }: { pitch: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => createGallery(ref.current!, pitch), []);
  return <div ref={ref} style={{ position: 'fixed', inset: '0' }} />;
}

function Game({ what }: { what: string }) {
  const [mode, query] = what.split('?');
  const seed = Number(new URLSearchParams(query || '').get('seed')) || Math.floor(Math.random() * 1e9);
  const n = mode === 'play2' ? 2 : mode === 'play6' ? 6 : 4;
  const watch = mode === 'race';
  const names = ['我', '小兔', '老狐狸', '大黄', '阿呆', '咪咪'];

  const { player, room, info } = useMemo(() => {
    const player = new GamePlayer();
    const seats = Array.from({ length: n }, (_, i) => (i === 0 && !watch ? { name: names[0] } : { name: watch ? names[(i + 1) % names.length] : names[i], ai: (i % 2 ? 'normal' : 'easy') as AiLevel }));
    const room = new LocalRoom({ seed, seats }, watch ? null : 0, (m) => player.ingest(m));
    const qp = new URLSearchParams(query || '');
    const track = qp.get('track') as TrackId | null;
    const raceNo = track ? TRACK_ORDER.indexOf(track) : -1;
    if (raceNo > 0) room.fastForward((g) => g.pending?.kind === 'pick' && g.state.results.length === raceNo);
    if (qp.get('at') === 'end') room.fastForward(() => false);
    const info: RoomInfo = {
      id: 'dev', code: 'DEV000', name: '开发', hostId: 'me', private: true, guestOnly: true, status: 'playing',
      seats: seats.map((s, i) => (s.ai ? { kind: 'ai', name: s.name, level: s.ai } : { kind: 'human', userId: i === 0 ? 'me' : `u${i}`, name: s.name, online: true })),
    };
    return { player, room, info };
  }, [what]);

  useEffect(() => {
    room.start();
    startMusic('race');
    console.info('dev seed', seed);
  }, [room]);

  if (!player.view.value) return <div class="hero"><div class="empty-hint">准备中…</div></div>;
  return <GameView room={info} player={player} send={(m) => room.handle(m)} status="open" dev />;
}

/** 静态赛道展示：#/dev/board?track=wild&cards=hare,banana,... */
function BoardDemo({ q }: { q: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const params = new URLSearchParams(q);
    const track = (params.get('track') || 'mild') as TrackId;
    const cards = (params.get('cards') || 'hare,banana,centaur,mouth,hugebaby,rocket').split(',') as CharId[];
    const posList = (params.get('pos') || '0,0,3,7,12,15').split(',').map(Number);
    let disposed = false;
    let b: { dispose(): void } | null = null;
    import('../scene/Board3D').then((m) => {
      if (disposed) return;
      const board = m.createBoard3D(ref.current!);
      b = board;
      const s: GameState = {
        phase: 'race', players: cards.map((_, i) => ({ seat: i, name: `P${i + 1}`, hand: [], used: [], gold: [], silver: [], bronze: 0 })),
        deckCount: 0, pool: [], draftOrder: [], draftIdx: 0, firstSeat: 0, results: [], perRace: 1,
        race: {
          no: 0, track, spaces: FIXED_TRACKS[track] ?? randomSpaces(Math.random), current: 0, finishers: [], eliminated: [], places: [null, null],
          racers: cards.map((c, i) => ({ idx: i, seat: i, card: c, power: c, pos: posList[i] ?? 0, tripped: i === 3, done: 0, turns: 0, prediction: i === 2 ? 0 : undefined })),
        },
      };
      if (params.get('reveal')) {
        // 演示随机赛道开场揭晓
        board.play({ t: 'raceStart', no: 0, track, spaces: s.race!.spaces, racers: s.race!.racers.map((r) => ({ idx: r.idx, seat: r.seat, card: r.card })), first: 0 }, s, 1);
      } else board.sync(s);
      if (params.get('view')) board.setView?.(params.get('view') as 'follow' | 'overview');
    });
    return () => {
      disposed = true;
      b?.dispose();
    };
  }, [q]);
  return <div ref={ref} style={{ position: 'fixed', inset: '0' }} />;
}
