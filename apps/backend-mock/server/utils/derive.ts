/**
 * 派生统计工具：把「从持久化记录聚合」这件事收敛到一处。
 *
 * 所有统计接口都只读取真实记录并按固定日期轴聚合，不再在请求里造随机数。
 * 日期轴以内置数据基准为准（确定性，跨重启一致）。
 */

/** 与 builtin-data 的固定基准保持一致 */
export const DATA_BASE_DATE = '2026-11-01';

/** 生成截止基准日的最近 n 天日期（YYYY-MM-DD），升序 */
export function lastNDays(n: number): string[] {
  const base = Date.parse(`${DATA_BASE_DATE}T00:00:00.000Z`);
  return Array.from(
    { length: n },
    (_, i) => new Date(base - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10)!,
  );
}

/** 按日期统计记录数；values 接受 'YYYY-MM-DD ...' 或 ISO 时间串 */
export function countByDay(days: string[], values: string[]): number[] {
  const counter = new Map<string, number>();
  for (const value of values) {
    const day = value.slice(0, 10);
    counter.set(day, (counter.get(day) ?? 0) + 1);
  }
  return days.map((day) => counter.get(day) ?? 0);
}

/** 分值夹到 0-100 的整数 */
export function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}
