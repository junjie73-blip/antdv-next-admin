import { success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { ROLE_DB } from '../../../utils/db/role'

export default defineMockRoute({
  handler({ query }) {
    const keyword = query.keyword
    const status = query.status

    let filtered = [...ROLE_DB]

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      filtered = filtered.filter(
        r => r.name.toLowerCase().includes(kw) || r.code.toLowerCase().includes(kw),
      )
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter(r => r.status === Number(status))
    }

    return success({ list: filtered, total: filtered.length }, '获取角色列表成功')
  },
  method: 'GET',
  path: '/system/role/list',
})
