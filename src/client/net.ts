/** 带自动重连的 WebSocket：指数退避，页面回到前台立即重连，25s 文本心跳 "ping"。 */
export type ConnStatus = 'connecting' | 'open' | 'closed';

export class Conn<In, Out> {
  private ws: WebSocket | null = null;
  private retry = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private ping: ReturnType<typeof setInterval> | undefined;
  private closed = false;
  private queue: Out[] = [];

  constructor(
    private path: string,
    private onMsg: (m: In) => void,
    private onStatus: (s: ConnStatus) => void,
    private onOpen?: () => Out | null,
  ) {
    document.addEventListener('visibilitychange', this.onVis);
    window.addEventListener('online', this.kick);
    this.connect();
  }

  private onVis = () => {
    if (document.visibilityState === 'visible') this.kick();
  };
  private kick = () => {
    if (this.closed) return;
    if (!this.ws || this.ws.readyState > 1) {
      clearTimeout(this.timer);
      this.retry = 0;
      this.connect();
    }
  };

  private connect() {
    if (this.closed) return;
    this.onStatus('connecting');
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${location.host}${this.path}`);
    this.ws = ws;
    ws.onopen = () => {
      this.retry = 0;
      this.onStatus('open');
      const hello = this.onOpen?.();
      if (hello) ws.send(JSON.stringify(hello));
      for (const m of this.queue.splice(0)) ws.send(JSON.stringify(m));
      clearInterval(this.ping);
      this.ping = setInterval(() => ws.readyState === 1 && ws.send('ping'), 25000);
    };
    ws.onmessage = (e) => {
      if (e.data === 'pong') return;
      try {
        this.onMsg(JSON.parse(e.data));
      } catch (err) {
        console.error('bad message', err);
      }
    };
    ws.onclose = () => {
      clearInterval(this.ping);
      if (this.ws !== ws) return;
      this.onStatus('closed');
      if (this.closed) return;
      const delay = Math.min(10000, 400 * 2 ** this.retry) * (0.7 + Math.random() * 0.6);
      this.retry++;
      this.timer = setTimeout(() => this.connect(), delay);
    };
    ws.onerror = () => ws.close();
  }

  send(m: Out) {
    if (this.ws?.readyState === 1) this.ws.send(JSON.stringify(m));
    else this.queue.push(m);
  }

  close() {
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.ping);
    document.removeEventListener('visibilitychange', this.onVis);
    window.removeEventListener('online', this.kick);
    this.ws?.close();
  }
}
