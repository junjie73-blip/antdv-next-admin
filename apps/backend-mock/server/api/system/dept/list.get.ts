import { success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { ALL_DEPTS_FLAT } from '../../../utils/db/dept'

export default defineMockRoute({
  handler({ query }) {
    const parentId = query.parentId
    const keyword = query.keyword

    let items = [...ALL_DEPTS_FLAT]

    if (parentId !== undefined && parentId !== null && parentId !== '') {
      items = items.filter(d => d.parentId === Number(parentId))
    }

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      items = items.filter(d => d.name.toLowerCase().includes(kw))
    }

    return success({ list: items, total: items.length }, '获取部门列表成功')
  },
  method: 'GET',
  path: '/system/dept/list',
})
