import { get, post } from './request'

// ======================== 安全评分 ========================

/** 安全评分概览 */
export function getSecurityScore() {
  return get<{
    totalScore: number
    dimensions: {
      name: string
      score: number
      status: 'excellent' | 'good' | 'warning' | 'critical'
    }[]
    trend: { date: string, score: number }[]
  }>('/security/score')
}

// ======================== 安全事件 ========================

/** 安全事件列表（分页） */
export function getSecurityEvents(params?: Record<string, unknown>) {
  return get<{
    list: SecurityEvent[]
    total: number
  }>('/security/events/list', params)
}

// ======================== 安全统计 ========================

/** 安全统计概览（图表数据） */
export function getSecurityStats() {
  return get<{
    threatDistribution: { name: string, value: number }[]
    attackSources: { region: string, value: number }[]
    dailyEvents: { date: string, count: number }[]
    responseTime: { date: string, avgMs: number }[]
  }>('/security/stats')
}

// ======================== 实时告警 ========================

/** 告警列表 */
export function getAlertList(params?: Record<string, unknown>) {
  return get<{ list: AlertItem[], total: number }>('/security/alerts/list', params)
}

/** 处置告警 */
export function handleAlert(alertId: string, action: string) {
  return post<void>(`/security/alerts/${alertId}/handle`, { action })
}

// ======================== 接口类型 ========================

/** 安全事件级别 */
export type SecurityEventLevel = 'critical' | 'high' | 'medium' | 'low'

/** 安全事件类型 */
export type SecurityEventType = 'login_anomaly' | 'permission_change' | 'sensitive_operation' | 'attack_attempt'

/** 安全事件状态 */
export type SecurityEventStatus = 'pending' | 'handled' | 'dismissed'

/** 安全事件记录 */
export interface SecurityEvent {
  id: string
  type: SecurityEventType
  level: SecurityEventLevel
  title: string
  description: string
  sourceIp: string
  location: string
  createdAt: string
  status: SecurityEventStatus
}

/** 告警项 */
export interface AlertItem {
  id: string
  level: SecurityEventLevel
  message: string
  source: string
  timestamp: string
  actions: string[]
}
