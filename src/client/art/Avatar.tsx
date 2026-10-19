import type { JSX } from 'preact';
import type { CharId } from '../../shared/types';
import { PAL, INK } from './palette';

// 程序化 SVG 头像。viewBox 100x100，粗描边贴纸风。
const S = { stroke: INK, 'stroke-width': 3.5, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' } as const;

function Eyes({ x = 50, y = 50, gap = 9, r = 4.2, look = 0 }: { x?: number; y?: number; gap?: number; r?: number; look?: number }) {
  return (
    <g>
      {[-1, 1].map((s) => (
        <g key={s}>
          <circle cx={x + s * gap} cy={y} r={r + 2.2} fill="#fff" {...S} stroke-width={2.5} />
          <circle cx={x + s * gap + look} cy={y + 0.6} r={r * 0.7} fill={INK} />
          <circle cx={x + s * gap + look + 1.2} cy={y - 0.8} r={1.1} fill="#fff" />
        </g>
      ))}
    </g>
  );
}
const Smile = ({ x = 50, y = 60, w = 7 }) => <path d={`M${x - w} ${y} Q${x} ${y + w} ${x + w} ${y}`} fill="none" {...S} stroke-width={3} />;
const Blob = ({ c, d = 'M50 22 C72 22 80 40 80 60 C80 80 68 88 50 88 C32 88 20 80 20 60 C20 40 28 22 50 22Z' }: { c: string; d?: string }) => <path d={d} fill={c} {...S} />;

type Art = (p: { b: string; a: string }) => JSX.Element;

const ART: Record<CharId, Art> = {
  alchemist: ({ b, a }) => (
    <g>
      <path d="M50 8 L64 40 L36 40Z" fill={b} {...S} />
      <circle cx="56" cy="20" r="3" fill="#ffd23f" />
      <Blob c={b} d="M32 40 L68 40 L78 88 L22 88Z" />
      <circle cx="50" cy="46" r="13" fill="#ffd9b8" {...S} />
      <Eyes y={46} gap={5} r={2.5} />
      <path d="M70 58 L76 58 L76 64 L84 80 Q86 86 80 86 L66 86 Q60 86 62 80 L70 64Z" fill={a} {...S} />
      <circle cx="72" cy="76" r="2.5" fill="#fff" />
    </g>
  ),
  babayaga: ({ b, a }) => (
    <g>
      <path d="M38 70 L32 88 M32 88 L24 90 M32 88 L36 92 M62 70 L68 88 M68 88 L76 90 M68 88 L64 92" fill="none" stroke={a} stroke-width={6} stroke-linecap="round" />
      <path d="M38 70 L32 88 M62 70 L68 88" fill="none" {...S} stroke-width={2} />
      <rect x="26" y="40" width="48" height="32" rx="4" fill={b} {...S} />
      <path d="M20 42 L50 14 L80 42Z" fill="#5a3a26" {...S} />
      <rect x="42" y="50" width="16" height="14" rx="2" fill="#ffd23f" {...S} />
      <Eyes y={56} gap={4} r={2} look={1} />
    </g>
  ),
  banana: ({ b, a }) => (
    <g>
      <path d="M26 24 C18 54 34 86 74 84 C82 84 84 78 78 76 C48 74 38 50 42 22 C42 16 30 16 26 24Z" fill={b} {...S} />
      <path d="M28 22 L32 12 L40 14 L40 22" fill={a} {...S} />
      <path d="M78 76 L84 80" {...S} />
      <Eyes x={44} y={52} gap={7} r={3.4} look={1} />
      <Smile x={46} y={63} w={5} />
    </g>
  ),
  blimp: ({ b, a }) => (
    <g>
      <path d="M14 46 L4 34 L8 58Z M14 46 L6 62 L16 54Z" fill={a} {...S} />
      <ellipse cx="52" cy="44" rx="38" ry="22" fill={b} {...S} />
      <path d="M30 32 Q52 26 76 34" fill="none" stroke="#fff" stroke-width={4} stroke-linecap="round" opacity={0.7} />
      <rect x="40" y="66" width="24" height="12" rx="4" fill={a} {...S} />
      <path d="M44 66 L46 64 M60 66 L58 64" {...S} stroke-width={2.5} />
      <Eyes x={66} y={44} gap={7} r={3.4} />
    </g>
  ),
  centaur: ({ b, a }) => (
    <g>
      <rect x="18" y="52" width="50" height="22" rx="11" fill={b} {...S} />
      <path d="M24 72 L22 90 M34 72 L34 90 M54 72 L54 90 M62 72 L64 90" {...S} stroke-width={5} />
      <path d="M18 58 Q6 60 10 74" fill="none" stroke="#5a3a26" stroke-width={6} stroke-linecap="round" />
      <path d="M56 56 L58 34 Q60 28 66 28 L72 28 Q78 30 76 38 L72 58Z" fill={a} {...S} />
      <circle cx="68" cy="20" r="11" fill={a} {...S} />
      <path d="M58 16 Q68 4 80 14" fill="#5a3a26" {...S} />
      <Eyes x={70} y={21} gap={4} r={2} look={1} />
    </g>
  ),
  cheerleader: ({ b, a }) => (
    <g>
      <circle cx="18" cy="46" r="11" fill={a} {...S} />
      <circle cx="82" cy="46" r="11" fill={a} {...S} />
      <path d="M34 58 L66 58 L74 86 L26 86Z" fill={b} {...S} />
      <path d="M30 80 L70 80" stroke="#fff" stroke-width={4} />
      <circle cx="50" cy="40" r="17" fill="#ffd9b8" {...S} />
      <path d="M33 36 Q50 14 67 36 Q66 26 50 22 Q34 26 33 36Z" fill="#c2410c" {...S} />
      <path d="M66 30 Q80 32 76 48" fill="none" stroke="#c2410c" stroke-width={6} stroke-linecap="round" />
      <Eyes y={42} gap={6} r={2.6} />
      <Smile y={50} w={5} />
    </g>
  ),
  coach: ({ b, a }) => (
    <g>
      <Blob c={b} d="M28 56 L72 56 L76 88 L24 88Z" />
      <path d="M50 56 L50 88" stroke={a} stroke-width={4} />
      <circle cx="50" cy="40" r="17" fill="#ffd9b8" {...S} />
      <path d="M32 36 Q50 16 68 36Z" fill={b} {...S} />
      <path d="M62 36 L82 38" {...S} stroke={INK} stroke-width={5} />
      <Eyes y={42} gap={6} r={2.6} />
      <path d="M42 54 Q50 66 58 54" fill="none" stroke="#999" stroke-width={2} />
      <circle cx="56" cy="64" r="4" fill="#c0c7d6" {...S} stroke-width={2} />
    </g>
  ),
  copycat: ({ b, a }) => (
    <g>
      <path d="M24 40 L22 14 L42 30Z M76 40 L78 14 L58 30Z" fill={b} {...S} />
      <Blob c={b} d="M50 26 C76 26 84 44 84 60 C84 80 70 88 50 88 C30 88 16 80 16 60 C16 44 24 26 50 26Z" />
      <ellipse cx="50" cy="66" rx="18" ry="13" fill={a} />
      <Eyes y={52} gap={12} r={4} />
      <path d="M46 62 L54 62 L50 66Z" fill="#ff8fb1" {...S} stroke-width={2} />
      <path d="M32 66 L18 64 M32 70 L18 72 M68 66 L82 64 M68 70 L82 72" stroke={INK} stroke-width={2} />
    </g>
  ),
  dicemonger: ({ b, a }) => (
    <g>
      <rect x="22" y="36" width="56" height="52" rx="10" fill={b} {...S} />
      {[[34, 78], [66, 78], [34, 50], [66, 50]].map(([x, y]) => <circle cx={x} cy={y} r={4} fill={a} />)}
      <rect x="32" y="12" width="36" height="24" rx="3" fill={a} {...S} />
      <rect x="24" y="32" width="52" height="7" rx="3" fill={a} {...S} />
      <rect x="32" y="26" width="36" height="5" fill="#ffd23f" />
      <Eyes y={62} gap={9} r={3.4} />
    </g>
  ),
  duelist: ({ b, a }) => (
    <g>
      <path d="M70 70 L94 22" stroke="#c0c7d6" stroke-width={4} stroke-linecap="round" />
      <path d="M66 74 L76 64" {...S} stroke-width={6} />
      <Blob c={b} d="M30 56 L70 56 L74 88 L26 88Z" />
      <circle cx="46" cy="40" r="17" fill={b} {...S} />
      <rect x="34" y="34" width="24" height="14" rx="3" fill="#333" />
      <path d="M36 37 L56 37 M36 41 L56 41 M36 45 L56 45" stroke="#888" stroke-width={1.5} />
      <path d="M46 23 Q50 6 64 10 Q56 14 54 24" fill={a} {...S} />
    </g>
  ),
  egg: ({ b, a }) => (
    <g>
      <path d="M50 10 C74 10 82 50 80 66 C78 82 66 90 50 90 C34 90 22 82 20 66 C18 50 26 10 50 10Z" fill={b} {...S} />
      <path d="M24 52 L34 46 L40 54 L50 46 L58 54 L66 46 L76 52" fill="none" {...S} stroke-width={2.5} />
      <ellipse cx="38" cy="26" rx="5" ry="8" fill="#fff" opacity={0.8} />
      <Eyes y={66} gap={9} r={3.4} />
      <circle cx="30" cy="74" r="4" fill={a} opacity={0.6} />
      <circle cx="70" cy="74" r="4" fill={a} opacity={0.6} />
    </g>
  ),
  flipflop: ({ b, a }) => (
    <g>
      <path d="M50 10 C72 10 78 30 76 50 C74 74 68 90 50 90 C32 90 26 74 24 50 C22 30 28 10 50 10Z" fill={b} {...S} transform="rotate(-18 50 50)" />
      <path d="M30 52 Q46 28 54 22 Q62 30 72 46" fill="none" stroke={a} stroke-width={7} stroke-linecap="round" transform="rotate(-18 50 50)" />
      <circle cx="54" cy="24" r="5" fill={a} {...S} stroke-width={2.5} transform="rotate(-18 50 50)" />
      <Eyes x={50} y={62} gap={9} r={3.4} />
      <Smile x={50} y={74} w={5} />
    </g>
  ),
  genius: ({ b, a }) => (
    <g>
      <rect x="34" y="66" width="32" height="22" rx="8" fill="#fff" {...S} />
      <path d="M22 48 C14 24 40 8 50 16 C60 8 86 24 78 48 C82 66 62 72 50 66 C38 72 18 66 22 48Z" fill={b} {...S} />
      <path d="M50 18 L50 40 M36 26 Q42 32 36 38 M64 26 Q58 32 64 38" fill="none" {...S} stroke-width={2.5} />
      <circle cx="40" cy="52" r="8" fill="#fff" {...S} stroke={a} />
      <circle cx="60" cy="52" r="8" fill="#fff" {...S} stroke={a} />
      <path d="M48 52 L52 52" {...S} />
      <circle cx="41" cy="53" r="3" fill={INK} />
      <circle cx="61" cy="53" r="3" fill={INK} />
    </g>
  ),
  gunk: ({ b, a }) => (
    <g>
      <path d="M18 84 C14 60 26 26 50 24 C74 26 86 60 82 84 C78 90 72 82 68 88 C62 94 58 84 52 90 C46 96 40 84 34 90 C28 94 22 90 18 84Z" fill={b} {...S} />
      <circle cx="34" cy="44" r="4" fill={a} />
      <circle cx="66" cy="70" r="5" fill={a} />
      <circle cx="60" cy="34" r="3" fill="#fff" opacity={0.7} />
      <Eyes y={56} gap={10} r={4} look={-1} />
      <path d="M40 70 Q50 64 60 70" fill="none" {...S} stroke-width={3} />
    </g>
  ),
  hare: ({ b, a }) => (
    <g>
      <path d="M36 44 C26 20 30 4 38 6 C46 8 46 30 44 44Z M64 44 C74 20 70 4 62 6 C54 8 54 30 56 44Z" fill={b} {...S} />
      <path d="M38 36 C34 22 36 14 39 14 M62 36 C66 22 64 14 61 14" fill="none" stroke={a} stroke-width={4} stroke-linecap="round" />
      <Blob c={b} d="M50 38 C72 38 80 52 80 66 C80 82 68 90 50 90 C32 90 20 82 20 66 C20 52 28 38 50 38Z" />
      <Eyes y={60} gap={10} r={3.6} />
      <path d="M46 70 L54 70 L50 74Z" fill={a} />
      <path d="M50 74 L50 78 M44 80 Q50 84 56 80" fill="none" {...S} stroke-width={2.5} />
    </g>
  ),
  heckler: ({ b, a }) => (
    <g>
      <Blob c={b} />
      <path d="M62 56 L88 42 L88 78 L62 66Z" fill={a} {...S} />
      <path d="M92 50 Q98 60 92 70" fill="none" {...S} stroke-width={2.5} />
      <Eyes x={42} y={48} gap={8} r={3.2} look={1} />
      <path d="M34 34 L44 38 M58 34 L48 38" {...S} stroke-width={3} />
      <ellipse cx="44" cy="66" rx="8" ry="6" fill={INK} />
    </g>
  ),
  hugebaby: ({ b, a }) => (
    <g>
      <circle cx="50" cy="52" r="38" fill={b} {...S} />
      <path d="M50 14 Q56 6 60 12 Q54 12 54 18" fill="none" {...S} stroke-width={3} />
      <circle cx="28" cy="62" r="6" fill="#ff9e9e" opacity={0.6} />
      <circle cx="72" cy="62" r="6" fill="#ff9e9e" opacity={0.6} />
      <Eyes y={46} gap={12} r={4.4} />
      <circle cx="50" cy="66" r="7" fill={a} {...S} />
      <rect x="40" y="62" width="20" height="5" rx="2.5" fill={a} {...S} stroke-width={2.5} />
    </g>
  ),
  hypnotist: ({ b, a }) => (
    <g>
      <path d="M50 70 L50 86" {...S} stroke-width={2} />
      <circle cx="50" cy="90" r="5" fill={a} {...S} stroke-width={2.5} />
      <Blob c={b} d="M50 20 C72 20 80 36 80 52 C80 70 68 76 50 76 C32 76 20 70 20 52 C20 36 28 20 50 20Z" />
      <path d="M30 22 L50 8 L70 22Z" fill={a} {...S} />
      {[-1, 1].map((s) => (
        <g>
          <circle cx={50 + s * 13} cy={46} r={9} fill="#fff" {...S} stroke-width={2.5} />
          <path d={`M${50 + s * 13} 46 m-1 0 a1 1 0 1 1 2 0 a3 3 0 1 1 -5 0 a5 5 0 1 1 9 0`} fill="none" stroke={a} stroke-width={2} />
        </g>
      ))}
      <path d="M38 64 Q50 70 62 64" fill="none" {...S} stroke-width={2.5} />
    </g>
  ),
  inchworm: ({ b, a }) => (
    <g>
      {[[20, 74, 10], [30, 56, 11], [44, 46, 12], [58, 52, 12]].map(([x, y, r]) => <circle cx={x} cy={y} r={r} fill={b} {...S} />)}
      <circle cx="72" cy="60" r="15" fill={b} {...S} />
      <path d="M66 46 L62 34 M78 46 L82 34" {...S} stroke-width={2.5} />
      <circle cx="62" cy="33" r="3" fill={a} />
      <circle cx="82" cy="33" r="3" fill={a} />
      <Eyes x={72} y={58} gap={5} r={2.6} />
      <Smile x={72} y={66} w={4} />
    </g>
  ),
  lackey: ({ b, a }) => (
    <g>
      <path d="M30 54 L70 54 L76 90 L24 90Z" fill={b} {...S} />
      <path d="M44 54 L50 74 L56 54" fill="#fff" {...S} stroke-width={2.5} />
      <path d="M46 58 L50 62 L54 58 L50 66Z" fill="#e63946" />
      <path d="M66 62 L84 66 L80 80 L66 72" fill={a} {...S} stroke-width={2.5} />
      <circle cx="48" cy="38" r="16" fill="#ffd9b8" {...S} />
      <path d="M32 34 Q48 16 64 34 Q48 28 32 34Z" fill="#33334d" {...S} />
      <path d="M40 40 L44 40 M52 40 L56 40" {...S} stroke-width={3} />
      <path d="M42 48 Q48 46 54 48" {...S} stroke-width={2.5} fill="none" />
    </g>
  ),
  leaptoad: ({ b, a }) => (
    <g>
      <path d="M14 82 L30 70 L26 88Z M86 82 L70 70 L74 88Z" fill={b} {...S} />
      <Blob c={b} d="M50 34 C78 34 88 56 84 72 C80 86 66 88 50 88 C34 88 20 86 16 72 C12 56 22 34 50 34Z" />
      <ellipse cx="50" cy="74" rx="20" ry="11" fill={a} />
      <circle cx="34" cy="34" r="11" fill={b} {...S} />
      <circle cx="66" cy="34" r="11" fill={b} {...S} />
      <Eyes y={33} gap={16} r={4} />
      <path d="M30 56 Q50 66 70 56" fill="none" {...S} stroke-width={3} />
    </g>
  ),
  legs: ({ b, a }) => (
    <g>
      <path d="M42 46 L36 84 M58 46 L64 84" {...S} stroke-width={5} />
      <path d="M26 86 Q30 80 38 82 L40 90 L24 90Z M74 86 Q70 80 62 82 L60 90 L76 90Z" fill={a} {...S} stroke-width={2.5} />
      <circle cx="50" cy="32" r="20" fill={b} {...S} />
      <path d="M30 26 L70 26" stroke={a} stroke-width={6} />
      <Eyes y={34} gap={8} r={3.2} look={1} />
      <Smile y={43} w={5} />
    </g>
  ),
  lovableloser: ({ b, a }) => (
    <g>
      <path d="M22 34 C10 40 12 64 22 62Z M78 34 C90 40 88 64 78 62Z" fill="#5d86d6" {...S} />
      <Blob c={b} d="M50 24 C74 24 80 44 80 60 C80 80 68 88 50 88 C32 88 20 80 20 60 C20 44 26 24 50 24Z" />
      <rect x="58" y="28" width="16" height="7" rx="2" fill={a} {...S} stroke-width={2} transform="rotate(30 66 31)" />
      <Eyes y={54} gap={10} r={4} />
      <path d="M36 46 L42 48 M64 46 L58 48" {...S} stroke-width={2.5} />
      <path d="M42 72 Q50 66 58 72" fill="none" {...S} stroke-width={3} />
      <path d="M36 60 Q34 66 36 68" fill="none" stroke="#4cc9f0" stroke-width={3} stroke-linecap="round" />
    </g>
  ),
  magician: ({ b, a }) => (
    <g>
      <path d="M24 88 L36 56 L64 56 L76 88Z" fill={a} {...S} />
      <path d="M36 56 L64 56 L60 88 L40 88Z" fill={b} {...S} />
      <circle cx="50" cy="44" r="15" fill="#ffd9b8" {...S} />
      <rect x="36" y="8" width="28" height="26" rx="2" fill={b} {...S} />
      <rect x="28" y="30" width="44" height="7" rx="3" fill={b} {...S} />
      <rect x="36" y="24" width="28" height="5" fill={a} />
      <Eyes y={46} gap={5} r={2.4} />
      <path d="M66 70 L88 54" stroke={INK} stroke-width={5} stroke-linecap="round" />
      <path d="M86 56 L90 52" stroke="#fff" stroke-width={5} stroke-linecap="round" />
      <path d="M88 40 l2 4 4 1 -3 3 1 4 -4 -2 -4 2 1 -4 -3 -3 4 -1z" fill="#ffd23f" {...S} stroke-width={1.5} />
    </g>
  ),
  mastermind: ({ b, a }) => (
    <g>
      <path d="M30 62 L70 62 L76 90 L24 90Z" fill={a} {...S} />
      <ellipse cx="50" cy="40" rx="30" ry="26" fill={b} {...S} />
      <path d="M30 30 Q36 22 44 28 M56 24 Q64 18 70 28" fill="none" {...S} stroke-width={2} />
      <circle cx="40" cy="44" r="4" fill={INK} />
      <circle cx="62" cy="44" r="9" fill="#fff" {...S} stroke-width={2.5} />
      <circle cx="62" cy="44" r="3.5" fill={INK} />
      <path d="M71 46 Q74 60 70 66" fill="none" stroke="#ffd23f" stroke-width={2} />
      <path d="M40 56 Q50 60 58 54" fill="none" {...S} stroke-width={3} />
    </g>
  ),
  mouth: ({ b, a }) => (
    <g>
      <path d="M46 12 L50 4 L54 12" {...S} />
      <circle cx="50" cy="4" r="3" fill="#ff5d3d" />
      <rect x="14" y="14" width="72" height="72" rx="20" fill={a} {...S} />
      <path d="M22 42 Q50 30 78 42 L78 66 Q50 84 22 66Z" fill={b} {...S} />
      <path d="M22 42 L30 52 L38 40 L46 52 L54 38 L62 52 L70 40 L78 50 L78 42 Q50 30 22 42Z" fill="#fff" {...S} stroke-width={2} />
      <path d="M24 66 L32 58 L40 70 L50 60 L60 72 L68 60 L76 66 Q50 84 24 66Z" fill="#fff" {...S} stroke-width={2} />
      <circle cx="32" cy="26" r="4" fill="#ffd23f" {...S} stroke-width={2} />
      <circle cx="68" cy="26" r="4" fill="#ffd23f" {...S} stroke-width={2} />
    </g>
  ),
  partyanimal: ({ b, a }) => (
    <g>
      <path d="M78 36 L78 70" {...S} stroke-width={2} />
      <ellipse cx="78" cy="26" rx="10" ry="12" fill={a} {...S} />
      <Blob c={b} d="M46 36 C68 36 74 52 74 66 C74 82 62 90 46 90 C30 90 18 82 18 66 C18 52 24 36 46 36Z" />
      <path d="M32 40 L44 6 L58 38Z" fill="#ffd23f" {...S} />
      <path d="M38 24 L50 26 M35 32 L54 34" stroke="#4cc9f0" stroke-width={3} />
      <circle cx="44" cy="6" r="4" fill="#4cc9f0" {...S} stroke-width={2} />
      <Eyes x={46} y={60} gap={9} r={3.4} />
      <path d="M36 72 Q46 82 56 72Z" fill={INK} {...S} stroke-width={2} />
    </g>
  ),
  rocket: ({ b, a }) => (
    <g>
      <path d="M20 48 L20 82 L32 82 L32 48 Q26 30 20 48Z" fill={a} {...S} />
      <path d="M22 84 Q26 98 30 84Z" fill="#ffd23f" {...S} stroke-width={2} />
      <Blob c={b} d="M34 54 L70 54 L74 88 L30 88Z" />
      <circle cx="52" cy="38" r="17" fill="#ffd9b8" {...S} />
      <path d="M36 32 Q40 16 52 18 Q66 16 70 32 Q62 24 52 26 Q42 24 36 32Z" fill="#eee" {...S} stroke-width={2.5} />
      <rect x="38" y="32" width="28" height="10" rx="5" fill="#4cc9f0" {...S} stroke-width={2.5} />
      <path d="M46 50 Q52 54 58 50" fill="none" {...S} stroke-width={2.5} />
    </g>
  ),
  romantic: ({ b, a }) => (
    <g>
      <path d="M50 88 C20 66 10 50 16 34 C22 18 42 18 50 32 C58 18 78 18 84 34 C90 50 80 66 50 88Z" fill={b} {...S} />
      <Eyes y={48} gap={10} r={3.6} />
      <circle cx="30" cy="58" r="5" fill="#ffb3c7" />
      <circle cx="70" cy="58" r="5" fill="#ffb3c7" />
      <Smile y={60} w={6} />
      <path d="M78 88 L74 66" stroke={a} stroke-width={3} />
      <circle cx="73" cy="62" r="7" fill="#e63946" {...S} stroke-width={2.5} />
    </g>
  ),
  scoocher: ({ b, a }) => (
    <g>
      <path d="M12 84 L86 84 Q90 76 80 74 L28 74 Q14 72 12 84Z" fill={b} {...S} />
      <circle cx="52" cy="54" r="24" fill={a} {...S} />
      <path d="M52 54 m-3 0 a3 3 0 1 1 6 0 a8 8 0 1 1 -14 0 a13 13 0 1 1 24 0 a18 18 0 1 1 -32 4" fill="none" {...S} stroke-width={2.5} />
      <path d="M20 74 Q14 52 22 46" fill="none" stroke={b} stroke-width={10} stroke-linecap="round" />
      <path d="M20 74 Q14 52 22 46" fill="none" {...S} stroke-width={2} opacity={0} />
      <path d="M18 44 L12 32 M24 44 L28 32" {...S} stroke-width={2.5} />
      <circle cx="12" cy="31" r="3" fill={INK} />
      <circle cx="28" cy="31" r="3" fill={INK} />
    </g>
  ),
  sisyphus: ({ b, a }) => (
    <g>
      <circle cx="64" cy="54" r="30" fill={a} {...S} />
      <path d="M50 40 L58 44 M70 70 L78 66 M60 60 L66 58" {...S} stroke-width={2} />
      <path d="M18 88 L28 64 L40 60" fill="none" {...S} stroke-width={6} />
      <circle cx="24" cy="48" r="11" fill={b} {...S} />
      <path d="M30 56 L40 52" {...S} stroke-width={5} />
      <circle cx="27" cy="46" r="2" fill={INK} />
      <path d="M18 40 Q16 36 20 34" fill="none" stroke="#4cc9f0" stroke-width={2.5} stroke-linecap="round" />
    </g>
  ),
  skipper: ({ b, a }) => (
    <g>
      <Blob c={b} d="M28 58 L72 58 L76 90 L24 90Z" />
      <path d="M50 58 L50 90 M28 70 L72 70" stroke={a} stroke-width={3} />
      <circle cx="50" cy="42" r="17" fill="#ffd9b8" {...S} />
      <path d="M44 52 Q50 64 56 52 Q50 56 44 52Z" fill="#f2f2f2" {...S} stroke-width={2} />
      <path d="M30 32 Q50 22 70 32 L66 22 Q50 14 34 22Z" fill={a} {...S} />
      <path d="M28 32 L72 32" {...S} stroke={b} stroke-width={6} />
      <circle cx="50" cy="22" r="3" fill="#ffd23f" />
      <Eyes y={42} gap={6} r={2.4} />
      <path d="M58 52 L70 50 L72 46" fill="none" stroke="#8a5a3b" stroke-width={3} />
    </g>
  ),
  stickler: ({ b, a }) => (
    <g>
      <rect x="32" y="10" width="36" height="82" rx="4" fill={b} {...S} />
      {[18, 26, 34, 74, 82].map((y, i) => <path d={`M32 ${y} L${i % 2 ? 40 : 44} ${y}`} {...S} stroke-width={2} />)}
      <circle cx="42" cy="48" r="7" fill="#fff" {...S} stroke-width={2.5} />
      <circle cx="58" cy="48" r="7" fill="#fff" {...S} stroke-width={2.5} />
      <path d="M49 48 L51 48" {...S} stroke-width={2} />
      <circle cx="42" cy="49" r="2.4" fill={a} />
      <circle cx="58" cy="49" r="2.4" fill={a} />
      <path d="M44 62 L56 62" {...S} stroke-width={3} />
      <path d="M68 30 L84 22" {...S} stroke-width={3} />
      <circle cx="84" cy="20" r="4" fill="#fff" {...S} stroke-width={2} />
    </g>
  ),
  suckerfish: ({ b, a }) => (
    <g>
      <path d="M78 50 L94 34 L92 66Z" fill={b} {...S} />
      <path d="M12 50 C20 28 54 24 78 50 C54 76 20 72 12 50Z" fill={b} {...S} />
      <path d="M24 40 Q44 30 62 40" fill="none" stroke={a} stroke-width={6} stroke-linecap="round" />
      <path d="M26 40 L58 40" stroke={INK} stroke-width={1.5} stroke-dasharray="3 3" />
      <circle cx="28" cy="52" r="6" fill="#fff" {...S} stroke-width={2.5} />
      <circle cx="27" cy="53" r="2.6" fill={INK} />
      <ellipse cx="16" cy="58" rx="4" ry="3" fill="#ff8fb1" {...S} stroke-width={2} />
    </g>
  ),
  thirdwheel: ({ b, a }) => (
    <g>
      <circle cx="50" cy="52" r="36" fill={a} {...S} />
      <circle cx="50" cy="52" r="26" fill={b} {...S} />
      {[0, 60, 120].map((r) => <path d={`M50 30 L50 74`} {...S} stroke-width={3} transform={`rotate(${r} 50 52)`} />)}
      <circle cx="50" cy="52" r="13" fill={b} {...S} />
      <Eyes y={50} gap={5} r={2.4} />
      <path d="M46 57 L54 57" {...S} stroke-width={2} />
      <path d="M82 18 l2 -6 2 6 6 2 -6 2 -2 6 -2 -6 -6 -2z" fill="#ffd23f" {...S} stroke-width={1.5} />
    </g>
  ),
  twin: ({ b, a }) => (
    <g>
      {[[32, b], [68, a]].map(([x, c]) => (
        <g>
          <path d={`M${+x - 16} 88 C${+x - 18} 56 ${+x - 12} 38 ${x} 38 C${+x + 12} 38 ${+x + 18} 56 ${+x + 16} 88Z`} fill={c as string} {...S} />
          <Eyes x={+x} y={56} gap={6} r={2.6} />
          <Smile x={+x} y={66} w={4} />
          <path d={`M${+x - 6} 38 Q${x} 26 ${+x + 6} 38`} fill="none" {...S} stroke-width={3} />
        </g>
      ))}
    </g>
  ),
};

export function Avatar({ id, bg = true, class: cls, size }: { id: CharId; bg?: boolean; class?: string; size?: number }) {
  const p = PAL[id];
  const Draw = ART[id];
  return (
    <svg viewBox="0 0 100 100" class={cls} width={size} height={size} aria-hidden="true">
      {bg && <circle cx="50" cy="50" r="47" fill={p.bg} />}
      <Draw b={p.body} a={p.accent} />
    </svg>
  );
}
