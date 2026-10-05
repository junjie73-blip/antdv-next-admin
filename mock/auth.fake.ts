import { defineFakeRoute } from 'vite-plugin-fake-server/client'
import { withRuntime } from './_runtime'

export default defineFakeRoute(
  withRuntime([
    {
      method: 'POST',
      url: '/auth/logout',
      response() {
        return {
          code: 200,
          data: null,
          message: '退出成功',
        }
      },
    },
    {
      method: 'GET',
      url: '/auth/user-info',
      response() {
        return {
          code: 200,
          data: {
            user: {
              id: '1',
              username: 'admin',
              role: 'admin',
              permissions: ['*'],
              roles: ['admin'],
            },
          },
          message: '获取用户信息成功',
        }
      },
    },
  ]),
)
