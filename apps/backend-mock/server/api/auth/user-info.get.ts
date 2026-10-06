import { success } from '../../utils/response'
import { defineMockRoute } from '../../utils/runtime'

export default defineMockRoute({
  handler: () => success({
    user: {
      id: '1',
      username: 'admin',
      role: 'admin',
      permissions: ['*'],
      roles: ['admin'],
    },
  }, '获取用户信息成功'),
  method: 'GET',
  path: '/auth/user-info',
})
