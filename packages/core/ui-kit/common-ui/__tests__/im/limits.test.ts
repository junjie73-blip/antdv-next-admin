import { describe, expect, it } from 'vitest';

import {
  DEFAULT_LIMITS,
  MESSAGE_BOTTOM_SETTLE_FRAMES,
  MESSAGE_BOTTOM_TOLERANCE_PX,
  MESSAGE_LIST_PADDING_PX,
  MESSAGE_OVERSCAN_ROWS,
  MESSAGE_ROW_ESTIMATE_PX,
  MESSAGE_ROW_GAP_PX,
  MESSAGE_VIRTUALIZE_THRESHOLD,
  withLimits,
} from '../../src/im/index';

/**
 * 限额与虚拟化的"数字契约"。
 *
 * 这些常量看着最不需要测，其实最容易漂：改一个默认值的人通常只记得改自己那处调用，
 * 而 `MessagePane` 的 gap/padding 是同时写在 Tailwind 类名和 `core/limits.ts` 里的两处，
 * 差 4px 就会出现"整表渲染与虚拟渲染切换时行距跳一下"。
 * 所以这里既钉数值，也钉它与渲染档位的关系。
 */

describe('出厂限额', () => {
  it('八个默认值逐个钉住：改动要同步文档、演示页与后端约定，偷偷改最坏', () => {
    expect(DEFAULT_LIMITS).toStrictEqual({
      accept: [],
      historyPageSize: 30,
      maxAttachmentSizeMb: 20,
      maxAttachmentsPerMessage: 4,
      maxMessageLength: 2000,
      recallWindowMs: 120_000,
      typingThrottleMs: 2000,
      typingTimeoutMs: 6000,
    });
  });

  it('撤回窗口以毫秒表达"2 分钟"，typing 超时大于节流：超时比节流短的话提示会自己闪断', () => {
    expect(DEFAULT_LIMITS.recallWindowMs).toBe(2 * 60 * 1000);
    expect(DEFAULT_LIMITS.typingTimeoutMs).toBeGreaterThan(
      DEFAULT_LIMITS.typingThrottleMs,
    );
  });
});

describe('withLimits 的合并口径', () => {
  it('缺参与部分字段都返回新对象，逐字段覆盖：一处覆盖不能改掉全局出厂值', () => {
    const merged = withLimits({ maxMessageLength: 10 });
    expect(merged).not.toBe(DEFAULT_LIMITS);
    expect(merged.maxMessageLength).toBe(10);
    expect(merged.recallWindowMs).toBe(DEFAULT_LIMITS.recallWindowMs);
    expect(withLimits(undefined)).toStrictEqual(DEFAULT_LIMITS);
    expect(withLimits({})).toStrictEqual(DEFAULT_LIMITS);
    expect(DEFAULT_LIMITS.maxMessageLength).toBe(2000);
  });

  it('返回的对象字段齐平，宿主传未知字段也不会漏：组件里全部按 resolved.limits 读', () => {
    const merged = withLimits({ accept: ['.png'], typingThrottleMs: 0 });
    expect(Object.keys(merged).sort()).toStrictEqual(
      Object.keys(DEFAULT_LIMITS).sort(),
    );
    expect(merged.accept).toStrictEqual(['.png']);
    expect(merged.typingThrottleMs).toBe(0);
  });
});

describe('虚拟化常量', () => {
  it('阈值是"超过才虚拟"而不是"到达就虚拟"：100 条以内整表渲染更快也更稳', () => {
    expect(MESSAGE_VIRTUALIZE_THRESHOLD).toBe(100);
    expect(MESSAGE_OVERSCAN_ROWS).toBe(6);
    expect(MESSAGE_ROW_ESTIMATE_PX).toBe(72);
  });

  it('行间距与上下留白与整表渲染的档位同值：`gap-3` = 12px、`py-4` = 16px，切换模式时视觉不能断档', () => {
    expect(MESSAGE_ROW_GAP_PX).toBe(12);
    expect(MESSAGE_LIST_PADDING_PX).toBe(16);
  });

  it('贴底容差与追底帧数都是正数：容差为 0 就是"差 1px 再也不跟随"的那个经典故障', () => {
    expect(MESSAGE_BOTTOM_TOLERANCE_PX).toBe(24);
    expect(MESSAGE_BOTTOM_SETTLE_FRAMES).toBe(4);
    expect(MESSAGE_BOTTOM_TOLERANCE_PX).toBeGreaterThan(0);
    expect(MESSAGE_BOTTOM_SETTLE_FRAMES).toBeGreaterThan(0);
  });
});
