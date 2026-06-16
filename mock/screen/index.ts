import { defineMock } from '@alova/mock'
import { faker } from '@faker-js/faker/locale/zh_CN'

faker.seed(100)

export default defineMock({
  '[GET]/screen/monitor': () => ({
    code: 200,
    message: 'success',
    data: {
      overview: {
      onlineUsers: faker.number.int({ min: 80, max: 300 }),
      todayVisits: faker.number.int({ min: 2000, max: 8000 }),
      totalRequests: faker.number.int({ min: 50000, max: 200000 }),
      alertCount: faker.number.int({ min: 0, max: 8 }),
      cpuUsage: faker.number.float({ min: 20, max: 75, fractionDigits: 1 }),
      memUsage: faker.number.float({ min: 40, max: 85, fractionDigits: 1 }),
      diskUsage: faker.number.float({ min: 30, max: 70, fractionDigits: 1 }),
      networkIn: faker.number.float({ min: 10, max: 200, fractionDigits: 1 }),
      networkOut: faker.number.float({ min: 5, max: 150, fractionDigits: 1 }),
    },
    trend: Array.from({ length: 24 }, (_, i) => ({
      time: `${String(i).padStart(2, '0')}:00`,
      pv: faker.number.int({ min: 200, max: 1500 }),
      uv: faker.number.int({ min: 50, max: 400 }),
      requests: faker.number.int({ min: 1000, max: 8000 }),
    })),
    regions: [
      { name: '北京', value: 3200, users: 85 },
      { name: '上海', value: 2800, users: 72 },
      { name: '广州', value: 1800, users: 45 },
      { name: '深圳', value: 2200, users: 58 },
      { name: '杭州', value: 1400, users: 36 },
      { name: '成都', value: 1100, users: 28 },
      { name: '武汉', value: 900, users: 22 },
      { name: '南京', value: 800, users: 20 },
      { name: '其他', value: 3500, users: 90 },
    ],
    services: [
      { name: 'API 网关', status: 'healthy', uptime: '99.9%' },
      { name: '用户服务', status: 'healthy', uptime: '99.8%' },
      { name: '订单服务', status: 'warning', uptime: '98.5%' },
      { name: '支付服务', status: 'healthy', uptime: '99.95%' },
      { name: '消息队列', status: 'healthy', uptime: '99.7%' },
      { name: '缓存服务', status: 'down', uptime: '-' },
    ],
    alerts: Array.from({ length: 6 }, (_, i) => ({
      level: (['critical', 'high', 'medium', 'low'] as const)[i % 4],
      message: [
        '检测到来自 47.96.12.33 的异常登录尝试',
        '服务器 CPU 使用率超过阈值(78%)',
        '数据库连接池接近上限(92%)',
        'SSL 证书将在 15 天后过期',
        '新版本 v2.3.1 可用于更新',
        '定时备份任务执行成功',
      ][i],
      time: faker.date.recent({ days: 0.1 }).toLocaleTimeString('zh-CN'),
    })),
    },
  }),
})
