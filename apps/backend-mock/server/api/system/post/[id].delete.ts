import { bizError, success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { POST_DB } from '../../../utils/db/post'

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id)
    const idx = POST_DB.findIndex(p => p.id === id)

    if (idx === -1) {
      return bizError(404, '岗位不存在')
    }

    POST_DB.splice(idx, 1)

    return success(null, '删除岗位成功')
  },
  method: 'DELETE',
  path: '/system/post/:id',
})
