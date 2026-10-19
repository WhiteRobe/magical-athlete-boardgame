import { useEffect, useMemo, useState } from 'preact/hooks';
import { signal } from '@preact/signals';
import type { ClientMsg, RoomInfo, ServerMsg } from '../../shared/protocol';
import { Conn, type ConnStatus } from '../net';
import { me, go, toast } from '../store';
import { TopBar } from '../ui/TopBar';
import { SeatDot } from '../ui/common';
import { GamePlayer } from '../game/player';
import { GameView } from '../game/GameView';
import { Avatar } from '../art/Avatar';
import { sfx, startMusic } from '../audio';
import type { CharId } from '../../shared/types';

const AI_FACES: CharId[] = ['genius', 'mastermind', 'hypnotist', 'magician', 'alchemist', 'copycat'];
const HUMAN_FACES: CharId[] = ['hare', 'legs', 'coach', 'cheerleader', 'partyanimal', 'romantic'];

export function Room({ id }: { id: string }) {
  const s = useMemo(() => {
    const room = signal<RoomInfo | null>(null);
    const you = signal<number | null>(null);
    const status = signal<ConnStatus>('connecting');
    const player = new GamePlayer();
    const emotes = signal<{ id: number; seat: number; e: string }[]>([]);
    let eid = 0;
    let lastSeq = -1;
    const conn = new Conn<ServerMsg, ClientMsg>(
      `/ws/room/${id}`,
      (m) => {
        if (m.type === 'room') {
          room.value = m.room;
          you.value = m.you;
        } else if (m.type === 'game') {
          lastSeq = m.seq;
          player.ingest(m);
        } else if (m.type === 'emote') {
          const x = { id: ++eid, seat: m.seat, e: m.e };
          emotes.value = [...emotes.value, x];
          setTimeout(() => (emotes.value = emotes.value.filter((y) => y.id !== x.id)), 2500);
        } else if (m.type === 'error') {
          toast(m.msg);
        }
      },
      (st) => (status.value = st),
      () => ({ type: 'hello', lastSeq: lastSeq >= 0 ? lastSeq : undefined }),
    );
    return { room, you, status, player, conn, emotes };
  }, [id]);

  useEffect(() => () => s.conn.close(), [s]);

  const room = s.room.value;
  const inGame = !!s.player.view.value && room?.status !== 'waiting';

  useEffect(() => {
    startMusic(inGame ? 'race' : 'lobby');
  }, [inGame]);

  if (inGame && room) {
    return <GameView room={room} player={s.player} send={(m) => s.conn.send(m)} status={s.status.value} emotes={s.emotes.value} />;
  }

  return (
    <>
      <TopBar />
      <div class="page">
        {!room ? (
          <div class="empty-hint">{s.status.value === 'open' ? '进入房间…' : '连接中…'}</div>
        ) : (
          <Seats room={room} you={s.you.value} send={(m) => s.conn.send(m)} />
        )}
      </div>
    </>
  );
}

function Seats({ room, you, send }: { room: RoomInfo; you: number | null; send: (m: ClientMsg) => void }) {
  const myId = me.value?.id;
  const host = room.hostId === myId;
  const filled = room.seats.filter((x) => x.kind !== 'empty').length;
  const [copied, setCopied] = useState(false);

  return (
    <div class="room-wrap">
      <div class="room-title">
        <button class="btn ghost small" onClick={() => { send({ type: 'leave' }); go('/lobby'); }}>← 大厅</button>
        <h2>{room.name}</h2>
        <span
          class="code-chip"
          title="复制房间码"
          onClick={() => {
            navigator.clipboard?.writeText(room.code);
            setCopied(true);
            setTimeout(() => setCopied(false), 1200);
          }}
        >
          {copied ? '已复制' : room.code}
        </span>
        {room.private && <span class="tag">私密</span>}
        {room.guestOnly && <span class="tag">人机房</span>}
      </div>

      <div class="seat-grid">
        {room.seats.map((seat, i) => {
          if (seat.kind === 'empty') {
            return (
              <div class="seat empty" key={i}>
                <span class="seat-no"><SeatDot seat={i} /></span>
                <div style={{ fontSize: '30px', opacity: 0.6 }}>＋</div>
                <div class="actions">
                  {host && (
                    <>
                      <button class="btn small mint" onClick={() => send({ type: 'setSeat', seat: i, to: 'ai', level: 'normal' })}>AI 普通</button>
                      <button class="btn small ghost" onClick={() => send({ type: 'setSeat', seat: i, to: 'ai', level: 'easy' })}>AI 简单</button>
                    </>
                  )}
                  {you === null && !room.guestOnly && <button class="btn small" onClick={() => send({ type: 'setSeat', seat: i, to: 'me' })}>坐这里</button>}
                  {you !== null && you !== i && !room.guestOnly && <button class="btn small ghost" onClick={() => send({ type: 'setSeat', seat: i, to: 'me' })}>换到这</button>}
                </div>
              </div>
            );
          }
          const isMe = seat.kind === 'human' && seat.userId === myId;
          return (
            <div class="seat" key={i} style={isMe ? { boxShadow: '0 0 0 4px #ffd23f, 0 4px 0 #2b1b4d' } : undefined}>
              <span class="seat-no"><SeatDot seat={i} /></span>
              {seat.kind === 'human' && !seat.online && <span class="off tag">离线</span>}
              <Avatar class="avatar" id={(seat.kind === 'ai' ? AI_FACES : HUMAN_FACES)[i % 6]} />
              <div class="nm">{seat.name}{isMe ? '（你）' : ''}</div>
              <div class="row" style={{ gap: '4px' }}>
                {seat.kind === 'ai' ? <span class="tag" style={{ background: '#4cc9f0' }}>AI · {seat.level === 'easy' ? '简单' : '普通'}</span> : <span class="tag" style={{ background: '#3ddc97' }}>玩家</span>}
                {seat.kind === 'human' && seat.userId === room.hostId && <span class="tag" style={{ background: '#ffd23f' }}>房主</span>}
              </div>
              <div class="actions">
                {host && seat.kind === 'ai' && (
                  <>
                    <button class="btn small ghost" onClick={() => send({ type: 'setSeat', seat: i, to: 'ai', level: seat.level === 'easy' ? 'normal' : 'easy' })}>
                      改{seat.level === 'easy' ? '普通' : '简单'}
                    </button>
                    <button class="btn small ghost" onClick={() => send({ type: 'setSeat', seat: i, to: 'empty' })}>移除</button>
                  </>
                )}
                {host && seat.kind === 'human' && !isMe && <button class="btn small ghost" onClick={() => send({ type: 'kick', seat: i })}>请离</button>}
              </div>
            </div>
          );
        })}
      </div>

      <div class="panel row room-actions">
        <div style={{ flex: 1, minWidth: 200 }}>
          {host ? (
            filled < 2 ? '至少需要 2 名参赛者（可以添加 AI）。' : room.seats.some((x) => x.kind === 'empty') ? '空位不会参赛；也可以让 AI 补位。' : '人齐了，开赛吧！'
          ) : (
            '等待房主开始比赛…'
          )}
          <div class="muted" style={{ fontSize: '12px', marginTop: '4px' }}>把房间码发给朋友，就能一起玩。</div>
        </div>
        {host && room.seats.some((x) => x.kind === 'empty') && (
          <button class="btn mint" onClick={() => room.seats.forEach((x, i) => x.kind === 'empty' && send({ type: 'setSeat', seat: i, to: 'ai', level: 'normal' }))}>
            空位全部补 AI
          </button>
        )}
        {host && (
          <button class="btn primary big" disabled={filled < 2} onClick={() => { sfx('fanfare'); send({ type: 'start' }); }}>
            开始比赛
          </button>
        )}
      </div>
    </div>
  );
}
