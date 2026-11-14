import type {
  FieldMeta,
  FormatSpec,
  ResultColumn,
} from '../../src/report/core/types';

import { describe, expect, it } from 'vitest';

import {
  DATE_DEFAULT_PATTERN,
  formatCell,
  formatField,
  formatValue,
  NULL_PLACEHOLDER,
} from '../../src/report/core/format';

/**
 * 格式化是"报表对不对"的第一现场，这里把每种 kind 的默认小数位、负号位置、空值占位都钉死。
 * 断言全部是最终字符串，不用 toMatch 蒙过去 —— 差一个千分位就是线上事故。
 */

function fmt(value: unknown, spec?: FormatSpec): string {
  return formatValue(value, spec);
}

describe('空值与脏值', () => {
  it('null / undefined / 空串 / NaN / Infinity 一律给占位符，不给 0', () => {
    for (const value of [
      null,
      undefined,
      '',
      Number.NaN,
      Infinity,
      -Infinity,
    ]) {
      expect(fmt(value)).toBe(NULL_PLACEHOLDER);
      expect(fmt(value, { decimals: 2, kind: 'currency' })).toBe(
        NULL_PLACEHOLDER,
      );
    }
    expect(NULL_PLACEHOLDER).toBe('—');
  });

  it('不可解析的文本给占位符；带千分位 / 货币符号 / 百分号的文本能读回数值', () => {
    expect(fmt('N/A')).toBe(NULL_PLACEHOLDER);
    expect(fmt('-')).toBe(NULL_PLACEHOLDER);
    expect(fmt('待定')).toBe(NULL_PLACEHOLDER);
    expect(fmt('1¥2')).toBe(NULL_PLACEHOLDER);
    expect(fmt('1,234.5')).toBe('1,234.5');
    expect(fmt('¥1,234.50')).toBe('1,234.5');
    expect(fmt('-¥1,234.50')).toBe('-1,234.5');
    // 百分号按比率读数（与 percent 列的输出对偶）：'12.5%' 就是 0.125
    expect(fmt('12.5%')).toBe('0.13');
    expect(fmt('12.5%', { kind: 'percent' })).toBe('12.5%');
  });

  it('布尔与日期不是数值：忘配格式时日期列显示 —，提醒去补 kind: date', () => {
    expect(fmt(true)).toBe(NULL_PLACEHOLDER);
    expect(fmt(false)).toBe(NULL_PLACEHOLDER);
    expect(fmt(new Date(2026, 0, 1))).toBe(NULL_PLACEHOLDER);
  });

  it('text kind 下 0 / false 是真值，只有空值才给占位符', () => {
    expect(fmt(0, { kind: 'text' })).toBe('0');
    expect(fmt(false, { kind: 'text' })).toBe('false');
    expect(fmt('', { kind: 'text' })).toBe(NULL_PLACEHOLDER);
  });
});

describe('number 默认口径', () => {
  it('缺省等价于 kind: number：给千分位、最多 2 位、去尾零', () => {
    expect(fmt(1_234_567)).toBe('1,234,567');
    expect(fmt(1234.567)).toBe('1,234.57');
    expect(fmt(1234.5)).toBe('1,234.5');
    expect(fmt(1234.5, { decimals: 3, kind: 'number' })).toBe('1,234.500');
    expect(fmt(1234.5, { decimals: 0, kind: 'number' })).toBe('1,235');
    expect(fmt(-0.5)).toBe('-0.5');
    expect(fmt(0)).toBe('0');
  });

  it('suffix 紧贴数字，unit 前有空格', () => {
    expect(fmt(12, { kind: 'number', suffix: '件' })).toBe('12件');
    expect(fmt(12, { kind: 'number', unit: '元' })).toBe('12 元');
    expect(
      fmt(12, { decimals: 1, kind: 'number', suffix: '%', unit: '同比' }),
    ).toBe('12.0% 同比');
  });
});

describe('currency', () => {
  it('固定 2 位小数，币种符号在数字前、负号在符号前', () => {
    expect(fmt(1234.5, { currency: 'CNY', kind: 'currency' })).toBe(
      '¥1,234.50',
    );
    expect(fmt(-1234.5, { currency: 'CNY', kind: 'currency' })).toBe(
      '-¥1,234.50',
    );
    expect(fmt(1, { currency: 'USD', kind: 'currency' })).toBe('$1.00');
    expect(fmt(1, { currency: 'EUR', kind: 'currency' })).toBe('€1.00');
    expect(fmt(1, { currency: 'GBP', kind: 'currency' })).toBe('£1.00');
    // 没收录的币种直接把币种码当符号，宿主加币种不必改本包
    expect(fmt(1, { currency: 'hkd', kind: 'currency' })).toBe('HKD1.00');
    expect(fmt(1, { decimals: 0, kind: 'currency' })).toBe('1');
    // 不指定币种时只格式化数字
    expect(fmt(1234.5, { kind: 'currency' })).toBe('1,234.50');
  });
});

describe('percent', () => {
  it('传入的是比率（0.1234 → 12.34%），默认最多 2 位并去尾零', () => {
    expect(fmt(0.1234, { kind: 'percent' })).toBe('12.34%');
    expect(fmt(0.5, { kind: 'percent' })).toBe('50%');
    expect(fmt(0, { kind: 'percent' })).toBe('0%');
    expect(fmt(1, { kind: 'percent' })).toBe('100%');
    expect(fmt(-0.1234, { decimals: 1, kind: 'percent' })).toBe('-12.3%');
    expect(fmt(0.12345, { decimals: 4, kind: 'percent' })).toBe('12.3450%');
  });
});

describe('compact 计数单位', () => {
  it('short 走 K/M/B/T，默认 1 位小数并去尾零', () => {
    expect(fmt(999, { kind: 'compact' })).toBe('999');
    expect(fmt(1234, { kind: 'compact' })).toBe('1.2K');
    expect(fmt(1_500_000, { kind: 'compact' })).toBe('1.5M');
    expect(fmt(2_000_000_000, { kind: 'compact' })).toBe('2B');
    expect(fmt(-1234, { kind: 'compact' })).toBe('-1.2K');
    // 0.9995 容差：只要进位后会显示成 1000K，就提前跨档到 M，用户看不到 1000K 这种四位数
    expect(fmt(999_499, { kind: 'compact' })).toBe('999.5K');
    expect(fmt(999_500, { kind: 'compact' })).toBe('1M');
    expect(fmt(1_000_000, { kind: 'compact' })).toBe('1M');
  });

  it('cn 走 万/亿/万亿，跨档容差与 short 同一条规则', () => {
    expect(fmt(9994, { kind: 'compact', scale: 'cn' })).toBe('9,994');
    expect(fmt(9999, { kind: 'compact', scale: 'cn' })).toBe('1万');
    expect(fmt(12_345, { kind: 'compact', scale: 'cn' })).toBe('1.2万');
    expect(fmt(123_456_789, { kind: 'compact', scale: 'cn' })).toBe('1.2亿');
    expect(fmt(1_500_000_000_000, { kind: 'compact', scale: 'cn' })).toBe(
      '1.5万亿',
    );
    expect(fmt(12_345, { decimals: 2, kind: 'compact', scale: 'cn' })).toBe(
      '1.23万',
    );
  });
});

describe('bytes', () => {
  it('恒按 1024 进制，B 档不留小数', () => {
    expect(fmt(999, { kind: 'bytes' })).toBe('999B');
    expect(fmt(1024, { kind: 'bytes' })).toBe('1KB');
    expect(fmt(1536, { kind: 'bytes' })).toBe('1.5KB');
    expect(fmt(1024 ** 2, { kind: 'bytes' })).toBe('1MB');
    expect(fmt(1024 ** 3, { kind: 'bytes' })).toBe('1GB');
    expect(fmt(-1536, { kind: 'bytes' })).toBe('-1.5KB');
    expect(fmt(1024 ** 4, { decimals: 2, kind: 'bytes' })).toBe('1.00TB');
  });
});

describe('duration', () => {
  it('输入是毫秒，按量级换单位，秒/分进位不留 60', () => {
    expect(fmt(0, { kind: 'duration' })).toBe('0ms');
    expect(fmt(999, { kind: 'duration' })).toBe('999ms');
    expect(fmt(1500, { kind: 'duration' })).toBe('1.5s');
    expect(fmt(65_000, { kind: 'duration' })).toBe('1m 5s');
    expect(fmt(120_000, { kind: 'duration' })).toBe('2m');
    expect(fmt(119_999, { kind: 'duration' })).toBe('2m 0s');
    expect(fmt(3_600_000, { kind: 'duration' })).toBe('1h');
    expect(fmt(3_661_000, { kind: 'duration' })).toBe('1h 1m');
    expect(fmt(3_599_999, { kind: 'duration' })).toBe('60m 0s');
    expect(fmt(7_199_999, { kind: 'duration' })).toBe('2h 0m');
    expect(fmt(-1500, { kind: 'duration' })).toBe('-1.5s');
  });
});

describe('date', () => {
  it('缺省模板 YYYY-MM-DD，可被 pattern 覆盖', () => {
    expect(DATE_DEFAULT_PATTERN).toBe('YYYY-MM-DD');
    expect(fmt('2026-03-01', { kind: 'date' })).toBe('2026-03-01');
    expect(
      fmt('2026-03-01T08:30:00', { kind: 'date', pattern: 'MM-DD HH:mm' }),
    ).toBe('03-01 08:30');
    expect(fmt('2026-12-31', { kind: 'date', pattern: 'YYYY年M月' })).toBe(
      '2026年12月',
    );
  });

  it('时间戳与 Date 走本地时区解释，与 dayjs 一致', () => {
    const local = new Date(2026, 0, 1, 9, 30);
    expect(
      fmt(local.getTime(), { kind: 'date', pattern: 'YYYY-MM-DD HH:mm' }),
    ).toBe('2026-01-01 09:30');
    expect(fmt(local, { kind: 'date', pattern: 'YYYY-MM-DD HH:mm' })).toBe(
      '2026-01-01 09:30',
    );
  });

  it('非法日期串给占位符而不是 Invalid Date', () => {
    expect(fmt('不是日期', { kind: 'date' })).toBe(NULL_PLACEHOLDER);
    expect(fmt(null, { kind: 'date' })).toBe(NULL_PLACEHOLDER);
  });

  it('日期也吃 suffix / unit', () => {
    expect(
      fmt('2026-03-01', { kind: 'date', pattern: 'MM-DD', suffix: '下单' }),
    ).toBe('03-01下单');
  });
});

describe('formatCell / formatField', () => {
  const column: ResultColumn = {
    field: 'sales',
    format: { currency: 'CNY', decimals: 2, kind: 'currency' },
    key: 'sum_sales',
    kind: 'measure',
    label: '求和(销售额)',
  };

  it('列格式化用列上的 format', () => {
    expect(formatCell(column, 1234)).toBe('¥1,234.00');
    expect(formatCell({ ...column, format: undefined }, 1234)).toBe('1,234');
  });

  it('字段格式化用字段元信息里的 format，字段缺失时退化成数值口径', () => {
    const meta: FieldMeta = {
      dataType: 'number',
      format: { kind: 'percent' },
      key: 'refundRate',
      kind: 'measure',
      label: '退款率',
    };
    expect(formatField(meta, 0.0325)).toBe('3.25%');
    expect(formatField(undefined, 0.0325)).toBe('0.03');
  });
});
