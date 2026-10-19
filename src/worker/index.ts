import type { Me } from '../shared/protocol';
import {
  clearCookie, hashPassword, randomId, readCookie, sessionCookie, signSession, validateCredentials, verifyPassword, verifySession,
} from './auth';
import { lobbyStub, roomStub, type Env, type Identity } from './env';

export { LobbyDO } from './lobby';
export { RoomDO } from './room';

const json = (data: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } });

const fail = (msg: string, status = 400) => json({ error: msg }, status);

const me = (u: Identity): Me => ({ id: u.id, name: u.name, guest: u.guest });

async function readBody(req: Request): Promise<Record<string, unknown>> {
  try {
    const b = await req.json();
    return b && typeof b === 'object' ? (b as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

async function currentUser(req: Request, env: Env): Promise<Identity | null> {
  const sid = readCookie(req, 'sid');
  return sid ? verifySession(sid, env.SESSION_SECRET) : null;
}

async function login(env: Env, user: Identity): Promise<Response> {
  const token = await signSession(user, env.SESSION_SECRET);
  return json(me(user), 200, { 'Set-Cookie': sessionCookie(token) });
}

async function handleApi(req: Request, env: Env, path: string): Promise<Response> {
  const method = req.method;
  const ip = req.headers.get('CF-Connecting-IP') ?? 'local';

  if (path === '/api/me' && method === 'GET') {
    const u = await currentUser(req, env);
    return u ? json(me(u)) : fail('未登录', 401);
  }

  if (path === '/api/logout' && method === 'POST') return json({ ok: true }, 200, { 'Set-Cookie': clearCookie });

  if ((path === '/api/register' || path === '/api/login') && method === 'POST') {
    if (!(await lobbyStub(env).rateLimit('auth:' + ip, 20))) return fail('操作太频繁，请稍后再试', 429);
    const { username, password } = await readBody(req);
    const bad = validateCredentials(username, password);
    if (bad) return fail(bad);
    const name = username as string;
    if (path === '/api/register') {
      const iterations = Number(env.PBKDF2_ITERATIONS) || 60000;
      const id = randomId('u_');
      const hash = await hashPassword(password as string, iterations);
      try {
        await env.DB.prepare('INSERT INTO users (id, username, pass_hash, created_at) VALUES (?, ?, ?, ?)').bind(id, name, hash, Date.now()).run();
      } catch (e) {
        if (String(e).includes('UNIQUE')) return fail('用户名已被占用');
        throw e;
      }
      return login(env, { id, name, guest: false });
    }
    const row = await env.DB.prepare('SELECT id, username, pass_hash FROM users WHERE username = ?').bind(name).first<{ id: string; username: string; pass_hash: string }>();
    if (!row || !(await verifyPassword(password as string, row.pass_hash))) return fail('用户名或密码错误', 401);
    return login(env, { id: row.id, name: row.username, guest: false });
  }

  if (path === '/api/guest' && method === 'POST') {
    if (!(await lobbyStub(env).rateLimit('guest:' + ip, 30))) return fail('操作太频繁，请稍后再试', 429);
    const n = crypto.getRandomValues(new Uint16Array(1))[0] % 10000;
    return login(env, { id: randomId('g_'), name: `游客${String(n).padStart(4, '0')}`, guest: true });
  }

  const user = await currentUser(req, env);
  if (!user) return fail('请先登录', 401);

  if (path === '/api/rooms' && method === 'POST') {
    const b = await readBody(req);
    const maxSeats = Math.min(6, Math.max(2, Math.floor(Number(b.maxSeats) || 4)));
    const name = (typeof b.name === 'string' && b.name.trim() ? b.name.trim() : `${user.name}的房间`).slice(0, 20);
    const priv = user.guest || b.private === true;
    const created = await lobbyStub(env).createRoom({ name, host: user.name, maxSeats, private: priv, guestOnly: user.guest });
    await roomStub(env, created.id).init({ ...created, name, host: user, maxSeats, private: priv, guestOnly: user.guest });
    return json(created);
  }

  if (path === '/api/rooms/join' && method === 'POST') {
    const { code } = await readBody(req);
    if (typeof code !== 'string' || !/^[A-Za-z0-9]{6}$/.test(code)) return fail('房间码是 6 位字母数字');
    const found = await lobbyStub(env).lookup(code);
    if (!found) return fail('房间不存在', 404);
    if (found.guestOnly || user.guest) return fail(user.guest ? '游客只能和 AI 对战，请注册后加入好友房间' : '这是游客的练习房，不能加入', 403);
    return json({ id: found.id });
  }

  return fail('接口不存在', 404);
}

async function handleWs(req: Request, env: Env, path: string): Promise<Response> {
  if (req.headers.get('Upgrade') !== 'websocket') return fail('需要 WebSocket', 426);
  const user = await currentUser(req, env);
  if (!user) return fail('请先登录', 401);
  const headers = new Headers(req.headers);
  headers.set('X-User-Id', user.id);
  headers.set('X-User-Name', encodeURIComponent(user.name));
  headers.set('X-Guest', user.guest ? '1' : '0');
  const fwd = new Request(req.url, { headers });
  if (path === '/ws/lobby') return lobbyStub(env).fetch(fwd);
  const m = path.match(/^\/ws\/room\/([A-Za-z0-9_-]{4,32})$/);
  if (m) return roomStub(env, m[1]).fetch(fwd);
  return fail('接口不存在', 404);
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const path = new URL(req.url).pathname;
    try {
      if (path.startsWith('/api/')) return await handleApi(req, env, path);
      if (path.startsWith('/ws/')) return await handleWs(req, env, path);
    } catch (e) {
      console.error(e);
      return fail('服务器开小差了，请稍后再试', 500);
    }
    return env.ASSETS.fetch(req);
  },
} satisfies ExportedHandler<Env>;
