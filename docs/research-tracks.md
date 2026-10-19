# Magical Athlete 赛道专项调研

调研日期：2026-10-19。补充 `research-rules.md` 第 4 节。可信度标记沿用该文件：
- **[A]**：官方规则书原文或官方印刷图像
- **[B]**：CMYK 创意总监 Alex Hague 在 BGG 的发帖，或 IELLO 官方资料
- **[C]**：多个独立来源一致
- **[D]**：单一来源或推断

---

## 0. 结论速览

1. **基础盒（CMYK 2025，中文版《胡闹运动会》）只有一块双面赛道：Mild Mile / Wild Wilds。** 证据：规则书第 27 页内容物写的是 “1 double sided racetrack”。规则书里没有可选赛道、促销赛道或赛道变体。唯一相关的条文在第 18 页：“If you prefer, you can race all on a single track, or change the schedule to your liking.” 意思是可以只用一面，也可以自定赛程。[A]
2. **确实还有其他官方赛道：续作 *Magical Athlete: Second Wind* 带来两条新赛道，Twisty Twirl 和 Whirly World。** 2026-08-17 更新版规则书第 20 页 “COMBINING BOXES” 原文：
   > “There's more than one Magical Athlete box! … If you do, race on different tracks each race. So if you have the original Magical Athlete and Second Wind, race in this order: Mild Mile, Wild Wilds, Twisty Twirl, Whirly World.” [A]

   Second Wind 是独立续作（绿盒）：36 名新运动员、一块双面赛道、6 颗骰子，另有 Twist 卡。Hague 在 BGG 说 “We're hoping to launch the game November 10!”（2026-08-27）[B]。截至调研日还没上市，BGG 也没有条目。
3. **“很多 TRIP 格”的官方赛道没有找到。** 在所有官方赛道里，TRIP 最多的仍是 Wild Wilds（5、17、26，共 3 格）。从美术图看，两条新赛道都**没有** TRIP 格：Twisty Twirl 靠 Twist 卡，Whirly World 靠漩涡管道（whirl spaces）。用户印象中的赛道，可能是 Wild Wilds 本身，也可能是 BGG 上某条玩家自制赛道（见第 5 节）。

---

## 1. 赛道总表

| 赛道 | 中文名 | 来源盒 | 格数 | 特殊格 | 可信度 |
|---|---|---|---|---|---|
| Mild Mile | 中文正版官方译名未找到；开源实现译作“轻松一圈”“温和英里”“悠閒一哩”；法文版 Course Pépère | 基础盒 A 面 | Start + 1–29，越过 29 冲线 | 无 | A |
| Wild Wilds | 中文正版官方译名未找到；开源实现译作“狂野赛道”“疯狂赛道”“狂野荒野”；法文版 Course Galère | 基础盒 B 面 | 同上 | 10 格（见 research-rules.md 4.2） | A+C |
| Twisty Twirl | 未找到（中文版尚未引进续作） | Second Wind | 同样是 Start + 1–29（按美术图逐格数出） | 13/14 交界处有 TWIST 标志；Twist 卡组 | 名称 A；格子 D |
| Whirly World | 未找到 | Second Wind | 同样是 Start + 1–29（按美术图逐格数出） | 12 个漩涡格，组成 6 对管道 | 名称 A；格子 D；规则文字未找到 |

Grand Circuit（两盒混用）的每场金/银分值 [D]：malbonius 伴侣 App 的数据是 Mild Mile 3/1、Wild Wilds 4/2、Twisty Twirl 4/2、Whirly World 5/3，和基础盒四枚奖杯/花结的 3/1、4/2、4/2、5/3 一一对应。

---

## 2. Mild Mile / Wild Wilds（复核）

- 规则书（xeonliu/MagicalAthleteOL 的 `docs/How_to_play_Magical_Athlete_compressed.pdf`，2026-08 修订前版本，已下载到 `/tmp/ma-research/pdf1/` 并抽取文字）[A]：
  - 第 11 页：“Put the racetrack in the middle of the table, Mild Mile side up.”
  - 第 18 页：“Flip the track over to the other side. (You'll race on each track twice per game: Mild, Wild, Mild, Wild.)”，以及上面引用的自定赛程条文。
  - 第 21 页 WILD WILDS TRACK 只定义了三种格：Trip、Star、Arrows（原文见 research-rules.md 4.2）。
  - 第 27 页：“1 double sided racetrack”。
  - 抽出的文字里反复出现 “Wild Wilds 23x18mm…” 一类字样。这是印刷模切标注（指示物尺寸），不是额外赛道。
- 开源实现定义的赛道 [C]：
  - pschonev/magsim：`BoardName = Literal["Standard", "WildWilds"]`；`BOARD_DEFINITIONS` 只有 `Standard`（length=30，无特殊格）和 `build_wild_wilds()`。
  - pedestrian6/magical-athlete：`TRACKS: { mild, wild }`，`length: 29, secondCorner: 15`。
  - xeonliu/MagicalAthleteOL：内嵌 magsim，`TRACK_SCHEDULE = ("Standard", "Standard", "WildWilds", "WildWilds")`。注意它的赛程是 Mild、Mild、Wild、Wild，和规则书的 Mild、Wild、Mild、Wild 不一致。
  - 另外抽查了 Lv99Slime/Magical_Athlete_Web、jimlai0320/magical-athlete-bot，也只有这两面。
  - 三份实现的 Wild Wilds 特殊格完全一致：1★、5 TRIP、7 →3、11 →1、13★、16 ←4、17 TRIP、23 →2、24 ←2、26 TRIP。malbonius App 内嵌的官方 Wild Wilds 美术图也逐格吻合。
- BGG 帖 3662656 的一个旁证：两面的格子颜色都按“紫、黄、绿、蓝、红”循环，只有 Wild Wilds 第 16 格（后退 4）配色反了。不影响规则。
- 法文版 IELLO《Athlètes de Compète》：“1 plateau Piste (recto verso : Course Pépère/Course Galère)”。TRIP 在法文版里印作 “OUPS!”（据零售商描述）[B/D]。
- 日文版（Arclight）：“ゲーム盤（両面仕様）1枚” [C]。

---

## 3. Twisty Twirl（Second Wind）

**来源**
- 名称：更新版规则书第 20 页 [A]。原图是 W. Eric Martin 文章转载的规则书截图：https://storage.ghost.io/c/5a/16/5a16635c-eb73-44ae-8dab-7c32ee8e4fd4/content/images/2026/08/Screenshot-2026-08-20-at-10.59.51---AM.png
- 格子布局：开源伴侣 App malbonius/magical-athlete-companion 打包了这条赛道的美术图（`assets/track-twistytwirl.webp`，README 自称 “Official artwork and power/rules text are bundled”）。我把图解码到 `/tmp/ma-research/track-twistytwirl.png`，逐格数过。图应当是 CMYK Discord 预览的官方美术，但只有这一个出处，所以记 **[D]**。
- App 对这条赛道的描述：“Second Wind track with the Twist deck.”

**格子**
- 结构和基础盒完全相同：Start → 上排 1–12（印有 5、10）→ 右侧 13、14 → 15（右下角，印有 15）→ 下排向左 16–29（印有 20、25）→ 终点领奖台。
- 1–29 全是纯色格，看不到箭头、星、TRIP 图标。
- 右侧弯道 13（绿）和 14（橙）之间印着彩色 “TWIST” 字样，形状像糖果包装纸的扭结。这个标志具体属于哪一格、触发条件是什么，**都没找到规则文字**。推测是“到达或经过该处时翻一张 Twist 卡”，未证实 [D]。

| 格号 | 图标 | 效果 |
|---|---|---|
| 13 / 14 交界 | TWIST 标志 | **规则未找到**。推测与 Twist 卡组有关 |
| 其余 1–29 | 无 | — |

**Twist 卡（Second Wind 新组件）** [D]：卡名和规则原文取自 malbonius App。BGG 帖 3754599 有玩家指出更新版规则书第 21 页印有这些卡。App 中共 13 张：

| 卡名 | 规则原文 |
|---|---|
| Alchemy Lab Containment Breach! | Put the W.E.R.E.M.O.U.T.H. on the Start. Roll for its move after every turn. Any racer it passes is eliminated. If someone is racing as Bite Mark, they still race as the W.E.R.E.M.O.U.T.H., but go back to the Start. Roll for its move after every turn. |
| Bonkbug Infestation at the Finish Line! | When a racer stops on one of the last 2 spaces, they move backwards 5. |
| The Conveyor Belt is On! | Warp all racers to one space after Start. Everybody gets +3 to their main move. |
| Curse Wands for Everyone! | After each player's turn, they roll a die. Skip that many players in turn order. Racers that have finished or eliminated are still included in counting and still roll. If players have multiple racers, don't forget to count and roll for each. |
| The Fans Demand Chaos! | Draw 2 Twist cards and do both in order. |
| Mirror World Theory Confirmed! | Reverse the direction of the race. If multiple racers are on the Start when this happens, turn order determines the finish order. |
| No Running by the Scrying Pool! | Any racer that moves 6+ spaces for their main move is eliminated instead. |
| The Piñata is Leaking! | Put a point chip on every empty space after the first corner. When a racer stops on a space with one, they take it. |
| Randomness has Randomly Ceased! | All players roll their die: that's what they roll for anything for the rest of the race. |
| You Tromped on a Time Imp! | The racer that triggered this is eliminated, but participates in the next race as an extra racer for their player. If Mush triggered this, they start with all the powers they had when they were eliminated. |
| Roast Chicken on the Ground! | Move the last place racer 7. If multiple racers are in last place, they all get the bonus. In turn order if it matters. |
| Season Finale! | The 1st and 2nd finishers compete in a 1v1 race for all the points, starting on the second corner. First place starts. |
| Swap Meet! | All players draw a new racer and can swap it with their current one. The decision is simultaneous. |

“The racer that triggered this”这类措辞说明 Twist 卡由某名运动员触发，很可能是停在或经过 TWIST 处，但确切规则没有拿到。

---

## 4. Whirly World（Second Wind）

**来源**：名称 [A]，同上规则书第 20 页。格子来自 malbonius App 打包的官方美术图（`/tmp/ma-research/track-whirlyworld.png`），我放大后逐格数过 **[D]**。App 描述：“Second Wind track with whirl spaces.”

**格子**：同样是 Start + 1–29、29 格有效格的 U 形布局。格面没有印格号，以下按 Mild Mile / Wild Wilds 的同一路径编号（上排 1–12，右侧 13、14，15 为右下角，下排 16–29 向左）。

新的特殊格类型是**漩涡格（whirl space）**：格面画着同心圆漩涡，两两之间用同色条纹管道连接。共 12 格，组成 6 对：

| 漩涡格对 | 管道配色 | 管道走向（看图描述） |
|---|---|---|
| 4 ↔ 6 | 粉/蓝 | 上排内侧 U 形短管（企鹅正从里面滑过） |
| 8 ↔ 12 | 橙/粉 | 沿上边框外侧，连到右上角 |
| 11 ↔ 15 | 绿/黄 | 沿右侧向下，连到右下角，跨过第一、第二弯道 |
| 17 ↔ 22 | 浅绿/黄 | 沿下边框外侧 |
| 20 ↔ 23 | 红/绿 | 从赛道中央拱过 |
| 24 ↔ 28 | 蓝/绿 | 从赛道中央拱过，靠近终点 |

其余格（1、2、3、5、7、9、10、13、14、16、18、19、21、25、26、27、29）都是纯色格。整条赛道**没有 TRIP、星、箭头图标**。

**漩涡格规则：未找到原文。** 从图上看，应当是“停在一端就经管道传送到另一端”，类似蛇梯棋。几个问题都无法确认：能否双向传送、算瞬移（warp）还是移动、是否强制。上面的格号是我数格得出的，等实物或官方规则书出来后需要复核。

---

## 5. 其他“赛道”来源排查

| 来源 | 结果 |
|---|---|
| 2003 日本原版（Grimpeur，いしだたかし）/ 2010 Z-Man 英文版 | 单面 30 格纯赛道，另有一块拍卖板。没有特殊格（BGG 原版图片 pic247265 已查看；Hiew 2010 年评测：“The race track has 30 spaces and no other features.”）[A/C] |
| Kickstarter / 零售特典 / promo | 未找到。BGG 条目 454103 下没有任何扩展或 promo 条目；CMYK 商店只有基础盒和 6 盒装 |
| 2026-08 规则修订 | 规则改动见 research-rules.md 2.12。赛道相关的新内容只有第 20 页的四赛道 Grand Circuit 顺序 |
| BGG 规则书 PDF（CMYK_MA_Rulebook_081426.pdf，filepage 307679） | 需要登录才能下载（403），全文未读到；第 20 页只拿到截图 |
| BGG 文件 “Magical Athlete racers and tracks, from playtest”（filepage 309722，Abraham_tellez 上传，racers 部分经 Alex Hague 许可） | 内含 `Magical_Athlete_tracks_PLAYTEST_v1.pdf`，即测试期赛道。**下载需登录，内容未能读取。** 如果用户记得的“很多 TRIP”赛道是官方测试版，最可能在这里。另外 Garfield 的 Designer Diary 提到测试过长短不同的赛道，以及给分、移动、减益或增益的特殊格 |
| CMYK Discord | Hague 和玩家都说 Second Wind 的运动员、赛道、规则书都在 Discord 的 Magical Athlete 频道置顶消息里。需要登录，未访问 |
| 中文版《胡闹运动会》（艾赐魔袋） | 只有双面赛道，官方中文赛道名未找到。什么值得买文章提到续作《第二阵风》“新增2条赛道”，中文版尚未公布 |
| IELLO 法文版 | Course Pépère / Course Galère，与英文版相同 |
| Tabletop Simulator | Steam 创意工坊 “Magical Athlete (2025) [Scripted]”（id 3571528259）只有 mild/wild 两面，作者说正在准备续作模组；其余几个旧模组是原版或换皮 |
| Board Game Arena | 未找到该游戏 |
| 盗版“Magical Athlete Expansion”（AliExpress，抄袭 Hot Streak 角色） | 只有角色卡和棋子，没有赛道（BGG 帖 3714996）。Hague 说明它不是官方产品 |
| BGG 玩家自制赛道（均非官方） | Wild West Board（帖 3742892：4 号牛骷髅 Trip、11 号矿车让 12–14 号格的所有人 Trip、2/8/18 金块、21↔24 公牛、26–28 流沙）；Relay Race Track（帖 3769945：多处骰子 TRIP 格，终点前也有 Trip）；Squiggle / Boardwalks / Bridges（filepage 316780）；Nautical Mile 往返赛（帖 3588439）；Flower Alley / Hot Run（帖 3766406）；ROMPICHE / FORTICHE（filepage 330012）；1–6+ 人长赛道（filepage 329587）；Betting & Energy 扩展赛道（filepage 329155）。**其中 Wild West 和 Relay Race 的 Trip 元素最多**，可能就是用户记得的那条 |

---

## 6. 对线上实现的建议

- 基础版只需 `mild` 和 `wild` 两面。当前数据与官方美术、规则书一致，不用改。
- 如果要预留 Second Wind：
  - 在赛道数据结构里加一种 `whirl` 格类型（字段：配对目标格）。Whirly World 的 6 对管道见第 4 节，但传送规则必须等官方规则书确认。
  - Twisty Twirl 需要 Twist 卡组的机制和一个触发位置。触发规则未知，先不要实现。
  - 默认赛程增加 Grand Circuit 选项：Mild → Wild → Twisty → Whirly，分值 3/1、4/2、4/2、5/3。
- 规则书第 18 页允许“只用一面或自定赛程”，所以赛程本来就可以做成可配置项。

---

## 7. 来源

- 规则书 PDF（2026-08 修订前）：https://github.com/xeonliu/MagicalAthleteOL （`docs/How_to_play_Magical_Athlete_compressed.pdf`）
- 更新版规则书第 20 页截图（W. Eric Martin）：https://www.wericmartin.com/teasers-for-heat-magical-athlete-dixit-secret-museum/
- BGG 规则更新帖（通过 api.geekdo.com 读取全帖）：https://boardgamegeek.com/thread/3754599
- BGG 帖 “Any idea on when they will show more info on the Standalone expansion Second Wind?”（含 Hague “November 10”）：https://boardgamegeek.com/thread/3759717
- BGG 帖 “Any news on when the expansion is gonna be revealed?”（Hague：绿盒、新赛道可混用）：https://boardgamegeek.com/thread/3747768
- BGG 博文 “Magical Athlete expansion cover and name revealed”：https://boardgamegeek.com/blog/17048/blogpost/189953
- BGG 文件区（playtest 赛道等）：https://boardgamegeek.com/boardgame/454103/magical-athlete/files
- mr-boardgames 报道：https://mr-boardgames.com/en/news/magical-athlete-second-wind-the-standalone-sequel-to-catch-your-second-wind/
- boardgame.fr 报道：https://www.boardgame.fr/2026/09/08/magical-athlete-une-deuxieme-boite-arrive/
- speloptafel 报道：https://www.speloptafel.nl/magical-athlete-krijgt-nieuwe-editie-second-wind/
- malbonius 伴侣 App（Second Wind 赛道美术、Twist 卡文字、运动员列表）：https://github.com/malbonius/magical-athlete-companion
- 开源实现：https://github.com/pschonev/magsim 、https://github.com/pedestrian6/magical-athlete
- IELLO 产品页：https://iello.fr/jeux/athletes-de-compete-magical-athlete/
- Steam TTS 模组：https://steamcommunity.com/sharedfiles/filedetails/?id=3571528259
- 什么值得买（中文版与续作）：https://post.smzdm.com/p/ak8k4324/
- 原版评测（2010）：http://hiewandboardgames.blogspot.com/2010/10/magical-athlete.html
- 本地留存图像：`/tmp/ma-research/track-{mildmile,wildwilds,twistytwirl,whirlyworld}.png`、`/tmp/ma-research/img/sw.png`（规则书第 20 页）
