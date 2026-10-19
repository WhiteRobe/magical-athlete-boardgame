# Cloudflare Workers 免费计划部署方案调研（实时多人桌游）

> 调研日期：2026-10-18。数字均来自 developers.cloudflare.com 官方文档（当日抓取），文末附链接。标注「推断」的地方是文档没写明、我根据文档推出来的结论，需要上线后实测确认。
>
> 目标场景：2-6 人房间、掷骰回合制、注册登录、游戏大厅房间列表、断线重连。

---

## 0. 结论速览

| 项目 | 免费额度 / 限制 | 对本项目的影响 |
|---|---|---|
| Worker 请求 | 100,000 次/天（UTC 0 点重置，北京时间 08:00） | 只有打到 Worker 脚本的请求才计数，静态资源不计 |
| Worker CPU | 10 ms/次调用（偶发超限有一点弹性，持续超限会被终止） | 密码哈希要卡在这个范围里 |
| Worker 体积 | 未压缩 64 MiB；**官方文档现已写明没有压缩后大小限制** | 不是问题 |
| 子请求 | 50 次/请求（访问 Cloudflare 内部服务的上限是 1,000） | 不是问题 |
| 静态资源 | 请求免费且不限量；单文件 ≤ 25 MiB；每个版本 ≤ 20,000 个文件 | 前端 SPA 托管完全免费 |
| Durable Objects | 免费计划可用，**只能用 SQLite 后端**；请求 100,000 次/天，时长 13,000 GB-s/天，行读 500 万/天，行写 100,000/天，总存储 5 GB，单对象 1 GB | 房间和大厅都放在 DO 里 |
| WebSocket 计费 | 建立连接算 1 次请求；**入站消息按 20:1 折算成请求**；出站消息免费 | 广播开销是零 |
| D1 | 行读 500 万/天，行写 100,000/天，总存储 5 GB，单库 500 MB，最多 10 个库 | **用户表推荐放这里** |
| KV | 读 100,000/天，**写 / 删 / list 各 1,000/天**，存储 1 GB，同一 key 每秒最多写 1 次 | 不适合存用户表 |
| PBKDF2 | Workers 的 Web Crypto 硬上限是 100,000 次迭代 | 本机实测 100k 次约 10.5 ms，刚好卡在 10 ms 线上 |

**估算容量**：一局 4 人、约 25 分钟的标准对局，免费层每天大约能撑 **600 局**（不做优化）到 **1,500 局**（做了写入优化）。最先耗尽的是 **DO SQLite 行写入（100,000/天）**，其次是 DO 请求数。

---

## 1. Workers 免费计划限制

来源：[Workers Limits](https://developers.cloudflare.com/workers/platform/limits/)、[Workers Pricing](https://developers.cloudflare.com/workers/platform/pricing/)

| 项 | Free | 备注 |
|---|---|---|
| 请求数 | 100,000 次/天 | UTC 午夜重置。超出后返回 Error 1027 |
| CPU 时间 | 10 ms / HTTP 请求；Cron Trigger 也是 10 ms | 原文："Each isolate has some built-in flexibility to allow for cases where your Worker infrequently runs over the configured limit"，但持续超限会被终止。只算 CPU，等待 I/O 的时间不算 |
| 时长（wall time） | 不收费 | |
| Worker 体积 | 未压缩 64 MiB | 原文："There is no compressed size limit. Only the uncompressed bundle size counts."，wrangler 输出的 gzip 数值仅供参考。（过去免费计划是压缩后 3 MB，现在文档已经改了） |
| 子请求 | 50 次/请求 | 访问 Cloudflare 内部服务（KV、D1、DO 等）最多 1,000 次 |
| 内存 | 128 MB / isolate | |
| Worker 数量 | 100 个/账户 | |
| 环境变量 | 每个 Worker 64 个，单个 ≤ 5 KB | |
| 启动时间 | 全局作用域解析加执行 ≤ 1 秒 | |
| Cron Triggers | 5 个/账户 | |
| Workers Logs | 200,000 条/天，保留 3 天 | 用 `observability.enabled` 打开 |

## 2. Workers Static Assets（静态资源托管）

来源：[Billing and limitations](https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/)、[SPA routing](https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/)、[Static assets binding](https://developers.cloudflare.com/workers/static-assets/binding/)

- **免费额度**："Requests to static assets are free and unlimited."，资产存储也不收费。
- **单文件上限**：25 MiB。**每个 Worker 版本的文件数上限**：20,000（Free 和 Paid 相同）。
- **是否计入 Worker 请求数**：不计入。原文："Requests are only billable if a Worker script is invoked."
- **SPA 导航请求**：同时满足三个条件时，浏览器导航请求（`Sec-Fetch-Mode: navigate`）直接返回 `/index.html`，**不会唤起 Worker**：
  1. 配了 `main`（有 Worker 脚本）
  2. 配了 `not_found_handling`
  3. `compatibility_date >= 2025-04-01`
  
  这样刷新 `/room/abc` 这类前端路由不会消耗请求额度。
- **非导航请求**：比如前端 `fetch("/api/...")`，如果没有匹配到资产，会进入 Worker。
- **`run_worker_first`**：
  - 设为 `true`：所有请求先进 Worker，全部计费。免费额度用完后，资产请求也会收到 429，不会回退到直接返回资产。**不要这么配。**
  - 设为数组（例如 `["/api/*", "/ws/*"]`）：只有匹配到的路径先进 Worker（导航请求也一样），以 `!` 开头的路径直接走资产，其余按普通资产匹配流程处理。数组形式会关掉自动的 navigate 检测，最多 100 条。需要 wrangler ≥ 4.20.0。
- 一个 Worker 只能挂一个资产目录。用 `.assetsignore` 排除不想上传的文件（语法同 `.gitignore`）。

## 3. Durable Objects（免费计划）

来源：[DO Pricing](https://developers.cloudflare.com/durable-objects/platform/pricing/)、[DO Limits](https://developers.cloudflare.com/durable-objects/platform/limits/)、[DO FAQ](https://developers.cloudflare.com/durable-objects/reference/faq/)

### 3.1 可用性与额度

- 原文："Durable Objects are available both on Workers Free and Workers Paid plans."，但 "Only Durable Objects with SQLite storage backend are available"（免费计划）。如果用 `new_classes`（KV 后端）部署，会报 `free_tier_requires_sqlite`。
- 超出任何一项免费额度后，"further operations of that type will fail with an error"。每天 00:00 UTC 重置。

| 项 | Free |
|---|---|
| 请求 | 100,000 次/天 |
| 时长 | 13,000 GB-s/天（按分配的 128 MB 计费，和实际用了多少内存无关，相当于每天约 104,000 秒，约 28.9 小时的「活跃时间」） |
| SQLite 行读 | 500 万/天 |
| SQLite 行写 | 100,000/天 |
| 存储 | 账户合计 5 GB；**单个对象 1 GB**（FAQ 写的；写满后报 `SQLITE_FULL`，但仍可读、可删） |
| 类数量 | 100 个/账户 |
| 对象数量 | 不限 |
| 单对象吞吐 | 软上限约 1,000 req/s，超出后先排队，再返回 overloaded |
| 单对象 WebSocket 数 | 32,768（Hibernation API） |
| 入站 WebSocket 消息大小 | 32 MiB |
| SQL | 每表 100 列；单行、字符串、BLOB 最大 2 MB；单条语句 100 KB；最多 100 个绑定参数 |

> SQLite 存储计费的目标开始日期是 2026-01-07，现在（2026-10）行读、行写和存储额度应该已经在实际执行。

### 3.2 什么算一次 DO「请求」

原文："Includes HTTP requests, RPC sessions, WebSocket messages, and alarm invocations."

- **RPC**：每次通过 stub 调一个方法算 1 次（一个 RPC session）。
- **WebSocket**：建立连接算 1 次请求。**入站消息按 20:1 计费**，原文："100 WebSocket incoming messages would be charged as 5 requests"。**出站消息和入站的协议层 ping 都免费。** 指标面板里显示的是真实消息条数，20:1 只用在计费上。
- **Alarm**：每次触发算 1 次请求；另外每次调用 `setAlarm()` 记 1 行写入（删除 alarm 也记写入）。

### 3.3 WebSocket Hibernation API

来源：[WebSockets best practices](https://developers.cloudflare.com/durable-objects/best-practices/websockets/)、[DurableObjectState API](https://developers.cloudflare.com/durable-objects/api/state/)

```ts
export class RoomDO extends DurableObject<Env> {
  async fetch(req: Request) {
    const { 0: client, 1: server } = new WebSocketPair();
    const userId = req.headers.get("X-User-Id")!;      // 由前置 Worker 鉴权后注入
    this.ctx.acceptWebSocket(server, [userId]);        // 不要调用 server.accept()
    server.serializeAttachment({ userId, joinedAt: Date.now() }); // ≤ 16 KB，休眠后仍保留
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketMessage(ws: WebSocket, msg: string | ArrayBuffer) {
    const { userId } = ws.deserializeAttachment();
    // 处理动作 -> 写 SQLite -> 广播
    for (const s of this.ctx.getWebSockets()) s.send(JSON.stringify(/* state diff */ {}));
  }
  async webSocketClose(ws: WebSocket, code: number, reason: string, wasClean: boolean) {
    // 标记掉线、setAlarm 安排重连宽限期
  }
  async webSocketError(ws: WebSocket, err: unknown) {}
  async alarm() { /* 回合超时 / 掉线宽限到期 / 空房清理 */ }
}
```

要点：

- 用 `this.ctx.acceptWebSocket(ws, tags?)`：最多 10 个 tag，每个 ≤ 256 字符。之后可以用 `getWebSockets(tag)` 按 tag（比如 userId）找到对应连接。
- **休眠时内存状态全部丢失，下次有事件时构造函数会重新执行**。所以游戏状态必须放在 `ctx.storage.sql` 里，连接上的身份信息放在 `serializeAttachment` 里。构造函数里只做轻量工作，比如 `blockConcurrencyWhile` 里加载状态。
- **对象只要处于空闲、可休眠状态，就不计时长费**。用 `ws.accept()`（非 Hibernation 写法）的话，连接存续期间一直计费。
- **会阻止休眠的情况**：`setTimeout`/`setInterval`、正在处理的请求、外发的 WebSocket，以及 pending I/O（每个最多让对象多驻留 15 分钟）。**回合计时器必须用 alarm，不能用 setTimeout。**
- `setWebSocketAutoResponse(new WebSocketRequestResponsePair("ping","pong"))`：应用层心跳由运行时直接回复，不唤醒对象，不产生时长费用。请求和响应各 ≤ 2,048 字符。浏览器 JS 发不了协议层 ping 帧，所以心跳要用这个。注意：文档只说它不计 wall-clock，**没说这些消息是否仍按 20:1 计入请求数**，下文估算时保守地计入了。
- `compatibility_date >= 2026-04-07` 会默认开启 `web_socket_auto_reply_to_close`，运行时自动完成 close 握手。
- **每次部署都会重启所有 DO，断开所有 WebSocket**。客户端必须做自动重连，服务端状态必须能从 SQLite 恢复。
- 吞吐建议：每条消息都有上下文切换开销，高频场景要合并成批发送。回合制桌游用不到。

### 3.4 Alarm

来源：[Alarms API](https://developers.cloudflare.com/durable-objects/api/alarms/)

- 每个对象同一时间只能有 1 个 alarm，再次 `setAlarm` 会覆盖原来的。需要多个定时器时，把时间表存进 SQLite，在 `alarm()` 里处理到期项，再设下一个。
- 至少执行一次（at-least-once）。handler 抛异常会自动重试：指数退避，从 2 秒开始，最多重试 6 次。
- 免费计划可用（定价表里 alarm 归在请求类计费项下，免费计划同样有 DO 请求额度）。
- 构造函数里设 alarm 之前，先用 `getAlarm()` 检查是否已有，否则会覆盖还没触发的 alarm。

### 3.5 CPU 限制（有歧义，需注意）

DO 限制页和 FAQ 都写着每次调用（HTTP、WS 消息、alarm）的 CPU 上限默认 30 秒，可以通过 `limits.cpu_ms` 调到 5 分钟。但同一份 FAQ 也写着 DO "have the same per invocation CPU limits as any Workers do"，而 Workers 免费计划是 10 ms。**文档没有写明免费计划上的 DO 到底是 10 ms 还是 30 s。** 设计时按 10 ms 保守处理：每条消息的处理逻辑要轻，不要把密码哈希这类重计算放进 DO 来「绕开」10 ms。

## 4. 用户表放哪：D1 vs DO SQLite vs KV

来源：[D1 Pricing](https://developers.cloudflare.com/d1/platform/pricing/)、[D1 Limits](https://developers.cloudflare.com/d1/platform/limits/)、[KV Pricing](https://developers.cloudflare.com/kv/platform/pricing/)、[KV Limits](https://developers.cloudflare.com/kv/platform/limits/)

| | D1 | DO SQLite（单例 Users DO） | KV |
|---|---|---|---|
| 免费读 | 500 万行/天 | 500 万行/天（**和房间共用**） | 100,000/天 |
| 免费写 | 100,000 行/天 | 100,000 行/天（**和房间共用**） | **1,000/天**，同一 key 每秒最多 1 次 |
| 存储 | 单库 500 MB，总量 5 GB，最多 10 个库 | 单对象 1 GB，总量 5 GB | 1 GB |
| 一致性 | 强一致（单主） | 强一致 | 最终一致 |
| 唯一约束 | 支持 SQL `UNIQUE` | 支持 | 不支持，注册时有竞态 |
| 其他 | 每次调用最多 50 条查询；Time Travel 7 天；`wrangler d1 execute` 方便运维 | 全局单例会成为热点；额外消耗 DO 请求数 | |
| 超额表现 | 返回错误，当天不能再查询 | 对应操作报错 | 对应操作报错 |

**推荐 D1 存用户表和战绩。** 理由：

1. D1 和 DO 的配额是分开计算的。用户、战绩的读写走 D1，DO 的行写入额度就全部留给对局，而行写入正是瓶颈。
2. 有 SQL 唯一索引，直接解决用户名重复注册的问题。KV 每天只能写 1,000 次，而且是最终一致，判重靠不住。
3. 运维方便：`wrangler d1 migrations apply`、`wrangler d1 execute`，还有 Time Travel 备份。

用 DO SQLite 存用户也能工作（`idFromName("users")` 单例，或者按用户名分片成每用户一个 DO），但会挤占对局的配额，跨用户查询也麻烦。KV 只适合放极少写入的配置类数据。

## 5. 密码哈希与会话

来源：[Web Crypto](https://developers.cloudflare.com/workers/runtime-apis/web-crypto/)、[node:crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/)，以及非官方的 [workerd issue #1346](https://github.com/cloudflare/workerd/issues/1346)、[Cloudflare Community 帖子](https://community.cloudflare.com/t/web-crypto-api-derivekey-issues/474035)

### 5.1 PBKDF2 的硬上限和耗时

- Workers 的 Web Crypto 支持 PBKDF2、HKDF、ECDH、X25519 做 `deriveBits`，**不支持 scrypt / argon2**。
- **迭代次数硬上限是 100,000**，超过会报 `NotSupportedError: Pbkdf2 failed: iteration counts above 100000 are not supported`。官方文档页没写这条，来源是 workerd issue 和社区里 Cloudflare 员工的回复；2026 年 9-10 月仍有大量项目在修这个问题。**本地 `wrangler dev` / Miniflare 不会触发这个限制，只有线上才报错**，测试时容易漏掉。
- `node:crypto` 文档说 pbkdf2 / scrypt 都受支持（argon2 不支持），但没写迭代或 cost 上限。社区有报告说 `crypto.pbkdf2` 同样受 100k 上限约束。而且 scrypt 很吃 CPU 和内存，在 10 ms 的 CPU 限制下不现实。
- **本机实测**（Node v26，Apple Silicon，WebCrypto PBKDF2-SHA256，32 字节输出）：

  | 迭代次数 | 单次耗时 |
  |---|---|
  | 10,000 | 1.2 ms |
  | 50,000 | 5.3 ms |
  | 100,000 | 10.5 ms |

  CF 边缘机器的单核性能和这台机器大致在一个量级，所以 100k 次迭代大约正好打满 10 ms 的 CPU 预算。

**建议：**

- 用 **PBKDF2-SHA256，迭代 100,000 次**（Workers 允许的最大值）。登录和注册是低频操作，偶发的轻微超时可以靠文档提到的 isolate 弹性兜住。哈希串里带上版本号和参数，比如 `pbkdf2$sha256$100000$<salt_b64>$<hash_b64>`，以后可以调参或迁移。
- 上线后用 Workers Logs / `wrangler tail` 盯 CPU 时间和 Error 1102（CPU 超限）。如果频繁出现，降到 50,000–60,000 次。
- 比较哈希用 `crypto.subtle.timingSafeEqual(a, b)`（Workers 的非标准扩展）。
- 登录接口一定要限流（按 IP 或用户名计失败次数，计数可以放在 D1 或者一个 RateLimit DO 里），用来弥补迭代次数偏低的问题。也可以考虑 Turnstile（免费）。
- 不要把哈希放进 DO 去「借用 30 s CPU」，原因见 3.5，免费计划上 DO 的 CPU 上限不明确。

### 5.2 会话

推荐**无状态的 HMAC 签名 Cookie**（本质上就是一个精简版 JWT），不用每次请求查库：

- 载荷：`{uid, name, exp, ver}`，用 `HMAC-SHA256(SESSION_SECRET)` 签名，格式为 `base64url(payload).base64url(sig)`。
- 密钥用 `wrangler secret put SESSION_SECRET` 设置，本地开发写在 `.dev.vars` 里。
- Cookie 属性：`HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=30d`。
- 校验用 `crypto.subtle.verify("HMAC", ...)`，耗时只有微秒级。
- **WebSocket 鉴权**：同源的 WS upgrade 请求会自动带上 Cookie。前置 Worker 验签后，把 `X-User-Id` / `X-User-Name` 头注入请求再转发给 DO，DO 只信任这两个头（外部请求无法直接访问 DO）。
- 要支持「强制下线」的话，在 D1 用户表里放一个 `session_ver` 字段，只在敏感操作时比对。

## 6. 推荐架构

```
浏览器 (SPA, 静态资产免费)
   │  HTTPS /api/*         WSS /ws/lobby      WSS /ws/room/:id
   ▼
Worker（前置路由，run_worker_first: ["/api/*","/ws/*"]）
   ├─ /api/auth/register|login|logout|me   → D1 (users)
   ├─ /api/rooms (POST 创建)                → LobbyDO.createRoom() → RoomDO.init()
   ├─ /ws/lobby                              → LobbyDO（全局单例 idFromName("lobby")）
   └─ /ws/room/:id                           → RoomDO（idFromName(roomId)）
                                               │ 对局结束 → 写 D1 战绩（经 Worker 或直接绑定 D1）
                                               └ 状态变化 → RPC 通知 LobbyDO.updateRoom()
```

**LobbyDO（全局单例）**

- SQLite 表 `rooms(id, name, host, players, max_players, status, updated_at)`，只保存「列表摘要」。
- 大厅里的用户通过 Hibernation WS 订阅。房间有变化时广播增量，出站消息免费，不要让客户端轮询（轮询每次都耗 Worker 请求和 DO 请求）。
- 由 RoomDO 在创建、人数变化、开局、结束、销毁时调用 RPC 更新（每局约 8 次）。
- 用一个 alarm 定期清理僵尸房间，比如 10 分钟扫一次，没有房间时不设 alarm。

**RoomDO（每房间一个，游戏状态的权威来源）**

- SQLite：`state` 单行 JSON（包含版本号 `seq`），`players(user_id, seat, connected, last_seen)`。可选一张 `log` 表用于回放（会增加写入量）。
- 所有动作都在服务端校验。掷骰在服务端用 `crypto.getRandomValues` 生成，客户端只发意图。
- 每个动作处理完后：写一行 state（seq+1），然后广播 `{seq, diff}` 或全量状态。
- **断线重连**：
  - 连接 attachment 里存 `{userId, seat}`。
  - `webSocketClose` 时标记 `connected=0`，并设置宽限 alarm（例如 60 s）。
  - 重连时用 `getWebSockets(userId)` 找到旧连接并关闭，接受新连接，下发全量快照（客户端带上 `lastSeq`，差距小就补发 diff）。
  - 宽限期到了还没回来，就按规则托管或跳过该玩家。
- **回合计时**用 alarm。只设一个 alarm，指向「最近一个到期事件」，到期事件表存在 SQLite 里。
- 心跳用 `setWebSocketAutoResponse("ping","pong")`，客户端每 30 s 发一次。用 `getWebSocketAutoResponseTimestamp(ws)` 判断连接是否已经死掉。
- 对局结束后写 D1 战绩，通知 Lobby 删除房间，设清理 alarm（例如 10 分钟后 `ctx.storage.deleteAll()`，并且不再设新 alarm）。
- 部署会断开所有连接，所以客户端必须带指数退避自动重连，状态必须能从 SQLite 完整恢复。

### 6.1 每局配额消耗估算

基线假设：4 人，约 25 分钟，每人约 12 回合，共 48 回合；每回合约 2 条动作消息，全局约 100 条，另有约 20 条聊天或表情；心跳每人每 30 秒 1 条，约 200 条；每人平均重连 1 次。

| 来源 | Worker 请求 | DO 请求 | DO 行写入 |
|---|---|---|---|
| 登录 / `me` / 战绩接口（4 人） | ~8 | – | 0（会话无状态，读 D1） |
| 大厅 WS 连接（局前、局后各一次 ×4） | 8 | 8 | – |
| 创建 / 加入房间 API | 5 | 5（RPC） | 5 |
| 房间 WS 连接（4 + 4 次重连） | 8 | 8 | – |
| 入站消息 320 条（动作、聊天、心跳）÷ 20 | 0（WS 消息不经过 Worker） | 16 | ~100（每个动作写一次 state 行） |
| Room → Lobby RPC | – | 8 | 8 |
| alarm（每回合计时 48 + 宽限、清理若干） | – | ~50 | ~50（每次 setAlarm 记 1 行） |
| **合计（基线）** | **~30** | **~95** | **~165** |
| **合计（优化后）** | ~30 | ~50 | ~60 |

优化手段：

- alarm 只在有人掉线或超时风险时才设，不给每个回合都设，回合时限改由下一条动作到达时在服务端顺带判定。
- state 按回合落库，不按动作落库。
- 不写逐条动作日志。
- 注意：索引更新也会计入行写入。

时长（GB-s）：每局约 400 个事件，每个按约 30 ms 的 wall time 算，约 12 s × 0.125 GB = 1.5 GB-s。**前提是全程能休眠**。如果误用 setTimeout 导致对象常驻，一局 25 分钟就是 187 GB-s，每天只能撑约 70 局。

D1：注册 1 行（加唯一索引约 2 行）；每局战绩约 9 行（1 条 games 记录、4 条 participants、4 条用户统计更新）。

### 6.2 免费层每日可支撑局数

| 瓶颈 | 额度 | 基线局数 | 优化后局数 |
|---|---|---|---|
| DO 行写入 | 100,000 | **~600** | **~1,650** |
| DO 请求 | 100,000 | ~1,050 | ~2,000 |
| Worker 请求 | 100,000 | ~3,300 | ~3,300 |
| DO 时长 | 13,000 GB-s | ~8,600 | ~8,600 |
| D1 行写入 | 100,000 | ~11,000 | ~11,000 |

**结论：免费层每天大约能跑 600 局（不优化）到 1,500 局（优化后）**，按每局 4 人算是几千人次。对小规模内测、朋友局来说足够。超出后当天剩余时间里，对应操作会直接报错，不会自动扣费。如果要冲规模，升级 Workers Paid（$5/月，DO 包含 100 万请求和 400,000 GB-s）。

## 7. wrangler 4.x 配置

来源：[DO migrations / exports](https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/)、[Static assets binding](https://developers.cloudflare.com/workers/static-assets/binding/)

要点：

- **`durable_objects.bindings`**：`{ name, class_name }`，class 必须在入口文件里 `export`。
- **DO 类生命周期有两种写法，同一个 Worker 只能选一种**：
  - 传统 `migrations`：`[{ "tag": "v1", "new_sqlite_classes": [...] }]`。之后的改名、删除用 `renamed_classes` / `deleted_classes`，并追加新 tag。
  - 新的声明式 `exports`：`{ "RoomDO": { "type": "durable-object", "storage": "sqlite" } }`，改名或删除用 `state: "renamed" | "deleted"`。一旦用 `exports` 部署过，就**不能再回到 `migrations`**。另外它不支持 gradual deployments，`wrangler versions upload` 也不能应用生命周期变更。
  - 两种写法我都在本机用 wrangler 4.135.0 跑过 `deploy --dry-run`，都能通过。**建议先用传统 `migrations`**：教程和社区资料多，以后想迁到 `exports` 也不用迁移数据。
- **免费计划必须用 `new_sqlite_classes`**（或 `storage: "sqlite"`），用 `new_classes` 会部署失败。
- `compatibility_date >= 2026-08-04` 时 Node.js 兼容默认开启；`>= 2025-04-01` 时 SPA 导航请求不唤起 Worker；`>= 2026-04-07` 时 WS 自动回复 close。

### 示例 wrangler.jsonc

已用 `wrangler deploy --dry-run` 验证能通过（D1 的 `database_id` 换成 `wrangler d1 create` 输出的真实值）：

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "magical-athlete",
  "main": "src/worker/index.ts",
  "compatibility_date": "2026-10-01",

  // 前端 SPA：导航请求直接回 index.html，不计 Worker 请求
  "assets": {
    "directory": "./dist/client",
    "binding": "ASSETS",
    "not_found_handling": "single-page-application",
    "run_worker_first": ["/api/*", "/ws/*"]
  },

  "durable_objects": {
    "bindings": [
      { "name": "LOBBY", "class_name": "LobbyDO" },
      { "name": "ROOM",  "class_name": "RoomDO" }
    ]
  },
  // 免费计划必须是 SQLite 后端
  "migrations": [
    { "tag": "v1", "new_sqlite_classes": ["LobbyDO", "RoomDO"] }
  ],

  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "magical-athlete-db",
      "database_id": "<wrangler d1 create 输出的 id>",
      "migrations_dir": "migrations"
    }
  ],

  "observability": { "enabled": true }
  // 密钥不写在这里：wrangler secret put SESSION_SECRET；本地写到 .dev.vars
}
```

### 常用命令

```bash
# 本地开发（DO / D1 / 资产全部本地模拟，数据默认存在 .wrangler/state）
wrangler dev                       # 默认 http://localhost:8787
wrangler dev --persist-to ./.wrangler/state
# 前端用 Vite 时，推荐 @cloudflare/vite-plugin，一个 dev server 同时跑前端和 Worker

# 首次准备（会在账户里创建资源，按需执行）
wrangler d1 create magical-athlete-db
wrangler d1 migrations create magical-athlete-db init
wrangler d1 migrations apply magical-athlete-db --local
wrangler d1 migrations apply magical-athlete-db --remote
wrangler secret put SESSION_SECRET

# 类型生成与检查
wrangler types                     # 生成 Env 类型
wrangler deploy --dry-run --outdir dist/worker

# 部署与观测
wrangler deploy                    # 默认发布到 <name>.<subdomain>.workers.dev
wrangler tail                      # 实时日志（看 CPU 超限、异常）
wrangler rollback
```

## 8. 本机环境检查

- `wrangler --version`：**4.135.0**（提示有新版本 4.151.1 可升级，不影响使用）。
- `wrangler whoami`：已登录（OAuth），Token 权限包含 workers (write)、workers_scripts (write)、d1 (write)、workers_kv (write) 等，足够部署 Worker + DO + D1。
- 本次只执行了 `--help`、`whoami`，以及在 /tmp 临时目录里跑的 `deploy --dry-run`（不上传，事后已删除）。**没有部署，也没有创建任何资源。**

## 9. 风险点

1. **PBKDF2 上限 100k，且只在线上触发**。本地测试全绿、线上注册全挂是常见坑。代码里显式把迭代次数写成 ≤ 100000，并把哈希参数存进哈希串。100k 次在 10 ms CPU 线附近，需要实测。
2. **免费计划上 DO 的 CPU 上限文档有歧义**（10 ms 还是 30 s）。按 10 ms 设计，每条消息的处理保持轻量。
3. **DO 行写入是第一瓶颈**。写入要克制：单行 state、按回合落库、少用 alarm、少建索引。超额后当天剩余时间所有房间都写不进去，对局会直接卡死。建议在 RoomDO 里捕获写入错误，并给前端明确提示。
4. **部署会断开所有 WebSocket**。游戏进行中避免部署，或者确保客户端自动重连、服务端可以完整恢复。
5. **休眠失效会导致时长暴涨**：用了 setTimeout、外发 WebSocket、长时间 pending I/O，或者用了 `ws.accept()`，对象都会常驻。
6. **LobbyDO 是全局单例**。软上限约 1,000 req/s，免费层的规模远到不了。但它出问题会影响所有人，所以它只存摘要，不做重逻辑。
7. **额度在 UTC 0 点（北京时间 08:00）重置**。超额后对应操作直接报错，没有降级。`run_worker_first: true` 会让超额时静态页面也返回 429，不要这么配。
8. **Auto-response 心跳是否计入请求数文档没写**。按 20:1 估算，影响很小（每局约 10 次请求）。
9. **KV 每天只能写 1,000 次且最终一致**，不要用来存用户或会话。
10. `exports` 和 `migrations` 不能混用，用了 `exports` 就回不去了。新项目建议先固定用一种。

---

## 参考链接（官方）

- Workers Limits：https://developers.cloudflare.com/workers/platform/limits/
- Workers Pricing：https://developers.cloudflare.com/workers/platform/pricing/
- Static Assets 计费与限制：https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/
- Static Assets 配置 / binding：https://developers.cloudflare.com/workers/static-assets/binding/
- SPA 路由：https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/
- Durable Objects Pricing：https://developers.cloudflare.com/durable-objects/platform/pricing/
- Durable Objects Limits：https://developers.cloudflare.com/durable-objects/platform/limits/
- Durable Objects FAQ：https://developers.cloudflare.com/durable-objects/reference/faq/
- WebSocket Hibernation：https://developers.cloudflare.com/durable-objects/best-practices/websockets/
- DurableObjectState API：https://developers.cloudflare.com/durable-objects/api/state/
- Alarms API：https://developers.cloudflare.com/durable-objects/api/alarms/
- DO migrations / exports：https://developers.cloudflare.com/durable-objects/reference/durable-objects-migrations/
- D1 Pricing：https://developers.cloudflare.com/d1/platform/pricing/
- D1 Limits：https://developers.cloudflare.com/d1/platform/limits/
- KV Pricing：https://developers.cloudflare.com/kv/platform/pricing/
- KV Limits：https://developers.cloudflare.com/kv/platform/limits/
- Web Crypto：https://developers.cloudflare.com/workers/runtime-apis/web-crypto/
- node:crypto：https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/

非官方（PBKDF2 上限的出处）：

- workerd issue #1346：https://github.com/cloudflare/workerd/issues/1346
- Cloudflare Community：https://community.cloudflare.com/t/web-crypto-api-derivekey-issues/474035
