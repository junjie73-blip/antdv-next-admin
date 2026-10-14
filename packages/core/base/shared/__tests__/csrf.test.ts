/**
 * CSRF Double Submit Cookie 的属性拼接。
 *
 * 回归动机：这条写法在 Firefox 上会让控制台报错，端到端基线随之变红 ——
 * Cookie 属性是「出现即为真」的标记，`HttpOnly=false` 等于声明 HttpOnly=true，
 * 于是脚本第一次写入把 cookie 存成 HttpOnly，第二次再写同名 cookie 就被拒绝。
 * Chromium 把这类拒绝放在 DevTools 的 Security 面板里，控制台看着是干净的，
 * 所以只有 Firefox 暴露了问题。测试把这两条不变量钉死。
 */
import { beforeEach, describe, expect, it } from 'vitest';

import { buildCookieAttributes } from '../src/csrf';

function setProtocol(protocol: string) {
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...window.location, protocol },
  });
}

describe('buildCookieAttributes', () => {
  beforeEach(() => {
    setProtocol('http:');
  });

  it('不带 HttpOnly —— cookie 必须对脚本可读才能做 Double Submit', () => {
    const attributes = buildCookieAttributes();
    expect(attributes).not.toMatch(/httponly/i);
  });

  it('固定 path 与 SameSite=Lax', () => {
    expect(buildCookieAttributes()).toContain('path=/');
    expect(buildCookieAttributes()).toContain('SameSite=Lax');
  });

  it('本地 http 下不加 Secure（WebKit 会直接丢弃 Secure cookie）', () => {
    setProtocol('http:');
    expect(buildCookieAttributes()).not.toContain('Secure');
  });

  it('https 下加回 Secure', () => {
    setProtocol('https:');
    expect(buildCookieAttributes()).toContain('Secure');
  });
});
