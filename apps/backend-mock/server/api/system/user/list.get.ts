import { success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { USER_DB } from '../../../utils/db/user'

export default defineMockRoute({
  handler({ query }) {
    const keyword = query.keyword
    const status = query.status
    const deptId = query.deptId
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10

    let filtered = [...USER_DB]

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      filtered = filtered.filter(
        u => u.username.toLowerCase().includes(kw)
          || u.nickname.toLowerCase().includes(kw)
          || u.email.toLowerCase().includes(kw)
          || u.phone.includes(kw),
      )
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter(u => u.status === Number(status))
    }

    // 按部门筛选
    if (deptId !== undefined && deptId !== null && deptId !== '') {
      filtered = filtered.filter(u => u.deptId === Number(deptId))
    }

    const total = filtered.length
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize)

    return success({ list, total }, '获取用户列表成功')
  },
  method: 'GET',
  path: '/system/user/list',
})
