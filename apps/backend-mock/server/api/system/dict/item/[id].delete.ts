import { bizError, success } from '../../../../utils/response'
import { defineMockRoute } from '../../../../utils/runtime'
import { DICT_TYPE_DB } from '../../../../utils/db/dict'

export default defineMockRoute({
  handler({ params }) {
    const id = Number(params.id)

    for (const dictType of DICT_TYPE_DB) {
      const itemIdx = dictType.items.findIndex(i => i.id === id)
      if (itemIdx !== -1) {
        dictType.items.splice(itemIdx, 1)
        return success(null, '删除字典项成功')
      }
    }

    return bizError(404, '字典项不存在')
  },
  method: 'DELETE',
  path: '/system/dict/item/:id',
})
