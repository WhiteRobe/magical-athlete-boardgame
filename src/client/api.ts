import type { Me } from '../shared/protocol';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* 非 JSON */
  }
  if (!res.ok) throw new Error(data?.error || data?.msg || `请求失败（${res.status}）`);
  return data as T;
}

export const api = {
  me: () => call<Me>('GET', '/api/me'),
  login: (username: string, password: string) => call<Me>('POST', '/api/login', { username, password }),
  register: (username: string, password: string) => call<Me>('POST', '/api/register', { username, password }),
  guest: () => call<Me>('POST', '/api/guest', {}),
  logout: () => call<unknown>('POST', '/api/logout', {}),
  createRoom: (name: string, maxSeats: number, isPrivate: boolean) =>
    call<{ id: string }>('POST', '/api/rooms', { name, maxSeats, private: isPrivate }),
  joinByCode: (code: string) => call<{ id: string }>('POST', '/api/rooms/join', { code }),
};
