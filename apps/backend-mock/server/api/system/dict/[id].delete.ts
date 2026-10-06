import { bizError, success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { DICT_TYPE_DB } from '../../../utils/db/dict'

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id)
    const idx = DICT_TYPE_DB.findIndex(d => d.id === id)

    if (idx === -1) {
      return bizError(404, '字典类型不存在')
    }

    DICT_TYPE_DB.splice(idx, 1)

    return success(null, '删除字典类型成功')
  },
  method: 'DELETE',
  path: '/system/dict/:id',
})
