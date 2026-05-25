import type { MockContext } from '../../index'
import { defineMock } from '../../index'
import { faker } from '@faker-js/faker'

function generateTableData() {
  return {
    id: faker.string.uuid(),
    name: faker.person.fullName(),
    age: faker.number.int({ min: 18, max: 60 }),
    address: faker.location.streetAddress(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    status: faker.helpers.arrayElement(['success', 'processing', 'error']),
    createdAt: faker.date.past().toISOString(),
  }
}

export default defineMock({
  '[GET]/table/list'({ query }: MockContext) {
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10
    const total = 100

    const list = Array.from({ length: pageSize }, () => generateTableData())

    return {
      code: 200,
      data: {
        list,
        total,
        page,
        pageSize,
      },
      message: '获取表格数据成功',
    }
  },

  '[GET]/dashboard/stats'() {
    return {
      code: 200,
      data: {
        totalUsers: faker.number.int({ min: 1000, max: 10000 }),
        activeUsers: faker.number.int({ min: 100, max: 1000 }),
        totalOrders: faker.number.int({ min: 500, max: 5000 }),
        revenue: faker.number.float({ min: 10000, max: 100000, fractionDigits: 2 }),
        chartData: Array.from({ length: 7 }, () => ({
          date: faker.date.recent({ days: 7 }).toISOString().split('T')[0],
          value: faker.number.int({ min: 100, max: 1000 }),
        })),
      },
      message: '获取仪表盘数据成功',
    }
  },
})