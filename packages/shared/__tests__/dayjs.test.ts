import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dayjs,
  formatTz,
  getTimezone,
  nowTz,
  parseTz,
  setTimezone,
} from '../src/dayjs';

describe('时区默认值', () => {
  it('初始为 Asia/Shanghai', () => {
    expect(getTimezone()).toBe('Asia/Shanghai');
  });
});

describe('setTimezone', () => {
  afterEach(() => {
    setTimezone('Asia/Shanghai');
  });

  it('空值不改变当前时区', () => {
    setTimezone('');
    expect(getTimezone()).toBe('Asia/Shanghai');
  });

  it('切换后格式化随之时区化', () => {
    const utcInstant = Date.UTC(2026, 0, 1, 16, 30, 0);
    // UTC+8 已经跨天
    expect(formatTz(utcInstant, 'YYYY-MM-DD HH:mm')).toBe('2026-01-02 00:30');

    setTimezone('UTC');
    expect(getTimezone()).toBe('UTC');
    expect(formatTz(utcInstant, 'YYYY-MM-DD HH:mm')).toBe('2026-01-01 16:30');

    setTimezone('America/New_York');
    expect(formatTz(utcInstant, 'YYYY-MM-DD HH:mm')).toBe('2026-01-01 11:30');
  });
});

describe('formatTz', () => {
  it('空值返回空串，不做无意义解析', () => {
    expect(formatTz(null)).toBe('');
    expect(formatTz(undefined)).toBe('');
    expect(formatTz('')).toBe('');
  });

  it('支持 Date / 字符串 / 数字 / Dayjs', () => {
    const expected = '2026-01-01 08:30';
    const ms = Date.UTC(2026, 0, 1, 0, 30);
    expect(formatTz(new Date(ms), 'YYYY-MM-DD HH:mm')).toBe(expected);
    expect(formatTz(ms, 'YYYY-MM-DD HH:mm')).toBe(expected);
    expect(formatTz('2026-01-01T00:30:00.000Z', 'YYYY-MM-DD HH:mm')).toBe(
      expected,
    );
    expect(formatTz(dayjs(ms), 'YYYY-MM-DD HH:mm')).toBe(expected);
  });

  it('默认格式为日期时间', () => {
    expect(formatTz(Date.UTC(2026, 0, 1, 0, 30))).toBe('2026-01-01 08:30:00');
  });

  it('带 Z / 偏移量的字符串按瞬时换算，裸时间按目标时区墙上时间理解', () => {
    // 后端两种写法语义完全不同，必须区分处理
    expect(formatTz('2026-01-01T00:30:00Z', 'YYYY-MM-DD HH:mm')).toBe(
      '2026-01-01 08:30',
    );
    expect(formatTz('2026-01-01T00:30:00+08:00', 'YYYY-MM-DD HH:mm')).toBe(
      '2026-01-01 00:30',
    );
    expect(formatTz('2026-01-01 00:30:00', 'YYYY-MM-DD HH:mm')).toBe(
      '2026-01-01 00:30',
    );

    // 切到 UTC：瞬时口径与墙上口径都收敛到同一个值
    setTimezone('UTC');
    expect(formatTz('2026-01-01T00:30:00Z', 'YYYY-MM-DD HH:mm')).toBe(
      '2026-01-01 00:30',
    );
    expect(formatTz('2026-01-01 00:30:00', 'YYYY-MM-DD HH:mm')).toBe(
      '2026-01-01 00:30',
    );
    setTimezone('Asia/Shanghai');
  });
});

describe('nowTz / parseTz', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(Date.UTC(2026, 0, 1, 0, 30, 0)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('nowTz 返回当前时区的 Dayjs', () => {
    const now = nowTz();
    expect(dayjs.isDayjs(now)).toBe(true);
    expect(now.format('YYYY-MM-DD HH:mm')).toBe('2026-01-01 08:30');
  });

  it('parseTz 按当前时区解析字符串', () => {
    const parsed = parseTz('2026-01-01 08:30', 'YYYY-MM-DD HH:mm');
    expect(parsed.toISOString()).toBe('2026-01-01T00:30:00.000Z');
  });

  it('parseTz 不带格式时走默认解析', () => {
    const parsed = parseTz('2026-01-01T00:30:00.000Z');
    expect(parsed.format('YYYY-MM-DD HH:mm')).toBe('2026-01-01 08:30');
  });
});

describe('插件可用性', () => {
  it('相对时间、duration、周/季度、同/区间比较都已注册', () => {
    expect(dayjs('2026-01-01').from('2026-01-05')).toContain('天');
    expect(dayjs.duration(2, 'hours').asMinutes()).toBe(120);
    expect(dayjs('2026-01-01').quarter()).toBe(1);
    expect(dayjs('2026-01-01').week()).toBeGreaterThan(0);
    expect(dayjs('2026-01-02').isSameOrAfter('2026-01-01')).toBe(true);
    expect(dayjs('2026-01-02').isBetween('2026-01-01', '2026-01-03')).toBe(true);
  });

  it('中文 locale 生效', () => {
    expect(dayjs('2026-01-01').format('dddd')).toBe('星期四');
  });
});
