import { bizError, success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { OPER_LOG_DB } from '../../../utils/db/log'

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id)
    const idx = OPER_LOG_DB.findIndex(l => l.id === id)

    if (idx === -1) {
      return bizError(404, '日志记录不存在')
    }

    OPER_LOG_DB.splice(idx, 1)

    return success(null, '删除日志成功')
  },
  method: 'DELETE',
  path: '/system/log/:id',
})
