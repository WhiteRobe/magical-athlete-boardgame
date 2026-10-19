/**
 * 带自动重连的 WebSocket。国内到 Cloudflare 的链路时好时坏，所以这里要做到「断了也基本无感」：
 * - 握手超时：5s 没连上就放弃这次，立刻重试（换一次 TCP 往往就换到能通的那条路）
 * - 心跳看门狗：每 12s 发 "ping"，25s 内没收到任何数据就判定连接已死（半开连接不会触发 onclose），立即重连
 * - 重连节奏：第一次立即，之后 0.5s/1s/2s/4s，封顶 5s
 * - 状态去抖：短暂重连（< 2.5s）不向界面报告断开，避免「重连中」一闪一闪
 */
export type ConnStatus = 'connecting' | 'open' | 'closed';

const PING_MS = 12000;
const DEAD_MS = 25000;
const HANDSHAKE_MS = 5000;
const SHOW_DOWN_MS = 2500;

export class Conn<In, Out> {
  private ws: WebSocket | null = null;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private ping: ReturnType<typeof setInterval> | undefined;
  private downTimer: ReturnType<typeof setTimeout> | undefined;
  private lastRx = 0;
  private closed = false;
  private shown: ConnStatus | null = null;
  private queue: Out[] = [];

  constructor(
    private path: string,
    private onMsg: (m: In) => void,
    private onStatus: (s: ConnStatus) => void,
    private onOpen?: () => Out | null,
  ) {
    document.addEventListener('visibilitychange', this.onVis);
    window.addEventListener('online', this.kick);
    window.addEventListener('pageshow', this.kick);
    this.report('connecting');
    this.connect();
  }

  private report(s: ConnStatus) {
    if (s === 'open') {
      clearTimeout(this.downTimer);
      this.downTimer = undefined;
    } else if (this.shown === 'open') {
      // 已经连上过：断开先不声张，2.5s 内重连成功就当没发生
      if (!this.downTimer) this.downTimer = setTimeout(() => {
        this.downTimer = undefined;
        if (this.ws?.readyState !== WebSocket.OPEN) this.emit('closed');
      }, SHOW_DOWN_MS);
      return;
    }
    this.emit(s);
  }

  private emit(s: ConnStatus) {
    if (this.shown === s) return;
    this.shown = s;
    this.onStatus(s);
  }

  private onVis = () => {
    if (document.visibilityState !== 'visible') return;
    // 从后台回来：计时器被浏览器节流过，心跳可能早已失效，直接检查一次
    if (this.ws?.readyState === WebSocket.OPEN && Date.now() - this.lastRx > DEAD_MS) this.drop();
    else this.kick();
  };

  private kick = () => {
    if (this.closed) return;
    if (!this.ws || this.ws.readyState > WebSocket.OPEN) {
      clearTimeout(this.timer);
      this.retry = 0;
      this.connect();
    }
  };

  /** 放弃当前连接（不等 onclose，死连接的 close 事件可能要很久才来），立即重连 */
  private drop() {
    const ws = this.ws;
    this.ws = null;
    clearInterval(this.ping);
    if (ws) {
      ws.onopen = ws.onmessage = ws.onclose = ws.onerror = null;
      try { ws.close(); } catch { /* ignore */ }
    }
    if (this.closed) return;
    this.report('connecting');
    clearTimeout(this.timer);
    const delay = this.retry === 0 ? 0 : Math.min(5000, 250 * 2 ** this.retry) * (0.8 + Math.random() * 0.4);
    this.retry++;
    this.timer = setTimeout(() => this.connect(), delay);
  }

  private connect() {
    if (this.closed) return;
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}${this.path}`);
    this.ws = ws;
    const handshake = setTimeout(() => this.ws === ws && ws.readyState !== WebSocket.OPEN && this.drop(), HANDSHAKE_MS);

    ws.onopen = () => {
      clearTimeout(handshake);
      this.retry = 0;
      this.lastRx = Date.now();
      this.report('open');
      const hello = this.onOpen?.();
      if (hello) ws.send(JSON.stringify(hello));
      for (const m of this.queue.splice(0)) ws.send(JSON.stringify(m));
      clearInterval(this.ping);
      this.ping = setInterval(() => {
        if (this.ws !== ws) return;
        if (Date.now() - this.lastRx > DEAD_MS) return this.drop();
        if (ws.readyState === WebSocket.OPEN) ws.send('ping');
      }, PING_MS);
    };
    ws.onmessage = (e) => {
      this.lastRx = Date.now();
      if (e.data === 'pong') return;
      try {
        this.onMsg(JSON.parse(e.data));
      } catch (err) {
        console.error('bad message', err);
      }
    };
    ws.onclose = (e) => {
      clearTimeout(handshake);
      if (this.ws !== ws) return;
      // 4000 = 服务端拒绝（无权限等），不要无限重试
      if (e.code === 4000) {
        this.ws = null;
        clearInterval(this.ping);
        this.emit('closed');
        return;
      }
      this.drop();
    };
    ws.onerror = () => {
      if (this.ws === ws) this.drop();
    };
  }

  send(m: Out) {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(m));
    else this.queue.push(m);
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    clearTimeout(this.downTimer);
    clearInterval(this.ping);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('online', this.kick);
    window.removeEventListener('pageshow', this.kick);
    const ws = this.ws;
    this.ws = null;
    ws?.close();
  }
}
