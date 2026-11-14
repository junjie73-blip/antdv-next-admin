/**
 * 数值/日期展示格式化：纯函数，`core/` 层。
 *
 * 分层位置：只依赖 dayjs，不依赖 vue / DOM / 任何 UI 包。
 * 报表最容易在数字上翻车，所以这里的口径全部写成显式规则并被 `format.test.ts` 穷举：
 *
 * - **空值统一给占位符 `—`**（`null` / `undefined` / 空串 / `NaN` / `Infinity` / 解析失败的字符串）。
 *   不给 `0`：`0` 是一个业务事实（今天真的没卖出去），`—` 是"这里没数"，两者混起来会直接读错结论。
 * - **小数位默认口径**：`number` / `percent` / `compact` / `bytes` 未指定 `decimals` 时
 *   最多 2 位（compact/bytes 为 1 位）并**去掉尾随 0**；`currency` 固定 2 位（金额不留"看起来少一位"的歧义）。
 * - **舍入走 `toFixed`**：即 IEEE 双精度下的就近舍入，与 JS 生态一致；
 *   不做"银行家舍入"，否则导出与页面显示会出现 0.005 这类边界差一位。
 * - 负数一律用前导 `-`（币种符号在负号之后：`-¥1,234.00`），不用括号记账法。
 *
 * 不做的事：不做本地化（千分位恒为 `,`、小数点恒为 `.`）、不做条件着色、不读宿主时区。
 */

import type { FieldMeta, FormatSpec, ResultColumn } from './types';

import dayjs from 'dayjs';

/** 空值 / 不可解析值的占位符 */
export const NULL_PLACEHOLDER = '—';
/** `kind: 'date'` 的缺省模板 */
export const DATE_DEFAULT_PATTERN = 'YYYY-MM-DD';

/** 只放最常用的币种；没命中时把币种码本身当符号前置，宿主加新币种不必改本包 */
const CURRENCY_SYMBOLS: Record<string, string> = {
  CNY: '¥',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  USD: '$',
};

const SHORT_UNITS: Array<[number, string]> = [
  [1e12, 'T'],
  [1e9, 'B'],
  [1e6, 'M'],
  [1e3, 'K'],
];

const CN_UNITS: Array<[number, string]> = [
  [1e12, '万亿'],
  [1e8, '亿'],
  [1e4, '万'],
];

const BYTE_UNITS = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

/**
 * 数值解释口径来自 `core/number.ts`：格式化与聚合必须认同一批"这算一个数"的单元格，
 * 否则会出现格式化成 `—` 的值却参与过求和的对不上账。
 */
import { toNumberValue as toNumber } from './number';

function groupDigits(integral: string): string {
  return integral.replaceAll(/\B(?=(\d{3})+(?!\d))/gu, ',');
}

/**
 * 定点格式化。`decimals === undefined` 时按"最多 2 位并去尾零"。
 * 返回不含符号的绝对值部分，负号由调用方补，好让币种符号的位置只有一处决定。
 */
function fixedPositive(
  abs: number,
  decimals: number | undefined,
  fallback: number,
): string {
  const places = decimals ?? fallback;
  const text = abs.toFixed(places);
  if (decimals === undefined) {
    const [int = '0', decimal] = text.split('.');
    const trimmedDecimal = decimal?.replace(/0+$/u, '') ?? '';
    return trimmedDecimal
      ? `${groupDigits(int)}.${trimmedDecimal}`
      : groupDigits(int);
  }
  const [int = '0', decimal] = text.split('.');
  return decimal ? `${groupDigits(int)}.${decimal}` : groupDigits(int);
}

function withAffixes(text: string, spec?: FormatSpec): string {
  const suffix = spec?.suffix ?? '';
  const unit = spec?.unit ? ` ${spec.unit}` : '';
  return `${text}${suffix}${unit}`;
}

function formatDate(value: unknown, spec?: FormatSpec): string {
  if (value === null || value === undefined || value === '')
    return NULL_PLACEHOLDER;
  // 数字按 epoch 毫秒解释（后端常直接给时间戳），其余交给 dayjs 解析 ISO / 常见日期串
  const parsed = dayjs(value as dayjs.ConfigType);
  if (!parsed.isValid()) return NULL_PLACEHOLDER;
  return parsed.format(spec?.pattern ?? DATE_DEFAULT_PATTERN);
}

/** 落到某个档位：`0.9995 * div` 的容差避免 `999_950 → 1000K` 这种进位后跨档的显示 */
function pickUnit(
  abs: number,
  units: Array<[number, string]>,
): [number, string] | undefined {
  for (const [div, unit] of units) {
    if (abs >= div * 0.9995) return [div, unit];
  }
  return undefined;
}

function formatDuration(ms: number): string {
  const sign = ms < 0 ? '-' : '';
  const n = Math.abs(ms);
  if (n < 1000) return `${sign}${Math.round(n)}ms`;
  if (n < 60_000) return `${sign}${fixedPositive(n / 1000, undefined, 1)}s`;
  if (n < 3_600_000) {
    const minutes = Math.floor(n / 60_000);
    const seconds = Math.round((n % 60_000) / 1000);
    // 秒四舍五入到 60 时进位，避免出现 `1m 60s`
    if (seconds === 60) return `${sign}${minutes + 1}m 0s`;
    return seconds === 0
      ? `${sign}${minutes}m`
      : `${sign}${minutes}m ${seconds}s`;
  }
  const hours = Math.floor(n / 3_600_000);
  const minutes = Math.round((n % 3_600_000) / 60_000);
  if (minutes === 60) return `${sign}${hours + 1}h 0m`;
  return minutes === 0 ? `${sign}${hours}h` : `${sign}${hours}h ${minutes}m`;
}

/**
 * 按格式说明渲染一个单元格。
 *
 * `spec` 缺省等价于 `{ kind: 'number' }`：报表里"忘了配格式"的列绝大多数是数值，
 * 给千分位比给裸 `String(value)` 更接近可用。文本请显式写 `{ kind: 'text' }`。
 */
export function formatValue(value: unknown, spec?: FormatSpec): string {
  const kind = spec?.kind ?? 'number';

  if (kind === 'text') {
    if (value === null || value === undefined || value === '')
      return NULL_PLACEHOLDER;
    return withAffixes(String(value), spec);
  }
  if (kind === 'date') return withAffixes(formatDate(value, spec), spec);

  const numeric = toNumber(value);
  if (numeric === null) return NULL_PLACEHOLDER;
  const sign = numeric < 0 ? '-' : '';
  const abs = Math.abs(numeric);

  switch (kind) {
    case 'bytes': {
      // 字节恒用 1024 进制：报表里出现的都是存储/流量口径，混用 1000 会和既有对账单对不上
      let unitIndex = 0;
      let scaled = abs;
      while (scaled >= 1024 && unitIndex < BYTE_UNITS.length - 1) {
        scaled /= 1024;
        unitIndex += 1;
      }
      const unit = BYTE_UNITS[unitIndex]!;
      return unitIndex === 0
        ? withAffixes(`${sign}${groupDigits(scaled.toFixed(0))}${unit}`, spec)
        : withAffixes(
            `${sign}${fixedPositive(scaled, spec?.decimals, 1)}${unit}`,
            spec,
          );
    }
    case 'compact': {
      const units = spec?.scale === 'cn' ? CN_UNITS : SHORT_UNITS;
      const hit = pickUnit(abs, units);
      if (!hit)
        return withAffixes(
          `${sign}${fixedPositive(abs, spec?.decimals, 2)}`,
          spec,
        );
      const [div, unit] = hit;
      return withAffixes(
        `${sign}${fixedPositive(abs / div, spec?.decimals, 1)}${unit}`,
        spec,
      );
    }
    case 'currency': {
      // 命中词表用符号；没命中时把币种码大写后当前缀（ISO 4217 恒为大写），宿主加币种不必改本包
      const symbol = spec?.currency
        ? (CURRENCY_SYMBOLS[spec.currency.toUpperCase()] ??
          spec.currency.toUpperCase())
        : '';
      return withAffixes(
        `${sign}${symbol}${fixedPositive(abs, spec?.decimals ?? 2, 2)}`,
        spec,
      );
    }
    case 'duration': {
      return withAffixes(formatDuration(numeric), spec);
    }
    case 'percent': {
      return withAffixes(
        `${sign}${fixedPositive(abs * 100, spec?.decimals, 2)}%`,
        spec,
      );
    }
    default: {
      return withAffixes(
        `${sign}${fixedPositive(abs, spec?.decimals, 2)}`,
        spec,
      );
    }
  }
}

/**
 * 列格式化：优先用列格式，回退到字段格式？都不配时维度列按 `text` 走、度量列按数值走。
 * 维度列必须回落到 text，否则纯文本维度会被数值口径画成 `—`（`—` 表示"没数"，不是"不是数"）。
 */
export function formatCell(column: ResultColumn, value: unknown): string {
  const format =
    column.format ??
    (column.kind === 'dimension' ? { kind: 'text' as const } : undefined);
  return formatValue(value, format);
}

/** 字段级格式化：设计器预览与 KPI 卡用 */
export function formatField(
  meta: FieldMeta | undefined,
  value: unknown,
): string {
  return formatValue(value, meta?.format);
}
