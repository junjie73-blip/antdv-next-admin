/**
 * 安全中心数据生成器（legacy mock/security.fake.ts 的数据层）
 *
 * 与持久化内存库不同：legacy 每次请求都重新调用 generateEvents / generateAlerts，
 * 所以这里也只导出纯函数，不缓存结果；模块加载时定种（42）以复刻 legacy 的取值序列。
 */

import { faker } from '@faker-js/faker/locale/zh_CN'

faker.seed(42)

export type SecurityEventLevel = 'critical' | 'high' | 'low' | 'medium'
export type SecurityEventStatus = 'dismissed' | 'handled' | 'pending'
export type SecurityEventType = 'attack_attempt' | 'login_anomaly' | 'permission_change' | 'sensitive_operation'

export interface SecurityEvent {
  createdAt: string
  description: string
  id: string
  level: SecurityEventLevel
  location: string
  sourceIp: string
  status: SecurityEventStatus
  title: string
  type: SecurityEventType
}

export interface AlertItem {
  actions: string[]
  id: string
  level: SecurityEventLevel
  message: string
  source: string
  timestamp: string
}

const eventTypes: SecurityEventType[] = ['login_anomaly', 'permission_change', 'sensitive_operation', 'attack_attempt']
const eventTitles: Record<SecurityEventType, string[]> = {
  login_anomaly: ['异地登录检测', '频繁登录失败', '异常时间登录', '可疑设备登录'],
  permission_change: ['管理员权限变更', '角色分配变更', '菜单权限修改', 'API权限调整'],
  sensitive_operation: ['批量数据导出', '敏感配置修改', '用户密码重置', '数据库备份操作'],
  attack_attempt: ['XSS攻击尝试', 'SQL注入检测', 'CSRF攻击拦截', '暴力破解检测'],
}
const levels: SecurityEventLevel[] = ['critical', 'high', 'medium', 'low']
const locations = ['北京', '上海', '广州', '深圳', '杭州', '成都', '武汉', '南京']
const alertMessages = [
  '检测到来自异常IP的多次登录失败',
  '管理员账号权限被修改',
  '检测到敏感数据批量导出操作',
  '发现XSS攻击尝试已被拦截',
  '新设备首次登录需要验证',
  'API调用频率超过阈值',
  '发现未授权的配置文件访问',
  '检测到可能的CSRF攻击',
]

export function generateEvents(count: number): SecurityEvent[] {
  return Array.from({ length: count }, (_, i) => {
    const type = eventTypes[i % eventTypes.length]!
    const level = levels[i % levels.length]!
    const titles = eventTitles[type]
    return {
      id: `evt-${faker.string.uuid()}`,
      type,
      level,
      title: titles[i % titles.length]!,
      description: faker.lorem.sentence(),
      sourceIp: `${faker.number.int({ min: 1, max: 255 })}.${faker.number.int({ min: 0, max: 255 })}.${faker.number.int({ min: 0, max: 255 })}.${faker.number.int({ min: 1, max: 254 })}`,
      location: locations[i % locations.length]!,
      createdAt: faker.date.recent().toISOString(),
      status: (i % 3 === 0 ? 'pending' : 'handled') as SecurityEventStatus,
    }
  })
}

export function generateAlerts(count: number): AlertItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `alert-${faker.string.uuid()}`,
    level: levels[i % levels.length]!,
    message: alertMessages[i % alertMessages.length]!,
    source: `192.168.${faker.number.int({ min: 1, max: 254 })}.${faker.number.int({ min: 1, max: 254 })}`,
    timestamp: faker.date.recent({ days: 0.5 }).toISOString(),
    actions: i < 2 ? ['封禁IP', '强制下线'] : ['查看详情', '忽略'],
  }))
}
