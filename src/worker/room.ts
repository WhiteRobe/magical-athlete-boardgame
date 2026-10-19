import { DurableObject } from 'cloudflare:workers';
import type { AiLevel, Answer, CharId, GameConfig, GameEvent, Request as GameRequest } from '../shared/types';
import { playerScore } from '../shared/types';
import type { ClientMsg, PendingView, RoomInfo, RoomSummary, SeatInfo, ServerMsg } from '../shared/protocol';
import { Game, aiAnswer, aiPick, defaultAnswer } from './engine';
import { lobbyStub, type Env, type Identity } from './env';

const CLEANUP_MS = 10 * 60e3;
const AI_NAMES = ['小机灵', '铁皮蛙', '算盘精', '跑跑机', '骰子侠', '电子鸭', '萝卜头', '咕噜球'];

interface PickState { seq: number; picks: Record<number, CharId[]> }
interface TimerState { seq: number; deadline: number }

/** 一个房间：座位管理 + 权威游戏状态 + 房内 WebSocket。 */
export class RoomDO extends DurableObject<Env> {
  private info: RoomInfo | null = null;
  private config: GameConfig | null = null;
  private game: Game | null = null;
  private picks: PickState | null = null;
  private timer: TimerState | null = null;
  private offline: Record<string, number> = {};
  private cleanupAt: number | null = null;
  private dirty = new Set<string>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    const sql = ctx.storage.sql;
    sql.exec('CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT NOT NULL)');
    sql.exec('CREATE TABLE IF NOT EXISTS log (id INTEGER PRIMARY KEY AUTOINCREMENT, answers TEXT NOT NULL)');
    for (const { k, v } of sql.exec<{ k: string; v: string }>('SELECT k, v FROM kv')) {
      const val = JSON.parse(v);
      if (k === 'info') this.info = val;
      else if (k === 'config') this.config = val;
      else if (k === 'picks') this.picks = val;
      else if (k === 'timer') this.timer = val;
      else if (k === 'offline') this.offline = val;
      else if (k === 'cleanup') this.cleanupAt = val;
    }
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong'));
  }

  // ---------- 持久化 ----------

  private set<K extends 'info' | 'config' | 'picks' | 'timer' | 'offline' | 'cleanup'>(k: K) {
    this.dirty.add(k);
  }

  private flush(newAnswers: Answer[] = []) {
    const sql = this.ctx.storage.sql;
    if (newAnswers.length) sql.exec('INSERT INTO log (answers) VALUES (?)', JSON.stringify(newAnswers));
    const vals: Record<string, unknown> = {
      info: this.info, config: this.config, picks: this.picks, timer: this.timer, offline: this.offline, cleanup: this.cleanupAt,
    };
    for (const k of this.dirty) {
      if (vals[k] == null) sql.exec('DELETE FROM kv WHERE k = ?', k);
      else sql.exec('INSERT INTO kv (k, v) VALUES (?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v', k, JSON.stringify(vals[k]));
    }
    this.dirty.clear();
  }

  /** 懒加载：被驱逐后从回答日志重放。 */
  private getGame(): Game | null {
    if (this.game || !this.config) return this.game;
    const answers: Answer[] = [];
    for (const r of this.ctx.storage.sql.exec<{ answers: string }>('SELECT answers FROM log ORDER BY id')) answers.push(...JSON.parse(r.answers));
    try {
      this.game = Game.restore(this.config, answers);
    } catch (e) {
      console.error('restore failed', e);
      this.config = null;
      this.set('config');
      if (this.info) { this.info.status = 'waiting'; this.set('info'); }
      this.ctx.storage.sql.exec('DELETE FROM log');
      this.flush();
    }
    return this.game;
  }

  // ---------- RPC ----------

  async init(opts: { id: string; code: string; name: string; host: Identity; maxSeats: number; private: boolean; guestOnly: boolean }) {
    if (this.info) return;
    const seats: SeatInfo[] = Array.from({ length: opts.maxSeats }, () => ({ kind: 'empty' }) as SeatInfo);
    seats[0] = { kind: 'human', userId: opts.host.id, name: opts.host.name, online: false, guest: opts.host.guest };
    this.info = { id: opts.id, code: opts.code, name: opts.name, hostId: opts.host.id, private: opts.private, guestOnly: opts.guestOnly, status: 'waiting', seats };
    this.cleanupAt = Date.now() + CLEANUP_MS;
    this.set('info');
    this.set('cleanup');
    this.flush();
    await this.schedule();
  }

  // ---------- WebSocket ----------

  async fetch(req: Request): Promise<Response> {
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('expected websocket', { status: 426 });
    const user: Identity = {
      id: req.headers.get('X-User-Id') ?? '',
      name: decodeURIComponent(req.headers.get('X-User-Name') ?? ''),
      guest: req.headers.get('X-Guest') === '1',
    };
    const pair = new WebSocketPair();
    const ws = pair[1];
    const reject = (msg: string) => {
      // 握手完成后再关闭，否则客户端收不到错误消息
      ws.accept();
      ws.send(JSON.stringify({ type: 'error', msg } satisfies ServerMsg));
      setTimeout(() => ws.close(4000, 'rejected'), 200);
      return new Response(null, { status: 101, webSocket: pair[0] });
    };
    const info = this.info;
    if (!info || !user.id) return reject('房间不存在或已解散');
    const isHost = user.id === info.hostId;
    const seated = this.seatOf(user.id) != null;
    if (info.guestOnly && !isHost) return reject('这是游客的练习房，不能加入');
    if (user.guest && !isHost) return reject('游客只能在自己的房间里和 AI 对战');

    this.ctx.acceptWebSocket(ws, [user.id]);
    ws.serializeAttachment(user);

    let seatChanged = false;
    if (info.status === 'waiting' && !seated) {
      const empty = info.seats.findIndex((s) => s.kind === 'empty');
      if (empty >= 0) {
        info.seats[empty] = { kind: 'human', userId: user.id, name: user.name, online: true, guest: user.guest };
        this.set('info');
        seatChanged = true;
      }
    }
    if (user.id in this.offline) { delete this.offline[user.id]; this.set('offline'); }
    if (this.cleanupAt != null) { this.cleanupAt = null; this.set('cleanup'); }

    this.send(ws, this.roomMsg(user.id));
    if (this.getGame()) this.send(ws, this.gameMsg(user.id, [], true));
    this.broadcastRoom();
    // 有人回来后，原本因“无人在线”暂停的托管可以继续
    const { answers, events } = this.autoLoop();
    if (answers.length) await this.finishStep(answers, events);
    else {
      this.flush();
      await this.schedule();
    }
    if (seatChanged) await this.reportLobby();
    return new Response(null, { status: 101, webSocket: pair[0] });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer) {
    const user = ws.deserializeAttachment() as Identity;
    let msg: ClientMsg;
    try {
      msg = JSON.parse(typeof raw === 'string' ? raw : new TextDecoder().decode(raw));
    } catch {
      return;
    }
    const err = await this.handle(ws, user, msg);
    if (err) this.send(ws, { type: 'error', msg: err });
  }

  async webSocketClose(ws: WebSocket, code: number) {
    try { ws.close(code === 1006 ? 1000 : code); } catch { /* 已关闭 */ }
    await this.onDisconnect(ws);
  }

  async webSocketError(ws: WebSocket) {
    await this.onDisconnect(ws);
  }

  private async onDisconnect(ws: WebSocket) {
    const user = ws.deserializeAttachment() as Identity | null;
    if (!user || !this.info) return;
    const still = this.ctx.getWebSockets(user.id).some((s) => s !== ws && s.readyState === WebSocket.OPEN);
    if (!still && this.info.status === 'playing' && this.seatOf(user.id) != null) {
      this.offline[user.id] = Date.now();
      this.set('offline');
    }
    if (this.openSockets(ws).length === 0) {
      this.cleanupAt = Date.now() + CLEANUP_MS;
      this.set('cleanup');
    }
    this.flush();
    this.broadcastRoom(ws);
    await this.schedule();
  }

  // ---------- 消息处理 ----------

  private async handle(ws: WebSocket, user: Identity, msg: ClientMsg): Promise<string | null> {
    const info = this.info;
    if (!info) return '房间不存在';
    const isHost = user.id === info.hostId;
    const mySeat = this.seatOf(user.id);

    switch (msg.type) {
      case 'hello': {
        this.send(ws, this.roomMsg(user.id));
        if (this.getGame()) this.send(ws, this.gameMsg(user.id, [], true));
        return null;
      }
      case 'emote': {
        if (mySeat == null || typeof msg.e !== 'string') return null;
        const data = JSON.stringify({ type: 'emote', seat: mySeat, e: msg.e.slice(0, 16) } satisfies ServerMsg);
        for (const s of this.openSockets()) s.send(data);
        return null;
      }
      case 'setSeat': {
        if (info.status !== 'waiting') return '对局已开始';
        const seat = info.seats[msg.seat];
        if (!seat) return '座位不存在';
        if (msg.to === 'me') {
          if (seat.kind !== 'empty') return '这个座位已经有人了';
          if (mySeat != null) info.seats[mySeat] = { kind: 'empty' };
          info.seats[msg.seat] = { kind: 'human', userId: user.id, name: user.name, online: true, guest: user.guest };
        } else {
          if (!isHost) return '只有房主可以设置座位';
          if (msg.to === 'ai') {
            if (seat.kind === 'human') return '请先把玩家移出座位';
            const level: AiLevel = msg.level === 'easy' ? 'easy' : 'normal';
            info.seats[msg.seat] = { kind: 'ai', name: this.aiName(), level };
          } else {
            if (seat.kind === 'human' && seat.userId !== user.id) this.kicked(seat.userId);
            info.seats[msg.seat] = { kind: 'empty' };
          }
        }
        return this.afterSeatChange();
      }
      case 'kick': {
        if (!isHost) return '只有房主可以踢人';
        if (info.status !== 'waiting') return '对局已开始';
        const seat = info.seats[msg.seat];
        if (!seat || seat.kind !== 'human' || seat.userId === user.id) return '不能移出这个座位';
        this.kicked(seat.userId);
        info.seats[msg.seat] = { kind: 'empty' };
        return this.afterSeatChange();
      }
      case 'leave': {
        if (info.status === 'waiting' && mySeat != null) {
          info.seats[mySeat] = { kind: 'empty' };
          if (isHost) this.passHost(user.id);
          await this.afterSeatChange();
        }
        ws.close(1000, 'leave');
        return null;
      }
      case 'start':
      case 'rematch': {
        if (!isHost) return '只有房主可以开始';
        if (msg.type === 'start' && info.status !== 'waiting') return '对局已开始';
        if (msg.type === 'rematch' && info.status !== 'ended') return '对局还没结束';
        return this.startGame();
      }
      case 'answer':
      case 'pick': {
        const game = this.getGame();
        if (!game || info.status !== 'playing') return '对局未开始';
        if (msg.seq !== game.seq) return '操作已过期';
        if (mySeat == null) return '你不在座位上';
        const req = game.pending;
        if (!req) return '对局已结束';
        let first: Answer | null = null;
        if (msg.type === 'answer') {
          if (req.kind === 'pick' || req.seat !== mySeat) return '现在不是你的操作';
          first = msg.answer;
        } else {
          if (req.kind !== 'pick' || !req.seats.includes(mySeat)) return '现在不需要派人';
          const cur = this.curPicks(game.seq);
          if (cur[mySeat]) return '你已经派过人了';
          const hand = game.state.players[mySeat].hand;
          const cards = Array.isArray(msg.cards) ? msg.cards : [];
          if (cards.length !== req.count || new Set(cards).size !== cards.length || !cards.every((c) => hand.includes(c))) return '派人无效';
          cur[mySeat] = cards;
          this.set('picks');
          first = this.mergedPicks(req);
        }
        return this.advance(first);
      }
    }
    return null;
  }

  private afterSeatChange(): Promise<null> {
    this.set('info');
    this.flush();
    this.broadcastRoom();
    return this.reportLobby().then(() => null);
  }

  private kicked(userId: string) {
    for (const s of this.ctx.getWebSockets(userId)) this.send(s, { type: 'error', msg: '你被房主移出了座位' });
  }

  private passHost(oldId: string) {
    const info = this.info!;
    const next = info.seats.find((s) => s.kind === 'human' && s.userId !== oldId);
    if (next && next.kind === 'human') info.hostId = next.userId;
  }

  private aiName(): string {
    const used = new Set(this.info!.seats.map((s) => (s.kind === 'empty' ? '' : s.name)));
    const free = AI_NAMES.filter((n) => !used.has('AI·' + n));
    return 'AI·' + (free[Math.floor(Math.random() * free.length)] ?? 'AI·' + used.size);
  }

  // ---------- 对局推进 ----------

  private async startGame(): Promise<string | null> {
    const info = this.info!;
    const seats = info.seats.filter((s) => s.kind !== 'empty');
    if (seats.length < 2) return '至少需要 2 名玩家（可以用 AI 补位）';
    if (!seats.some((s) => s.kind === 'human')) return '至少需要 1 名真人玩家';
    // 去掉空座位：房间座位号 == 游戏 seat
    info.seats = seats;
    info.status = 'playing';
    this.config = {
      seed: crypto.getRandomValues(new Uint32Array(1))[0],
      seats: seats.map((s) => (s.kind === 'ai' ? { name: s.name, ai: s.level } : { name: s.kind === 'human' ? s.name : '' })),
    };
    this.game = Game.create(this.config);
    this.picks = null;
    this.timer = null;
    this.offline = {};
    for (const k of ['info', 'config', 'picks', 'timer', 'offline'] as const) this.set(k);
    this.ctx.storage.sql.exec('DELETE FROM log');
    this.broadcastRoom();
    await this.advance(null, this.game.takeEvents());
    await this.reportLobby();
    return null;
  }

  /** 提交一个回答（可为空），然后让 AI/托管座位连续行动，持久化并广播。 */
  private async advance(first: Answer | null, initial: GameEvent[] = []): Promise<string | null> {
    const game = this.getGame()!;
    const answers: Answer[] = [];
    const events: GameEvent[] = [...initial];
    if (first) {
      const r = game.answer(first);
      if (!r.ok) {
        this.flush();
        return r.error;
      }
      answers.push(first);
      events.push(...r.events);
    }
    const more = this.autoLoop();
    answers.push(...more.answers);
    events.push(...more.events);
    await this.finishStep(answers, events);
    return null;
  }

  private async finishStep(answers: Answer[], events: GameEvent[]) {
    const game = this.game!;
    if (!game.pending) {
      this.timer = null;
      this.set('timer');
      if (this.info!.status === 'playing') {
        this.info!.status = 'ended';
        this.set('info');
        await this.recordResult();
        this.broadcastRoom();
        await this.reportLobby();
      }
    } else if (this.timer?.seq !== game.seq) {
      this.timer = { seq: game.seq, deadline: Date.now() + animEstimate(events) + Number(this.env.TURN_TIMEOUT_MS || 45000) };
      this.set('timer');
    }
    this.flush(answers);
    this.broadcastGame(events);
    await this.schedule();
  }

  /** 让 AI 座位与已托管的掉线座位行动，直到需要在线真人决策。 */
  private autoLoop(): { answers: Answer[]; events: GameEvent[] } {
    const game = this.getGame();
    const answers: Answer[] = [];
    const events: GameEvent[] = [];
    if (!game || this.info?.status !== 'playing') return { answers, events };
    for (let guard = 0; guard < 10000 && game.pending; guard++) {
      const req = game.pending;
      let a: Answer | null = null;
      if (req.kind === 'pick') {
        const cur = this.curPicks(game.seq);
        for (const s of req.seats) {
          if (!cur[s] && this.isAuto(s)) {
            cur[s] = aiPick(game, s, req.count);
            this.set('picks');
          }
        }
        a = this.mergedPicks(req);
      } else if (this.isAuto(req.seat)) {
        a = aiAnswer(game, req);
      }
      if (!a) break;
      const r = game.answer(a);
      if (!r.ok) {
        console.error('auto answer rejected', r.error, req, a);
        break;
      }
      answers.push(a);
      events.push(...r.events);
    }
    return { answers, events };
  }

  private curPicks(seq: number): Record<number, CharId[]> {
    if (!this.picks || this.picks.seq !== seq) {
      this.picks = { seq, picks: {} };
      this.set('picks');
    }
    return this.picks.picks;
  }

  private mergedPicks(req: Extract<GameRequest, { kind: 'pick' }>): Answer | null {
    const cur = this.picks?.picks ?? {};
    return req.seats.every((s) => cur[s]) ? { kind: 'pick', picks: { ...cur } } : null;
  }

  /** AI 座位，或掉线超时且仍有其他真人在线时的托管座位。 */
  private isAuto(seat: number): boolean {
    const s = this.info!.seats[seat];
    if (!s || s.kind === 'ai') return true;
    if (s.kind !== 'human') return true;
    const since = this.offline[s.userId];
    if (since == null) return false;
    return Date.now() - since >= this.takeoverMs() && this.anyHumanOnline();
  }

  private takeoverMs() {
    return Number(this.env.OFFLINE_TAKEOVER_MS || 30000);
  }

  private anyHumanOnline(): boolean {
    return this.info!.seats.some((s) => s.kind === 'human' && this.isOnline(s.userId));
  }

  private isOnline(userId: string) {
    return this.ctx.getWebSockets(userId).some((s) => s.readyState === WebSocket.OPEN);
  }

  /** 对某个真人座位的有效截止时间。 */
  private seatDeadline(seat: number): number | null {
    const s = this.info?.seats[seat];
    if (!s || s.kind !== 'human' || !this.timer) return null;
    const since = this.offline[s.userId];
    if (since != null && this.anyHumanOnline()) return Math.min(this.timer.deadline, since + this.takeoverMs());
    return this.timer.deadline;
  }

  private waitingSeats(): number[] {
    const game = this.game;
    const req = game?.pending;
    if (!req) return [];
    if (req.kind === 'pick') {
      const cur = this.picks?.seq === game!.seq ? this.picks.picks : {};
      return req.seats.filter((s) => !cur[s]);
    }
    return [req.seat];
  }

  private async schedule() {
    const times: number[] = [];
    if (this.cleanupAt != null) times.push(this.cleanupAt);
    if (this.info?.status === 'playing' && this.anyHumanOnline()) {
      for (const s of this.waitingSeats()) {
        const d = this.seatDeadline(s);
        if (d != null) times.push(d);
      }
    }
    const want = times.length ? Math.max(Math.min(...times), Date.now() + 100) : null;
    const cur = await this.ctx.storage.getAlarm();
    if (want == null) {
      if (cur != null) await this.ctx.storage.deleteAlarm();
    } else if (cur == null || Math.abs(cur - want) > 500) {
      await this.ctx.storage.setAlarm(want);
    }
  }

  async alarm() {
    const now = Date.now();
    if (this.cleanupAt != null && now >= this.cleanupAt && this.openSockets().length === 0) {
      if (this.info) await lobbyStub(this.env).remove(this.info.id);
      await this.ctx.storage.deleteAll();
      this.info = this.config = this.game = this.picks = this.timer = null;
      this.offline = {};
      this.cleanupAt = null;
      return;
    }
    const game = this.getGame();
    if (game?.pending && this.info?.status === 'playing') {
      const { answers, events } = this.autoLoop();
      const req = game.pending;
      if (req && this.timer?.seq === game.seq && now >= this.timer.deadline - 50) {
        // 超时：在线但没操作的真人用默认选择
        let a: Answer | null;
        if (req.kind === 'pick') {
          const cur = this.curPicks(game.seq);
          for (const s of req.seats) if (!cur[s]) cur[s] = aiPick(game, s, req.count);
          this.set('picks');
          a = this.mergedPicks(req);
        } else {
          a = defaultAnswer(game, req);
        }
        const r = a ? game.answer(a) : null;
        if (a && r?.ok) {
          answers.push(a);
          events.push(...r.events);
          const more = this.autoLoop();
          answers.push(...more.answers);
          events.push(...more.events);
        }
      }
      await this.finishStep(answers, events);
      return;
    }
    await this.schedule();
  }

  private async recordResult() {
    const game = this.game!;
    const players = game.state.players.map((p, i) => {
      const s = this.info!.seats[i];
      return { userId: s?.kind === 'human' ? s.userId : undefined, name: p.name, ai: p.ai, score: playerScore(p) };
    });
    try {
      await this.env.DB.prepare('INSERT INTO match_results (room_id, finished_at, players) VALUES (?, ?, ?)')
        .bind(this.info!.id, Date.now(), JSON.stringify(players)).run();
    } catch (e) {
      console.error('record result failed', e);
    }
  }

  // ---------- 广播 ----------

  private openSockets(except?: WebSocket) {
    return this.ctx.getWebSockets().filter((s) => s !== except && s.readyState === WebSocket.OPEN && s.deserializeAttachment());
  }

  private seatOf(userId: string): number | null {
    const i = this.info?.seats.findIndex((s) => s.kind === 'human' && s.userId === userId) ?? -1;
    return i >= 0 ? i : null;
  }

  private send(ws: WebSocket, msg: ServerMsg) {
    try { ws.send(JSON.stringify(msg)); } catch { /* 连接已断 */ }
  }

  private roomMsg(userId: string, except?: WebSocket): ServerMsg {
    const info = this.info!;
    const seats = info.seats.map((s) =>
      s.kind === 'human' ? { ...s, online: this.ctx.getWebSockets(s.userId).some((w) => w !== except && w.readyState === WebSocket.OPEN) } : s,
    );
    return { type: 'room', room: { ...info, seats }, you: this.seatOf(userId) };
  }

  private gameMsg(userId: string, events: GameEvent[], full: boolean): ServerMsg {
    const game = this.game!;
    const you = this.seatOf(userId);
    const req = game.pending;
    const picked = req?.kind === 'pick' && this.picks?.seq === game.seq ? Object.keys(this.picks.picks).map(Number) : [];
    let pending: PendingView | null = null;
    if (req) {
      const waiting = this.waitingSeats();
      const mine = you != null && waiting.includes(you);
      const deadline = mine ? this.seatDeadline(you!) : (waiting.map((s) => this.seatDeadline(s)).find((d) => d != null) ?? null);
      pending = mine ? { mine: true, req, deadline } : { mine: false, kind: req.kind, seat: req.kind === 'pick' ? null : req.seat, deadline };
    }
    return { type: 'game', seq: game.seq, events, full, state: game.state, pending, picked, you };
  }

  private broadcastRoom(except?: WebSocket) {
    for (const ws of this.openSockets(except)) {
      const u = ws.deserializeAttachment() as Identity;
      this.send(ws, this.roomMsg(u.id, except));
    }
  }

  private broadcastGame(events: GameEvent[]) {
    if (!this.game) return;
    for (const ws of this.openSockets()) {
      const u = ws.deserializeAttachment() as Identity;
      this.send(ws, this.gameMsg(u.id, events, false));
    }
  }

  private async reportLobby() {
    const info = this.info;
    if (!info) return;
    const host = info.seats.find((s) => s.kind === 'human' && s.userId === info.hostId);
    const summary: RoomSummary = {
      id: info.id, code: info.code, name: info.name,
      host: host?.kind === 'human' ? host.name : '',
      status: info.status,
      humans: info.seats.filter((s) => s.kind === 'human').length,
      ais: info.seats.filter((s) => s.kind === 'ai').length,
      maxSeats: info.seats.length,
      updatedAt: Date.now(),
    };
    try {
      await lobbyStub(this.env).upsert(summary);
    } catch (e) {
      console.error('lobby upsert failed', e);
    }
  }
}

/** 客户端播放这些事件动画的大致时长，用于放宽真人决策的截止时间。 */
function animEstimate(events: GameEvent[]): number {
  let ms = 0;
  for (const e of events) {
    if (e.t === 'move') ms += 300 + 220 * e.path.length;
    else if (e.t === 'roll' || e.t === 'duelRoll') ms += 1200;
    else if (e.t === 'raceStart' || e.t === 'raceEnd') ms += 2500;
    else ms += 250;
  }
  return Math.min(ms, 90e3);
}
