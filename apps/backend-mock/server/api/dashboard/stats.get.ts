import { faker } from '@faker-js/faker'
import { success } from '../../utils/response'
import { defineMockRoute } from '../../utils/runtime'

export default defineMockRoute({
  handler() {
    return success({
      totalUsers: faker.number.int({ min: 1000, max: 10000 }),
      activeUsers: faker.number.int({ min: 100, max: 1000 }),
      totalOrders: faker.number.int({ min: 500, max: 5000 }),
      revenue: faker.number.float({ min: 10000, max: 100000, fractionDigits: 2 }),
      chartData: Array.from({ length: 7 }, () => ({
        date: faker.date.recent({ days: 7 }).toISOString().split('T')[0]!,
        value: faker.number.int({ min: 100, max: 1000 }),
      })),
    }, '获取仪表盘数据成功')
  },
  method: 'GET',
  path: '/dashboard/stats',
})
