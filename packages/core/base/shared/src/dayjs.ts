import dayjs from 'dayjs';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import duration from 'dayjs/plugin/duration';
import isBetween from 'dayjs/plugin/isBetween';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import quarterOfYear from 'dayjs/plugin/quarterOfYear';
import relativeTime from 'dayjs/plugin/relativeTime';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import weekOfYear from 'dayjs/plugin/weekOfYear';

import 'dayjs/locale/zh-cn';

/* ============================================================
 * 加载插件
 * ============================================================ */

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);
dayjs.extend(localizedFormat);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);
dayjs.extend(duration);
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);
dayjs.extend(isBetween);
dayjs.extend(quarterOfYear);
dayjs.extend(weekOfYear);

/* ============================================================
 * 全局配置
 * ============================================================ */

dayjs.locale('zh-cn');

/** 默认时区 */
const DEFAULT_TIMEZONE = 'Asia/Shanghai';

/**
 * 当前生效的时区
 * 用模块级变量保存，避免每次读取 store
 */
let currentTimezone = DEFAULT_TIMEZONE;

/* ============================================================
 * 对外 API
 * ============================================================ */

/** 获取当前时区 */
export function getTimezone(): string {
  return currentTimezone;
}

/**
 * 设置全局时区
 * 会同时修改 dayjs.tz 默认值 + 通过 setDefault 影响 dayjs() 默认行为
 */
export function setTimezone(timezone: string): void {
  if (!timezone) return;
  currentTimezone = timezone;
  dayjs.tz.setDefault(timezone);
}

/**
 * 带显式时区标记的 ISO 字符串（结尾的 `Z` 或 `±hh:mm`）
 *
 * `dayjs.tz('2026-01-01T00:30:00Z', 'Asia/Shanghai')` 会把 `00:30` 当作目标时区的
 * 墙上时间，于是 UTC 时刻被当成东八区时刻，结果差 8 小时。这类字符串必须先还原成
 * 瞬时，再换算到目标时区；而后端下发的 `'2026-01-01 08:30:00'` 这类「无时区裸时间」
 * 恰恰相反，要按目标时区的墙上时间理解，所以只对匹配到的情况特殊处理。
 */
const EXPLICIT_OFFSET_RE = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;

/**
 * 统一的「解析 → 目标时区」入口
 *
 * `parseFormat` 是给 dayjs 的**解析**格式（用于后端裸时间字符串），不是输出格式。
 */
function toTargetTz(
  value: Date | dayjs.Dayjs | null | number | string,
  parseFormat?: string,
): dayjs.Dayjs {
  if (
    typeof value === 'string' &&
    !parseFormat &&
    EXPLICIT_OFFSET_RE.test(value.trim())
  ) {
    return dayjs(value).tz(currentTimezone);
  }
  return parseFormat
    ? dayjs.tz(value, parseFormat, currentTimezone)
    : dayjs.tz(value, currentTimezone);
}

/**
 * 全局格式化：自动应用当前时区
 *
 *   formatTz(new Date())              → "2024-09-23 15:30:00"
 *   formatTz(new Date(), "YYYY-MM-DD") → "2024-09-23"
 */
export function formatTz(
  value: Date | dayjs.Dayjs | null | number | string | undefined,
  format = 'YYYY-MM-DD HH:mm:ss',
): string {
  if (value === null || value === undefined || value === '') return '';
  return toTargetTz(value).format(format);
}

/**
 * 当前时区下的"现在"
 */
export function nowTz(): dayjs.Dayjs {
  return dayjs.tz(new Date(), currentTimezone);
}

/**
 * 解析为指定时区的时间
 */
export function parseTz(
  value: Date | number | string,
  format?: string,
): dayjs.Dayjs {
  return toTargetTz(value, format);
}

/* ============================================================
 * 初始化：应用默认时区
 * ============================================================ */

dayjs.tz.setDefault(DEFAULT_TIMEZONE);

export { dayjs };
export default dayjs;
