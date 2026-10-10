import type { ConfigType, Dayjs, ManipulateType } from 'dayjs';

import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime.js';
import timezone from 'dayjs/plugin/timezone.js';
import utc from 'dayjs/plugin/utc.js';

// Node ESM 要求写全扩展名：dayjs 没有 exports map，
// 'dayjs/plugin/relativeTime' 这种写法在 vitest（Vite 解析）下能过，裸 Node 消费 dist 时会 ERR_MODULE_NOT_FOUND。
import 'dayjs/locale/zh-cn.js';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(relativeTime);

dayjs.tz.setDefault('Asia/Shanghai');

const dateUtil = dayjs;

/** 与后端约定的几个固定口径，散写在业务里的格式串迟早会互相漂移 */
const DATE_FORMATS = {
  date: 'YYYY-MM-DD',
  dateTime: 'YYYY-MM-DD HH:mm:ss',
  fileStamp: 'YYYYMMDD_HHmmss',
  month: 'YYYY-MM',
  time: 'HH:mm:ss',
  year: 'YYYY',
} as const;

type DateFormatKey = keyof typeof DATE_FORMATS;

function format(value: ConfigType, key: DateFormatKey): string {
  const instance = dateUtil(value);
  return instance.isValid() ? instance.format(DATE_FORMATS[key]) : '';
}

/** 生成文件名用的时间戳：不能含冒号与横杠，Windows 与 shell 都会抱怨 */
function formatDate(value: ConfigType): string {
  return format(value, 'date');
}

function formatDateTime(value: ConfigType): string {
  return format(value, 'dateTime');
}

function fileStamp(value: ConfigType = new Date()): string {
  return format(value, 'fileStamp');
}

function isValidDate(value: ConfigType): boolean {
  return dateUtil(value).isValid();
}

function isSameDay(a: ConfigType, b: ConfigType): boolean {
  return dateUtil(a).isSame(dateUtil(b), 'day');
}

/** 带符号：b - a。负数表示 b 在 a 之前，调用方不必自己判断先后 */
function daysBetween(a: ConfigType, b: ConfigType): number {
  return dateUtil(b).startOf('day').diff(dateUtil(a).startOf('day'), 'day');
}

/** 中文相对时间；不改全局 locale，避免影响其他包的英文格式化 */
function fromNow(value: ConfigType): string {
  return dateUtil(value).locale('zh-cn').fromNow();
}

/**
 * 最近 N 个单位的区间（查询表单、日志范围常用）。
 * offset 取绝对值：调用方传 -7 的意图就是"往前 7 天"，不该产出 end 早于 start 的区间。
 */
function rangeOf(
  unit: ManipulateType,
  offset: number,
  formatKey: DateFormatKey = 'date',
): { end: string; start: string } {
  const end = dateUtil();
  const start = end.subtract(Math.abs(offset), unit);
  return {
    end: end.format(DATE_FORMATS[formatKey]),
    start: start.format(DATE_FORMATS[formatKey]),
  };
}

/** 快捷构造，替代满屏的 `dayjs(x)` 裸调用 */
function $(value?: ConfigType): Dayjs {
  return dateUtil(value);
}

export {
  $,
  DATE_FORMATS,
  dateUtil,
  daysBetween,
  fileStamp,
  formatDate,
  formatDateTime,
  fromNow,
  isSameDay,
  isValidDate,
  rangeOf,
};

export type { DateFormatKey };
