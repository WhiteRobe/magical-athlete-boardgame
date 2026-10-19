import type { LobbyDO } from './lobby';
import type { RoomDO } from './room';

export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  LOBBY: DurableObjectNamespace<LobbyDO>;
  ROOM: DurableObjectNamespace<RoomDO>;
  SESSION_SECRET: string;
  PBKDF2_ITERATIONS: string;
  TURN_TIMEOUT_MS: string;
  OFFLINE_TAKEOVER_MS: string;
}

export interface Identity {
  id: string;
  name: string;
  guest: boolean;
}

export function lobbyStub(env: Env) {
  return env.LOBBY.get(env.LOBBY.idFromName('lobby'));
}

export function roomStub(env: Env, roomId: string) {
  return env.ROOM.get(env.ROOM.idFromName(roomId));
}
