import { DurableObject } from 'cloudflare:workers';
import type { LobbyMsg, RoomSummary } from '../shared/protocol';
import type { Env } from './env';
import { randomId } from './auth';

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const STALE_MS = 6 * 3600e3; // 长时间没更新的房间视为失效

interface RateEntry { n: number; reset: number }

/** 全局单例：房间摘要、房间码映射、大厅推送、登录限流（仅内存）。 */
export class LobbyDO extends DurableObject<Env> {
  private rate = new Map<string, RateEntry>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.storage.sql.exec(`CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      private INTEGER NOT NULL,
      guest_only INTEGER NOT NULL,
      summary TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    )`);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  // ---------- RPC ----------

  /** 返回 true 表示放行。窗口 10 分钟内最多 max 次。 */
  async rateLimit(key: string, max = 20): Promise<boolean> {
    const now = Date.now();
    const e = this.rate.get(key);
    if (!e || e.reset < now) {
      this.rate.set(key, { n: 1, reset: now + 600e3 });
      if (this.rate.size > 5000) this.rate.clear();
      return true;
    }
    return ++e.n <= max;
  }

  async createRoom(opts: { name: string; host: string; maxSeats: number; private: boolean; guestOnly: boolean }): Promise<{ id: string; code: string }> {
    const id = randomId('', 8);
    let code = '';
    for (;;) {
      const r = crypto.getRandomValues(new Uint8Array(6));
      code = Array.from(r, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join('');
      if (!this.ctx.storage.sql.exec('SELECT 1 FROM rooms WHERE code = ?', code).toArray().length) break;
    }
    const summary: RoomSummary = { id, code, name: opts.name, host: opts.host, status: 'waiting', humans: 1, ais: 0, maxSeats: opts.maxSeats, updatedAt: Date.now() };
    this.ctx.storage.sql.exec(
      'INSERT INTO rooms (id, code, private, guest_only, summary, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      id, code, opts.private ? 1 : 0, opts.guestOnly ? 1 : 0, JSON.stringify(summary), summary.updatedAt,
    );
    if (!opts.private) this.broadcast({ type: 'upsert', room: summary });
    await this.ensureAlarm();
    return { id, code };
  }

  async lookup(code: string): Promise<{ id: string; guestOnly: boolean } | null> {
    const row = this.ctx.storage.sql.exec<{ id: string; guest_only: number }>('SELECT id, guest_only FROM rooms WHERE code = ?', code.toUpperCase()).toArray()[0];
    return row ? { id: row.id, guestOnly: row.guest_only === 1 } : null;
  }

  async upsert(summary: RoomSummary): Promise<void> {
    const row = this.ctx.storage.sql.exec<{ private: number; guest_only: number }>('SELECT private, guest_only FROM rooms WHERE id = ?', summary.id).toArray()[0];
    if (!row) return;
    this.ctx.storage.sql.exec('UPDATE rooms SET summary = ?, updated_at = ? WHERE id = ?', JSON.stringify(summary), summary.updatedAt, summary.id);
    if (row.private || row.guest_only) return;
    this.broadcast(summary.status === 'ended' ? { type: 'remove', id: summary.id } : { type: 'upsert', room: summary });
  }

  async remove(id: string): Promise<void> {
    this.ctx.storage.sql.exec('DELETE FROM rooms WHERE id = ?', id);
    this.broadcast({ type: 'remove', id });
  }

  // ---------- 大厅 WebSocket ----------

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].send(JSON.stringify({ type: 'rooms', rooms: this.listPublic() } satisfies LobbyMsg));
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    if (msg === 'list') ws.send(JSON.stringify({ type: 'rooms', rooms: this.listPublic() } satisfies LobbyMsg));
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try { ws.close(code === 1006 ? 1000 : code); } catch { /* 已关闭 */ }
  }

  async alarm() {
    const cutoff = Date.now() - STALE_MS;
    const stale = this.ctx.storage.sql.exec<{ id: string }>('SELECT id FROM rooms WHERE updated_at < ?', cutoff).toArray();
    for (const r of stale) await this.remove(r.id);
    await this.ensureAlarm();
  }

  private async ensureAlarm() {
    const any = this.ctx.storage.sql.exec('SELECT 1 FROM rooms LIMIT 1').toArray().length > 0;
    if (any && (await this.ctx.storage.getAlarm()) == null) await this.ctx.storage.setAlarm(Date.now() + 3600e3);
  }

  private listPublic(): RoomSummary[] {
    return this.ctx.storage.sql
      .exec<{ summary: string }>("SELECT summary FROM rooms WHERE private = 0 AND guest_only = 0 ORDER BY updated_at DESC LIMIT 100")
      .toArray()
      .map((r) => JSON.parse(r.summary) as RoomSummary)
      .filter((s) => s.status !== 'ended');
  }

  private broadcast(msg: LobbyMsg) {
    const data = JSON.stringify(msg);
    for (const ws of this.ctx.getWebSockets()) {
      try { ws.send(data); } catch { /* 断开的连接由 close 回调处理 */ }
    }
  }
}
