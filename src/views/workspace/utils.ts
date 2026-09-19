import dayjs from "dayjs";

import { getTimeGreeting } from "~/utils";

export const greeting = getTimeGreeting();

/** 副标题文案：随时间变化 */
export function getSubGreeting(): string {
  const h = dayjs().hour();
  if (h < 6) return "夜深了，注意休息";
  if (h < 9) return "新的一天，从一杯咖啡开始";
  if (h < 12) return "上午好，愿你事事顺遂";
  if (h < 14) return "午后时光，别忘了小憩片刻";
  if (h < 18) return "下午好，继续加油";
  if (h < 22) return "晚上好，今天辛苦了";
  return "夜深了，早些休息";
}

export function getTodayLabel(): string {
  return dayjs().format("YYYY年MM月DD日");
}

export function getWeekLabel(): string {
  const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return week[dayjs().day()]!;
}

export function formatLogTime(time: string): string {
  return dayjs(time).format("MM-DD HH:mm:ss");
}
