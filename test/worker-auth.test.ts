import { describe, expect, it } from 'vitest';
import { hashPassword, signSession, validateCredentials, verifyPassword, verifySession } from '../src/worker/auth';

describe('worker auth', () => {
  it('密码哈希可校验，错误密码不通过', async () => {
    const h = await hashPassword('secret123', 1000);
    expect(h.startsWith('pbkdf2$sha256$1000$')).toBe(true);
    expect(await verifyPassword('secret123', h)).toBe(true);
    expect(await verifyPassword('secret124', h)).toBe(false);
  });

  it('会话签名防篡改', async () => {
    const t = await signSession({ id: 'u_1', name: '大春', guest: false }, 'k');
    expect(await verifySession(t, 'k')).toEqual({ id: 'u_1', name: '大春', guest: false });
    expect(await verifySession(t, 'other')).toBeNull();
    const [body, sig] = t.split('.');
    expect(await verifySession(body.slice(0, -2) + 'AA.' + sig, 'k')).toBeNull();
  });

  it('用户名与密码规则', () => {
    expect(validateCredentials('大春', 'secret')).toBeNull();
    expect(validateCredentials('a', 'secret')).not.toBeNull();
    expect(validateCredentials('bad name', 'secret')).not.toBeNull();
    expect(validateCredentials('ok_1', '123')).not.toBeNull();
  });
});
