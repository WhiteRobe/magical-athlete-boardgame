// 加速跑几局 AI 对战，检查不崩溃、能结束、重放一致。用法：npm run sim -- [局数] [起始seed]
import { Game } from '../src/shared/engine';
import { aiAnswer } from '../src/shared/ai';
import { playerScore, type GameEvent } from '../src/shared/types';

const N = Number(process.argv[2] ?? 30);
const seed0 = Number(process.argv[3] ?? 1);
const used = new Map<string, number>();
const reasons: Record<string, number> = {};
let maxSteps = 0;
const t0 = performance.now();
for (let k = 0; k < N; k++) {
  const players = 2 + (k % 5);
  const config = {
    seed: seed0 + k,
    seats: Array.from({ length: players }, (_, i) => ({ name: 'AI' + i, ai: (i % 2 ? 'easy' : 'normal') as 'easy' | 'normal' })),
  };
  const g = Game.create(config);
  const events: GameEvent[] = g.takeEvents();
  let steps = 0;
  while (g.pending) {
    const r = g.answer(aiAnswer(g, g.pending));
    if (!r.ok) throw new Error(`seed ${config.seed}: ${r.error} ${JSON.stringify(g.pending)}`);
    events.push(...r.events);
    if (++steps > 20000) throw new Error('too many steps, seed ' + config.seed);
  }
  maxSteps = Math.max(maxSteps, steps);
  for (const e of events) {
    if (e.t === 'power') used.set(e.power, (used.get(e.power) ?? 0) + 1);
    if (e.t === 'raceEnd') reasons[e.reason] = (reasons[e.reason] ?? 0) + 1;
  }
  const end = events.find((e) => e.t === 'gameEnd');
  if (!end) throw new Error('no gameEnd, seed ' + config.seed);
  // 重放一致
  const h = Game.restore(config, g.answers);
  const a = JSON.stringify(g.state), b = JSON.stringify(h.state);
  if (a !== b) throw new Error('replay mismatch seed ' + config.seed);
  if (k < 3) console.log(`seed ${config.seed} ${players}人: 决策 ${steps} 次，得分`, g.state.players.map(playerScore).join('/'));
}
console.log(`${N} 局完成，用时 ${(performance.now() - t0).toFixed(0)}ms，单局最多决策 ${maxSteps}`);
console.log('结束原因', reasons);
console.log('能力发动次数', Object.fromEntries([...used].sort((a, b) => b[1] - a[1])));
