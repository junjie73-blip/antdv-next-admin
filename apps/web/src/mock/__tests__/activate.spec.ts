import { describe, expect, it } from 'vitest';

import { installBrowserMockIfEnabled, isBrowserMockEnabled } from '../activate';

/**
 * 开关判定必须走 `isEnvEnabled`：`import.meta.env` 的值运行时一律是字符串，
 * 写 `VITE_MOCK === true` 恒为 false（功能看着配了、实际从没生效过），
 * 写 `if (VITE_MOCK)` 又会被 `'false'`、`'0'` 这类真值字符串骗开。
 */

describe('isBrowserMockEnabled', () => {
  it('生产构建 + 打开的开关才算启用', () => {
    for (const value of ['true', 'TRUE', ' true ', true, '1', 'yes', 'on']) {
      expect(isBrowserMockEnabled({ PROD: true, VITE_MOCK: value })).toBe(true);
    }
  });

  it('关掉开关（含空串、undefined、字符串 false）都不启用', () => {
    for (const value of ['false', false, '', undefined, '0', 'no', null]) {
      expect(isBrowserMockEnabled({ PROD: true, VITE_MOCK: value })).toBe(
        false,
      );
    }
  });

  it('dev 下即使 VITE_MOCK=true 也不装：/api 归 vite proxy 管，面板要的是实时 mock', () => {
    expect(isBrowserMockEnabled({ PROD: false, VITE_MOCK: 'true' })).toBe(
      false,
    );
  });

  it('运行时开关覆盖构建期配置：同一份包可现场启停', () => {
    const url = new URL(window.location.href);
    try {
      url.searchParams.set('mock', '0');
      window.history.replaceState({}, '', url);
      expect(isBrowserMockEnabled({ PROD: true, VITE_MOCK: 'true' })).toBe(
        false,
      );

      url.searchParams.set('mock', '1');
      window.history.replaceState({}, '', url);
      expect(isBrowserMockEnabled({ PROD: false, VITE_MOCK: 'false' })).toBe(
        true,
      );

      url.searchParams.delete('mock');
      window.history.replaceState({}, '', url);
      window.localStorage.setItem('BACKEND_MOCK_ENABLED', 'true');
      expect(isBrowserMockEnabled({ PROD: true, VITE_MOCK: 'false' })).toBe(
        true,
      );
    } finally {
      window.localStorage.removeItem('BACKEND_MOCK_ENABLED');
      url.searchParams.delete('mock');
      window.history.replaceState({}, '', url);
    }
  });
});

describe('installBrowserMockIfEnabled', () => {
  it('开关关闭时不碰 globalThis.fetch，也不下载拦截器模块', async () => {
    const sentinel = () => Promise.reject(new Error('不该被调用'));
    globalThis.fetch = sentinel as unknown as typeof fetch;

    await installBrowserMockIfEnabled({ PROD: true, VITE_MOCK: 'false' });
    expect(globalThis.fetch).toBe(sentinel);
  });

  it('开关打开时装上拦截器（这条必须放在最后：安装是幂等的全局副作用）', async () => {
    const sentinel = () => Promise.reject(new Error('不该被调用'));
    globalThis.fetch = sentinel as unknown as typeof fetch;

    await installBrowserMockIfEnabled({ PROD: true, VITE_MOCK: 'true' });
    expect(globalThis.fetch).not.toBe(sentinel);

    const response = await globalThis.fetch('/api/menus');
    const body = await response.json();
    expect(body.code).toBe(200);
  });
});
