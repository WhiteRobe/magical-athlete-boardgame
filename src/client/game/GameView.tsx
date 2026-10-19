import { useEffect, useRef, useState } from 'preact/hooks';
import type { ClientMsg, RoomInfo } from '../../shared/protocol';
import type { Answer, CharId, GameState, Racer, Request } from '../../shared/types';
import { playerScore, FINISH, TRACK_ORDER } from '../../shared/types';
import { CHARS, TRACK_NAME } from '../../shared/characters';
import type { GamePlayer } from './player';
import { copycatTarget, predictionValid } from './powers';
import { TrackPreview } from '../ui/TrackPreview';
import type { BoardApi } from './board';
import { Avatar } from '../art/Avatar';
import { SEAT_COLORS } from '../art/palette';
import { Card, Modal, SeatDot, TimerRing } from '../ui/common';
import { go } from '../store';
import { sfx } from '../audio';
import { SoundButton } from '../ui/TopBar';
import type { ConnStatus } from '../net';

type Send = (m: ClientMsg) => void;

export function GameView(p: { room: RoomInfo | null; player: GamePlayer; send: Send; status: ConnStatus; emotes?: { id: number; seat: number; e: string }[]; dev?: boolean }) {
  const { player, send } = p;
  const s = player.view.value!;
  const pending = player.pending.value;
  const you = player.you.value;
  const stageRef = useRef<HTMLDivElement>(null);
  const boardRef = useRef<BoardApi | null>(null);
  const [showLog, setShowLog] = useState(() => window.innerWidth > 720);
  const [detail, setDetail] = useState<Racer | null>(null);
  const [seatInfo, setSeatInfo] = useState<number | null>(null);
  const [cam, setCam] = useState<'follow' | 'overview' | null>(null);
  const [, setBoardReady] = useState(0);

  // 挂载赛道渲染器（3D 优先，失败降级 DOM）
  useEffect(() => {
    let disposed = false;
    const el = stageRef.current!;
    (async () => {
      let b: BoardApi;
      try {
        if (localStorage.getItem('ma-lowfx') === '1' || !hasWebGL()) throw new Error('no webgl');
        const m = await import('../scene/Board3D');
        b = m.createBoard3D(el);
      } catch (err) {
        if ((err as Error).message !== 'no webgl') console.warn('3D 渲染失败，降级为 2D', err);
        const m = await import('../scene/DomBoard');
        b = m.createDomBoard(el);
      }
      if (disposed) return b.dispose();
      boardRef.current = b;
      b.onPick = (idx) => pickRef.current(idx);
      b.onPickSpace = (sp) => spaceRef.current(sp);
      player.setBoard(b);
      setBoardReady((x) => x + 1);
    })();
    return () => {
      disposed = true;
      player.setBoard(null);
      boardRef.current?.dispose();
      boardRef.current = null;
    };
  }, []);

  const req = pending?.mine ? pending.req : null;
  const answer = (a: Answer) => {
    sfx('click');
    send({ type: 'answer', seq: player.seq.value, answer: a });
  };

  // 棋盘点选：目标选择或查看详情
  const pickRef = useRef<(i: number) => void>(() => {});
  const spaceRef = useRef<(sp: number) => void>(() => {});
  const targets = req ? racerTargets(req) : null;
  pickRef.current = (idx) => {
    if (req && targets?.includes(idx)) {
      if (req.kind === 'main') answer({ kind: 'main', mode: 'swap', target: idx });
      else if (req.kind === 'hypnotist') answer({ kind: 'hypnotist', target: idx });
      else if (req.kind === 'mastermind') answer({ kind: 'mastermind', target: idx });
      return;
    }
    const r = s.race?.racers.find((x) => x.idx === idx);
    if (r) setDetail(r);
  };
  spaceRef.current = (sp) => {
    if (req?.kind === 'thirdwheel' && req.options.includes(sp)) answer({ kind: 'thirdwheel', space: sp });
  };
  const [swapMode, setSwapMode] = useState(false);
  useEffect(() => setSwapMode(false), [req]);
  useEffect(() => {
    const b = boardRef.current;
    if (!b) return;
    const sel = req?.kind === 'main' ? (swapMode ? req.swap : null) : targets;
    b.setSelectable(sel && sel.length ? sel : null);
    b.setSelectableSpaces(req?.kind === 'thirdwheel' ? req.options : null);
  }, [req, swapMode, boardRef.current]);

  const current = s.race?.racers.find((r) => r.idx === s.race!.current);
  const turnSeat = pending && !pending.mine ? pending.seat : pending?.mine ? you : null;
  const activeSeat = s.phase === 'race' ? current?.seat ?? null : turnSeat;

  return (
    <div class="game">
      <div class="scorebar">
        <button class="icon-btn" title="离开" onClick={() => (p.dev ? history.back() : go('/lobby'))}>←</button>
        {s.players.map((pl) => {
          const seatInfo = p.room?.seats[pl.seat];
          const offline = seatInfo?.kind === 'human' && !seatInfo.online;
          return (
            <div class={`score-chip ${activeSeat === pl.seat ? 'turn' : ''}`} key={pl.seat} onClick={() => setSeatInfo(pl.seat)} style={{ cursor: 'pointer' }}>
              <SeatDot seat={pl.seat} label={pl.ai ? 'AI' : String(pl.seat + 1)} />
              <span class={offline ? 'offline' : ''} style={{ maxWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {pl.name}{pl.seat === you ? '（你）' : ''}
              </span>
              <span class="pts">{playerScore(pl)}</span>
            </div>
          );
        })}
        <span class="spacer" />
        {p.status !== 'open' && <span class="tag" style={{ background: '#ffd23f' }}>重连中…</span>}
        {you !== null && !p.dev && <Emotes send={send} />}
        <SoundButton />
      </div>

      <div class={`stage ${s.phase === 'race' && showLog ? 'with-log' : ''}`}>
        <div class="board-wrap" ref={stageRef} />
        {s.phase === 'race' && s.race && (
          <div class="hud-top">
            <span class="race-badge">第 <b>{s.race.no + 1}</b>/4 场 · {TRACK_NAME[s.race.track]}</span>
            {boardRef.current?.setView && (
              <button
                class="btn small ghost view-btn"
                title="切换镜头：跟随当前行动者 / 查看全局（也可以拖动、双指缩放）"
                onClick={() => {
                  const b = boardRef.current!;
                  const next = b.view === 'follow' ? 'overview' : 'follow';
                  b.setView!(next);
                  setCam(next);
                }}
              >
                {(cam ?? boardRef.current.view) === 'follow' ? '🔭 全局' : '🎯 跟随'}
              </button>
            )}
            {player.genius.value && (
              <span class="race-badge" style={{ background: '#ff9ec7', color: '#2b1b4d' }}>
                🔮 {racerName(s, player.genius.value.racer)} 预测掷出 <b style={{ color: '#2b1b4d' }}>{player.genius.value.value}</b> 点
              </span>
            )}
            {player.busy.value && (
              <div class="speed">
                {[1, 2].map((k) => (
                  <button class={player.speed.value === k ? 'on' : ''} onClick={() => player.setSpeed(k)}>{k}×</button>
                ))}
                <button onClick={() => player.skip()}>跳过</button>
              </div>
            )}
          </div>
        )}
        {s.phase === 'race' && (
          <button class="icon-btn log-toggle" title="比赛日志" onClick={() => setShowLog(!showLog)}>📜</button>
        )}
        {s.phase === 'race' && showLog && <Log player={player} />}
        {s.phase === 'draft' && <DraftOverlay s={s} req={req} you={you} answer={answer} pendingSeat={pending && !pending.mine ? pending.seat : you} />}
        {s.phase === 'pick' && <PickOverlay s={s} you={you} player={player} send={send} />}
        {s.phase === 'end' && <FinalOverlay s={s} room={p.room} send={send} you={you} />}
        {player.banner.value && (
          <div class="banner" key={player.banner.value.id}>
            {player.banner.value.title}
            {player.banner.value.sub && <small>{player.banner.value.sub}</small>}
          </div>
        )}
        {p.emotes?.map((e) => (
          <div class="pop-word" key={e.id} style={{ left: `${10 + ((e.seat * 15) % 80)}%`, top: '30%', fontSize: '40px' }}>{e.e}</div>
        ))}
      </div>

      {s.phase === 'race' && (
        <div class="dock">
          {req ? (
            <Prompt s={s} req={req} answer={answer} deadline={pending!.mine ? pending!.deadline : null} swapMode={swapMode} setSwapMode={setSwapMode} />
          ) : (
            <Waiting s={s} pending={pending} busy={player.busy.value} you={you} />
          )}
        </div>
      )}
      {(req?.kind === 'egg' || req?.kind === 'twin') && <PowerChoice req={req} answer={answer} />}
      {seatInfo !== null && s.players[seatInfo] && (
        <Modal onClose={() => setSeatInfo(null)} class="seat-modal">
          <SeatPanel s={s} seat={seatInfo} you={you} />
          <div class="row" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
            <button class="btn small" onClick={() => setSeatInfo(null)}>关闭</button>
          </div>
        </Modal>
      )}
      {detail && (
        <Modal onClose={() => setDetail(null)}>
          <RacerDetail r={detail} s={s} />
          <div class="row" style={{ justifyContent: 'flex-end', marginTop: '12px' }}>
            <button class="btn small" onClick={() => setDetail(null)}>知道了</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

const EMOTES = ['👍', '😂', '😱', '🔥', '😭'];
function Emotes({ send }: { send: Send }) {
  const [open, setOpen] = useState(false);
  const [cool, setCool] = useState(false);
  return (
    <div class="emote-bar">
      {open && EMOTES.map((e) => (
        <button disabled={cool} onClick={() => {
          send({ type: 'emote', e });
          setOpen(false);
          setCool(true);
          setTimeout(() => setCool(false), 2000);
        }}>{e}</button>
      ))}
      <button title="表情" onClick={() => setOpen(!open)}>{open ? '✕' : '😀'}</button>
    </div>
  );
}

function hasWebGL() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

function racerTargets(req: Request): number[] | null {
  if (req.kind === 'hypnotist' || req.kind === 'mastermind') return req.options;
  if (req.kind === 'main') return req.swap;
  return null;
}

export const racerName = (s: GameState, idx: number) => {
  const r = s.race?.racers.find((x) => x.idx === idx);
  return r ? CHARS[r.card].name : '?';
};

function RacerChip({ s, idx, onClick }: { s: GameState; idx: number; onClick?: () => void }) {
  const r = s.race?.racers.find((x) => x.idx === idx);
  if (!r) return null;
  return (
    <button class="btn small ghost racer-chip" onClick={onClick} style={{ borderColor: SEAT_COLORS[r.seat % 6] }}>
      <Avatar id={r.card} />
      {CHARS[r.card].name}
      <span class="muted" style={{ fontSize: '11px' }}>{r.pos === 0 ? '起点' : `${r.pos}格`}</span>
    </button>
  );
}

const ME_RACER = (s: GameState, req: Request) => ('racer' in req ? s.race?.racers.find((r) => r.idx === req.racer) : undefined);

function Prompt({ s, req, answer, deadline, swapMode, setSwapMode }: {
  s: GameState; req: Request; answer: (a: Answer) => void; deadline: number | null; swapMode: boolean; setSwapMode: (b: boolean) => void;
}) {
  const r = ME_RACER(s, req);
  const head = (t: string) => (
    <div class="prompt">
      <TimerRing deadline={deadline} />
      {r && <span class="racer-chip"><Avatar id={r.card} />{CHARS[r.card].name}</span>}
      <span>{t}</span>
    </div>
  );
  const [predict, setPredict] = useState<number | null>(null);

  switch (req.kind) {
    case 'main':
      if (swapMode) {
        return (
          <>
            {head('和谁交换位置？（也可以直接点棋盘上的棋子）')}
            <div class="opts">
              {req.swap.map((i) => <RacerChip s={s} idx={i} onClick={() => answer({ kind: 'main', mode: 'swap', target: i })} />)}
              <button class="btn small ghost" onClick={() => setSwapMode(false)}>返回</button>
            </div>
          </>
        );
      }
      return (
        <>
          {head(r?.tripped ? '你摔倒了，这回合用来爬起来' : '轮到你了！')}
          {req.predict && (
            <div class="row" style={{ gap: '4px', marginBottom: '8px', flexWrap: 'wrap' }}>
              <span style={{ fontWeight: 800, fontSize: '13px' }}>天才预测：</span>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <button class={`btn small ${predict === n ? 'purple' : 'ghost'}`} onClick={() => setPredict(predict === n ? null : n)}>{n}</button>
              ))}
            </div>
          )}
          <div class="opts">
            <button class="btn primary big" onClick={() => answer({ kind: 'main', mode: 'roll', predict: predict ?? undefined })}>🎲 掷骰子</button>
            {req.legs && <button class="btn mint big" onClick={() => answer({ kind: 'main', mode: 'legs' })}>🦵 直接走 5 格</button>}
            {req.swap.length > 0 && <button class="btn purple big" onClick={() => setSwapMode(true)}>🩴 交换位置</button>}
          </div>
        </>
      );
    case 'afterRoll': {
      const label: Record<string, string> = { keep: `就走 ${req.value} 点`, reroll: '🎲 重掷', alchemist: '⚗️ 改为走 4', rocket: `🚀 翻倍走 ${req.value * 2}（之后摔倒）` };
      return (
        <>
          {head(`掷出了 ${req.value} 点，怎么办？`)}
          <div class="opts">
            {req.options.map((o) => (
              <button class={`btn ${o === 'keep' ? 'ghost' : o === 'reroll' ? 'primary' : 'purple'}`} onClick={() => answer({ kind: 'afterRoll', choice: o })}>{label[o]}</button>
            ))}
          </div>
        </>
      );
    }
    case 'cheer':
      return (
        <>
          {head(`要为最后一名（${req.targets.map((i) => racerName(s, i)).join('、')}）加油吗？他们前进 2 格，你前进 1 格`)}
          <div class="opts">
            <button class="btn primary" onClick={() => answer({ kind: 'cheer', use: true })}>📣 加油！</button>
            <button class="btn ghost" onClick={() => answer({ kind: 'cheer', use: false })}>算了</button>
          </div>
        </>
      );
    case 'hypnotist':
      return (
        <>
          {head('催眠谁，把它拉到你身边？（可点棋盘）')}
          <div class="opts">
            {req.options.map((i) => <RacerChip s={s} idx={i} onClick={() => answer({ kind: 'hypnotist', target: i })} />)}
            <button class="btn small ghost" onClick={() => answer({ kind: 'hypnotist', target: null })}>不催眠</button>
          </div>
        </>
      );
    case 'thirdwheel':
      return (
        <>
          {head('挤到哪个两人格去？（可点棋盘格子）')}
          <div class="opts">
            {req.options.map((sp) => (
              <button class="btn small purple" onClick={() => answer({ kind: 'thirdwheel', space: sp })}>{sp === 0 ? '起点' : `第 ${sp} 格`}</button>
            ))}
            <button class="btn small ghost" onClick={() => answer({ kind: 'thirdwheel', space: null })}>不挤</button>
          </div>
        </>
      );
    case 'duel':
      return (
        <>
          {head(`要和 ${racerName(s, req.target)} 决斗吗？点大者前进 2 格，平局你赢`)}
          <div class="opts">
            <button class="btn primary" onClick={() => answer({ kind: 'duel', use: true })}>⚔️ 决斗！</button>
            <button class="btn ghost" onClick={() => answer({ kind: 'duel', use: false })}>放过它</button>
          </div>
        </>
      );
    case 'follow':
      return (
        <>
          {head(`要吸附在 ${racerName(s, req.target)} 身上跟到${req.to >= FINISH ? '终点' : `第 ${req.to} 格`}吗？`)}
          <div class="opts">
            <button class="btn primary" onClick={() => answer({ kind: 'follow', use: true })}>🐟 跟上</button>
            <button class="btn ghost" onClick={() => answer({ kind: 'follow', use: false })}>不跟</button>
          </div>
        </>
      );
    case 'mastermind':
      return (
        <>
          {head('预言谁会赢得本场？猜中的话比赛立即结束，你拿第 2 名')}
          <div class="opts">{req.options.map((i) => <RacerChip s={s} idx={i} onClick={() => answer({ kind: 'mastermind', target: i })} />)}</div>
        </>
      );
    default:
      return head('请做出选择…');
  }
}

const KIND_TEXT: Record<Request['kind'], string> = {
  draft: '选秀', pick: '选择出场运动员', egg: '孵蛋', twin: '选择双胞胎能力', mastermind: '预言胜者', main: '行动',
  afterRoll: '考虑骰子结果', cheer: '考虑是否加油', hypnotist: '施展催眠', thirdwheel: '找地方挤', duel: '考虑决斗', follow: '考虑要不要蹭车',
};

function Waiting({ s, pending, busy, you }: { s: GameState; pending: ReturnType<GamePlayer['pending']['peek']>; busy: boolean; you: number | null }) {
  if (busy) return <div class="wait">🏃 比赛进行中…</div>;
  if (!pending || pending.mine) return <div class="wait">…</div>;
  const name = pending.seat != null ? s.players[pending.seat]?.name : '大家';
  return (
    <div class="wait">
      <TimerRing deadline={pending.deadline} />
      等待 {name} {KIND_TEXT[pending.kind]}…
      {you === null && <span class="tag">观战中</span>}
    </div>
  );
}

function Log({ player }: { player: GamePlayer }) {
  const ref = useRef<HTMLDivElement>(null);
  const lines = player.log.value;
  useEffect(() => {
    ref.current?.scrollTo({ top: 1e6, behavior: 'smooth' });
  }, [lines.length]);
  return (
    <div class="log" ref={ref}>
      {lines.slice(-60).map((l) => <div class={`ln ${l.hot ? 'hot' : ''}`} key={l.id}>{l.text}</div>)}
    </div>
  );
}

/** 点击比分条：该玩家当前出场角色（含化身/模仿），非比赛阶段显示手牌与已用 */
function SeatPanel({ s, seat, you }: { s: GameState; seat: number; you: number | null }) {
  const p = s.players[seat];
  const racers = s.phase === 'race' || s.phase === 'end' ? (s.race?.racers.filter((r) => r.seat === seat) ?? []) : [];
  const status = (r: Racer) => (r.done === 'out' ? '已被淘汰' : r.done ? `第 ${r.done} 名冲线` : r.pos === 0 ? '在起点' : `第 ${r.pos} 格${r.tripped ? ' · 摔倒中' : ''}`);
  return (
    <div class="col">
      <div class="row">
        <SeatDot seat={seat} label={p.ai ? 'AI' : String(seat + 1)} />
        <b style={{ fontSize: '20px' }}>{p.name}{seat === you ? '（你）' : ''}</b>
        <span class="spacer" />
        <span class="tag">{playerScore(p)} 分</span>
      </div>
      {s.phase === 'race' && racers.length > 0 ? (
        racers.map((r) => {
          const morphed = r.power && r.power !== r.card && r.power !== 'copycat';
          const cc = r.power === 'copycat' ? copycatTarget(s, r) : null;
          return (
            <div class="col" style={{ gap: '6px' }}>
              <div class="muted" style={{ fontSize: '13px', fontWeight: 700 }}>本场出场 · {status(r)}</div>
              <Prediction s={s} r={r} />
              <div class="card-row" style={{ justifyContent: 'flex-start' }}>
                <Card id={r.card} />
                {morphed && (
                  <div class="col" style={{ gap: '4px', alignItems: 'center' }}>
                    <span class="tag" style={{ background: '#3ddc97' }}>化身为 {CHARS[r.power!].name}</span>
                    <Card id={r.power!} />
                  </div>
                )}
                {r.power === null && r.card !== 'copycat' && <span class="tag">本场没有能力</span>}
                {cc && (
                  <div class="col" style={{ gap: '4px', alignItems: 'center' }}>
                    {cc.power && cc.from ? (
                      <>
                        <span class="tag" style={{ background: '#4cc9f0' }}>当前复制：{CHARS[cc.power].name}（领先者）</span>
                        <Card id={cc.power} />
                      </>
                    ) : (
                      <span class="tag">{r.done ? '已离场' : '自己独自领先，暂无能力'}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })
      ) : (
        <>
          <div class="muted" style={{ fontSize: '13px', fontWeight: 700 }}>
            {s.phase === 'pick' ? '手牌（本场暗选中，选了谁要等翻牌）' : '手牌'} · {p.hand.length} 名
          </div>
          <div class="card-row" style={{ justifyContent: 'flex-start' }}>
            {p.hand.length ? p.hand.map((c) => <Card id={c} mini />) : <span class="muted">（空）</span>}
          </div>
          {p.used.length > 0 && (
            <>
              <div class="muted" style={{ fontSize: '13px', fontWeight: 700 }}>已上场</div>
              <div class="card-row" style={{ justifyContent: 'flex-start' }}>{p.used.map((c) => <Card id={c} mini dim />)}</div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Prediction({ s, r }: { s: GameState; r: Racer }) {
  if (r.prediction === undefined) return null;
  const t = s.race?.racers.find((x) => x.idx === r.prediction);
  if (!t) return null;
  const valid = predictionValid(s, r);
  return (
    <span class="tag" style={{ alignSelf: 'flex-start', background: valid ? '#e2d4ff' : '#eee', borderRadius: '10px' }}>
      🔮 预测冠军：{CHARS[t.card].name}（{s.players[t.seat]?.name}）{!valid && ' · 预测已失效'}
    </span>
  );
}

function RacerDetail({ r, s }: { r: Racer; s: GameState }) {
  const c = CHARS[r.card];
  const pw = r.power && r.power !== r.card ? CHARS[r.power] : null;
  return (
    <div class="col">
      <div class="char-detail">
        <Avatar id={r.card} />
        <div class="col" style={{ gap: '4px' }}>
          <div class="row"><b style={{ fontSize: '22px' }}>{c.name}</b><SeatDot seat={r.seat} size={22} /><span class="muted">{s.players[r.seat]?.name}</span></div>
          <span class="card" style={{ display: 'contents' }}><span class="sk">{c.skill}</span></span>
          <div style={{ fontSize: '14px' }}>{c.text}</div>
        </div>
      </div>
      {pw && pw.id !== 'copycat' && <div class="tag" style={{ alignSelf: 'flex-start', background: '#3ddc97', borderRadius: '10px' }}>化身为 {pw.name} · {pw.skill}：{pw.text}</div>}
      {r.power === 'copycat' && (() => {
        const cc = copycatTarget(s, r);
        return <div class="tag" style={{ alignSelf: 'flex-start', background: '#4cc9f0', borderRadius: '10px' }}>{cc.power ? `当前复制：${CHARS[cc.power].name}（领先者）· ${CHARS[cc.power].text}` : '自己独自领先，暂无能力'}</div>;
      })()}
      <Prediction s={s} r={r} />
      {s.race?.racers.some((x) => x.prediction === r.idx && predictionValid(s, x)) && (
        <span class="tag" style={{ alignSelf: 'flex-start', background: '#e2d4ff', borderRadius: '10px' }}>
          🔮 被 {s.race!.racers.filter((x) => x.prediction === r.idx && predictionValid(s, x)).map((x) => CHARS[x.card].name).join('、')} 预言会夺冠
        </span>
      )}
      <div class="row muted" style={{ fontSize: '13px' }}>
        位置：{r.done === 'out' ? '已淘汰' : r.done ? `第 ${r.done} 名冲线` : r.pos === 0 ? '起点' : `第 ${r.pos} 格`}
        {r.tripped && ' · 摔倒中'}
      </div>
    </div>
  );
}

function PowerChoice({ req, answer }: { req: Extract<Request, { kind: 'egg' | 'twin' }>; answer: (a: Answer) => void }) {
  return (
    <Modal>
      <h3 style={{ marginBottom: '6px' }}>{req.kind === 'egg' ? '🥚 蛋蛋孵化：选一个能力' : '👯 双胞胎：照搬哪位冠军的能力？'}</h3>
      <div class="card-row" style={{ margin: '10px 0' }}>
        {req.options.map((c) => <Card id={c} mini onClick={() => answer(req.kind === 'egg' ? { kind: 'egg', card: c } : { kind: 'twin', card: c })} />)}
      </div>
      {req.kind === 'twin' && <button class="btn ghost small" onClick={() => answer({ kind: 'twin', card: null })}>不照搬</button>}
    </Modal>
  );
}

// ---------- 选秀 ----------
function DraftOverlay({ s, req, you, answer, pendingSeat }: { s: GameState; req: Request | null; you: number | null; answer: (a: Answer) => void; pendingSeat: number | null }) {
  const myTurn = req?.kind === 'draft';
  const turnSeat = s.draftOrder[s.draftIdx];
  return (
    <div class="overlay">
      <h2>🏟️ 选秀大会</h2>
      <div class="sub">
        {myTurn ? '轮到你选人了！' : `${s.players[turnSeat ?? pendingSeat ?? 0]?.name ?? ''} 正在挑选…`}
      </div>
      <div class="order-strip">
        {s.draftOrder.map((seat, i) => (
          <span class={`o ${i === s.draftIdx ? 'now' : i < s.draftIdx ? 'done' : ''}`} style={{ background: SEAT_COLORS[seat % 6] }}>{seat + 1}</span>
        ))}
      </div>
      <div class="card-row">
        {s.pool.map((c, i) => (
          <Card id={c} key={c} class="flip-in" style={{ animationDelay: `${i * 60}ms` }} onClick={myTurn ? () => answer({ kind: 'draft', card: c }) : undefined} />
        ))}
      </div>
      <Teams s={s} you={you} />
    </div>
  );
}

function Teams({ s, you }: { s: GameState; you: number | null }) {
  return (
    <div class="teams">
      {s.players.map((p) => (
        <div class="team" style={p.seat === you ? { borderColor: '#ffd23f' } : undefined}>
          <div class="tn"><SeatDot seat={p.seat} size={20} />{p.name}{p.seat === you ? '（你）' : ''}</div>
          <div class="tc">
            {p.hand.map((c) => <span title={CHARS[c].name}><Avatar id={c} /></span>)}
            {p.used.map((c) => <span title={CHARS[c].name} style={{ opacity: 0.3 }}><Avatar id={c} /></span>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------- 派人 ----------
function PickOverlay({ s, you, player, send }: { s: GameState; you: number | null; player: GamePlayer; send: Send }) {
  const [sel, setSel] = useState<CharId[]>([]);
  const picked = player.picked.value;
  const done = you !== null && picked.includes(you);
  const hand = you !== null ? s.players[you].hand : [];
  const count = s.perRace;
  const last = s.results[s.results.length - 1];
  const raceNo = s.results.length;
  useEffect(() => setSel([]), [raceNo]);
  const pending = player.pending.value;

  return (
    <div class="overlay">
      {last && <RaceResult s={s} />}
      <h2>第 {raceNo + 1} 场 · {TRACK_NAME[TRACK_ORDER[raceNo]] ?? ''}</h2>
      {TRACK_ORDER[raceNo] && <TrackPreview track={TRACK_ORDER[raceNo]} compact />}
      <div class="sub">
        {done ? '已选好，等待其他人…' : you === null ? '观战中' : `从手牌中暗选 ${count} 名运动员出场${count > 1 ? '（先选的先行动）' : ''}`}
      </div>
      <div class="row" style={{ gap: '6px', flexWrap: 'wrap', justifyContent: 'center' }}>
        {s.players.map((p) => (
          <span class="tag" style={{ background: picked.includes(p.seat) ? '#3ddc97' : '#fff' }}>
            {picked.includes(p.seat) ? '✓' : '…'} {p.name}
          </span>
        ))}
        {pending?.deadline && <TimerRing deadline={pending.deadline} />}
      </div>
      {you !== null && !done && (
        <>
          <div class="card-row">
            {hand.map((c) => (
              <Card id={c} key={c} class="flip-in" selected={sel.includes(c)} badge={sel.includes(c) && count > 1 ? <span class="medal g" style={{ width: '26px', height: '26px' }}>{sel.indexOf(c) + 1}</span> : undefined}
                onClick={() => setSel(sel.includes(c) ? sel.filter((x) => x !== c) : sel.length < count ? [...sel, c] : count === 1 ? [c] : sel)} />
            ))}
          </div>
          <button class="btn primary big" disabled={sel.length !== count}
            onClick={() => { sfx('card'); send({ type: 'pick', seq: player.seq.value, cards: sel }); }}>
            就决定是{count > 1 ? '它们' : '它'}了！
          </button>
        </>
      )}
      <div class="muted" style={{ color: 'rgba(255,255,255,.6)', fontSize: '13px' }}>后面的比赛分值更高：金牌 3 / 4 / 4 / 5，银牌 1 / 2 / 2 / 3</div>
      <Teams s={s} you={you} />
    </div>
  );
}

function RaceResult({ s }: { s: GameState }) {
  const last = s.results[s.results.length - 1];
  const w1 = last.winners.find((w) => w.place === 1);
  const w2 = last.winners.find((w) => w.place === 2);
  const step = (w: typeof w1, cls: string, pts: number, medal: string) => (
    <div class={`step ${cls}`}>
      <div class="who">{w ? <Avatar id={w.card} /> : <div style={{ height: '72px' }} />}</div>
      <div style={{ fontWeight: 800, fontSize: '13px', minHeight: '18px' }}>{w ? `${CHARS[w.card].name} · ${s.players[w.seat].name}` : '空缺'}</div>
      <div class="block">
        <span class={`medal ${medal} chip-fly`}>{pts}</span>
      </div>
    </div>
  );
  return (
    <div class="col" style={{ alignItems: 'center' }}>
      <div class="sub">第 {last.no + 1} 场结果</div>
      <div class="podium">
        {step(w2, 'p2', [1, 2, 2, 3][last.no], 's')}
        {step(w1, 'p1', [3, 4, 4, 5][last.no], 'g')}
      </div>
    </div>
  );
}

// ---------- 终局 ----------
function FinalOverlay({ s, room, send, you }: { s: GameState; room: RoomInfo | null; send: Send; you: number | null }) {
  const ranked = [...s.players].sort((a, b) => playerScore(b) - playerScore(a));
  const top = playerScore(ranked[0]);
  const isHost = room && room.seats[you ?? -1]?.kind === 'human';
  return (
    <div class="overlay">
      {s.results.length > 0 && <RaceResult s={s} />}
      <h2>🏆 最终排名</h2>
      <table class="rank-table">
        <tbody>
          {ranked.map((p, i) => (
            <tr class={playerScore(p) === top ? 'win' : ''}>
              <td>{playerScore(p) === top ? '👑' : i + 1}</td>
              <td>
                <div class="row" style={{ gap: '6px' }}>
                  <SeatDot seat={p.seat} size={22} />
                  <b>{p.name}</b>
                  <span class="spacer" />
                  {p.gold.map((g) => <span class="medal g" style={{ width: '26px', height: '26px', fontSize: '12px' }}>{g}</span>)}
                  {p.silver.map((g) => <span class="medal s" style={{ width: '26px', height: '26px', fontSize: '12px' }}>{g}</span>)}
                  {p.bronze > 0 && <span class="medal b" style={{ width: '26px', height: '26px', fontSize: '12px' }}>{p.bronze}</span>}
                </div>
              </td>
              <td>{playerScore(p)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div class="row">
        {isHost && <button class="btn primary big" onClick={() => send({ type: 'rematch' })}>再来一局</button>}
        <button class="btn ghost big" onClick={() => go('/lobby')}>回大厅</button>
      </div>
    </div>
  );
}
