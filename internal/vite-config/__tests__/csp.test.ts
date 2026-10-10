import { describe, expect, it } from 'vitest';

import { CSP_UPGRADE_INSECURE, cspUpgradeInsecureRequests } from '../src/plugins/csp';

/**
 * 这条判断是"本地 Safari 白屏"的开关，所以按渲染结果测，不按实现细节测。
 *
 * 背景：`upgrade-insecure-requests` 写在 index.html 的 CSP meta 里，dev 也带着它。
 * WebKit 不豁免 http://localhost，会把每个模块请求升级成 https://localhost:6080，
 * 而本地 dev server 没上 TLS —— 握手失败，应用一行代码都没执行，页面只剩首屏 Loading。
 * Chromium 与 Firefox 都按规范把 localhost 当可信源，症状完全看不出来。
 */
describe('cspUpgradeInsecureRequests', () => {
  it('开发环境为空串：不能给 CSP 留下半条指令', () => {
    expect(cspUpgradeInsecureRequests(false)).toBe('');
  });

  it('生产产物带上升级指令', () => {
    expect(cspUpgradeInsecureRequests(true)).toBe(CSP_UPGRADE_INSECURE);
    expect(CSP_UPGRADE_INSECURE).toContain('upgrade-insecure-requests');
  });

  /**
   * 指令是用 `<%= VITE_CSP_UPGRADE_INSECURE %>` 直接拼进 `content` 尾部的
   * （模板里前一条指令已带 `;`），所以两个分支都必须"拼完仍然是一条能解析的 CSP"。
   */
  it('两个分支拼进 content 尾部后仍是合法的分号分隔串', () => {
    const template = "default-src 'self'; worker-src 'self' blob: data:;";
    for (const isProd of [false, true]) {
      const content = `${template}${cspUpgradeInsecureRequests(isProd)}`;
      expect(content.trimEnd().endsWith(';')).toBe(true);
      const directives = content
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean);
      // 没有因为拼接多出空指令，也没有丢指令
      expect(directives).toHaveLength(isProd ? 3 : 2);
    }
  });
});
