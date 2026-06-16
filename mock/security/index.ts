import { defineMock } from '@alova/mock'
import { faker } from '@faker-js/faker/locale/zh_CN'

faker.seed(42)

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

type SecurityEventLevel = 'critical' | 'high' | 'medium' | 'low'
type SecurityEventType = 'login_anomaly' | 'permission_change' | 'sensitive_operation' | 'attack_attempt'
type SecurityEventStatus = 'pending' | 'handled' | 'dismissed'

interface SecurityEvent {
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

interface AlertItem {
  id: string
  level: SecurityEventLevel
  message: string
  source: string
  timestamp: string
  actions: string[]
}

function generateEvents(count: number): SecurityEvent[] {
  return Array.from({ length: count }, (_, i) => {
    const type = eventTypes[i % eventTypes.length]!
    const level = levels[i % levels.length]!
    const titles = eventTitles[type]!
    return {
      id: `evt-${faker.string.uuid()}`,
      type,
      level,
      title: titles[i % titles.length],
      description: faker.lorem.sentence(),
      sourceIp: `${faker.number.int({ min: 1, max: 255 })}.${faker.number.int({ min: 0, max: 255 })}.${faker.number.int({ min: 0, max: 255 })}.${faker.number.int({ min: 1, max: 254 })}`,
      location: locations[i % locations.length],
      createdAt: faker.date.recent().toISOString(),
      status: (i % 3 === 0 ? 'pending' : 'handled') as SecurityEventStatus,
    }
  })
}

function generateAlerts(count: number): AlertItem[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `alert-${faker.string.uuid()}`,
    level: levels[i % levels.length]!,
    message: alertMessages[i % alertMessages.length],
    source: `192.168.${faker.number.int({ min: 1, max: 254 })}.${faker.number.int({ min: 1, max: 254 })}`,
    timestamp: faker.date.recent({ days: 0.5 }).toISOString(),
    actions: i < 2 ? ['封禁IP', '强制下线'] : ['查看详情', '忽略'],
  }))
}

export default defineMock({
  // 安全评分
  '[GET]/security/score': () => ({
    code: 200,
    data: {
      totalScore: faker.number.int({ min: 72, max: 95 }),
      dimensions: [
        { name: '身份认证', score: faker.number.int({ min: 80, max: 98 }), status: 'excellent' },
        { name: '数据安全', score: faker.number.int({ min: 65, max: 90 }), status: 'good' },
        { name: '访问控制', score: faker.number.int({ min: 70, max: 95 }), status: 'good' },
        { name: '审计合规', score: faker.number.int({ min: 55, max: 85 }), status: 'warning' },
      ],
      trend: Array.from({ length: 30 }, (_, i) => ({
        date: `${i + 1}日`,
        score: faker.number.int({ min: 70, max: 95 }),
      })),
    },
    message: 'ok',
  }),

  // 安全事件列表
  '[GET]/security/events/list': (query) => {
    const page = Number(query.page || 1)
    const pageSize = Number(query.pageSize || 10)
    const allEvents = generateEvents(56)
    const start = (page - 1) * pageSize
    return {
      code: 200,
      data: {
        list: allEvents.slice(start, start + pageSize),
        total: allEvents.length,
      },
      message: 'ok',
    }
  },

  // 安全统计
  '[GET]/security/stats': () => ({
    code: 200,
    data: {
      threatDistribution: [
        { name: 'XSS攻击', value: faker.number.int({ min: 20, max: 80 }) },
        { name: 'SQL注入', value: faker.number.int({ min: 10, max: 50 }) },
        { name: 'CSRF攻击', value: faker.number.int({ min: 15, max: 60 }) },
        { name: '暴力破解', value: faker.number.int({ min: 30, max: 90 }) },
        { name: '扫描探测', value: faker.number.int({ min: 40, max: 100 }) },
      ],
      attackSources: [
        { region: '北京', value: faker.number.int({ min: 100, max: 500 }) },
        { region: '上海', value: faker.number.int({ min: 80, max: 400 }) },
        { region: '广州', value: faker.number.int({ min: 50, max: 300 }) },
        { region: '深圳', value: faker.number.int({ min: 60, max: 350 }) },
        { region: '杭州', value: faker.number.int({ min: 40, max: 200 }) },
        { region: '成都', value: faker.number.int({ min: 30, max: 180 }) },
        { region: '海外', value: faker.number.int({ min: 200, max: 800 }) },
      ],
      dailyEvents: Array.from({ length: 14 }, (_, i) => ({
        date: faker.date.recent(14 - i).toLocaleDateString('zh-CN'),
        count: faker.number.int({ min: 5, max: 50 }),
      })),
      responseTime: Array.from({ length: 14 }, (_, i) => ({
        date: faker.date.recent(14 - i).toLocaleDateString('zh-CN'),
        avgMs: faker.number.int({ min: 50, max: 500 }),
      })),
    },
    message: 'ok',
  }),

  // 告警列表
  '[GET]/security/alerts/list': () => ({
    code: 200,
    data: {
      list: generateAlerts(8),
      total: 8,
    },
    message: 'ok',
  }),

  // 处置告警
  '[POST]/security/alerts/*/handle': () => ({ code: 200, data: { success: true, message: '处置成功' }, message: '处置成功' }),
})
