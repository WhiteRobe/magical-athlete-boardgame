import { useEffect, useState } from 'preact/hooks';
import type { LobbyMsg, RoomSummary } from '../../shared/protocol';
import { Conn, type ConnStatus } from '../net';
import { api } from '../api';
import { me, go, toast } from '../store';
import { Modal } from '../ui/common';
import { TopBar } from '../ui/TopBar';
import { Avatar } from '../art/Avatar';

const STATUS: Record<RoomSummary['status'], string> = { waiting: '等待中', playing: '比赛中', ended: '已结束' };

export function Lobby() {
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [status, setStatus] = useState<ConnStatus>('connecting');
  const [creating, setCreating] = useState(false);
  const [code, setCode] = useState('');
  const guest = !!me.value?.guest;

  useEffect(() => {
    const c = new Conn<LobbyMsg, never>('/ws/lobby', (m) => {
      if (m.type === 'rooms') setRooms(m.rooms);
      else if (m.type === 'upsert') setRooms((rs) => [m.room, ...rs.filter((r) => r.id !== m.room.id)]);
      else if (m.type === 'remove') setRooms((rs) => rs.filter((r) => r.id !== m.id));
    }, setStatus);
    return () => c.close();
  }, []);

  const sorted = [...rooms].sort((a, b) => {
    const w = (r: RoomSummary) => (r.status === 'waiting' ? 0 : r.status === 'playing' ? 1 : 2);
    return w(a) - w(b) || b.updatedAt - a.updatedAt;
  });

  async function join(id: string) {
    go(`/room/${id}`);
  }
  async function joinCode() {
    if (!/^\w{4,8}$/.test(code.trim())) return toast('请输入房间码');
    try {
      const { id } = await api.joinByCode(code.trim().toUpperCase());
      go(`/room/${id}`);
    } catch (e: any) {
      toast(e.message);
    }
  }
  function quick() {
    const r = sorted.find((r) => r.status === 'waiting' && r.humans + r.ais < r.maxSeats);
    if (r) join(r.id);
    else setCreating(true);
  }

  return (
    <>
      <TopBar />
      <div class="page">
        <div class="lobby-head">
          <h2>游戏大厅</h2>
          <span class="tag" style={{ background: status === 'open' ? '#3ddc97' : '#ffd23f' }}>
            {status === 'open' ? '● 已连接' : '○ 连接中…'}
          </span>
          <div class="spacer" />
          {!guest && (
            <div class="row" style={{ gap: '6px' }}>
              <input class="input" style={{ width: '120px', padding: '8px 10px' }} placeholder="房间码" value={code}
                onInput={(e) => setCode(e.currentTarget.value.toUpperCase())} maxLength={8}
                onKeyDown={(e) => e.key === 'Enter' && joinCode()} />
              <button class="btn ghost" onClick={joinCode}>加入</button>
            </div>
          )}
          {!guest && <button class="btn mint" onClick={quick}>快速加入</button>}
          <button class="btn primary" onClick={() => setCreating(true)}>{guest ? '开一局人机对战' : '创建房间'}</button>
        </div>

        {guest && (
          <div class="panel" style={{ marginBottom: '16px' }}>
            <b>游客模式</b>：可以和 AI 尽情比赛。想和朋友一起玩？<a href="#/" onClick={async () => { await api.logout().catch(() => {}); me.value = null; }}>注册一个账号</a>吧。
          </div>
        )}

        {sorted.length === 0 ? (
          <div class="empty-hint">
            <span class="big">🏟️</span>
            现在还没有房间，创建一个吧！
          </div>
        ) : (
          <div class="room-grid">
            {sorted.map((r) => (
              <div class="panel room-card" key={r.id} onClick={() => (guest ? toast('游客只能和 AI 对战') : join(r.id))}>
                <div class="row">
                  <span class={`tag status-${r.status}`}>{STATUS[r.status]}</span>
                  <span class="spacer" />
                  <span class="tag">{r.code}</span>
                </div>
                <h3 style={{ marginTop: '8px' }}>{r.name}</h3>
                <div class="muted" style={{ fontSize: '13px' }}>房主 {r.host}</div>
                <div class="seats">
                  {Array.from({ length: r.maxSeats }, (_, i) => (
                    <span class={`pip ${i < r.humans ? 'h' : i < r.humans + r.ais ? 'a' : ''}`} />
                  ))}
                  <span class="spacer" />
                  <span class="muted" style={{ fontSize: '13px', fontWeight: 700 }}>{r.humans + r.ais}/{r.maxSeats}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {creating && <CreateRoom onClose={() => setCreating(false)} guest={guest} />}
    </>
  );
}

function CreateRoom({ onClose, guest }: { onClose: () => void; guest: boolean }) {
  const [name, setName] = useState(`${me.value?.name ?? ''}的赛场`);
  const [n, setN] = useState(4);
  const [priv, setPriv] = useState(guest);
  const [busy, setBusy] = useState(false);
  async function create() {
    setBusy(true);
    try {
      const { id } = await api.createRoom(name.trim() || '魔法赛场', n, priv || guest);
      go(`/room/${id}`);
    } catch (e: any) {
      toast(e.message);
      setBusy(false);
    }
  }
  return (
    <Modal onClose={onClose}>
      <div class="row" style={{ marginBottom: '6px' }}>
        <Avatar id="coach" size={48} />
        <h3>{guest ? '人机对战' : '创建房间'}</h3>
      </div>
      <label class="label">房间名</label>
      <input class="input" value={name} maxLength={20} onInput={(e) => setName(e.currentTarget.value)} />
      <label class="label">人数（含 AI）</label>
      <div class="seg">
        {[2, 3, 4, 5, 6].map((k) => (
          <button class={k === n ? 'on' : ''} onClick={() => setN(k)}>{k} 人</button>
        ))}
      </div>
      {n === 2 && <div class="muted" style={{ fontSize: '12px', marginTop: '6px' }}>2 人局：每场每人派 2 名运动员上场。</div>}
      {!guest && (
        <>
          <label class="label">可见性</label>
          <div class="seg">
            <button class={!priv ? 'on' : ''} onClick={() => setPriv(false)}>公开</button>
            <button class={priv ? 'on' : ''} onClick={() => setPriv(true)}>私密（房间码加入）</button>
          </div>
        </>
      )}
      <div class="row" style={{ marginTop: '18px', justifyContent: 'flex-end' }}>
        <button class="btn ghost" onClick={onClose}>取消</button>
        <button class="btn primary" onClick={create} disabled={busy}>创建</button>
      </div>
    </Modal>
  );
}
