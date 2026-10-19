import type { ComponentType } from 'preact';
import { useEffect, useState } from 'preact/hooks';

/** 极简懒加载组件（避免引入 preact/compat） */
export function lazy<P extends object>(load: () => Promise<ComponentType<P>>) {
  let C: ComponentType<P> | null = null;
  let p: Promise<void> | null = null;
  return function Lazy(props: P) {
    const [, force] = useState(0);
    useEffect(() => {
      if (!C) (p ??= load().then((c) => void (C = c))).then(() => force((x) => x + 1));
    }, []);
    return C ? <C {...props} /> : <div class="hero"><div class="empty-hint">加载中…</div></div>;
  };
}
