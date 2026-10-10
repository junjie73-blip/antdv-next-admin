import { describe, expect, it } from 'vitest';

import {
  getTokenRemainingSeconds,
  isJwtFormat,
  isTokenExpired,
  parseJwt,
} from '../src/jwt';

/** 用 base64url 手搓一个未签名校验的 token，只测解析链路 */
function makeToken(payload: Record<string, unknown>): string {
  // btoa 只吃 Latin1，中文 payload 要先按 UTF-8 逐字节转成二进制串
  const encode = (value: unknown) => {
    const json = JSON.stringify(value);
    const bytes = new TextEncoder().encode(json);
    const binary = [...bytes]
      .map((byte) => String.fromCharCode(byte))
      .join('');
    return btoa(binary)
      .replaceAll('+', '-')
      .replaceAll('/', '_')
      .replace(/=+$/, '');
  };
  return `${encode({ alg: 'HS256', typ: 'JWT' })}.${encode(payload)}.sig`;
}

describe('parseJwt', () => {
  it('解析出 payload 字段', () => {
    const token = makeToken({ exp: 1_800_000_000, sub: '42', name: '张三' });
    expect(parseJwt(token)).toMatchObject({ name: '张三', sub: '42' });
  });

  it('非三段式 / 非法 base64 一律返回 null，不抛异常', () => {
    expect(parseJwt(undefined)).toBeNull();
    expect(parseJwt('a.b')).toBeNull();
    expect(parseJwt('aaa.%%%bbb.ccc')).toBeNull();
  });

  it('payload 是 JSON 数组时也判为无效（JWT 载荷必须是对象）', () => {
    expect(parseJwt('a.Y1sxXQ==.c')).toBeNull();
  });
});

describe('过期判断', () => {
  it('无 exp 视为长期有效', () => {
    const token = makeToken({ sub: '1' });
    expect(isTokenExpired(token)).toBe(false);
    expect(getTokenRemainingSeconds(token)).toBe(Number.POSITIVE_INFINITY);
  });

  it('已过期与提前 5 分钟预警', () => {
    const past = makeToken({ exp: Math.floor(Date.now() / 1000) - 10 });
    expect(isTokenExpired(past)).toBe(true);
    expect(getTokenRemainingSeconds(past)).toBe(0);

    const soon = makeToken({
      exp: Math.floor(Date.now() / 1000) + 120,
    });
    expect(isTokenExpired(soon, 300)).toBe(true);
    expect(isTokenExpired(soon, 60)).toBe(false);
  });

  it('opaque token 交给后端判断，不当作过期', () => {
    expect(isTokenExpired('opaque-session-id')).toBe(false);
    expect(isJwtFormat('opaque-session-id')).toBe(false);
    expect(isJwtFormat(makeToken({ sub: '1' }))).toBe(true);
  });

  it('空 token 直接算过期', () => {
    expect(isTokenExpired(null)).toBe(true);
    expect(getTokenRemainingSeconds('')).toBe(0);
  });
});
