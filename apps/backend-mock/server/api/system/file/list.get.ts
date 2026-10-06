import { success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { FILE_DB } from '../../../utils/db/file'
import type { FileType } from '../../../utils/db/file'

export default defineMockRoute({
  handler({ query }) {
    const name = query.name as string | undefined
    const type = query.type as string | undefined
    const parentId = query.parentId as string | undefined
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 20

    let filtered = [...FILE_DB]

    if (parentId !== undefined && parentId !== null && parentId !== '') {
      filtered = filtered.filter(f => f.parentId === Number(parentId))
    }
    else if (parentId === undefined || parentId === null || parentId === '') {
      // 默认只返回根目录内容（parentId 为 null 的）；显式传空字符串则返回全部根级
      filtered = filtered.filter(f => f.parentId === null)
    }

    if (name) {
      const kw = String(name).toLowerCase()
      filtered = filtered.filter(f => f.name.toLowerCase().includes(kw))
    }

    if (type && type !== '') {
      filtered = filtered.filter(f => f.type === (type as FileType))
    }

    // 文件夹排在前面，按名称排序
    filtered.sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
      return a.name.localeCompare(b.name, 'zh-CN')
    })

    const total = filtered.length
    const startIdx = (page - 1) * pageSize
    const list = filtered.slice(startIdx, startIdx + pageSize)

    return success({ list, total }, '获取文件列表成功')
  },
  method: 'GET',
  path: '/system/file/list',
})
