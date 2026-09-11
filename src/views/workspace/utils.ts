import dayjs from "dayjs";
import { getTimeGreeting } from "@/utils";

export const greeting = getTimeGreeting();

/** 今天的日期文案，如 2026年09月11日 */
export function getTodayLabel(): string {
  return dayjs().format("YYYY年MM月DD日");
}

/** 星期文案，如 星期五 */
export function getWeekLabel(): string {
  const week = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
  return week[dayjs().day()]!;
}

/** 格式化最近操作的时间，如 09-11 14:30:42 */
export function formatLogTime(time: string): string {
  return dayjs(time).format("MM-DD HH:mm:ss");
}
