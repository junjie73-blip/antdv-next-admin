import { faker } from '@faker-js/faker'
import { defineMock } from 'vite-plugin-mock-dev-server'

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

export default defineMock([
  {
    url: '/api/users',
    method: 'GET',
    body: ({ query }) => {
      const page = Number(query.page) || 1
      const pageSize = Number(query.pageSize) || 10
      const total = 100

      const list = Array.from({ length: pageSize }, () => generateUser())

      return {
        code: 200,
        message: 'success',
        data: {
          list,
          total,
          page,
          pageSize,
        },
      }
    },
  },
  {
    url: '/api/users/:id',
    method: 'GET',
    body: ({ _params }) => {
      return {
        code: 200,
        message: 'success',
        data: generateUser(),
      }
    },
  },
  {
    url: '/api/users',
    method: 'POST',
    body: () => {
      return {
        code: 200,
        message: 'success',
        data: generateUser(),
      }
    },
  },
  {
    url: '/api/users/:id',
    method: 'PUT',
    body: () => {
      return {
        code: 200,
        message: 'success',
        data: generateUser(),
      }
    },
  },
  {
    url: '/api/users/:id',
    method: 'DELETE',
    body: () => {
      return {
        code: 200,
        message: 'success',
        data: null,
      }
    },
  },
])
