import type { Identity } from './env';

const enc = new TextEncoder();

export function b64url(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function unb64url(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

export function randomId(prefix = '', bytes = 9): string {
  return prefix + b64url(crypto.getRandomValues(new Uint8Array(bytes)));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i];
  return d === 0;
}

// ---------- 密码：pbkdf2$sha256$<iter>$<salt>$<hash> ----------

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations }, key, 256);
  return new Uint8Array(bits);
}

export async function hashPassword(password: string, iterations: number): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, iterations);
  return `pbkdf2$sha256$${iterations}$${b64url(salt)}$${b64url(hash)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [algo, h, iter, salt, hash] = stored.split('$');
  if (algo !== 'pbkdf2' || h !== 'sha256') return false;
  const got = await pbkdf2(password, unb64url(salt), Number(iter));
  return timingSafeEqual(got, unb64url(hash));
}

// ---------- 会话 Cookie：sid = base64url(payload).base64url(HMAC) ----------

const SESSION_DAYS = 30;

interface SessionPayload { u: string; n: string; g: 0 | 1; e: number }

async function hmacKey(secret: string) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

export async function signSession(id: Identity, secret: string): Promise<string> {
  const payload: SessionPayload = { u: id.id, n: id.name, g: id.guest ? 1 : 0, e: Date.now() + SESSION_DAYS * 864e5 };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(secret), enc.encode(body));
  return `${body}.${b64url(sig)}`;
}

export async function verifySession(token: string, secret: string): Promise<Identity | null> {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), unb64url(sig), enc.encode(body));
    if (!ok) return null;
    const p = JSON.parse(new TextDecoder().decode(unb64url(body))) as SessionPayload;
    if (p.e < Date.now()) return null;
    return { id: p.u, name: p.n, guest: p.g === 1 };
  } catch {
    return null;
  }
}

export function sessionCookie(token: string): string {
  return `sid=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`;
}

export const clearCookie = 'sid=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0';

export function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.get('Cookie');
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return null;
}

// ---------- 校验 ----------

export const USERNAME_RE = /^[\p{Script=Han}A-Za-z0-9_]{2,16}$/u;

export function validateCredentials(username: unknown, password: unknown): string | null {
  if (typeof username !== 'string' || !USERNAME_RE.test(username)) return '用户名需为 2-16 位中文、字母、数字或下划线';
  if (typeof password !== 'string' || password.length < 6 || password.length > 64) return '密码长度需为 6-64 位';
  return null;
}
