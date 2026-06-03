import type { MockContext } from '../index'
import { defineMock } from '../index'

export default defineMock({
  '[POST]/auth/login'({ data }: MockContext) {
    const payload =
      typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
    const username = typeof payload.username === 'string' ? payload.username : ''
    const password = typeof payload.password === 'string' ? payload.password : ''

    if (username !== 'admin' || password !== 'admin123') {
      return {
        code: 400,
        data: null,
        message: '用户名或密码错误',
      }
    }

    return {
      code: 200,
      data: {
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
      },
      message: '登录成功',
    }
  },
})