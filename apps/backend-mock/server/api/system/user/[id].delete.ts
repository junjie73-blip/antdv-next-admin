import { bizError, success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { USER_DB } from '../../../utils/db/user'

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id)
    const idx = USER_DB.findIndex(u => u.id === id)

    if (idx === -1) {
      return bizError(404, '用户不存在')
    }

    USER_DB.splice(idx, 1)

    return success(null, '删除用户成功')
  },
  method: 'DELETE',
  path: '/system/user/:id',
})
