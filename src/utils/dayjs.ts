import dayjs from 'dayjs'
import 'dayjs/locale/zh-cn'
import advancedFormat from 'dayjs/plugin/advancedFormat'
import customParseFormat from 'dayjs/plugin/customParseFormat'
import duration from 'dayjs/plugin/duration'
import isBetween from 'dayjs/plugin/isBetween'
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter'
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore'
import localizedFormat from 'dayjs/plugin/localizedFormat'
import quarterOfYear from 'dayjs/plugin/quarterOfYear'
import relativeTime from 'dayjs/plugin/relativeTime'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import weekOfYear from 'dayjs/plugin/weekOfYear'

/* ============================================================
 * 加载插件
 * ============================================================ */

dayjs.extend(utc)
dayjs.extend(timezone)
dayjs.extend(relativeTime)
dayjs.extend(localizedFormat)
dayjs.extend(customParseFormat)
dayjs.extend(advancedFormat)
dayjs.extend(duration)
dayjs.extend(isSameOrAfter)
dayjs.extend(isSameOrBefore)
dayjs.extend(isBetween)
dayjs.extend(quarterOfYear)
dayjs.extend(weekOfYear)

/* ============================================================
 * 全局配置
 * ============================================================ */

dayjs.locale('zh-cn')

/** 默认时区 */
const DEFAULT_TIMEZONE = 'Asia/Shanghai'

/**
 * 当前生效的时区
 * 用模块级变量保存，避免每次读取 store
 */
let currentTimezone = DEFAULT_TIMEZONE

/* ============================================================
 * 对外 API
 * ============================================================ */

/** 获取当前时区 */
export function getTimezone(): string {
  return currentTimezone
}

/**
 * 设置全局时区
 * 会同时修改 dayjs.tz 默认值 + 通过 setDefault 影响 dayjs() 默认行为
 */
export function setTimezone(timezone: string): void {
  if (!timezone) return
  currentTimezone = timezone
  dayjs.tz.setDefault(timezone)
}

/**
 * 全局格式化：自动应用当前时区
 *
 *   formatTz(new Date())              → "2024-09-23 15:30:00"
 *   formatTz(new Date(), "YYYY-MM-DD") → "2024-09-23"
 */
export function formatTz(
  value: string | number | Date | dayjs.Dayjs | null | undefined,
  format = 'YYYY-MM-DD HH:mm:ss',
): string {
  if (value === null || value === undefined || value === '') return ''
  return dayjs.tz(value, currentTimezone).format(format)
}

/**
 * 当前时区下的"现在"
 */
export function nowTz(): dayjs.Dayjs {
  return dayjs.tz(new Date(), currentTimezone)
}

/**
 * 解析为指定时区的时间
 */
export function parseTz(value: string | number | Date, format?: string): dayjs.Dayjs {
  if (format) {
    return dayjs.tz(value, format, currentTimezone)
  }
  return dayjs.tz(value, currentTimezone)
}

/* ============================================================
 * 初始化：应用默认时区
 * ============================================================ */

dayjs.tz.setDefault(DEFAULT_TIMEZONE)

export { dayjs }
export default dayjs
