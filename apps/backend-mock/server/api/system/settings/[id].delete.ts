import { bizError, success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { SETTINGS_DB } from '../../../utils/db/settings'

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id)
    const idx = SETTINGS_DB.findIndex(s => s.id === id)

    if (idx === -1) {
      return bizError(404, '配置项不存在')
    }

    SETTINGS_DB.splice(idx, 1)

    return success(null, '删除配置成功')
  },
  method: 'DELETE',
  path: '/system/settings/:id',
})
