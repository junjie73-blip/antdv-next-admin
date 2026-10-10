import { describe, expect, it } from 'vitest';

import {
  buildIframeSandbox,
  canEscapeSandbox,
  DEFAULT_SANDBOX_FLAGS,
  SANDBOX_FLAGS,
} from '../src/iframe';

/**
 * 这些断言守护的是"默认策略必须不给同源身份"。
 *
 * 起因是全站巡检里的一条浏览器告警：
 * "An iframe which has both allow-scripts and allow-same-origin for its sandbox
 * attribute can escape its sandboxing." —— 本站的微前端预览过去硬编码了这一串，
 * 而且演示模式把子应用映射到**本站自己的页面**，等于让框架里的脚本能爬到顶层读 token。
 */
describe('buildIframeSandbox', () => {
  it('默认允许脚本但没有同源身份：不构成逃逸组合', () => {
    const sandbox = buildIframeSandbox();
    expect(sandbox).toContain('allow-scripts');
    expect(sandbox).not.toContain('allow-same-origin');
    expect(canEscapeSandbox(sandbox)).toBe(false);
    // 默认集合逐项对得上，避免以后悄悄多给一个能力
    expect(sandbox.split(' ')).toEqual([...DEFAULT_SANDBOX_FLAGS]);
  });

  it('显式打开 sameOrigin 才出现该标志，并被识别为逃逸组合', () => {
    const sandbox = buildIframeSandbox({ sameOrigin: true });
    expect(sandbox).toContain('allow-same-origin');
    expect(canEscapeSandbox(sandbox)).toBe(true);
  });

  it('传 false 能收回默认给的能力', () => {
    expect(buildIframeSandbox({ forms: false, popups: false })).toBe(
      'allow-presentation allow-scripts',
    );
  });

  it('关掉脚本后即使保留同源也不再是逃逸组合', () => {
    const sandbox = buildIframeSandbox({ sameOrigin: true, scripts: false });
    expect(sandbox).toContain('allow-same-origin');
    expect(sandbox).not.toContain('allow-scripts');
    expect(canEscapeSandbox(sandbox)).toBe(false);
  });

  it('输出顺序稳定：同一配置换种写法得到同一字符串', () => {
    const a = buildIframeSandbox({ downloads: true, modals: true, sameOrigin: true });
    const b = buildIframeSandbox({ sameOrigin: true, modals: true, downloads: true });
    expect(a).toBe(b);
    // 规范内的关键字一律按 SANDBOX_FLAGS 的次序输出
    const ranks = a.split(' ').map((t) => SANDBOX_FLAGS.indexOf(t as never));
    expect(ranks).toEqual([...ranks].sort((x, y) => x - y));
  });

  it('extra 只接受 allow- 开头的关键字，且不重复', () => {
    const sandbox = buildIframeSandbox({
      extra: ['allow-pointer-lock', 'pointer-lock', '', 'allow-modals'],
    });
    expect(sandbox).toContain('allow-pointer-lock');
    expect(sandbox).toContain('allow-modals');
    expect(sandbox.match(/allow-modals/g)).toHaveLength(1);
    // 非法值不会混进去
    expect(sandbox.split(' ')).not.toContain('pointer-lock');
  });

  it('把默认能力全关掉得到空串：sandbox="" 是最严格而非不限制', () => {
    const sandbox = buildIframeSandbox({
      downloads: false,
      forms: false,
      popups: false,
      presentation: false,
      sameOrigin: false,
      scripts: false,
    });
    expect(sandbox).toBe('');
  });

  it('拼错的键不当能力用：不会多出任何标志', () => {
    const typo = buildIframeSandbox({ sameOrigon: true } as never);
    expect(typo).not.toContain('allow-same-origin');
    expect(typo).toBe(buildIframeSandbox());
  });
});

describe('canEscapeSandbox', () => {
  it('按空白分隔解析，容忍多余空格', () => {
    expect(canEscapeSandbox('allow-scripts   allow-same-origin')).toBe(true);
    expect(canEscapeSandbox('  allow-same-origin')).toBe(false);
    expect(canEscapeSandbox('')).toBe(false);
  });

  it('allow-top-navigation 不属于源隔离问题，不算逃逸', () => {
    expect(canEscapeSandbox('allow-scripts allow-top-navigation')).toBe(false);
  });
});
