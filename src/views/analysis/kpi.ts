/** BorderBeam 颜色映射 */
export function borderBeamColor(color: string): string {
  const map: Record<string, string> = {
    blue: '#1677ff',
    emerald: '#52c41a',
    violet: '#722ed1',
    amber: '#faad14',
  }
  return map[color] || '#1677ff'
}

/** KPI 图标容器样式 */
export function kpiIconWrap(color: string): string {
  const map: Record<string, string> = {
    blue: 'bg-blue-50 text-ant-primary dark:bg-blue-500/15 dark:text-blue-400',
    green: 'bg-emerald-50 text-emerald-500 dark:bg-emerald-500/15 dark:text-emerald-400',
    purple: 'bg-violet-50 text-violet-500 dark:bg-violet-500/15 dark:text-violet-400',
    orange: 'bg-amber-50 text-amber-500 dark:bg-amber-500/15 dark:text-amber-400',
    red: 'bg-rose-50 text-rose-500 dark:bg-rose-500/15 dark:text-rose-400',
    cyan: 'bg-cyan-50 text-cyan-500 dark:bg-cyan-500/15 dark:text-cyan-400',
  }
  return map[color] || map.blue!
}
