import dayjs from 'dayjs';

/**
 * 时间口径的唯一出处。
 *
 * 分层位置：`utils/`，只依赖 dayjs。
 * 单独成文件的理由：会话列表要"今天 HH:mm / 03-05"，消息流要"今天 / 昨天 / 03月05日"，
 * 两处各写一遍就会漂移（常见事故：列表显示 03-05、分隔条显示 3 月 5 日，用户以为不是同一天）。
 *
 * 这一层不做什么：不做时区换算（按浏览器本地，与 dayjs 默认一致）、不做相对时间（"3 分钟前"）。
 * 相对时间看着轻巧，实际要让界面每分钟重算一次，收益不抵成本。
 */

/** 会话列表右侧的时间：今年之内不写年份，跨年才补 */
export function formatListTime(value: number | string): string {
  const time = dayjs(value);
  if (!time.isValid()) return '';
  const today = dayjs();
  if (time.isSame(today, 'day')) return time.format('HH:mm');
  // 同一自然年用 `MM-DD`；跨年必须带年份，否则列表里会出现"去年的 03-05 看起来像上周"
  if (time.isSame(today, 'year')) return time.format('MM-DD');
  return time.format('YYYY-MM-DD');
}

/** 消息气泡角落的时钟：只到分钟 —— IM 里秒级时间戳没有阅读价值，只会让气泡抖 */
export function formatClock(value: number | string): string {
  const time = dayjs(value);
  return time.isValid() ? time.format('HH:mm') : '';
}

/** 消息流的日期分隔条文案 */
export function formatDayDivider(value: number | string): string {
  const time = dayjs(value);
  if (!time.isValid()) return '';
  const today = dayjs();
  if (time.isSame(today, 'day')) return '今天';
  if (time.isSame(today.subtract(1, 'day'), 'day')) return '昨天';
  if (time.isSame(today, 'year')) return time.format('MM月DD日');
  return time.format('YYYY年MM月DD日');
}

/** 分隔条的比较键：同一天连续消息只出一个分隔条 */
export function dayKey(value: number | string): string {
  return dayjs(value).format('YYYY-MM-DD');
}
