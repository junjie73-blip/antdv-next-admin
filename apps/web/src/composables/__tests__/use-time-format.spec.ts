import { describe, expect, it } from 'vitest';

import { formatByTimeFormat } from '../use-time-format';

/** 固定 UTC 时刻；默认时区 Asia/Shanghai，对应本地 10:30 */
const ISO = '2026-11-25T02:30:00.000Z';

describe('可配置时间格式', () => {
  it('预设格式按当前时区渲染，不再下发原始 ISO 串', () => {
    expect(formatByTimeFormat(ISO, 'YYYY-MM-DD HH:mm:ss')).toBe(
      '2026-11-25 10:30:00',
    );
    expect(formatByTimeFormat(ISO, 'YYYY/MM/DD HH:mm')).toBe(
      '2026/11/25 10:30',
    );
    expect(formatByTimeFormat(ISO, 'MM-DD HH:mm')).toBe('11-25 10:30');
  });

  it('自定义规则生效，空规则回落到默认格式', () => {
    expect(formatByTimeFormat(ISO, 'custom', 'YYYY年M月D日 HH点mm分')).toBe(
      '2026年11月25日 10点30分',
    );
    expect(formatByTimeFormat(ISO, 'custom', '  ')).toBe('2026-11-25 10:30:00');
  });

  it('相对时间与原始 ISO 两个特殊值各自生效', () => {
    expect(formatByTimeFormat(ISO, 'iso')).toBe(ISO);
    expect(formatByTimeFormat('2020-01-01T00:00:00.000Z', 'relative')).toMatch(
      /前$|刚刚/u,
    );
  });

  it('空值与非法时间不抛错：空值占位，非法原样回显便于排查', () => {
    expect(formatByTimeFormat('', 'YYYY-MM-DD')).toBe('—');
    expect(formatByTimeFormat(null, 'YYYY-MM-DD')).toBe('—');
    expect(formatByTimeFormat('not-a-date', 'YYYY-MM-DD')).toBe('not-a-date');
  });
});
