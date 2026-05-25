import type { MockContext } from '../../index'
import { defineMock } from '../../index'
import { faker } from '@faker-js/faker'

function generateUser() {
  return {
    id: faker.string.uuid(),
    username: faker.internet.username(),
    email: faker.internet.email(),
    phone: faker.phone.number(),
    avatar: faker.image.avatar(),
    status: faker.helpers.arrayElement(['active', 'inactive']),
    createdAt: faker.date.past().toISOString(),
    updatedAt: faker.date.recent().toISOString(),
  }
}

export default defineMock({
  '[GET]/users'({ query }: MockContext) {
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10
    const total = 100

    const list = Array.from({ length: pageSize }, () => generateUser())

    return {
      code: 200,
      data: {
        list,
        total,
        page,
        pageSize,
      },
      message: '获取用户列表成功',
    }
  },

  '[GET]/users/:id'() {
    return {
      code: 200,
      data: generateUser(),
      message: '获取用户详情成功',
    }
  },

  '[POST]/users'() {
    return {
      code: 200,
      data: generateUser(),
      message: '创建用户成功',
    }
  },

  '[PUT]/users/:id'() {
    return {
      code: 200,
      data: generateUser(),
      message: '更新用户成功',
    }
  },

  '[DELETE]/users/:id'() {
    return {
      code: 200,
      data: null,
      message: '删除用户成功',
    }
  },
})