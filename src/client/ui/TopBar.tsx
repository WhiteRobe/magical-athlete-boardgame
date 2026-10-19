import { useState } from 'preact/hooks';
import { me, go } from '../store';
import { api } from '../api';
import { Logo } from './common';
import { audioPrefs, setAudio, sfx } from '../audio';

export function SoundButton() {
  const [m, setM] = useState(audioPrefs.muted);
  return (
    <button
      class="icon-btn"
      title={m ? '打开声音' : '静音'}
      onClick={() => {
        setAudio({ muted: !m });
        setM(!m);
        if (m) sfx('click');
      }}
    >
      {m ? '🔇' : '🔊'}
    </button>
  );
}

export function TopBar() {
  const u = me.value;
  return (
    <div class="topbar">
      <Logo onClick={() => go('/lobby')} />
      <div class="spacer" />
      <button class="icon-btn" title="角色图鉴" onClick={() => go('/codex')}>📖</button>
      <SoundButton />
      {u && (
        <>
          <span class="who">{u.guest && !u.name.startsWith('游客') ? '游客 · ' : ''}{u.name}</span>
          <button
            class="btn small ghost"
            onClick={async () => {
              await api.logout().catch(() => {});
              me.value = null;
              go('/');
            }}
          >
            退出
          </button>
        </>
      )}
    </div>
  );
}

