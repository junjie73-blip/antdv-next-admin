import dayjs from 'dayjs'
import { success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { OPER_LOG_DB } from '../../../utils/db/log'

export default defineMockRoute({
  handler({ query }) {
    const operName = query.operName
    const operType = query.operType
    const status = query.status
    const dateRange = query.dateRange
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10

    let filtered = [...OPER_LOG_DB]

    if (operName) {
      filtered = filtered.filter(l => l.operName.includes(String(operName)))
    }

    if (operType && operType !== '') {
      filtered = filtered.filter(l => l.operType === operType)
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter(l => l.status === Number(status))
    }

    if (dateRange) {
      const [startStr, endStr] = String(dateRange).split(',')
      if (startStr) {
        filtered = filtered.filter(l => l.operTime >= startStr)
      }
      if (endStr) {
        filtered = filtered.filter(l => l.operTime <= `${endStr} 23:59:59`)
      }
    }

    // 按时间倒序排列
    filtered.sort((a, b) => dayjs(b.operTime).valueOf() - dayjs(a.operTime).valueOf())

    const total = filtered.length
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize)

    return success({ list, total }, '获取操作日志列表成功')
  },
  method: 'GET',
  path: '/system/log/list',
})
