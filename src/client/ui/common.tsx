import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { CharId } from '../../shared/types';
import { CHARS } from '../../shared/characters';
import { Avatar } from '../art/Avatar';
import { PAL, SEAT_COLORS } from '../art/palette';
import { sfx } from '../audio';

export function Card(p: {
  id: CharId;
  mini?: boolean;
  onClick?: () => void;
  selected?: boolean;
  dim?: boolean;
  badge?: ComponentChildren;
  class?: string;
  style?: any;
}) {
  const c = CHARS[p.id];
  return (
    <div
      class={`card ${p.mini ? 'mini' : ''} ${p.onClick ? 'pickable' : ''} ${p.selected ? 'selected' : ''} ${p.dim ? 'dim' : ''} ${p.class ?? ''}`}
      style={p.style}
      onClick={p.onClick ? () => (sfx('click'), p.onClick!()) : undefined}
    >
      <div class="art" style={{ background: PAL[p.id].bg }}>
        <Avatar id={p.id} bg={false} />
        {p.badge && <div class="owner-badge">{p.badge}</div>}
      </div>
      <div class="body">
        <div class="nm">{c.name}</div>
        <div class="en">{c.en}</div>
        <span class="sk">{c.skill}</span>
        <div class="tx">{c.text}</div>
      </div>
    </div>
  );
}

export function Modal(p: { onClose?: () => void; children: ComponentChildren; class?: string }) {
  return (
    <div class="modal-bg" onClick={(e) => e.target === e.currentTarget && p.onClose?.()}>
      <div class={`panel modal ${p.class ?? ''}`}>{p.children}</div>
    </div>
  );
}

export function SeatDot({ seat, label, size = 26 }: { seat: number; label?: string; size?: number }) {
  return (
    <span class="dot" style={{ background: SEAT_COLORS[seat % 6], width: `${size}px`, height: `${size}px`, borderRadius: '50%', border: '2px solid #2b1b4d', display: 'inline-grid', placeItems: 'center', color: '#fff', fontSize: '12px', fontWeight: 900, flex: 'none' }}>
      {label ?? seat + 1}
    </span>
  );
}

/** deadline 倒计时环 */
export function TimerRing({ deadline }: { deadline: number | null }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!deadline) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [deadline]);
  if (!deadline) return null;
  const left = Math.max(0, deadline - now);
  const total = 45000;
  const frac = Math.min(1, left / total);
  const C = 2 * Math.PI * 10;
  return (
    <svg class="timer-ring" viewBox="0 0 26 26">
      <circle cx="13" cy="13" r="10" fill="#fff" stroke="#2b1b4d" stroke-width="3" />
      <circle
        cx="13" cy="13" r="10" fill="none" stroke={left < 10000 ? '#ff5d3d' : '#6c4bf4'} stroke-width="4"
        stroke-dasharray={`${C * frac} ${C}`} transform="rotate(-90 13 13)" stroke-linecap="round"
      />
      <text x="13" y="17" text-anchor="middle" font-size="10" font-weight="900" fill="#2b1b4d">{Math.ceil(left / 1000)}</text>
    </svg>
  );
}

export function Logo({ onClick }: { onClick?: () => void }) {
  return (
    <div class="logo" onClick={onClick}>
      <svg class="star" viewBox="0 0 64 64"><rect x="4" y="4" width="56" height="56" rx="14" fill="#6C4BF4" stroke="#fff" stroke-width="4" /><path d="M32 12l5.5 13 14 1-10.8 9 3.4 13.7L32 41l-12.1 7.7 3.4-13.7-10.8-9 14-1z" fill="#FFD23F" stroke="#2B1B4D" stroke-width="3" stroke-linejoin="round" /></svg>
      <span>魔法运动会</span>
    </div>
  );
}
