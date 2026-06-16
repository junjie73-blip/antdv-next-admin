import { get } from './request'

/** 大屏统计数据 */
export function getScreenMonitorData() {
  return get<{
    overview: {
      onlineUsers: number
      todayVisits: number
      totalRequests: number
      alertCount: number
      cpuUsage: number
      memUsage: number
      diskUsage: number
      networkIn: number
      networkOut: number
    }
    trend: { time: string, pv: number, uv: number, requests: number }[]
    regions: { name: string, value: number, users: number }[]
    services: { name: string, status: 'healthy' | 'warning' | 'down', uptime: string }[]
    alerts: { level: 'critical' | 'high' | 'medium' | 'low', message: string, time: string }[]
  }>('/screen/monitor')
}
