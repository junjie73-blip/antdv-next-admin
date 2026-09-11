/** BorderBeam 颜色映射 */
export function borderBeamColor(color: string): string {
  const map: Record<string, string> = {
    blue: "#1677ff",
    emerald: "#52c41a",
    violet: "#722ed1",
    amber: "#faad14",
  };
  return map[color] || "#1677ff";
}

/** KPI 图标容器样式 */
export function kpiIconWrap(color: string): string {
  const map: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400",
    violet: "bg-violet-50 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400",
  };
  return map[color] || map.blue!;
}
