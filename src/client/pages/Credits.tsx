import { TopBar } from '../ui/TopBar';

export function Credits() {
  return (
    <>
      <TopBar />
      <div class="page">
        <div class="panel" style={{ lineHeight: 1.8 }}>
          <h2 style={{ marginBottom: '10px' }}>声明与致谢</h2>
          <p>
            <b>本站是非官方同人作品，仅供个人娱乐，非商业用途。</b>
            《Magical Athlete》（魔法运动员 / 胡闹运动会）的游戏设计、名称与角色版权归原作者 Takashi Ishida、Richard Garfield
            及出版商 CMYK 所有。如果你喜欢这款游戏，请购买正版支持。
          </p>
          <p>本站美术（角色头像、3D 棋子、赛道）、音效与音乐均为程序化原创生成，未使用原版游戏的任何美术素材。</p>
          <h3>技术与开源</h3>
          <ul>
            <li>three.js（MIT）· Preact（MIT）· @preact/signals（MIT）· Vite（MIT）</li>
            <li>部署于 Cloudflare Workers</li>
          </ul>
          <button class="btn ghost small" onClick={() => history.back()}>返回</button>
        </div>
      </div>
    </>
  );
}
