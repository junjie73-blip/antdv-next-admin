import { faker } from '@faker-js/faker'
import { success } from '../../utils/response'
import { defineMockRoute } from '../../utils/runtime'

/**
 * 表格演示数据：legacy 用未固定种子的默认（英文）faker 实例，
 * 每次请求随机生成 pageSize 行，因此这里同样不做 seed、不做缓存。
 */
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

export default defineMockRoute({
  handler({ query }) {
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10
    const total = 100

    const list = Array.from({ length: pageSize }, () => generateTableData())

    return success({ list, page, pageSize, total }, '获取表格数据成功')
  },
  method: 'GET',
  path: '/table/list',
})
