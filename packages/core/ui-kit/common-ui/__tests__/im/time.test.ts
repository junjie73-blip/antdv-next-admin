import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  dayKey,
  formatClock,
  formatDayDivider,
  formatListTime,
} from '../../src/im/index';

/**
 * 测试口径：**用例必须在任何时区里都绿**，所以所有时间戳都用本地 `new Date(y, m, d, h, mi)` 造，
 * 再把 `dayjs()` 的"现在"钉在同一天的本地中午（`vi.setSystemTime`）。
 *
 * 为什么值得单独一个文件：`utils/time.ts` 是"今天 / 昨天 / 03月05日"这套文案的唯一出处。
 * 会话列表和消息分隔条一旦各写各的，用户会看到列表显示 03-05、气泡上面显示 3 月 5 日，
 * 然后怀疑自己记错了日子 —— 这类漂移没有报错，只能靠断言钉。
 */

/** "现在"：2026-03-05 12:34:56（本地），故意避开整点，防止有人按 00:00 心算 */
const NOW = new Date(2026, 2, 5, 12, 34, 56);

/** 本地时间戳：不用 ISO 字符串，免得 UTC 与本地两种解释把"今天"变成"昨天" */
function at(
  year: number,
  month: number,
  day: number,
  hour = 9,
  minute = 5,
): number {
  return new Date(year, month, day, hour, minute).getTime();
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe('会话列表右侧的时间', () => {
  it('同一天只显示到分钟：一天里"几月几号"没有信息量，却要占掉标题的宽度', () => {
    expect(formatListTime(at(2026, 2, 5, 9, 7))).toBe('09:07');
    // 当天 23 点也算今天，`isSame(day)` 是按自然日而不是按 24 小时内
    expect(formatListTime(at(2026, 2, 5, 23, 59))).toBe('23:59');
    expect(formatListTime(at(2026, 2, 5, 0, 1))).toBe('00:01');
  });

  it('今年之内更早的日子显示 MM-DD，跨年必须带年份：否则去年的 03-05 会被读成上周', () => {
    expect(formatListTime(at(2026, 1, 20, 8, 0))).toBe('02-20');
    expect(formatListTime(at(2026, 2, 4, 22, 0))).toBe('03-04');
    expect(formatListTime(at(2025, 11, 30, 10, 0))).toBe('2025-12-30');
    // 未来几天同样按"今年"处理：宿主给错时间戳时界面不该出现空串
    expect(formatListTime(at(2026, 2, 6, 10, 0))).toBe('03-06');
  });

  it('空值与非法值给空串而不是 "Invalid Date"：会话没有 lastMessageAt 时列表要能正常画', () => {
    // `ConversationList` 传的就是 `lastMessageAt ?? ''`，这一支必须落在同一个口径上
    expect(formatListTime('')).toBe('');
    expect(formatListTime(Number.NaN)).toBe('');
    expect(formatListTime('不是日期')).toBe('');
  });
});

describe('气泡角落的时钟', () => {
  it('只到分钟：带秒的话每条气泡都在自己抖，而 IM 里秒级时间没有阅读价值', () => {
    expect(formatClock(at(2026, 2, 5, 9, 7))).toBe('09:07');
    expect(formatClock(at(2025, 0, 1, 23, 58))).toBe('23:58');
    expect(formatClock(Number.NaN)).toBe('');
  });

  it('同一时刻在列表与气泡里写法一致：两处分别格式化就会漂', () => {
    const value = at(2026, 2, 5, 14, 20);
    expect(formatListTime(value)).toBe(formatClock(value));
  });
});

describe('消息流的分隔条', () => {
  it('今天 / 昨天 / 今年内 / 跨年四档各给一种文案：分隔条的作用是"这条是几天前的"', () => {
    expect(formatDayDivider(at(2026, 2, 5, 8, 0))).toBe('今天');
    expect(formatDayDivider(at(2026, 2, 4, 23, 0))).toBe('昨天');
    expect(formatDayDivider(at(2026, 2, 1, 9, 0))).toBe('03月01日');
    expect(formatDayDivider(at(2025, 2, 3, 9, 0))).toBe('2025年03月03日');
  });

  it('跨月与跨年边界上"昨天"仍然是昨天：只比日号的话 3 月 1 日的昨天会变成 2 月 1 日', () => {
    vi.setSystemTime(new Date(2026, 2, 1, 0, 30));
    expect(formatDayDivider(at(2026, 1, 28, 22, 0))).toBe('昨天');
    vi.setSystemTime(new Date(2026, 0, 1, 8, 0));
    expect(formatDayDivider(at(2025, 11, 31, 23, 59))).toBe('昨天');
  });

  it('非法值给空串：分隔条没有文案时宁可不显示，也不要写出 Invalid Date', () => {
    expect(formatDayDivider('不是日期')).toBe('');
    expect(formatDayDivider('')).toBe('');
  });

  it('dayKey 同一天不同分钟是同一个键、跨天必不同：分隔条多一条少一条都是看得见的 bug', () => {
    expect(dayKey(at(2026, 2, 5, 0, 1))).toBe(dayKey(at(2026, 2, 5, 23, 59)));
    expect(dayKey(at(2026, 2, 5, 23, 59))).not.toBe(
      dayKey(at(2026, 2, 6, 0, 1)),
    );
    // 23:59 与次日 00:01 必须切成两条：这正好是"两条消息只差两分钟却分属两天"的那种深夜对话
    expect(dayKey(at(2025, 11, 31, 23, 59))).toBe('2025-12-31');
  });

  it('分隔条文案与分组键用的是同一个"日"：否则文案说今天、分组却是昨天', () => {
    const morning = at(2026, 2, 4, 7, 0);
    const night = at(2026, 2, 4, 22, 0);
    expect(dayKey(morning)).toBe(dayKey(night));
    expect(formatDayDivider(morning)).toBe(formatDayDivider(night));
  });
});
