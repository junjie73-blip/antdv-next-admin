import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getPersonalizedWelcome,
  getTimeGreeting,
  showLoginWelcome,
} from '../src/welcome';

/** 用本地时间构造时刻，避免 CI 时区影响小时数 */
function atLocalHour(hour: number) {
  vi.setSystemTime(new Date(2026, 0, 1, hour, 5, 0));
}

describe('按时间段的问候语', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    [5, '夜深了'],
    [6, '早上好'],
    [11, '早上好'],
    [12, '中午好'],
    [13, '中午好'],
    [14, '下午好'],
    [17, '下午好'],
    [18, '晚上好'],
    [21, '晚上好'],
    [22, '夜深了'],
    [23, '夜深了'],
    [0, '夜深了'],
  ] as const)('%i 点 → %s', (hour, expected) => {
    atLocalHour(hour);
    expect(getTimeGreeting()).toBe(expected);
  });

  it('个性化欢迎语将用户名拼在提示语前', () => {
    atLocalHour(9);
    const config = getPersonalizedWelcome('张三');
    expect(config.title).toBe('早上好');
    expect(config.message).toBe('张三，新的一天，元气满满！');
    expect(config.icon).toContain('solar:');
    expect(config.iconColor).toMatch(/^#[\da-f]{6}$/i);
  });

  it('每个时段都有完整配置', () => {
    for (const hour of [3, 8, 12, 15, 19, 23]) {
      atLocalHour(hour);
      const config = getPersonalizedWelcome('u');
      expect(config.icon).toBeTruthy();
      expect(config.title).toBeTruthy();
      expect(config.message.startsWith('u，')).toBe(true);
    }
  });
});

describe('showLoginWelcome', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    document.body.querySelectorAll('.welcome-notification').forEach((n) => n.remove());
  });

  it('渲染欢迎通知且不抛异常，用户名缺省为「朋友」', () => {
    vi.setSystemTime(new Date(2026, 0, 1, 9, 0, 0));
    expect(() => showLoginWelcome()).not.toThrow();
    expect(() => showLoginWelcome({ username: '  李四  ' })).not.toThrow();
  });

  it('透传 duration / placement / onClick', () => {
    const onClick = vi.fn();
    expect(() =>
      showLoginWelcome({ duration: 0, onClick, placement: 'topLeft', username: '王五' }),
    ).not.toThrow();
  });
});
