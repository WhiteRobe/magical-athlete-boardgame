# 架构与模块约定

## 目录
```
src/shared/types.ts       引擎类型（GameState / Request / Answer / GameEvent）
src/shared/characters.ts  36 名角色中文资料、狂野赛道特殊格
src/shared/protocol.ts    HTTP / WebSocket 协议
src/shared/engine.ts      规则引擎（纯 TS，确定性，无 I/O）
src/shared/ai.ts          AI 决策
src/worker/               Worker 入口、auth、LobbyDO、RoomDO
src/client/               Preact UI + three 场景 + 音频
test/                     vitest
```

## 引擎 API（src/shared/engine.ts）

```ts
class Game {
  static create(config: GameConfig): Game;               // 新开一局，立刻推进到第一个决策
  static restore(config: GameConfig, answers: Answer[]): Game; // 重放回答日志恢复（DO 被驱逐后用）
  readonly config: GameConfig;
  readonly answers: Answer[];      // 已接受的回答日志（持久化它即可）
  state: GameState;                // 公开状态（deck 只有数量）
  pending: Request | null;         // 当前等待的决策；null 表示游戏结束
  get seq(): number;               // = answers.length，客户端提交时带上防过期
  answer(a: Answer): { ok: true; events: GameEvent[] } | { ok: false; error: string };
  takeEvents(): GameEvent[];       // 取出 create() 时产生的事件
}
// src/shared/ai.ts
function aiAnswer(game: Game, req: Request): Answer;              // 单人决策
function aiPick(game: Game, seat: number, count: number): CharId[]; // 同时派人阶段
function defaultAnswer(game: Game, req: Request): Answer;         // 超时默认（=简单 AI）
```

- `pending.kind === 'pick'` 是**同时决策**：RoomDO 自己收集每个 seat 的选择（各自 `count` 张、互不可见），齐了以后合并成 `{kind:'pick', picks:{seat: CharId[]}}` 一次性交给引擎。
- 其他决策由 `req.seat` 一人回答。AI 座位（`state.players[seat].ai`）由服务端立即用 `aiAnswer` 回答，循环直到轮到真人或游戏结束。服务端**不做 AI 延迟**，节奏由客户端动画播放控制。
- 引擎从不使用 `Math.random` / `Date`，同样的 config + answers 必然得到同样状态。

## 持久化（RoomDO SQLite）
- `meta`：RoomInfo + GameConfig + 部分派人选择 + deadline。
- `log`：回答日志分块存储，一次请求处理完成后只追加一行（本次新增的回答数组），节省行写入。
- 被驱逐后用 `Game.restore` 重放。

## 节奏与超时
- 真人决策 deadline = now + 估算动画时长 + 45s；超时用 `defaultAnswer`。
- 真人掉线 > 30s 视为托管，轮到他时立即由 AI 代答；重连后交还。
- alarm 同一时间只设一个（最近的 deadline）。
