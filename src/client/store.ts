import { signal } from '@preact/signals';
import type { Me } from '../shared/protocol';

export const me = signal<Me | null | undefined>(undefined);

export type Route =
  | { name: 'home' }
  | { name: 'lobby' }
  | { name: 'room'; id: string }
  | { name: 'codex' }
  | { name: 'credits' }
  | { name: 'dev'; what: string };

function parse(h: string): Route {
  const p = h.replace(/^#\/?/, '').split('/');
  if (p[0] === 'lobby') return { name: 'lobby' };
  if (p[0] === 'room' && p[1]) return { name: 'room', id: p[1] };
  if (p[0] === 'codex') return { name: 'codex' };
  if (p[0] === 'credits') return { name: 'credits' };
  if (p[0] === 'dev') return { name: 'dev', what: p[1] || 'race' };
  return { name: 'home' };
}
export const route = signal<Route>(parse(location.hash));
window.addEventListener('hashchange', () => (route.value = parse(location.hash)));
export function go(path: string) {
  location.hash = path;
}

export const toastMsg = signal<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;
export function toast(msg: string) {
  toastMsg.value = msg;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toastMsg.value = null), 2600);
}
