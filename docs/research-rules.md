# Magical Athlete 规则调研（面向线上实现）

调研日期：2026-10-18。范围是 CMYK 2025 版基础盒（36 名运动员）。

可信度标记：
- **[A]**：官方规则书原文（CMYK 英文规则书 PDF，28 页，下文简称“规则书”），或官方实物照片。
- **[B]**：官方本地化方 IELLO 的 FAQ 2.0（2026-08-28，已合入 CMYK 2026 年 8 月规则修订），或 CMYK 创意总监 Alex Hague 在 BGG 上的发帖。
- **[C]**：多个独立的第三方开源实现或评测彼此一致。
- **[D]**：单一来源或推断，需要再核实。

> **关于规则书 PDF 的重要提示**：我拿到的规则书 PDF（来自 GitHub 仓库 xeonliu/MagicalAthleteOL 的 `docs/How_to_play_Magical_Athlete_compressed.pdf`）在文字抽取时，每张角色卡都出现两套英文文本。两套大多只差措辞，但 Blimp（+2 / +3）和 Hare（是否拿铜分）在数值上不同。另一个开源项目（pedestrian6/magical-athlete）对照了 IELLO 法文规则书的可见卡面，判断“+3、不拿铜分”那套才是正式卡面，另一套是错位或过时的隐藏英文层。IELLO FAQ 2.0 的描述也和“+3、不拿铜分”一致。下文角色表采用这套“正式卡面”，旧文本单独列出。
>
> 另外，这份 PDF 是 **2026 年 8 月修订之前**的版本。修订推翻了其中“同时到达仍然触发”的条款，详见第 2.12 节。

---

## 1. 出版信息

| 项目 | 内容 | 可信度 |
|---|---|---|
| 原始设计 | Takashi Ishida（石田貴史）。日本原版，2010 年由 Z-Man Games 引进美国（原版年份和日本出版商未核实） | A（规则书署名）/ C（ICv2） |
| 新版更新设计 | Richard Garfield | A |
| 出版商 | CMYK（美国）；零售发行 Asmodee | A / C |
| 年份 | 2025。ICv2 报道零售上架日为 2025-11-07，定价 29.99 美元；BGG 编号 454103 | C |
| 美术 | Angela Kirkwood | A |
| 其他署名 | Creative Director Alex Hague；Lead Writer Sophie Abromowitz；Additional Design Skaff Elias、James Nathan Spencer、Justin Vickers；平面设计 Elizabeth Goodspeed、Janet Delavan；制造 Strom MFG | A |
| 人数 / 时长 | 2–6 人，约 30 分钟（CMYK 官网标 6+；ICv2 标 8+、60 分钟） | A / C |
| 法文版 | IELLO《Athlètes de Compète》，2026 年 7 月 | B |
| 中文正版 | 《胡闹运动会》，艾赐魔袋出版，约 2026-05-29 上市（据什么值得买文章） | D |
| 是否众筹 | 没找到 Kickstarter 记录。委托方提到的“Kickstarter / Big Potato”未得到任何来源支持 | — |

**基础包内容物 [A]（规则书第 27 页）**
- 1 块双面赛道（Mild Mile / Wild Wilds）
- 36 个运动员棋子（racer tokens）
- 36 张运动员卡
- 6 颗骰子
- 4 枚金色一等奖筹码（奖杯造型）
- 4 枚银色二等奖筹码（花结造型）
- 9 枚铜色 3 分筹码
- 16 枚铜色 1 分筹码（星形）
- 1 本规则书

---

## 2. 完整规则

### 2.1 准备 [A]
1. 赛道 Mild Mile 面朝上，放在桌子中央。
2. 金、银筹码按分值各叠一摞，**大的（分值高的）在底下**，所以第 1 场拿到的是最上面、分值最低的那枚。
3. 洗混运动员牌堆，放在一旁。
4. 倒出全部运动员棋子。
5. 每人发 1 颗骰子。

### 2.2 选秀（Recruit your team）[A]
- 每人组一支 4 人队伍，整局共用，每场比赛派 1 人上场。
- 每一批翻开 **玩家人数 × 2** 张运动员牌：3 人翻 6 张，4 人 8 张，5 人 10 张，6 人 12 张。
- 所有人掷骰（roll off），点数最高的人先选。如果最高点并列，看“下一个最高点”（规则书原文：*If there's a tie, the player with the next highest roll drafts first. If everyone ties, reroll.*）。
  - 实现提示：原文的并列处理有歧义。IELLO FAQ 和开源实现一般做成“并列最高者之间重掷”。
- **第一轮蛇形选秀**：从起始玩家开始顺时针各选 1 张；最后一位玩家连选 2 张（先选本轮第 1 张，再立即选第 2 张），然后逆时针往回，直到每人 2 名。示例（4 人）：A 第 1、8 手，B 第 2、7 手，C 第 3、6 手，D 第 4、5 手。
- **第二轮蛇形选秀**：再翻一批（同样是人数 × 2 张），由**第一轮起始玩家左手边**的玩家开始，同样蛇形。结束后每人 4 名。
- 第一批没被选的牌怎么处理，规则书没写。按“每批恰好人数 × 2 张、每人选 2 张”计算，每批正好选完，不会剩牌。
- 简化选项：新手局可以直接随机发每人 4 名；或者用棋子代替卡牌来选。

### 2.3 每场派人 [A]
- 第 1 场前，再按选秀的方式掷一次骰，赢的人先手。
- 所有人从手里选 1 张运动员卡，**同时亮出**；把对应棋子放到 Start 格。
- 每名运动员整局只能用一次；后面的比赛分值更高。

### 2.4 回合流程 [A]
- 轮到你时，掷骰并按点数移动，这叫 **main move（主移动）**。
- 你的回合完全结束后，轮到顺时针下一位。
- 某个能力写“can”就是可选的；其他能力都是强制的。
- 能力有三种生效方式：玩家主动使用、条件触发、常驻被动。

对编码有用的回合拆解（综合规则书、IELLO FAQ 和卡面时机词）：
1. **回合开始 / 主移动前**（At the start of my turn / Before my main move）：Cheerleader、Hypnotist、Party Animal、Third Wheel、Lovable Loser、Mastermind（仅首回合）等在这里结算。Hare 和 Blimp 在这里按当前位置判定。这类时机能力每回合只触发一次 [A 第 5 条]。
2. **主移动**：
   - 如果被绊倒（tripped）：不掷骰，把棋子扶正，这次主移动就用掉了 [A]。
   - 否则掷骰；或者用替代能力（Legs 改为移动 5，Flip Flop 改为交换位置）。
   - 重掷窗口：Magician、Dicemonger。必须在点数的后果开始结算前决定是否重掷 [B]。
   - 点数触发：Inchworm（1）、Skipper（1）、Lackey（6）、Sisyphus（6）、Alchemist（1/2）、Rocket Scientist（翻倍）、Genius（预测比对）。
   - 计算距离：先替换或翻倍（Alchemist 4、Legs 5、Rocket ×2），再加所有加减值（Coach +1、Gunk −1、Hare +2、Blimp +3/−1、Party Animal +N）[B]。合计为负就后退，合计为 0 就不算移动 [B]。
   - 执行移动，然后结算后果（经过、停格、赛道格）。
3. **回合结束**：Heckler 检查（任何运动员回合结束时离本回合起点 ≤1 格）。
4. **下一位**：默认顺时针；Skipper 可以插队（有人主移动掷出 1）；Genius 猜中时加一个额外回合。

### 2.5 移动、主移动、瞬移的定义 [A]（规则书第 21 页术语表）
- **Main move（主移动）**：每回合都有的动作，掷骰后移动相应格数。
- **Move（移动）**：因为主移动、能力或任何明确用了 “move” 一词的情况而换格。“move 0” **不算移动**，不触发和移动有关的能力。
- **Warp（瞬移/传送）**：直接把棋子放到新格，**不算 move**，不触发和移动有关的能力，也不算经过任何人。但到达新格算“停在该格”[B]，所以会触发停格能力和赛道格效果。
- **Passing（经过）**：一次移动开始时在对方后方、结束时在对方前方。只比较同一次移动的起点和终点 [A]。IELLO 补充 [B]：**双向**都算（后退时从对方前方退到后方也算经过）；从同一格出发不算经过。
- **Ahead / Behind**：停的格更靠近终点就是领先；同格的两人互不领先也不落后。
- **Alone**：所在格没有别人。
- **Last place**：离 Start 最近的运动员，可以并列。
- **Lead**：离终点最近、**还没冲线**的运动员，可以并列。
- **Sharing a space（共格）**：双方都“停”在同一格。移动或瞬移过程中短暂重叠不算。
- **Space（格）**：从 Start 格到终点线之间的方格。**Start 本身算一格**，终点线之后的都不算格。
- **Stopping on a space（停在格上）**：移动结束到达该格，或者用其他方式（如瞬移）到达该格。

### 2.6 终点判定
- 两面赛道都是：Start（编号 0）加上 1–29 号格，共 30 格（含 Start）；走过 29 号格就越过终点线 [A 照片计数 + C]。实现时可以把到达或超过位置 30 视为冲线。
- **不需要正好到达**，越过终点多少格都无所谓 [A：“Anything past the finish line doesn't [count as a space]”；B：“overshooting it is normally fine”]。只有场上有 **Stickler** 时，其他运动员才必须恰好移动到终点线，多出来的移动整次作废，留在原地 [A 卡面 + B]。
- 冲线顺序决定名次：第 1 个冲线的拿第 1 名，第 2 个冲线时比赛**立即结束** [A]。
- 已冲线的运动员离开比赛，能力随之失效，除非卡上另有说明 [A 第 6 条]。
- 越过终点后多出来的格数**不计分**，也不影响名次（规则书没有任何相关规则）。
- 同时冲线（例如 Suckerfish 跟着别人一起冲）：被跟随者名次在前 [B]。

### 2.7 比赛结束条件 [A]
1. 第 2 名运动员冲线，立即结束。
2. 场上只剩 1 名运动员（其他人被 M.O.U.T.H. 淘汰）时，立即结束，这名运动员拿到还剩下的那个名次（第 1 或第 2）。没人能拿的名次作废，对应筹码（例如银花结）弃掉 [A，M.O.U.T.H. 注释]。
3. Mastermind 预测正确：首个冲线者一出现比赛就立即结束，Mastermind 拿第 2 名 [A 卡面]。如果预测的是自己并且猜中，第 1、第 2 名都归它 [A 注释]。
4. 能力造成“谁都无法冲线”的循环：比赛结束，剩下的分数没人拿 [A 第 9 条]。

### 2.8 赛后与场间先手 [A]（第 18 页）
1. 第 1 名拿金摞最上面那枚，第 2 名拿银摞最上面那枚。
2. 本场用过的卡牌和棋子移出游戏。
3. 赛道翻面。默认顺序：Mild → Wild → Mild → Wild。开局前可以约定全程只用一面或自定顺序。
4. 所有人同时亮出新的运动员卡，棋子放到 Start。
5. **下一场先手**：上一场**最落后（或最先被淘汰）**的运动员所属的玩家。
   - 最落后的有多人并列时怎么办，规则书没写（未找到）。实现建议：掷骰，或按顺时针离上场先手最近的玩家。
   - 双运动员变体：上一场得分较低的玩家先手，平局掷骰 [A]。
6. 第 4 场结束后游戏结束，总分最高者胜；平分就共享胜利，不比次级条件 [A]。

### 2.9 能力结算顺序 [A]（第 15 页）+ [B]
多个能力需要同时生效时，顺序为：
1. **赛道格**（RACETRACK SPACES）
2. **当前回合的玩家**（CURRENT PLAYER）
3. **其他玩家**，从当前玩家起**顺时针**（OTHER PLAYERS, going clockwise）

IELLO FAQ 补充 [B]：
- 一个动作先完整结算，再结算它的后果。会修改、替换或取消当前动作的能力（例如 Inchworm 取消 1 点的主移动），在动作本身的阶段介入。
- 可选能力在轮到它结算的那一刻重新检查条件，条件已经不成立就不能用了（“机会不等人”）。例如 Romantic 在自己回合停到 Duelist 所在格：Romantic 优先，先走 2 格，Duelist 的共格条件随之消失。
- 一个效果引出的新连锁，先于还在排队的旧效果结算（栈式，后进先出）。
- 一名玩家控制多名运动员时，开赛前固定它们的顺序。
- 措辞差异：“a racer / anyone” 包括自己（Skipper、Romantic、Heckler）；“another racer / other racers” 不包括自己（Lackey、Inchworm、Gunk）。

### 2.10 循环处理 [A]（第 21 页第 8、9 条）
- 遇到无限循环（例如 Scoocher 停到 Huge Baby 格被放回后面一格，再次触发……），按发生顺序**完整执行一轮，然后终止**。
- 有些能力可以反复互动，比如 Scoocher 和 Suckerfish。这种每轮都有实际进展的情况**不算循环**，可以一直结算下去。
- IELLO 的判定标准 [B]：只有“完全相同的状态”（位置、状态、待结算效果）再次出现才算循环。每轮都有变化（得分、淘汰、持续前进）就不是循环。
- 能力循环导致没人能冲线：比赛结束，剩余分数没人拿。

### 2.11 摔倒（Trip）[A]
- 被绊倒的运动员**跳过下一次主移动**，连骰子都不掷。但它的能力照常触发，也照样能通过其他方式移动。
- 绊倒时，先把当前这次移动**完整走完**，再把棋子面朝下放倒。绊倒不会提前结束正在进行的移动。
- 下一次主移动时把棋子扶正，表示恢复；这次主移动就用掉了。
- 被绊倒期间还能被移动、被瞬移，也能绊倒别人 [B]。
- 如果在同一回合的主移动阶段之前被绊倒（例如回合开始时 Hypnotist 把自己传到 Baba Yaga 的格），本回合的主移动就用来起身 [B]。
- 已经倒着的运动员再次被绊倒：规则书没写，没有叠加效果。开源实现 magsim 的处理是已绊倒就忽略 [D]。
- Hare：如果处于被绊倒状态，又在回合开始时独自领先，则跳过主移动，**不起身** [B，来自 FAQ 意译]。

### 2.12 2026 年 8 月规则修订 [B]（Alex Hague，BGG 帖 “A couple August 2026 rules updates”）
1. **“停在某格”类能力，在多名运动员同时到达时不触发**（例如 Party Animal 让大家同时移动）。这推翻了旧规则书第 21 页第 3 条（*Powers related to stopping on a space together still trigger if racers arrive at the same time*）和 Romantic 的旧注释（*If two racers move together... my power triggers twice*）。按 IELLO FAQ 2.0：同组同时到达的成员之间不触发，但目的地原本就在那里的第三者、以及赛道格效果仍然生效。Suckerfish 跟随到达时，被跟随者先结算，但 Romantic 不会因为这一对而触发。
2. 一名玩家控制多名运动员时，**开赛前把它们按想要的行动顺序摆在面前**（顺时针），之后不再每轮调整。旧规则是“每回合按任意顺序行动”。

### 2.13 2 人变体 [A]（第 26 页）
- 选秀：翻 8 张，按 ABBAABBA 选；再翻 8 张，**顺序反过来**（BAABBAAB）。每人 8 名（共 16 名）。
- 备赛：每场双方同时选 **2 名不同的**运动员上场，赛道上开局共 4 人。每人拿 2 颗骰子。
- 比赛：轮到某玩家时，他的两名运动员依次各行动一个完整回合。旧规则是按任意顺序，2026-08 修订后改为开赛前固定顺序。卡上写“other racers”的能力，**包括自己的另一名运动员**。
- 比完第一场后：上一场得分较低的玩家先手，平分掷骰。
- Genius 猜中只给 Genius 加回合，不给同一玩家的另一名运动员 [A]。
- Skipper 触发时，Skipper 先行动，然后才轮到同一玩家的其他运动员 [A]。

### 2.14 3 人双运动员变体 [A]
- 选秀：翻 6 张正常蛇形选秀，共进行 4 次，每次轮换先选的玩家，最后每人 8 名。pedestrian6 的实现顺序是 ABCCBA、BCAACB、CABBAC、ABCCBA [D]。
- 每场每人上 2 名，开局共 6 人；其余规则同 2 人变体。

### 2.15 其他通用细则 [A]（第 21 页 Fiddly Details 1–9）
1. 因任何原因重掷时，前一次点数视为没发生过；但“重掷”这个动作本身会触发 Scoocher 之类的能力。
2. Start 格算一格。
3. （旧条款，已被 2026-08 修订推翻）同时到达也触发停格类能力。
4. move 0 不算移动。
5. 有特定时机的能力（例如“Before my main move”）每回合只发生一次。
6. 运动员冲线或以其他方式离场后，能力失效，除非另有说明。
7. 任何“可以重掷”都只针对最近一次掷出的骰子。
8. 无限循环执行一轮后终止（见 2.10）。
9. 循环导致无人冲线时，比赛结束（见 2.10）。
- 规则争议解决不了时，掷骰决定谁对 [A 第 20 页]。
- 任何运动员都不能被推到 Start 之后（Centaur 的注释，IELLO 也确认这是通用规则）[A/B]。

---

## 3. 金/银筹码每场分值（重点）

| 场次 | 赛道（默认） | 第 1 名（金奖杯） | 第 2 名（银花结） |
|---|---|---|---|
| 第 1 场 | Mild Mile | **3** | **1** |
| 第 2 场 | Wild Wilds | **4** | **2** |
| 第 3 场 | Mild Mile | **4** | **2** |
| 第 4 场 | Wild Wilds | **5** | **3** |

- 依据：
  - [A] GeekDad 评测的实物组件照片，能直接看到 4 枚金奖杯上印着 3、4、4、5，4 枚银花结上印着 1、2、2、3（https://geekdad.com/wp-content/uploads/2025/11/MagicalAthlete-components.jpg ，本次已亲自查看图片核实）。
  - [A] 规则书规定“大的在下面”，所以从上往下依次是 3/1、4/2、4/2、5/3。
  - [C] 两个独立开源实现（xeonliu/MagicalAthleteOL、pedestrian6/magical-athlete）用的也是这组数值。
- 铜色筹码：1 分（星形，16 枚）和 3 分（9 枚）。规则书写明的用途有：Wild Wilds 星格 +1、Lovable Loser +1、Sisyphus 赛前拿 4 分。**3 分铜币**的用途规则书没写，推测是找零或兑换用 [D]。
- 一局最高总分 = 金 16 + 银 8 = 24，另加铜分。

---

## 4. 两面赛道

公共结构 [A 照片计数 + C]：
- Start（0）→ 上排 1–12（12 是右上角）→ 右侧 13、14 → 15（右下角）→ 下排向左 16–29 → 终点线（左下角的领奖台）。
- 有效格 1–29，越过 29 即冲线（可以记为位置 ≥30）。
- “第二个弯道”（Blimp 用）：第一个弯道在 12 附近，第二个在 15 附近。Blimp 回合开始时位置 **<15 得 +3，≥15 得 −1**。这是开源实现 magsim 和 pedestrian6 的共同解读 [C]，规则书没有给出格号。
- 两面都印有 5、10、15、20、25 的格号，方便数格。

### 4.1 Mild Mile（温和面）[A]
没有任何特殊格，30 格纯赛道。

### 4.2 Wild Wilds（狂野面）
来源：GeekDad 双面赛道俯视实物照片（https://geekdad.com/wp-content/uploads/2025/11/MagicalAthlete-GameBoard.jpg ，本次已亲自查看并逐格数过），与两个开源实现（pschonev/magsim 的 `build_wild_wilds`、pedestrian6 的 `TRACKS.wild`）完全一致 [A+C]。

| 格号 | 图标 | 效果 |
|---|---|---|
| 1 | 星（★1） | 停下获得 1 枚铜 1 分 |
| 5 | TRIP! | 停下即摔倒 |
| 7 | 箭头 3（指向前进方向） | 再**前进 3** 格 |
| 11 | 箭头 1（指向前进方向） | 再**前进 1** 格 |
| 13 | 星（★1） | 停下获得 1 分 |
| 16 | 箭头 4（下排箭头朝右，也就是朝 Start 方向） | 再**后退 4** 格（→ 12） |
| 17 | TRIP! | 摔倒 |
| 23 | 箭头 2（朝左，前进方向） | 再**前进 2** 格（→ 25） |
| 24 | 箭头 2（朝右，后退方向） | 再**后退 2** 格（→ 22） |
| 26 | TRIP! | 摔倒 |

赛道格规则 [A]：
- **箭头格**：停在箭头格时，朝箭头方向移动所示格数。这是一次**独立的移动**，不属于主移动（Coach、Gunk 等加减值不适用；会触发 Banana、Centaur、Scoocher 等能力）。
- **TRIP 格**：停下就摔倒。
- **星格**：停下就拿 1 枚铜 1 分。
- 只有“停在”格上才触发，路过不算。瞬移到达也算停下 [B]。
- 赛道格的结算优先级最高（见 2.9）。
- 箭头连锁：16 退 4 到 12（普通格），24 退 2 到 22（普通格），7 进 3 到 10，11 进 1 到 12，23 进 2 到 25。按当前布局不会连到另一个特殊格（是否连锁需要看落点的实际位置，Huge Baby、Leaptoad 会改变落点）。
- Suckerfish 停在箭头格上时，可以选择跟着另一名运动员走，也可以留下结算自己的箭头 [B]。

---

## 5. 基础包 36 名运动员

**英文能力原文**取自规则书第 22–25 页的正式卡面（判定依据见文首提示）[A]。旧版或隐藏层文本有差异的在“备注”列标出。
**中文名**：中文正版《胡闹运动会》（艾赐魔袋）的官方译名**没有找到完整列表**。表中“中文名”列给出几个来源：
- 【X】xeonliu/MagicalAthleteOL 的中文本地化
- 【P】pedestrian6/magical-athlete
- 【Z】桌游库 zhuoyouku 指南
- 【S】什么值得买评测里出现的、疑似正版译名（大嘴巴、巨婴、西西弗斯、派对动物、半人马）

以上都**不是确认过的官方译名**。
**中文翻译**是本文自己的译文，力求忠于原文。
**规则书注释**为卡片下方的官方注释 [A]；**FAQ** 为 IELLO FAQ 2.0 [B]。

| # | 英文名 / 能力名 | 中文名（来源） | 能力原文（正式卡面） | 中文翻译 | 官方注释 / FAQ 要点 | 可信度 |
|---|---|---|---|---|---|---|
| 1 | **Alchemist** / TRANSMUTE 'N' SCOOT | 炼金术士【X】【P】 | When I roll a 1 or 2 for my main move, I can move 4 instead. | 我主移动掷出 1 或 2 时，可以改为移动 4。 | FAQ：骰面不变，所以 Inchworm、Skipper 照样触发；Inchworm 会把这次移动整个取消；重掷掉的 1 不触发。“改为 4”之后再加 Coach、Gunk 等修正。 | A |
| 2 | **Baba Yaga** / LEG IT | 芭芭雅嘎【X】、鸡脚屋【P】 | Trip any racer that stops on my space, or when I stop on theirs. | 停到我所在格的运动员会摔倒；我停到别人格上时，对方也摔倒。 | 注释：和 Duelist 共格时仍可决斗，但 Duelist 照样摔倒；Hypnotist 可以把我传过去，但 Hypnotist 自己摔倒。FAQ：同时到达的不算；瞬移算停下；Duelist 赢了决斗走到我格上就摔倒。 | A |
| 3 | **Banana** / THE SLIP | 香蕉【X】【P】【Z】 | I trip any racer that passes me. | 经过我的运动员都会摔倒。 | 规则书示例：对方走完整个主移动后再摔倒。FAQ：Leaptoad 跳过我也算经过；后退经过也算；从我所在格出发不算。 | A |
| 4 | **Blimp** / BLOW IT | 飞艇【X】【P】 | When I start my turn before the second corner of the track, I get +3 to my main move. On or after that corner, I get -1. | 我的回合开始时如果还没到赛道第二个弯道，主移动 +3；在弯道上或已过弯道，主移动 −1。 | 旧/隐藏层文本是 **+2**（正式卡面和 IELLO FAQ 为 +3）。第二弯道按格 15 处理 [C]。 | A（数值 +3 依据 B/C） |
| 5 | **Centaur** / HOOFWHACK | 半人马【X】【P】【S】 | When I pass a racer, they move -2. | 我经过一名运动员时，对方移动 −2（后退 2）。 | 注释：不能退到 Start 之后。FAQ：后退时经过也触发，但被踢者仍然朝 Start 方向退；同格的几人一起退；按 Centaur 经过的先后顺序依次结算。后退是 move，会触发 Banana 等。 | A |
| 6 | **Cheerleader** / RAH RAH | 啦啦队长【X】【P】 | Before my main move, I can make the racer(s) in last place move 2. If I do, I move 1. | 主移动前，我可以让最后一名（可以是多人）移动 2；这样做的话，我再移动 1。 | 注释：并列最后的全部移动，但我只 +1；我自己也是最后时，是两次独立移动（先 2 后 1）。FAQ：多名最后者同时移动（同时到达规则适用）。旧文本时机写的是 “At the start of my turn”。 | A |
| 7 | **Coach** / GOOD HUSTLE | 教练【X】【P】【Z】 | Everyone on my space gets +1 to their main move, including me. | 和我同格的所有人（包括我）主移动 +1。 | 注释：我自己也享受。FAQ：加在总距离上；没有主移动就没有加成。Legs 的 5 也能 +1。 | A |
| 8 | **Copy Cat** / COPY THAT | 模仿猫【X】【P】 | I have the power of the racer currently in the lead. If there's a tie, I pick. | 我拥有当前领先运动员的能力；领先并列时由我选。 | 注释：持续生效，不只在我的回合；和被复制者的能力冲突时以对方为准；不复制“赛前”能力；并列领先时不能在一个动作中途换复制对象。FAQ：复制 Mastermind 时做的预测，失去该能力时一起作废；同时猜中同一冠军时 Mastermind 拿第 2；复制 Twin 时复制的是 Twin 印刷文本，不是 Twin 选中的能力。我自己独自领先时怎么处理没有官方说明（P 的处理是没有能力）[D]。 | A |
| 9 | **Dicemonger** / DICEY DEALS | 骰商【X】【Z】、骰子商人【P】 | Anyone can reroll their main move once per turn. When another racer does it, I move 1. | 任何人每回合可以重掷一次主移动骰。别的运动员这样做时，我移动 1。 | 注释：别人重掷时，我先移动，他们再掷、再移动。FAQ：由当前玩家决定是否重掷；我先完整结算移动 1，再掷新骰。 | A |
| 10 | **Duelist** / DUEL! | 决斗家【X】【P】、决斗者【Z】 | Whenever a racer shares my space, I can shout DUEL! We roll our dice and whoever rolls highest moves 2. I win ties. | 每当有运动员和我共格，我可以喊“决斗！”。双方掷骰，点数高的移动 2，平局算我赢。 | 注释：一回合可以决斗多次，不是我的回合也可以；只要共格就能立即宣布；不能打断进行中的动作（比如掷骰和移动之间）。FAQ：Start 格上也能决斗；当前玩家优先。决斗骰不是主移动骰，不触发 Lackey 等。 | A |
| 11 | **Egg** / SCRAMBLE | 蛋【X】、蛋蛋【P】 | Before my race, draw 3 new racers from the deck and pick one. I have its powers. | 我这场比赛开始前，从牌堆抽 3 名新运动员，选 1 名，我拥有它的能力。 | 注释：仍使用 Egg 的棋子；也会获得所选角色的“赛前”能力。没选中的牌放哪里没有说明 [未找到]。旧文本写的是 “At the start of my race”。 | A |
| 12 | **Flip Flop** / FLOP FLIP | 人字拖【X】【P】 | I can skip rolling for my main move and swap spaces with another racer instead. | 我可以不掷主移动骰，改为和另一名运动员交换位置。 | 注释：交换是瞬移，不算移动，也不掷骰；双方不会短暂共格；同时交换。FAQ：双方都算“停下”，都触发赛道格；可以把 M.O.U.T.H. 换到某个单人格让它吃人；Suckerfish 不能跟随。 | A |
| 13 | **Genius** / THINK GOOD | 天才【X】【P】 | I can predict what number I'll roll for my main move. If I'm right, I take another turn after this one. | 我可以预测自己主移动会掷出几点。猜对的话，本回合结束后我再进行一个回合。 | 注释：和 Skipper 同场时，我预测 1 并掷出 1，Skipper 抢走下一回合（它的能力在我之后触发）；多运动员模式下只有 Genius 获得额外回合。FAQ：以最终（重掷后）点数为准；Skipper 的回合**取代**我的额外回合。 | A |
| 14 | **Gunk** / GOOP 'EM | 黏液怪【X】【P】 | Other racers get -1 to their main move. | 其他运动员主移动 −1。 | 注释：减的是移动距离，不是骰面，所以掷出的 6 仍是 6，Lackey 照常触发。FAQ：多个 Gunk 效果叠加；合计可以为负（后退）；每次 −1 都触发 Scoocher。 | A |
| 15 | **Hare** / HUBRIS | 野兔【X】【P】、兔子【Z】 | I get +2 to my main move. When I start my turn alone in the lead, I skip my main move. | 我主移动 +2。回合开始时如果我独自领先，就跳过主移动。 | 旧/隐藏层文本：“...I skip my move **and get a bronze point chip**”（正式卡面和 IELLO FAQ **不给铜分**）。FAQ：并列领先不触发；被绊倒且独自领先时，不起身。 | A（无铜分依据 B/C） |
| 16 | **Heckler** / SCHADENFREUDE | 起哄者【X】【P】 | When a racer ends their turn within 1 space of where they started, I move 2. | 任何运动员结束回合时，如果离本回合开始的位置不超过 1 格，我移动 2。 | 注释：对刚从摔倒中起身的运动员也生效。FAQ：包括我自己；在该回合所有后果结算完之后检查。前进 1、原地、后退 1 都算。 | A |
| 17 | **Huge Baby** / REALLY HUGE | 巨婴【X】【P】【S】 | No one can ever be on my space, besides the Start. Whenever that would happen, put the racer on the space behind me instead. | 除 Start 外，任何人都不能和我同格。一旦要发生这种情况，就把那名运动员放到我身后一格。 | 注释：被放到后面**不算移动**，相当于直接停在那一格。我停到 Banana 格并把它挤到后面，算我经过它，我摔倒。FAQ：被放到后面那格算“停下”（会触发赛道格等）。Party Animal 注释：Huge Baby 被拉到 Party Animal 的格时，那格其他人都后退一格。 | A |
| 18 | **Hypnotist** / HSSSSST | 催眠师【X】【P】 | Before my main move, I can warp a racer to my space. | 主移动前，我可以把一名运动员瞬移到我所在格。 | 旧文本时机写的是 “At the start of my turn”。FAQ：目标算停在我格上，但不经过任何人；拉来 Baba Yaga 我会摔倒；拉来 M.O.U.T.H. 我可能被吃。之后我仍然有主移动。 | A |
| 19 | **Inchworm** / WRIGGLE | 尺蠖【X】【P】 | When another racer rolls a 1 for their main move, they skip that move and I move 1. | 其他运动员主移动掷出 1 时，对方跳过这次移动，我移动 1。 | 注释：和 Skipper 同场时，有人掷出 1：我先蠕动 1，然后 Skipper 行动。FAQ：取消对方整个主移动（含所有加值）；重掷掉的 1 不算；看骰面不看距离。旧文本写的是 “When anyone else rolls a 1”。 | A |
| 20 | **Lackey** / VERY GOOD SIRE | 跟班【X】【P】 | When another racer rolls a 6 for their main move, I move 2 before they move. | 其他运动员主移动掷出 6 时，在对方移动前我先移动 2。 | FAQ：我自己掷 6 不触发；Gunk 不改变 6 这个骰面。 | A |
| 21 | **Leaptoad** / JUMPFROG | 跳跳蛙【X】、跳跳蟾蜍【P】 | While moving, I skip spaces with other racers on them. | 移动时，我跳过有其他运动员的格（不计入步数）。 | 注释：后退时也这样。FAQ：任何方式的移动都适用；同一时刻刚空出来的格算空格；跳过 Banana 会摔倒；每跳过一个有人的格，都单独触发一次 Scoocher（连续跳两格就触发两次）。 | A |
| 22 | **Legs** / JOG | 长腿【X】、大长腿【P】 | I can skip rolling for my main move and move 5 instead. | 我可以不掷主移动骰，改为移动 5。 | 注释：这仍算主移动，所以受 Gunk 的 −1 和 Coach 的 +1 影响。FAQ：没掷骰，所以不触发任何看骰面的能力；使用能力会触发 Scoocher。 | A |
| 23 | **Lovable Loser** / D'AWW | 可爱输家【X】、可爱的倒霉蛋【P】 | Before my main move, I get 1 point chip if I'm alone in last place. | 主移动前，如果我独自处于最后一名，获得 1 枚分数筹码（1 分）。 | 旧文本：“At the start of my turn, I get a bronze point chip...”（拼写为 Loveable Loser）。FAQ：并列最后不算；被绊倒时也能得分。 | A |
| 24 | **Magician** / POOF | 魔术师【X】【P】 | I can reroll my main move up to two times. | 我主移动最多可以重掷两次。 | 注释：必须用最后一次掷出的点数。FAQ：每次重掷都在任何能力反应之前抹掉前一个点数；每次重掷都触发 Scoocher（即使最后没用上）。旧文本写的是 “twice”。 | A |
| 25 | **Mastermind** / KNOW-IT-ALL | 幕后主脑【X】、幕后军师【P】 | At the start of my first turn, I predict which racer will win. If I'm right, the race ends immediately and I finish 2nd. | 在我第一个回合开始时，我预测哪名运动员会赢。猜对的话，比赛立即结束，我获得第 2 名。 | 注释：预测自己并猜中时，可以同时拿第 1 和第 2。FAQ：在首回合开始时预测，不是赛前；被淘汰就失去能力。和 Copy Cat 预测同一人时 Mastermind 优先。 | A |
| 26 | **M.O.U.T.H.** / CHOMP | 大嘴【X】、大嘴怪【P】、大嘴巴【S】 | When I stop on a space with exactly one other racer, they're eliminated from the race. | 我停到一个恰好有另一名运动员的格时，对方被淘汰出本场比赛。 | 注释：吃到没人能拿第 2 时，没人得那份分，银花结弃掉；只剩 1 人时比赛立即结束，这人拿第 1 或第 2。FAQ：别人停到我格上不触发；同时到达不触发；瞬移到达也触发（例如被 Flip Flop 换过去）。Huge Baby 不会和我共格，所以吃不到（S 也这么说）[推论]。 | A |
| 27 | **Party Animal** / ANIMAL MAGNETISM | 派对动物【X】【P】【S】 | Before my main move, all racers move 1 space towards me. Each other racer on my space gives me +1 to my main move. | 主移动前，所有运动员朝我移动 1 格。和我同格的每名其他运动员，让我主移动 +1。 | 注释：Huge Baby 被拉到我格上时，那格的人都后退 1 格。FAQ：所有人**同时**移动（2026-08 修订后，同时到达的人之间不触发停格能力）；本来就在我格上的人不动；Leaptoad 在我旁边时会跳过我的格；Start 格上也能拿加成。旧文本时机写的是 “At the start of my turn”。 | A |
| 28 | **Rocket Scientist** / KABLOOEY | 火箭科学家【X】【P】 | When I roll for my main move, I can move double that number. If I do, I trip. | 我掷主移动骰后，可以移动该点数的两倍。这样做的话，我摔倒（移动完后）。 | 注释：先掷骰再决定。FAQ：先翻倍，再加减（例如掷 5 有 Coach：5×2+1=11）；走完再摔倒。旧文本：“...If I do, I trip after moving.” | A |
| 29 | **Romantic** / AH, LOVE! | 浪漫主义者【X】、浪漫家【P】、浪漫者【Z】 | When anyone stops on a space with exactly one other racer, I move 2. | 每当有人停到一个恰好有另一名运动员的格（停下后该格恰好 2 人），我移动 2。 | 旧注释“两人一起移动时触发两次”已被 2026-08 修订推翻。FAQ：包括我自己；一回合可以多次触发；被绊倒也能触发；同时移动的组（Party Animal、Cheerleader、Suckerfish）之间不触发。 | A |
| 30 | **Scoocher** / SCOOCH SCOOCH | 挪步者【X】、蹭蹭怪【P】、慢挪【Z】 | When another racer's power happens, I move 1. | 每当另一名运动员的能力发生，我移动 1。 | 注释：Gunk 每对一名运动员的主移动造成一次 −1，就挪 1；Dicemonger 每次重掷都挪；Leaptoad 每跳过一格都挪（跳过 2 个连续有人格就挪两次）；Magician 每次重掷都挪（即使没用上）。和 Suckerfish 反复互动不算循环。FAQ：在对方能力完整结算后再挪，次数不限。 | A |
| 31 | **Sisyphus** / KEEP ROLLIN' | 西西弗斯【X】【P】【S】 | Before my race, I take 4 point chips. When I roll a 6 for my main move, instead of moving, I warp to the Start and lose 1 point chip. | 我这场比赛开始前，拿 4 枚分数筹码。主移动掷出 6 时不移动，改为瞬移回 Start，并失去 1 枚分数筹码。 | 注释：掷出超过 4 次 6，只要还有分就继续扣；瞬移后不再进行主移动。FAQ：修正值不改变骰面；分数不会扣到 0 以下。“point chips”按 1 分算 [推论，P/X 均如此实现]。 | A |
| 32 | **Skipper** / SALTY DOG | 抢跑者【X】、船长【P】 | When anyone rolls a 1 for their main move, I go next in turn order. | 任何人主移动掷出 1 时，下一个行动的是我。 | 注释：我行动完，顺序从我左边继续（如果我又掷出 1，就再来一次）；多运动员模式下有人掷出 1，我先行动，然后才是我的其他运动员。FAQ：在当前回合完整结算后才轮到我；中间的人被跳过；我自己掷 1 也触发；多个 Skipper 按优先级处理。 | A |
| 33 | **Stickler** / ACTUALLY... | 较真者【X】、较真怪【P】 | Other racers can only cross the finish line by moving the exact amount they need. If they overshoot, they don't move. | 其他运动员只有移动的步数正好够时才能冲线。超过了就不移动。 | 注释：包括主移动和能力造成的所有移动，例如 Duelist 在终点前一格赢得决斗（移动 2）也不能冲线。FAQ：整次移动取消；Stickler 自己不受限。 | A |
| 34 | **Suckerfish** / SUCKER! | 吸盘鱼【X】【P】 | When a racer on my space moves, I can move to their new space. | 和我同格的运动员移动时，我可以移动到它的新位置。 | 注释：跟着开始移动后，必须陪它走完整次移动；可以借此冲线。FAQ：两人同时到达；冲线名次排在被跟随者后面；瞬移不能跟；每次跟随都触发 Scoocher（可能形成连续追逐）；在箭头格上可以选择跟走或留下结算自己的箭头。后退能不能跟没有明确裁定（P 允许）[D]。 | A |
| 35 | **Third Wheel** / ROLL THROUGH | 电灯泡【X】【P】 | Before my main move, I can warp to any space with exactly 2 racers on it. | 主移动前，我可以瞬移到任何恰好有 2 名运动员的格。 | 注释：瞬移后我仍然有主移动。FAQ：这算真正的停下（会触发停格能力和赛道格）。 | A |
| 36 | **Twin** / DOUBLE DIP | 双胞胎【X】【P】 | Before my race, I can pick a racer who won a previous race and race with their powers. | 我这场比赛开始前，可以选一名在之前某场比赛中获胜的运动员，用它的能力参赛。 | 注释：仍使用 Twin 的棋子；也获得所选角色的“赛前”能力。FAQ：只能选拿过第 1 名的（第 2 名不行）；第 1 场没有可选对象。 | A |

> 卡牌底部还有趣味文案（flavor text），与规则无关，略去。规则书 PDF 里能力名字段的对应关系是从排版顺序推断的，名称本身都出现在原文中。

---

## 6. 已知规则澄清 / FAQ（角色互动）

除了上表各行，补充几条跨角色的要点：

1. **结算的基本顺序** [B]：骰面 → 最终移动值 → 棋子移动 → 停在哪里 → 后果。
2. **修正与骰面分离** [A/B]：Gunk、Coach、Hare、Blimp、Party Animal 改的是移动距离，不改骰面。Lackey、Sisyphus 看的 6 和 Inchworm、Skipper、Alchemist 看的 1 都是骰面。替换（Alchemist 4、Legs 5）或翻倍（Rocket）先算，加减后算。
3. **重掷** [A/B]：重掷掉的点数视为没发生，不触发 Inchworm、Lackey、Skipper、Sisyphus。重掷动作本身触发 Scoocher；Dicemonger 的 +1 在新骰之前结算。一旦后果开始结算就不能再重掷。
4. **Genius 对 Skipper** [A/B]：Genius 预测 1 并掷出 1 时，Skipper 抢走下一回合，取代 Genius 的额外回合。
5. **Inchworm 对 Skipper** [A]：有人掷出 1，Inchworm 先蠕动 1，然后 Skipper 行动。
6. **Scoocher 对 Huge Baby** [A]：Scoocher 停到 Huge Baby 格被放回后面一格，这是规则书点名的无限循环例子，执行一轮后终止。
7. **Scoocher 对 Suckerfish** [A]：可以反复互动，不算循环。
8. **Huge Baby 对 Banana** [A]：Huge Baby 停到 Banana 格，把 Banana 挤到后面，算 Huge Baby 经过 Banana，所以 Huge Baby 摔倒。
9. **Huge Baby 对 Party Animal** [A]：Huge Baby 被拉到 Party Animal 的格上时，那格的其他人都后退 1 格。
10. **Baba Yaga 对 Duelist / Hypnotist** [A]：Duelist 可以和 Baba Yaga 决斗，但照样摔倒；Hypnotist 把 Baba Yaga 拉过来，Hypnotist 自己摔倒。
11. **Gunk 对 Lackey** [A]：Gunk 不改变骰面，6 仍然触发 Lackey。
12. **Legs 对 Gunk / Coach** [A]：移动 5 仍算主移动，受 −1 和 +1 影响。
13. **Stickler 对 Duelist** [A]：Duelist 在终点前 1 格赢得移动 2，不能冲线（移动取消）。
14. **Copy Cat** [A/B]：持续复制领先者；不复制赛前能力；复制 Twin 时只拿 Twin 的印刷能力；复制 Mastermind 时，失去该能力就连同预测一起失去。
15. **M.O.U.T.H.** [A/B]：吃到场上只剩 1 人时比赛立即结束；可以被 Flip Flop 换到某个单人格去吃人；被 Hypnotist 拉过去也会吃人（Hypnotist 自己可能被吃）。
16. **Romantic 对 Duelist** [B]：Romantic 在自己回合停到 Duelist 的格，Romantic 优先移动 2，决斗条件随之消失。
17. **Centaur 后退经过** [B]：Centaur 被别的能力推着后退时经过的运动员，也会被踢退 2。
18. **Banana 双向** [B]：后退经过 Banana 也会摔倒。
19. **起点规则** [B]：Duelist 可以在 Start 决斗，Party Animal 在 Start 也拿加成；Huge Baby 在 Start 必须和别人共格（例外）。
20. **Sisyphus 分数下限** [B]：最多扣到 0。
21. **同时到达** [B，2026-08 修订]：同一组同时到达的运动员之间不触发停格能力（Romantic、M.O.U.T.H.、Baba Yaga、Third Wheel 判定等），赛道格照常生效。

已知还有一个 BGG 帖 “Racers moving simultaneously”（https://boardgamegeek.com/thread/3578468），BGG 拒绝匿名访问（403），**内容未能读取**。

---

## 7. 扩展包情况（简述）

- **Magical Athlete: Second Wind**：CMYK 的**独立续作**（standalone）。2026 年 8 月 Alex Hague 在 BGG 上传更新版规则书时，里面的一页提前泄露了它。据 CMYK 代表说，格式与本作相同：同样数量的运动员、双面赛道、6 颗骰子，可以和基础盒混用；还新增 “twist cards” [D]。发售日期未公布，具体角色未公开（BGG 用户称已在 CMYK Discord 公布，未核实）。2026-08 规则修订就是为它铺路（更多多运动员情境）。
- **官方扩展**：基础盒之外没找到已发售的官方扩展。
- **社区内容**：BGG 文件区有大量玩家自制运动员（例如 “Over 350 Racers”）和自制赛道（包括 1–6+ 人赛道）；Steam 有 Tabletop Simulator 脚本化模组。
- **旧版**：Z-Man Games 2010 年英文版（Ishida 原版规则，含拍卖等旧机制），与本作不兼容，这里不展开。

---

## 8. 缺失或不确定的信息

1. **中文正版《胡闹运动会》的官方角色译名**：未找到完整列表。表中中文名都是社区或开源项目的译名，最终命名需要购买中文版核对，或者自行确定。
2. **旧/新卡面文本之争**：Blimp +2/+3、Hare 是否拿铜分，依据的是 IELLO 法文可见卡面和 FAQ 2.0 [B]，没有亲眼看到 CMYK 英文实体卡。CMYK 早期印刷批次可能与此不同。
3. **2026-08 修订版英文规则书全文**：没拿到（BGG 403）。只通过帖子摘要和 IELLO FAQ 2.0 间接得知两条主要改动；Hague 说“还有很多非常小的改动”，细节未知。
4. **Blimp 的“第二个弯道”格号**：规则书没写，按 15 处理 [C]。
5. **几处平局细则**：场间先手时最落后并列怎么办、Copy Cat 自己独自领先时有什么能力、Egg 没选中的两张牌去哪、Suckerfish 能否跟着后退，规则书都没写。
6. **3 分铜币的用途**：规则书没说明。
7. 日本原版的出版年份和出版商未核实。

---

## 9. 主要来源

- 官方规则书 PDF（CMYK，2026-08 修订前的版本）：仓库 xeonliu/MagicalAthleteOL 的 `docs/How_to_play_Magical_Athlete_compressed.pdf`（https://github.com/xeonliu/MagicalAthleteOL）
- IELLO 法文版官方 FAQ 2.0（2026-08-28）：https://iello.fr/athletes-de-compete-tatillon-repond-a-vos-questions/
- IELLO 法文规则书：https://iello.fr/wp-content/uploads/2026/02/Magical-Athlete_Rulebook_FR_Light.pdf （经 pedestrian6 转引，本次未直接下载）
- BGG 2026-08 规则修订帖（经搜索摘要获取）：https://boardgamegeek.com/thread/3754599/a-couple-august-2026-rules-updates
- GeekDad 评测和实物照片（金银分值、赛道格位置）：https://geekdad.com/2025/11/wacky-racing-in-magical-athlete/ ；组件图 https://geekdad.com/wp-content/uploads/2025/11/MagicalAthlete-components.jpg ；赛道图 https://geekdad.com/wp-content/uploads/2025/11/MagicalAthlete-GameBoard.jpg
- CMYK 产品页：https://www.cmyk.games/products/magical-athlete
- ICv2 发行报道：https://icv2.com/articles/news/view/60814/richard-garfield-updates-rules-magical-athlete
- BGG 条目：https://boardgamegeek.com/boardgame/454103/magical-athlete
- 开源实现（交叉核对）：https://github.com/pschonev/magsim 、https://github.com/pedestrian6/magical-athlete 、https://github.com/siyanew/Magical-Athlete
- 中文资料：桌游库指南 https://www.zhuoyouku.com/rulebook/rule_magical_athlete ；什么值得买（中文正版信息）https://post.smzdm.com/p/ak8k4324/
- 186996.com/game/MagicalAthlete/：访问返回 404 页面，未取得内容。
