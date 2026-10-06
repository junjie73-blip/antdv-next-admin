import { success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { POST_DB } from '../../../utils/db/post'

export default defineMockRoute({
  handler({ query }) {
    const name = query.name
    const deptId = query.deptId
    const status = query.status

    let filtered = [...POST_DB]

    if (name) {
      const kw = String(name).toLowerCase()
      filtered = filtered.filter(p => p.name.toLowerCase().includes(kw))
    }

    if (deptId !== undefined && deptId !== null && deptId !== '') {
      filtered = filtered.filter(p => p.deptId === Number(deptId))
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter(p => p.status === Number(status))
    }

    return success({ list: filtered, total: filtered.length }, '获取岗位列表成功')
  },
  method: 'GET',
  path: '/system/post/list',
})
