import { useState } from 'preact/hooks';
import { api } from '../api';
import { me, go } from '../store';
import { Avatar } from '../art/Avatar';
import type { CharId } from '../../shared/types';
import { sfx } from '../audio';

const HERO: CharId[] = ['hare', 'banana', 'centaur', 'mouth', 'hugebaby', 'rocket'];

export function Login() {
  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [u, setU] = useState('');
  const [p, setP] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: Event) {
    e.preventDefault();
    setErr('');
    if (!/^[\w一-龥]{2,16}$/.test(u)) return setErr('用户名 2-16 位，可用中文、字母、数字、下划线');
    if (p.length < 6) return setErr('密码至少 6 位');
    setBusy(true);
    try {
      me.value = tab === 'login' ? await api.login(u, p) : await api.register(u, p);
      sfx('fanfare');
      go('/lobby');
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }
  async function guest() {
    setBusy(true);
    try {
      me.value = await api.guest();
      go('/lobby');
    } catch (x: any) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div class="hero">
      <div class="hero-card">
        <div class="hero-racers">
          {HERO.map((id) => <Avatar id={id} key={id} />)}
        </div>
        <h1 class="hero-title">魔法运动会</h1>
        <div class="hero-sub">MAGICAL ATHLETE · 在线版</div>
        <form class="panel" onSubmit={submit}>
          <div class="tabs">
            <button type="button" class={tab === 'login' ? 'on' : ''} onClick={() => setTab('login')}>登录</button>
            <button type="button" class={tab === 'register' ? 'on' : ''} onClick={() => setTab('register')}>注册</button>
          </div>
          <label class="label">用户名</label>
          <input class="input" value={u} onInput={(e) => setU(e.currentTarget.value)} autoComplete="username" maxLength={16} />
          <label class="label">密码</label>
          <input
            class="input" type="password" value={p} onInput={(e) => setP(e.currentTarget.value)}
            autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
          />
          <div class="err" style={{ marginTop: '8px' }}>{err}</div>
          <button class="btn primary big" style={{ width: '100%', marginTop: '4px' }} disabled={busy}>
            {tab === 'login' ? '进入赛场' : '注册并进入'}
          </button>
          <div class="divider">或者</div>
          <button type="button" class="btn ghost" style={{ width: '100%' }} onClick={guest} disabled={busy}>
            游客试玩（只能和 AI 对战）
          </button>
        </form>
        <div class="disclaimer">
          非官方同人作品，仅供个人娱乐，非商业用途 · <a href="#/credits">声明与致谢</a> · <a href="#/codex">角色图鉴</a>
        </div>
      </div>
    </div>
  );
}
