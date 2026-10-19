// 服务端 WebSocket 冒烟测试：node scripts/ws-smoke.mjs [baseUrl]
// 流程：注册两人 → 建房 → 加入 → 设 AI → 开局 → 自动操作 → 断线重连 → 打完一局 → 游客限制。
const BASE = process.argv[2] ?? 'http://localhost:8787';
const WS = BASE.replace(/^http/, 'ws');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const assert = (c, m) => { if (!c) { console.error('✘', m); process.exit(1); } else console.log('✔', m); };

async function api(path, body, cookie) {
  const res = await fetch(BASE + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'Content-Type': 'application/json', ...(cookie ? { Cookie: cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const set = res.headers.get('set-cookie');
  return { status: res.status, data: await res.json(), cookie: set ? set.split(';')[0] : cookie };
}

async function user(name) {
  let r = await api('/api/register', { username: name, password: 'secret123' });
  if (r.status !== 200) r = await api('/api/login', { username: name, password: 'secret123' });
  assert(r.status === 200, `登录 ${name}`);
  return r.cookie;
}

/** 一个自动玩家：对自己的决策选第一个合法选项 */
function client(label, cookie, roomId, { auto = true } = {}) {
  const c = { label, room: null, game: null, you: null, errors: [], closed: false };
  c.ws = new WebSocket(`${WS}/ws/room/${roomId}`, { headers: { Cookie: cookie } });
  c.ready = new Promise((r) => c.ws.addEventListener('open', r));
  c.ws.addEventListener('close', () => (c.closed = true));
  c.ws.addEventListener('message', (ev) => {
    const m = JSON.parse(ev.data);
    if (m.type === 'room') { c.room = m.room; c.you = m.you; }
    else if (m.type === 'error') c.errors.push(m.msg);
    else if (m.type === 'game') {
      c.game = m;
      if (m.full) c.gotFull = true;
      if (!auto || !m.pending?.mine) return;
      const req = m.pending.req;
      let msg;
      if (req.kind === 'pick') msg = { type: 'pick', seq: m.seq, cards: m.state.players[m.you].hand.slice(0, req.count) };
      else if (req.kind === 'draft') msg = { type: 'answer', seq: m.seq, answer: { kind: 'draft', card: req.options[0] } };
      else if (req.kind === 'main') msg = { type: 'answer', seq: m.seq, answer: { kind: 'main', mode: 'roll' } };
      else {
        const answer = {
          afterRoll: { kind: 'afterRoll', choice: 'keep' },
          egg: { kind: 'egg', card: req.options?.[0] },
          twin: { kind: 'twin', card: null },
          mastermind: { kind: 'mastermind', target: req.options?.[0] },
          cheer: { kind: 'cheer', use: false },
          hypnotist: { kind: 'hypnotist', target: null },
          thirdwheel: { kind: 'thirdwheel', space: null },
          duel: { kind: 'duel', use: true },
          follow: { kind: 'follow', use: true },
        }[req.kind];
        if (answer) msg = { type: 'answer', seq: m.seq, answer };
      }
      if (msg) setTimeout(() => c.ws.send(JSON.stringify(msg)), 5);
    }
  });
  c.send = (m) => c.ws.send(JSON.stringify(m));
  return c;
}

const waitFor = async (fn, label, ms = 8000) => {
  const t = Date.now();
  while (Date.now() - t < ms) { if (fn()) return assert(true, label); await sleep(50); }
  assert(false, label + '（超时）');
};

const ca = await user('smoke_a');
const cb = await user('smoke_b');
const { data: room } = await api('/api/rooms', { name: '冒烟房', maxSeats: 4 }, ca);
assert(room.id && room.code, `建房 ${room.code}`);
const join = await api('/api/rooms/join', { code: room.code.toLowerCase() }, cb);
assert(join.data.id === room.id, '房间码加入');

const A = client('A', ca, room.id);
await A.ready;
await waitFor(() => A.room && A.you === 0, 'A 在 0 号座');
const B = client('B', cb, room.id);
await B.ready;
await waitFor(() => B.you === 1 && A.room.seats[1].kind === 'human', 'B 自动入座 1 号');

B.send({ type: 'setSeat', seat: 2, to: 'ai', level: 'normal' });
await waitFor(() => B.errors.includes('只有房主可以设置座位'), '非房主不能设 AI');
A.send({ type: 'setSeat', seat: 2, to: 'ai', level: 'normal' });
A.send({ type: 'setSeat', seat: 3, to: 'ai', level: 'easy' });
await waitFor(() => A.room.seats[2].kind === 'ai' && A.room.seats[3].kind === 'ai', 'A 设置两个 AI');
A.send({ type: 'start' });
await waitFor(() => A.game && B.game, '开局，双方收到 game');
await waitFor(() => A.game.seq > 10, '进入对局推进');

// 断线重连
B.ws.close();
await waitFor(() => A.room.seats[1].online === false, 'A 看到 B 掉线');
const seqAtDrop = A.game.seq;
const B2 = client('B2', cb, room.id);
await waitFor(() => B2.gotFull && B2.you === 1, `B 重连拿到 full 同步 (seq=${seqAtDrop})`);

await waitFor(() => A.game.state.phase === 'end' && A.game.pending === null, '打完一局', Number(process.env.SMOKE_GAME_MS ?? 60000));
await waitFor(() => A.room.status === 'ended', '房间状态 ended');
console.log('  比分', A.game.state.players.map((p) => `${p.name}:${p.gold.concat(p.silver).reduce((x, y) => x + y, 0) + p.bronze}`).join(' '));

// 游客限制
const { cookie: cg } = await api('/api/guest', {});
const gj = await api('/api/rooms/join', { code: room.code }, cg);
assert(gj.status === 403, '游客不能用房间码加入');
const G = client('G', cg, room.id, { auto: false });
await waitFor(() => G.errors.length > 0 && G.closed, '游客 WS 被拒');
console.log('  拒绝原因：', G.errors[0]);

// 再来一局
A.send({ type: 'rematch' });
await waitFor(() => A.room.status === 'playing' && A.game.state.phase !== 'end', '再来一局');

for (const c of [A, B2]) c.ws.close();
console.log('全部通过');
process.exit(0);
