import { success } from '../../utils/response'
import { defineMockRoute } from '../../utils/runtime'

export default defineMockRoute({
  handler: () => success(null, '退出成功'),
  method: 'POST',
  path: '/auth/logout',
})
