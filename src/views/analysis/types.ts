/** 时间范围 */
export type TimeRange = 'today' | '7d' | '30d'

/** KPI 项 */
export interface KpiItem {
  title: string
  value: string | number
  trend: number
  trendLabel: string
  icon: string
  color: 'blue' | 'emerald' | 'violet' | 'amber' | string
}

/** 活动趋势数据 */
export interface ActivityTrendData {
  categories: string[]
  pv: number[]
  uv: number[]
  apiCalls: number[]
}

/** 资源使用数据 */
export interface ResourceUsageData {
  indicators: Array<{ name: string; max: number }>
  current: number[]
  peak: number[]
}

/** 错误率趋势数据 */
export interface ErrorRateData {
  hours: string[]
  errorRates: number[]
  errors4xx: number[]
  errors5xx: number[]
}

/** 模块排行项 */
export interface ModuleRankItem {
  name: string
  value: number
}

/** 用户行为漏斗阶段 */
export interface JourneyStage {
  name: string
  value: number
}
