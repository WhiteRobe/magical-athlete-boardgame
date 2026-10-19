// WebSocket / HTTP 协议。服务端与客户端共用。
import type { Answer, CharId, GameEvent, GameState, Request, AiLevel } from './types';

// ---------- HTTP ----------
// POST /api/register {username, password}        -> Me
// POST /api/login    {username, password}        -> Me
// POST /api/guest    {}                          -> Me   (游客：只能和 AI 打)
// POST /api/logout
// GET  /api/me                                   -> Me | 401
// POST /api/rooms    {name, maxSeats, private}   -> {id}
// POST /api/rooms/join {code}                    -> {id}
// WS   /ws/lobby   大厅推送
// WS   /ws/room/:id  房间与对局

export interface Me {
  id: string;
  name: string;
  guest: boolean;
}

export type SeatInfo =
  | { kind: 'empty' }
  | { kind: 'human'; userId: string; name: string; online: boolean; guest?: boolean }
  | { kind: 'ai'; name: string; level: AiLevel };

export interface RoomInfo {
  id: string;
  code: string; // 6 位房间码
  name: string;
  hostId: string;
  private: boolean;
  guestOnly: boolean; // 游客房：只允许房主 + AI
  status: 'waiting' | 'playing' | 'ended';
  seats: SeatInfo[]; // 长度 = 最大人数（2..6）
}

export interface RoomSummary {
  id: string;
  code: string;
  name: string;
  host: string;
  status: RoomInfo['status'];
  humans: number;
  ais: number;
  maxSeats: number;
  updatedAt: number;
}

/** 发给某个客户端的待决策视图。不是给你的决策只露出 kind 和 seat。 */
export type PendingView =
  | { mine: true; req: Request; deadline: number | null }
  | { mine: false; kind: Request['kind']; seat: number | null; deadline: number | null };

// ---------- 客户端 -> 房间 ----------
export type ClientMsg =
  | { type: 'hello'; lastSeq?: number }
  | { type: 'answer'; seq: number; answer: Answer } // seq = 当前 pending 的序号，防止重复/过期提交
  | { type: 'pick'; seq: number; cards: CharId[] } // 同时派人
  | { type: 'setSeat'; seat: number; to: 'empty' | 'ai' | 'me'; level?: AiLevel } // 房主设置 AI / 清空；任何人可坐到空位
  | { type: 'kick'; seat: number }
  | { type: 'start' }
  | { type: 'rematch' }
  | { type: 'emote'; e: string }
  | { type: 'leave' };

// ---------- 房间 -> 客户端 ----------
export type ServerMsg =
  | { type: 'room'; room: RoomInfo; you: number | null }
  | {
      type: 'game';
      seq: number; // 已执行的决策数
      /** 增量事件；为空表示全量同步（重连），客户端直接对齐到 state */
      events: GameEvent[];
      full: boolean;
      state: GameState;
      pending: PendingView | null;
      picked: number[]; // 同时派人阶段已选好的 seat
      you: number | null;
    }
  | { type: 'emote'; seat: number; e: string }
  | { type: 'error'; msg: string };

// ---------- 大厅 ----------
export type LobbyMsg =
  | { type: 'rooms'; rooms: RoomSummary[] }
  | { type: 'upsert'; room: RoomSummary }
  | { type: 'remove'; id: string };
