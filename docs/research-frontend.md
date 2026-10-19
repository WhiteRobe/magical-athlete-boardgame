# 《Magical Athlete》网页版：前端技术与美术/音效调研

> 调研日期：2026-10-18。体积数字除特别说明外，均为本机实测：`esbuild --bundle --minify` 打包一个「最小可用」入口后用 `gzip -9` / `brotli` 压缩。测试版本：three@0.186.1、ogl@1.0.11、cannon-es@0.20.0、@babylonjs/core@9.31.0、@react-three/fiber@9.8.2 + react@19.3.1、preact@11.0.1、@preact/signals@2.11.3、solid-js@1.9.17、svelte@5.57.2、gsap@3.15.0、motion@14.3.0、@tweenjs/tween.js@25.0.0、canvas-confetti@1.9.4、zdog@1.1.3、zzfx@1.4.0。
>
> 部署约束：Cloudflare Workers 免费版 + Static Assets，每个版本最多 20,000 个静态文件，单文件不超过 25 MiB，静态资源请求免费且不限量（[Limits 文档](https://developers.cloudflare.com/workers/platform/limits)、[2025-09 changelog](https://developers.cloudflare.com/changelog/post/2025-09-02-increased-static-asset-limits/)）。所以真正的约束是**用户下载体积和移动端性能**，而不是平台配额。

---

## 0. 结论速览

| 项 | 推荐 |
|---|---|
| 渲染 | **three.js（具名导入）** 渲染整个桌面：赛道、低多边形棋子、3D 骰子放在同一个 WebGL 场景里。棋盘是 2.5D 斜俯视，相机固定，只做平移跟随 |
| UI 层 | **Preact + @preact/signals**（备选 Solid）。HUD、角色卡、技能弹窗用 DOM 叠在 canvas 上 |
| 构建 | Vite（Rolldown），`manualChunks` 把 three 单独拆包；游戏场景路由懒加载 |
| 骰子 | **不在运行时跑物理引擎**。构建时用 cannon-es 离线录制若干条投掷轨迹，运行时回放，再对骰子做一次局部预旋转，让落地面等于服务端给的点数 |
| 补间 | 自写约 1 KB 的 tween/easing 工具（备选 @tweenjs/tween.js，3 KB） |
| 粒子 | 冲线彩带用 three `InstancedMesh` 自写，或者在 DOM 层叠 canvas-confetti（4 KB，ISC） |
| 音效 | **ZzFX** 程序化生成大部分音效（约 1 KB）；3~5 个关键音效用 Kenney CC0 的 OGG/WebM-Opus |
| BGM | ZzFXM 程序化 chiptune（约 0.5 KB 播放器 + 每首 0.5~1 KB）；或者一首 Kenney Music Jingles / CC0 loop，转 48 kbps Opus |
| 美术 | 原创程序化：低多边形几何体拼棋子 + 程序化 SVG 头像，图标用 game-icons.net（CC BY 3.0，需署名） |
| 字体 | 正文用系统字体栈；标题用**得意黑 Smiley Sans（OFL）**，构建时按游戏内实际用字子集化，约 30~60 KB woff2 |
| 首屏预算 | 大厅首屏 JS ≤ 40 KB gz；进对局后 JS 总计 ≤ 220 KB gz（brotli 约 180 KB）；全部资源（含音频、字体）≤ 600 KB |

---

## 1. 3D 方案对比

### 1.1 实测体积（min + gzip / brotli）

| 方案 | 测试入口 | min | gzip | brotli | 许可证 |
|---|---|---|---|---|---|
| three.js r186，具名导入 | WebGLRenderer + 透视相机 + Box/Cylinder/Sphere + Standard/Toon 材质 + 两种灯 + CanvasTexture | 527 KB | **132 KB** | **109 KB** | MIT |
| three.js r186，`import *` | 全量 | 728 KB | 186 KB | 152 KB | MIT |
| @react-three/fiber 9 + React 19 + three | 一个 Canvas + 一个 mesh | 1126 KB | **311 KB** | 250 KB | MIT |
| OGL 1.0 | Renderer + Box/Cylinder/Sphere + Program + Texture | 55 KB | **16 KB** | 13 KB | Unlicense |
| Babylon.js 9（@babylonjs/core 深路径导入） | Engine + Scene + 相机 + 灯 + Box + StandardMaterial | 1484 KB | **344 KB** | 264 KB | Apache-2.0 |
| Zdog 1.1 | Illustration + Box | 27 KB | 7 KB | 7 KB | MIT |
| 纯 CSS 3D 骰子 | 6 个 div + transform | 0 | 约 1 KB CSS | — | — |

参考资料：
- three.js 最新版是 r186（2026-09-08），npm 上为 0.186.1。r186 删除了 `PCFSoftShadowMap` 和 minified build，`require('three')` 会打印弃用警告（[utsubo: Three.js 2026 changelog](https://www.utsubo.com/blog/threejs-2026-what-changed)、[npm](https://www.npmjs.com/package/three)）。Bundlephobia 给出的全量 gzip 是 180.6 KB（[bundlephobia](https://bundlephobia.com/package/three)），和实测的 186 KB 基本一致。
- three.js 的 tree-shaking 效果有限：只要引入 `WebGLRenderer`，大部分库就跟着进来了（[three.js 论坛](https://discourse.threejs.org/t/what-is-the-state-of-tree-shaking/33168)）。实测具名导入只比全量省约 30%。
- OGL 官方 README 标注 Core 8 KB + Math 6 KB + Extras 15 KB，总计约 29 KB minzip（[oframe/ogl](https://github.com/oframe/ogl)）。

### 1.2 分析

- **three.js（推荐）**：gzip 132 KB 换来成熟的材质、阴影、`InstancedMesh`、Raycaster 和大量现成示例，对「精致」的性价比最高。r186 起 WebGPU 渲染器和 TSL 是主线，但**本项目应该继续用 `WebGLRenderer`**：它体积更小，移动端兼容性也最稳，WebGPU 带来的收益在这个场景里用不上。
  - 再压缩的手段：`MeshToonMaterial`/`MeshLambertMaterial` 代替 PBR；不引入任何 `examples/jsm` loader（不加载 glTF）；不用 OrbitControls，相机自己写。
  - r3f 文档里提到一个激进做法：用自定义 export 文件把 `three` alias 过去，可以压到 50~80 KB（[r3f reducing bundle-size](https://gracious-keller-98ef35.netlify.app/docs/recipes/reducing-bundle-size/)）。但 `WebGLRenderer` 内部依赖会全部带进来，实际收益不确定，维护成本也高，**不建议**。
- **@react-three/fiber**：本身不大，问题在于必须带上 React 19（约 60 KB gz），而且 r3f 内部 `import * as THREE` 导致 three 无法 tree-shake。实测总计 311 KB gz，**超出预算，不推荐**。
- **OGL**：16 KB，体积优势非常大，API 跟 three 很像。代价是灯光、阴影、Toon 着色都要自己写 GLSL，Raycast 和文字也比较弱。如果团队熟悉 shader，这是「极致体积」路线（总 JS 可以压到 80 KB 以内）；否则开发成本明显更高。**作为备选**。
- **twgl.js**：只是 WebGL 薄封装，场景图、几何体、数学库都得自己写，不推荐。
- **Zdog**：7 KB 的伪 3D 矢量引擎，扁平卡通风很可爱，但没有光照和深度缓冲，复杂场景会有排序问题。可以用于**角色头像/角色卡里的旋转小人**，不适合整个棋盘。
- **Babylon.js**：最小场景就有 344 KB gz，**太大**，排除。
- **纯 CSS 3D 骰子**：6 个面加 `transform-style: preserve-3d`，几乎零体积。翻滚动画只能靠 keyframes 模拟，没有真实落地弹跳，但做「降级方案」很合适。

### 1.3 2.5D（2D 画布 + CSS 3D 骰子）是否更合适？

| | 全 three.js（2.5D 视角） | 2D Canvas/DOM + CSS 3D 骰子 |
|---|---|---|
| JS 体积 | 约 130 KB（three）+ 业务 | 约 5~20 KB + 业务 |
| 棋子跳跃 | 真实抛物线、落地挤压回弹、阴影 | 精灵 + 缩放模拟高度，同样能做得可爱 |
| 骰子 | 真 3D 翻滚和弹跳 | CSS 关键帧，弹跳感较弱 |
| 美术成本 | 程序化几何体，**不需要画师** | 需要更多 2D 插画（SVG）功夫 |
| 移动端性能 | 需要控制 DPR 和阴影 | 极轻 |

**推荐**：主方案用 three.js 做 2.5D（固定斜俯视，45° 或等距视角），棋盘、棋子、骰子都在一个场景里。原因是需求明确要「3D 翻滚 + 棋子跳跃」，且不想投入大量 2D 插画；程序化低多边形可以不靠美术资源做出精致感。132 KB gz 在 250 KB 预算内。

同时保留**降级路径**：检测到 WebGL 不可用，或者用户在设置里打开「省电模式」时，切换到 DOM 棋盘 + CSS 3D 骰子。游戏逻辑和渲染层分离，就能低成本实现。

### 1.4 体积预算

| 分包 | 内容 | gzip 目标 |
|---|---|---|
| `entry`（大厅/房间页） | Preact + signals + 路由 + 大厅 UI + WebSocket 客户端 | **≤ 40 KB** |
| `game`（懒加载） | three（约 132 KB）+ 场景/棋子/骰子/特效（约 25 KB）+ 规则 UI/36 个角色数据（约 15 KB） | ≤ 180 KB |
| 音频 | ZzFX 代码内联；3~5 个 Opus 小文件 + 可选 BGM | ≤ 150 KB（BGM 懒加载） |
| 字体 | 得意黑子集 woff2 | ≤ 60 KB |
| 图标/SVG | 内联 SVG sprite（game-icons 30~50 个） | ≤ 30 KB |
| **合计** | 首屏 JS ≤ 40 KB；进入对局时 JS ≤ 220 KB | 全资源 ≤ 600 KB |

Cloudflare 边缘会对文本资源做 brotli/gzip 压缩；实测 brotli 比 gzip 再小 15~20%。

---

## 2. 骰子：服务端决定点数，客户端播放动画

### 2.1 是否需要物理引擎？

- **cannon-es 0.20.0**：实测（World + Box + Plane + ContactMaterial）81 KB min / **24 KB gz**，MIT（[pmndrs/cannon-es](https://github.com/pmndrs/cannon-es)）。最后一次发版在 2022 年，基本处于停更维护状态。
- Rapier 等 WASM 引擎体积是数百 KB，排除。
- 现成库：[byWulf/threejs-dice](https://github.com/byWulf/threejs-dice)（可指定落点，依赖旧 cannon.js）、[BreadMoirai/threejs-dice](https://github.com/BreadMoirai/threejs-dice)（cannon-es 版本，`DiceManager.prepareValues([{dice, value: 6}])`）、[@3d-dice/dice-box-threejs](https://www.npmjs.com/package/@3d-dice/dice-box-threejs)（支持预定结果）。这些库都会把运行时物理引擎带进来，而且只需要 1 颗 d6，**不推荐直接引入**，参考原理就够了。
- 教程：[Codrops: Crafting a Dice Roller with Three.js and Cannon-es](https://tympanus.net/codrops/2023/01/25/crafting-a-dice-roller-with-three-js-and-cannon-es/)；判断顶面和平滑校正的写法见 [DEV: 3DRoll chi-square test](https://dev.to/3droll/i-chi-square-tested-my-physics-dice-found-a-bias-with-five-dice-and-fixed-it-threejs--53a6)。

**结论：运行时不需要物理引擎。** 推荐下面两种方案之一。

### 2.2 方案 A（推荐）：离线录制轨迹 + 局部预旋转

这就是「指定点数」的标准技巧（[cannon.js issue #401](https://github.com/schteppe/cannon.js/issues/401) 讨论的就是它）：

1. **构建期**（Node 脚本，cannon-es 作为 devDependency）：从不同初速度和角速度模拟 12~20 次投掷，每次以 30 fps 记录约 60~90 帧的位置（vec3）和朝向（quat）。用 Int16 量化后，每条轨迹约 1~1.5 KB，20 条打成一个约 20 KB 的二进制文件（gzip 后更小），或者直接内联进 JS。同时记录每条轨迹最终朝上的是哪个面 `f_rec`。
2. **运行时**：服务端下发 `value`。客户端随机挑一条轨迹回放（帧间做 lerp/slerp），并对**骰子 mesh 的子节点**施加一个固定的局部旋转 `R`，把「目标点数所在面的法线」转到「`f_rec` 面的法线」：
   ```
   R = Quaternion.setFromUnitVectors(normal[value], normal[f_rec])
   dieRoot.quaternion = trajectory.q(t)     // 回放录制的朝向
   dieMesh.quaternion = R                    // 常量局部旋转，整个过程不变
   ```
   因为 `R` 在局部坐标里是常量，所以观感和原始物理模拟一模一样，最后停下时朝上的一定是 `value`。d6 的 6 个面法线是 ±X/±Y/±Z，`R` 都是 90°/180° 的旋转。
3. 落地时用碰撞帧（构建期一起记录）触发「咔哒」音效和屏幕轻微震动。

优点：零运行时物理，真实感满分，确定性强（观战方和回放都一致），不存在「物理结果和服务端不一致」的问题。

### 2.3 方案 B：纯程序化补间（约 1 KB）

- 位置：抛物线弹跳 2~3 次，每次高度乘以 0.4 衰减；水平方向做 easeOutCubic 滑行。
- 朝向：起始为随机四元数，叠加绕随机轴 `N` 圈的角速度并逐渐减速，最后 300 ms 用 slerp 收束到目标朝向 `Q_target(value)`，绕 Y 轴随机偏航。
- 观感比方案 A 略「假」，但完全可控，也可作为 CSS 3D 降级版的同一套逻辑（CSS 的 `rotateX/rotateY` 关键帧）。

### 2.4 防作弊

点数由服务端（Durable Object/Worker）用 `crypto.getRandomValues` 决定，客户端只负责播放。动画开始前就已知道结果，所以可以「先结算、后演出」，演出时长对玩家可跳过（双击加速）。

---

## 3. UI 框架

### 3.1 实测体积（最小入口：渲染 + 状态 + 列表/条件）

| 框架 | gzip | 许可证 | 说明 |
|---|---|---|---|
| Solid 1.9 | **5 KB** | MIT | 细粒度响应式，性能最好；Solid 2.0 还在 beta |
| Preact 11 + hooks + @preact/signals | **8 KB** | MIT | React 心智模型，生态最大（可通过 `preact/compat` 用部分 React 库） |
| Svelte 5.57（runes，含 `$state`/`{#each}`/`{#if}`） | **约 20 KB** | MIT | Svelte 5 运行时比 Svelte 4 大不少；组件多时每个组件还会再生成代码 |
| React 19 + react-dom | 约 60 KB | MIT | 超预算 |
| 原生 + 自写 signals | 约 1 KB | — | 体积最小，但游戏有大量 UI（36 个角色卡、技能提示、房间、结算），开发效率低 |

第三方对比也支持上面的量级：Solid 运行时约 6~8 KB，Svelte 5 客户端运行时 2~5 KB（不含 each/if 等特性），Preact 约 3~4 KB；同一功能的真实应用，Svelte 和 Solid 主包都在 28 KB 左右（[PkgPulse](https://www.pkgpulse.com/guides/solidjs-vs-svelte-2026)、[tech-insider](https://tech-insider.org/solidjs-vs-react-vs-svelte-2026/)、[index.dev](https://www.index.dev/skill-vs-skill/frontend-react-vs-preact-vs-solidjs)）。

### 3.2 推荐

- **Preact + @preact/signals**：8 KB，用 JSX，跟 React 一样上手。three 场景用命令式代码管理（不需要 r3f），游戏状态放在 signals 里，UI 和 3D 场景各自订阅即可。AI 编码辅助对 React/Preact 写法的准确率也最高。
- 如果团队偏好细粒度响应式，**Solid** 是同样优秀的选择（体积更小）。
- Svelte 5 开发体验好，但实测运行时更大，没有明显优势。
- **构建**：Vite（新版本以 Rolldown 为打包器，以实际安装版本为准），配合 `@preact/preset-vite`。three 单独拆 chunk 并懒加载；`build.target: 'es2020'`；用 `rollup-plugin-visualizer` 或 `vite-bundle-visualizer` 盯住体积。部署走 `wrangler` + `assets.directory = "./dist"`，SPA 设 `not_found_handling = "single-page-application"`。

---

## 4. 美术：低成本做精致原创

**原则：不用任何原版美术**（角色立绘、赛道、Logo、卡面版式都不能照搬），角色名可以保留或换成原创称呼，技能用自己的措辞描述。整体靠「程序化几何体 + 统一色板 + 少量 CC0/CC-BY 图标」出效果。

### 4.1 棋子：程序化低多边形（不加载 glTF）

- 每个角色由 3~6 个基础几何体拼成：`CapsuleGeometry`/`CylinderGeometry`（身体）+ `SphereGeometry(r, 8, 6)`（低面数头，天然低多边形）+ `ConeGeometry`（帽子/耳朵/角）+ `TorusGeometry`（光环）+ `BoxGeometry`（背包/盾），材质用 `MeshToonMaterial` 加 2~3 级色阶的 `gradientMap`（4×1 的 DataTexture）。配色从色板取，每个角色有一个主色 + 一个配件色 + 一个「标志道具」。
- 表情：用 `CanvasTexture` 画大眼睛，或者贴一张程序化 SVG 转成的 texture，做贴纸感。
- 描边：反向法线外扩的 back-face 轮廓（再 clone 一个 mesh，`side: BackSide` 并略放大），零后处理成本，卡通感立刻提升。
- 「一个角色一个函数」：`buildRunner(id) → Group`，36 个角色的代码总量约 10~15 KB，比任何 glTF 都小。
- 如果需要借鉴造型：[Kenney Mini Characters](https://kenney.nl/assets/mini-characters)（CC0，12 个角色 32 种动画，zip 约 2.4 MB）、[Quaternius](https://quaternius.com/) 的 [Animated Animal Pack](https://poly.pizza/bundle/Animated-Animal-Pack-ILAPXeUYiS)、[Ultimate Monsters](https://poly.pizza/bundle/Ultimate-Monsters-Bundle-5oyGWAmOB6)（均为 CC0，glTF/FBX）。CC0 意味着可以直接商用，但单个 glb 常常有 100 KB~1 MB，**建议只作为造型参考，或在 Blender 里简化成几百面后再用**。

### 4.2 赛道

- 30 格直线赛道建议做成 **蛇形/S 形曲线** 放在斜俯视的场景里（逻辑上仍是直线 30 格），移动端竖屏时能装下全部格子。每格是一块倒角的低多边形板（`ExtrudeGeometry` 或 `BoxGeometry`）。
- 温和面/狂野面用两套色板和地形装饰（温和：草地、旗帜；狂野：岩浆裂缝、蘑菇）。
- 特殊格用**图标贴花**区分：箭头格（前进/后退箭头）、摔倒格（香蕉皮/漩涡）、星格（星星）。贴花用 game-icons SVG 转成 CanvasTexture。
- 背景：渐变天空 + 几朵低多边形云 + 看台上的「观众」用 `InstancedMesh` 随机颜色胶囊体，几十个也只占一次 draw call。

### 4.3 角色头像：程序化 SVG

- 用参数化 SVG 生成器：底色圆形 + 头部形状 + 眼睛样式 + 配饰 + 角色主色，30 行左右的函数就能生成 36 个统一风格的头像，体积几乎为零。和 3D 棋子共用同一份角色描述数据（颜色、配件），保证一致性。
- 参考：[DiceBear](https://www.dicebear.com/)（MIT 代码；各风格许可不同，部分为 CC0/CC BY 4.0，**使用前逐个风格核对**），也可以只参考思路后自写。

### 4.4 图标/Emoji 库

| 资源 | 许可证 | 内容 | 用途建议 | 链接 |
|---|---|---|---|---|
| **game-icons.net** | **CC BY 3.0**（需署名作者） | 约 4,180 个 SVG 游戏图标 | 技能图标、特殊格贴花、按钮 | [game-icons.net](https://game-icons.net/)、[about/授权](https://game-icons.net/about.html) |
| **Kenney Board Game Icons** | CC0 | 250 个桌游图标（骰子、棋子、卡牌等） | UI 小图标 | [kenney.nl/assets/board-game-icons](https://kenney.nl/assets/board-game-icons) |
| **Kenney Particle Pack** | CC0 | 80 张粒子贴图（512×512，PNG/矢量） | 星星、魔法、烟雾、火花 | [kenney.nl/assets/particle-pack](https://kenney.nl/assets/particle-pack) |
| **Microsoft Fluent Emoji** | **MIT** | 3D/Flat/Color/高对比四种风格，Flat 约 3,145 个 SVG | 表情反应、聊天快捷表情（Flat 风格很搭） | [microsoft/fluentui-emoji](https://github.com/microsoft/fluentui-emoji) |
| Twemoji | CC BY 4.0（需署名） | Emoji SVG | 备选 | [jdecked/twemoji](https://github.com/jdecked/twemoji)（社区维护分支，授权以仓库 LICENSE 为准） |
| OpenMoji 17 | **CC BY-SA 4.0**（相同方式共享） | 4,495 个 | **不推荐**：改动后的衍生作品需按 CC BY-SA 发布 | [openmoji.org](https://openmoji.org/) |

建议：

- 只挑用到的 30~50 个 SVG，用 `svgo` 压缩后做成一个 sprite（`<symbol>`），总共约 20~30 KB，gzip 后不到 10 KB。
- 在「关于/致谢」页统一列出 CC BY 作者（例如 "Icons by Lorc, Delapouite… from game-icons.net, CC BY 3.0"）。
- 不要直接显示系统 emoji 作为核心美术：iOS/Android/Windows 的 emoji 外观不一致，品牌感也会被冲淡。

### 4.5 字体（中文体积问题）

- 中文全量字体 2~10 MB，不能直接加载。常见做法：
  1. **正文用系统字体栈**（零体积）：
     `font-family: system-ui, -apple-system, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;`
  2. **标题/数字用展示字体并子集化**：
     - [得意黑 Smiley Sans](https://atelier-anchor.com/typefaces/smiley-sans)（SIL OFL 1.1，可商用，覆盖 GB 2312 全部 6763 字，原始 TTF 约 2 MB）。斜体、有速度感，**很适合「运动会」主题**。
     - 备选：站酷快乐体（OFL）。
  3. **子集化工具**：
     - 静态子集（推荐）：构建时扫描 i18n 文案和角色数据，提取所有用到的汉字（估计 800~1,500 字），用 `fonttools pyftsubset` 或 `subset-font`（npm）输出 woff2，大约 30~60 KB。
     - 动态分包：[cn-font-split](https://github.com/KonghaYao/cn-font-split)（Rust 实现，按 unicode-range 切成很多小包，浏览器只下载用到的分片）和 [中文网字计划](https://chinese-font.netlify.app/zh-cn/)；有 `vite-plugin-font`。适合包含用户输入（昵称、聊天）的场景。
     - 玩家昵称和聊天这种不可预测的文本，直接回退系统字体即可。
  4. `font-display: swap` 并 `preload` 子集文件。
- 拉丁字/数字：可选 Fredoka / Baloo 2（OFL，圆润卡通），只取拉丁子集约 15 KB。

---

## 5. 音效

### 5.1 对比

| 方案 | 体积 | 许可证 | 优点 | 缺点 |
|---|---|---|---|---|
| **ZzFX** | 库约 1 KB；每个音效是一行约 20 个参数的数组 | MIT | 体积几乎为零；可以按角色随机变调；有[在线设计器](https://killedbyapixel.github.io/ZzFX/) | 偏 8-bit 合成器质感，脚步、人声类做不真 |
| jsfxr / sfxr | 约 5~8 KB | Unlicense/MIT | 经典 8-bit 音效生成 | 和 ZzFX 功能重叠，体积更大 |
| **Kenney CC0 音频包** | 单个 OGG 约 5~30 KB | CC0 | 真实采样，质感好 | 每个文件都要下载 |

ZzFX：[KilledByAPixel/ZzFX](https://github.com/KilledByAPixel/ZzFX)，npm 上为 `zzfx`，实测打包后不到 1 KB gzip，有 20 个可调参数。

相关的 Kenney 音频包（全部 CC0，下载免费）：

| 包 | 文件数 | 适合用于 | 链接 |
|---|---|---|---|
| Interface Sounds | — | 按钮、确认、弹窗 | [interface-sounds](https://kenney.nl/assets/interface-sounds) |
| UI Audio | — | 点击、切换 | [ui-audio](https://kenney.nl/assets/ui-audio) |
| Impact Sounds | 130 | 骰子落桌、棋子落地 | [impact-sounds](https://kenney.nl/assets/impact-sounds) |
| Casino Audio | 50 | **骰子摇晃/掷出**（标签含 dice/card/chip，具体文件下载后确认） | [casino-audio](https://kenney.nl/assets/casino-audio) |
| Music Jingles | 85 | 胜利、回合开始、冲线短曲 | [music-jingles](https://kenney.nl/assets/music-jingles) |
| Digital Audio | — | 技能触发、魔法音效 | [digital-audio](https://kenney.nl/assets/digital-audio) |
| RPG Audio | — | 脚步、物品 | [rpg-audio](https://kenney.nl/assets/rpg-audio) |
| Voiceover Pack | — | "Ready / Go / Winner" 等语音 | [voiceover-pack](https://kenney.nl/assets/voiceover-pack) |

（Kenney 的音频一般是 OGG；落地前用 ffmpeg 转成单声道 48~64 kbps Opus（`.webm`/`.ogg`），并为旧版 iOS Safari 准备 m4a/AAC 回退。较新的 iOS Safari 已支持 Opus，但老设备仍需回退格式，上线前实机验证。）

### 5.2 推荐做法（混合）

1. **ZzFX 负责 80% 的音效**：棋子每格跳跃「嘣」声（按角色音高变化）、技能触发、星格得分「叮」、摔倒「噗通」、箭头格「嗖」、UI 点击、倒计时。数据总共不到 2 KB。
2. **Kenney CC0 采样负责 3~5 个高感知音效**：骰子在杯中摇晃 + 落桌（Casino Audio / Impact Sounds）、冲线欢呼（Music Jingles 中挑一首），每个裁剪到 0.3~1.5 s，转 Opus 后合计约 40~80 KB，进入对局时懒加载。
3. 统一用一个 `AudioContext` 加 master/sfx/music 三个 GainNode；首次用户点击时 `resume()`（iOS 必须）；提供静音按钮并记住设置；同一音效限制并发数，避免多个棋子同时跳时叠音爆音。

### 5.3 背景音乐

- **方案一（推荐，体积 < 2 KB）**：[ZzFXM](https://github.com/keithclark/ZzFXM)。播放器约 442 字节 gzip，一首 2~3 分钟的 tracker 风格曲子 gzip 后只有 0.5~1 KB（[官方 demo](https://keithclark.github.io/ZzFXM/)）。可以写一首轻快的大调 chiptune「运动会进行曲」，再写一首节奏更快的「狂野面」版本。注意：渲染一首曲子要在主线程计算几百毫秒，应在 `requestIdleCallback` 或 Worker 中预渲染成 AudioBuffer。
- **方案二**：一首 CC0 loop，例如从 [OpenGameArt CC0 音乐](https://opengameart.org/art-search-advanced?field_art_type_tid%5B%5D=12&field_art_licenses_tid%5B%5D=4) 挑选，30~60 s 无缝循环，单声道 64 kbps Opus 约 250~500 KB，必须懒加载，并默认低音量。
- 本项目推荐方案一，体积优势太大；同时预留 `music.src` 配置，以后可以换成真实录音。

---

## 6. 动效

### 6.1 补间库

| 库 | 实测 gzip | 许可证 | 说明 |
|---|---|---|---|
| GSAP 3.15（core + timeline） | 27 KB | GSAP Standard License（Webflow 自有许可，**非 MIT**） | 2025-04-30 起含全部插件免费并允许商用（[GSAP 3.13 公告](https://gsap.com/blog/3-13/)、[CSS-Tricks](https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/)）。功能最强，但体积大，许可条款中有关于与 Webflow 竞争产品的限制，需要自行阅读 |
| Motion（`motion`，完整 `animate`） | 25 KB | MIT | 偏 DOM 动画 |
| Motion mini（`motion/mini`） | 3 KB | MIT | 只支持 WAAPI，不能驱动 three 对象 |
| @tweenjs/tween.js 25 | 3 KB | MIT | 可以驱动任意对象属性，three 官方示例常用 |
| 自写 tween | < 1 KB | — | 推荐 |

**推荐自写**：游戏里需要的只是「按时长插值 + 若干 easing + Promise 化 + 串联」。核心约 60 行：

```ts
// 在 three 的渲染循环里每帧调用 update(dt)
tween({ from: 0, to: 1, duration: 280, ease: easeOutBack, onUpdate: t => ... }) // 返回 Promise
```

### 6.2 棋子逐格跳跃

- 每格一段：水平方向从格 i 的中心 lerp 到格 i+1 的中心；竖直方向用 `y = 4h · t(1-t)` 抛物线（h ≈ 0.6 格宽）；每格 220~280 ms，按步数递减（第一步慢、中间快、最后一步慢）。
- 「挤压与拉伸」：起跳前 60 ms `scale.y = 0.75`，空中 `scale.y = 1.15`，落地瞬间 `scale.y = 0.7` 再弹回 1（easeOutElastic）。卡通感主要来自这一步。
- 落地时：一个小尘土粒子（4~6 个低多边形四面体向外扩散后消失）+ ZzFX 跳跃音（音高随格数递增，营造节奏感）。
- 被推回/摔倒：沿反方向翻滚 360° + 头顶冒星星；箭头格：棋子被「嗖」地滑过去，留一条拖尾（`Line` 或 ribbon）。
- 同格多个棋子：按到达顺序在格内错开排列（2~3 个槽位），移入时被挤开的棋子做一个小侧跳。

### 6.3 粒子（冲线彩带）

- 方案 A：three `InstancedMesh`（一个 `PlaneGeometry` + 实例颜色），300~500 片彩纸，CPU 模拟重力 + 空气阻力 + 绕自身轴翻转。约 1 KB 代码，一次 draw call，移动端无压力。
- 方案 B：DOM 层叠加 [canvas-confetti](https://github.com/catdad/canvas-confetti)（实测 4 KB gzip，ISC 许可），一行 `confetti({ particleCount: 150, spread: 70 })`，最省事，适合放在结算 UI 上。
- 星格得分：星星从格子飞向玩家 HUD 的计分区（3D 世界坐标转屏幕坐标后，切换为 DOM 元素飞行），飞行结束时 HUD 数字弹跳。

### 6.4 镜头

- 默认镜头：斜俯视并能看到全场（移动端竖屏时拉远，或改成纵向赛道）。
- 当前行动棋子移动时：镜头目标点 `lookAt` 用阻尼平滑跟随（`target.lerp(piece.pos, 1 - exp(-k·dt))`），并稍微拉近（FOV 或距离减少 15%），移动结束后 600 ms 缓慢回到全景。
- 关键事件（冲线、连锁技能）：短暂慢动作（时间缩放 0.4，持续 0.5 s）+ 轻微屏幕震动（相机位置加衰减噪声，幅度 0.05）。
- 提供「减少动效」设置，并尊重 `prefers-reduced-motion`：关闭震动和慢动作，跳跃改为简单滑动。

### 6.5 移动端性能要点

- `renderer.setPixelRatio(Math.min(devicePixelRatio, 2))`，低端机降到 1.5。
- 阴影只开一盏方向光，`shadowMap` 尺寸 1024，赛道静态部分烘焙成接收阴影的平面，或干脆用「圆形假阴影」贴片（更便宜也更卡通）。
- 静止时**按需渲染**：无动画时停止 rAF 循环，大幅省电。
- 几何体合并（`mergeGeometries` 需要从 `three/addons` 引入，约 2 KB）或使用 `InstancedMesh`，目标 draw call < 80。

---

## 7. 视觉风格建议

### 7.1 风格方向：「贴纸感卡通低多边形」

- **3D 部分**：低多边形 + Toon 两级/三级色阶 + 粗描边（深紫而非纯黑），轮廓圆润、比例 Q 版（大头小身，头身比约 1:1.2），像「桌上的软胶玩具棋子」。
- **2D UI**：贴纸风，即白色粗描边（3~4 px）+ 轻微随机旋转（±2°）+ 硬投影（`box-shadow: 0 4px 0 #2B1B4D`，无模糊）。按钮按下时投影消失并向下位移 4 px，手感很强。
- **混乱搞笑**：技能触发时弹出漫画式拟声词贴纸（"BOING!"、"嗖！"、"啪叽！"），用得意黑斜体 + 描边 + 抖动入场。摔倒时棋子头上转圈的星星，冲线时角色跳起来转一圈。
- **魔法元素**：赛道边缘飘浮的魔法符文粒子、星格发光脉冲（emissive 呼吸动画）、狂野面的地面裂缝透出紫色光。

### 7.2 色板

| 角色 | 名称 | HEX | 用途 |
|---|---|---|---|
| 主色 | 魔法紫 | `#6C4BF4` | 品牌色、主按钮、Logo |
| 主色深 | 夜幕紫 | `#2B1B4D` | 描边、硬投影、标题文字 |
| 强调 1 | 冲线橙 | `#FF7A2F` | 行动按钮、当前回合提示 |
| 强调 2 | 星光黄 | `#FFD23F` | 星格、得分、金牌 |
| 强调 3 | 泡泡粉 | `#FF5C9A` | 技能触发、搞笑拟声词 |
| 强调 4 | 薄荷青 | `#2EE6C5` | 前进箭头格、增益效果 |
| 警示 | 番茄红 | `#F2424B` | 摔倒格、减益效果 |
| 温和面地面 | 草坪绿 | `#7BD389` / 暗部 `#4FA866` | 温和面赛道 |
| 狂野面地面 | 岩浆褐 | `#5A3A5E` / 裂缝光 `#B44CFF` | 狂野面赛道 |
| 背景 | 天空渐变 | `#9AD8FF` → `#E8F6FF` | 场景天空 |
| 纸面 | 奶油白 | `#FFF8EC` | 卡片、对话框底色 |
| 中性 | 石板灰 | `#8A85A3` | 次要文字、禁用态 |

玩家颜色（6 人，色相分散，色盲友好，同时配合图案或角色剪影区分）：
`#FF5C5C` 红、`#3D8BFF` 蓝、`#FFC93C` 黄、`#3DDC84` 绿、`#B85CFF` 紫、`#FF8FC8` 粉。

建议：

- 所有颜色在 Toon 材质下会被色阶压暗。实际用作 3D 材质时，亮部取上表的值，暗部系数约 0.65，必要时为每个角色单独调整。
- 文字对比度：深色文字 `#2B1B4D` 放在 `#FFF8EC` 上是 14:1，`#FFFFFF` 放在 `#6C4BF4` 上是 5.0:1，都满足 WCAG AA。

---

## 8. 素材来源与许可证清单

| 素材 | 来源 | 许可证 | 是否需要署名 | 预计用量与体积 |
|---|---|---|---|---|
| 3D 棋子、赛道、骰子 | 原创程序化几何体 | 自有 | — | 代码约 15 KB |
| 角色头像 | 原创程序化 SVG | 自有 | — | 代码约 3 KB |
| 技能/格子图标 | [game-icons.net](https://game-icons.net/) | CC BY 3.0 | **是**（作者名 + 链接） | 30~50 个，sprite 约 10 KB gz |
| UI 小图标 | [Kenney Board Game Icons](https://kenney.nl/assets/board-game-icons) | CC0 | 否（建议致谢） | 按需 |
| 粒子贴图 | [Kenney Particle Pack](https://kenney.nl/assets/particle-pack) | CC0 | 否 | 2~4 张，合成 256 px atlas 约 20 KB |
| 表情 | [Fluent Emoji](https://github.com/microsoft/fluentui-emoji)（Flat） | MIT | 保留许可声明 | 10~20 个 SVG |
| 造型参考（可选） | [Kenney Mini Characters](https://kenney.nl/assets/mini-characters)、[Quaternius](https://quaternius.com/) | CC0 | 否 | 不直接打包 |
| 程序化音效 | [ZzFX](https://github.com/KilledByAPixel/ZzFX) | MIT | 保留许可声明 | < 2 KB |
| 采样音效 | Kenney [Casino Audio](https://kenney.nl/assets/casino-audio)、[Impact Sounds](https://kenney.nl/assets/impact-sounds)、[Interface Sounds](https://kenney.nl/assets/interface-sounds)、[Music Jingles](https://kenney.nl/assets/music-jingles) | CC0 | 否 | 3~5 个，Opus 约 40~80 KB |
| 背景音乐 | [ZzFXM](https://github.com/keithclark/ZzFXM) 原创曲 | MIT（播放器） | — | < 2 KB |
| 标题字体 | [得意黑 Smiley Sans](https://github.com/atelier-anchor/smiley-sans) | SIL OFL 1.1 | 否（保留 OFL） | 子集约 30~60 KB |
| 彩带（可选） | [canvas-confetti](https://github.com/catdad/canvas-confetti) | ISC | 保留许可声明 | 4 KB gz |

**合规要点**：

1. 在游戏内「关于/致谢」页列出所有 CC BY 作者和 MIT/ISC/OFL 声明（可以用 `rollup-plugin-license` 自动汇总 npm 依赖的许可）。
2. 避免 CC BY-SA（OpenMoji）和 CC BY-NC 素材。
3. 原版游戏的角色名、规则文字属于商标/版权灰色地带，美术**必须原创**；名称建议改为原创译名或自创名字，并在页面声明「非官方同人作品，与原版权利人无关」。

---

## 参考链接

- three.js：[npm](https://www.npmjs.com/package/three) · [Bundlephobia](https://bundlephobia.com/package/three) · [r186 变更](https://www.utsubo.com/blog/threejs-2026-what-changed) · [tree-shaking 讨论](https://discourse.threejs.org/t/what-is-the-state-of-tree-shaking/33168) · [r3f 讨论 #812](https://github.com/pmndrs/react-three-fiber/discussions/812)
- OGL：[GitHub](https://github.com/oframe/ogl)
- 骰子：[Codrops 教程](https://tympanus.net/codrops/2023/01/25/crafting-a-dice-roller-with-three-js-and-cannon-es/) · [threejs-dice](https://github.com/byWulf/threejs-dice) · [cannon-es fork](https://github.com/BreadMoirai/threejs-dice) · [dice-box-threejs](https://github.com/3d-dice/dice-box-threejs) · [cannon.js #401](https://github.com/schteppe/cannon.js/issues/401) · [3DRoll DEV 文章](https://dev.to/3droll/i-chi-square-tested-my-physics-dice-found-a-bias-with-five-dice-and-fixed-it-threejs--53a6)
- 框架对比：[PkgPulse Solid vs Svelte](https://www.pkgpulse.com/guides/solidjs-vs-svelte-2026) · [tech-insider](https://tech-insider.org/solidjs-vs-react-vs-svelte-2026/) · [index.dev](https://www.index.dev/skill-vs-skill/frontend-react-vs-preact-vs-solidjs)
- GSAP：[3.13 免费公告](https://gsap.com/blog/3-13/) · [CSS-Tricks](https://css-tricks.com/gsap-is-now-completely-free-even-for-commercial-use/)
- 音频：[ZzFX](https://github.com/KilledByAPixel/ZzFX) · [ZzFXM](https://github.com/keithclark/ZzFXM) · [ZzFXM demo](https://keithclark.github.io/ZzFXM/) · [Kenney 音频分类](https://kenney.nl/assets/category:Audio)
- 图标/Emoji：[game-icons about](https://game-icons.net/about.html) · [OpenMoji FAQ](https://openmoji.org/faq/) · [Fluent Emoji LICENSE](https://github.com/microsoft/fluentui-emoji/blob/main/LICENSE)
- 字体：[cn-font-split](https://github.com/KonghaYao/cn-font-split) · [中文网字计划](https://chinese-font.netlify.app/zh-cn/) · [得意黑](https://atelier-anchor.com/typefaces/smiley-sans)
- Cloudflare：[Workers Limits](https://developers.cloudflare.com/workers/platform/limits) · [静态资源上限 changelog](https://developers.cloudflare.com/changelog/post/2025-09-02-increased-static-asset-limits/)
