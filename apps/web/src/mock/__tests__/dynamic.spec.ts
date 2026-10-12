import type { FixtureSet } from '../types';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createMockFetch } from '../browser';
import { resetUploadSeq } from '../dynamic';

/**
 * 上传接口在 fixtures 里是缺席的（multipart 抓不了、返回值要求每次唯一），
 * 由覆盖层按 `backend-mock/server/utils/upload.ts` 的同一份契约现造。
 *
 * 这里守的是"产物里点上传有没有人接"：示例页的 `customRequest` 与头像上传组件
 * 都发到 `/upload/**`，漏一条就是一次真网络请求 —— 静态部署下直接 404。
 */

const fixtures = {
  auth: {
    accounts: [
      {
        password: 'admin123',
        permissions: ['*'],
        profile: { id: '1', username: 'admin' },
        roles: ['admin'],
        username: 'admin',
        visibleMenus: null,
      },
    ],
    failure: { code: 400, data: null, message: '用户名或密码错误' },
    loginPath: '/auth/login',
    logoutPath: '/auth/logout',
    success: { code: 200, data: { user: {} }, message: '登录成功' },
    userPath: '/auth/user-info',
  },
  generatedAt: '2026-01-01T00:00:00.000Z',
  menusPath: '/menus',
  mockServer: 'http://localhost:5320',
  routes: [],
} as unknown as FixtureSet;

async function post(path: string) {
  const nativeFetch = vi.fn();
  const mockFetch = createMockFetch(fixtures, {
    baseUrl: 'http://localhost:9080/',
    latency: () => 0,
    nativeFetch,
    prefix: '',
  });
  const body = new FormData();
  body.append('file', new Blob(['x'], { type: 'image/png' }), 'p.png');
  const response = await mockFetch(path, { body, method: 'POST' });
  return {
    envelope: await response.json(),
    nativeFetch,
    status: response.status,
  };
}

beforeEach(() => {
  resetUploadSeq();
});

describe('上传的现造应答', () => {
  it('pOST /upload 被接住，信封与 Nitro 同构且不发真实请求', async () => {
    const { envelope, nativeFetch, status } = await post('/upload');
    expect(status).toBe(200);
    expect(nativeFetch).not.toHaveBeenCalled();
    expect(Object.keys(envelope)).toEqual(['code', 'data', 'message']);
    expect(envelope.code).toBe(200);
    expect(envelope.message).toBe('上传成功');
    expect(Object.keys(envelope.data).toSorted()).toEqual([
      'fileId',
      'storedPath',
      'uploadedAt',
      'url',
      'variant',
    ]);
    expect(envelope.data.variant).toBe('upload');
  });

  it('变体名决定 variant 与 storedPath，url 是可渲染的内联 SVG', async () => {
    const { envelope } = await post('/upload/avatar');
    expect(envelope.data.variant).toBe('avatar');
    expect(envelope.data.storedPath).toBe(
      `/uploads/avatar/${envelope.data.fileId}`,
    );
    expect(envelope.data.url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
    expect(decodeURIComponent(envelope.data.url)).toContain('avatar');
    expect(envelope.data.uploadedAt).toMatch(
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/,
    );
  });

  it('同一会话里连续两次上传不会撞 fileId（列表的 key 靠它）', async () => {
    const first = await post('/upload/image');
    const second = await post('/upload/image');
    expect(second.envelope.data.fileId).not.toBe(first.envelope.data.fileId);
    expect(second.envelope.data.storedPath).not.toBe(
      first.envelope.data.storedPath,
    );
    // 不断言 url 互不相同：预览图是 `data:` SVG，内容只由「配色（种子哈希撞色就重合）+ 变体名」
    // 决定，两次同变体上传撞出同一张缩略图是允许的 —— Nitro 那边 `upload.ts:103` 就是这个口径。
    expect(second.envelope.data.url).toMatch(
      /^data:image\/svg\+xml;charset=utf-8,/,
    );
  });

  it('带接口前缀时同样命中（dev 下 VITE_APP_BASE_API=/api）', async () => {
    const nativeFetch = vi.fn();
    const mockFetch = createMockFetch(fixtures, {
      baseUrl: 'http://localhost:9080/',
      latency: () => 0,
      nativeFetch,
      prefix: '/api',
    });
    const response = await mockFetch('/api/upload/status', {
      body: new FormData(),
      method: 'POST',
    });
    expect((await response.json()).data.variant).toBe('status');
    expect(nativeFetch).not.toHaveBeenCalled();
  });
});
