import { bizError, success } from '../../utils/response'
import { defineMockRoute } from '../../utils/runtime'

export default defineMockRoute({
  handler({ data }) {
    const username = typeof data.username === 'string' ? data.username : ''
    const password = typeof data.password === 'string' ? data.password : ''

    if (username !== 'admin' || password !== 'admin123') {
      return bizError(400, '用户名或密码错误')
    }

    return success({
      user: {
        id: '1',
        username: 'admin',
        nickname: '管理员',
        avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
        email: 'admin@antdv-next.com',
        phone: '138-0000-0001',
        token: `mock_token_${Date.now()}`,
        role: 'admin',
        permissions: ['*'],
        roles: ['admin'],
      },
    }, '登录成功')
  },
  method: 'POST',
  path: '/auth/login',
})
