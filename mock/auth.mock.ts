import { faker } from '@faker-js/faker'
import { defineMock } from 'vite-plugin-mock-dev-server'

export default defineMock([
  {
    url: '/api/auth/login',
    method: 'POST',
    body: () => {
      return {
        code: 200,
        message: 'success',
        data: {
          user: {
            id: faker.string.uuid(),
            username: faker.internet.username(),
            token: faker.string.alphanumeric(32),
            role: 'admin',
            permissions: ['user:view', 'user:create', 'user:edit', 'user:delete'],
            roles: ['admin'],
          },
        },
      }
    },
  },
  {
    url: '/api/auth/logout',
    method: 'POST',
    body: () => {
      return {
        code: 200,
        message: 'success',
        data: null,
      }
    },
  },
  {
    url: '/api/auth/user-info',
    method: 'GET',
    body: () => {
      return {
        code: 200,
        message: 'success',
        data: {
          user: {
            id: faker.string.uuid(),
            username: faker.internet.username(),
            role: 'admin',
            permissions: ['user:view', 'user:create', 'user:edit', 'user:delete'],
            roles: ['admin'],
          },
        },
      }
    },
  },
])
