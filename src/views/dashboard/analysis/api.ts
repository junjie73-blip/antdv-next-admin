import { http } from '~/composables'

/* ============================================================
 * 类型
 * ============================================================ */
export interface KpiItem {
  title: string
  value: string | number
  trend: number
  trendLabel: string
  icon: string
  color: string
}

export interface ActivityTrendData {
  categories: string[]
  pv: number[]
  uv: number[]
  apiCalls: number[]
}

export interface TrafficDistribution {
  name: string
  value: number
}

export interface SystemHealth {
  /** 0-100 健康度评分 */
  health: number
}

export interface ResourceUsageData {
  indicators: Array<{ name: string; max: number }>
  current: number[]
  peak: number[]
}

export interface ErrorRateData {
  hours: string[]
  errorRates: number[]
  errors4xx: number[]
  errors5xx: number[]
}

export interface JourneyStage {
  name: string
  value: number
}

export interface ModuleRankItem {
  name: string
  value: number
}

/* ============================================================
 * 接口（与后端 OpenAPI 一一对应）
 * ============================================================ */
export function getAnalysisKpi(): Promise<KpiItem[]> {
  return http.get<KpiItem[]>('/dashboard/kpi').then((r) => r?.data ?? r ?? [])
}

export function getAnalysisActivityTrend(range: 'today' | '7d' | '30d' = '7d'): Promise<ActivityTrendData> {
  return http
    .get<ActivityTrendData>('/dashboard/activity-trend', { range })
    .then((r) => r?.data ?? r ?? { categories: [], pv: [], uv: [], apiCalls: [] })
}

export function getAnalysisTrafficDistribution(): Promise<TrafficDistribution[]> {
  return http.get<TrafficDistribution[]>('/dashboard/traffic-distribution').then((r) => r?.data ?? r ?? [])
}

export function getAnalysisSystemHealth(): Promise<SystemHealth> {
  return http.get<SystemHealth>('/dashboard/system-health').then((r) => r?.data ?? r ?? { health: 0 })
}

export function getAnalysisResourceUsage(): Promise<ResourceUsageData> {
  return http
    .get<ResourceUsageData>('/dashboard/resource-usage')
    .then((r) => r?.data ?? r ?? { indicators: [], current: [], peak: [] })
}

export function getAnalysisErrorRate(): Promise<ErrorRateData> {
  return http
    .get<ErrorRateData>('/dashboard/error-rate')
    .then((r) => r?.data ?? r ?? { hours: [], errorRates: [], errors4xx: [], errors5xx: [] })
}

export function getAnalysisUserJourney(): Promise<JourneyStage[]> {
  return http.get<JourneyStage[]>('/dashboard/user-journey').then((r) => r?.data ?? r ?? [])
}

export function getAnalysisModuleRank(): Promise<ModuleRankItem[]> {
  return http.get<ModuleRankItem[]>('/dashboard/module-rank').then((r) => r?.data ?? r ?? [])
}

export const analysisApi = {
  getKpi: getAnalysisKpi,
  getActivityTrend: getAnalysisActivityTrend,
  getTrafficDistribution: getAnalysisTrafficDistribution,
  getSystemHealth: getAnalysisSystemHealth,
  getResourceUsage: getAnalysisResourceUsage,
  getErrorRate: getAnalysisErrorRate,
  getUserJourney: getAnalysisUserJourney,
  getModuleRank: getAnalysisModuleRank,
} as const
