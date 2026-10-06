import dayjs from 'dayjs'
import { success } from '../../../utils/response'
import { defineMockRoute } from '../../../utils/runtime'
import { LOGIN_LOG_DB } from '../../../utils/db/login-log'

export default defineMockRoute({
  handler() {
    const today = dayjs().format('YYYY-MM-DD')
    const weekAgo = dayjs().subtract(7, 'day').startOf('day')
    const monthAgo = dayjs().subtract(30, 'day').startOf('day')

    const todayCount = LOGIN_LOG_DB.filter(l => dayjs(l.loginTime).format('YYYY-MM-DD') === today).length
    const weekCount = LOGIN_LOG_DB.filter(l => dayjs(l.loginTime).isAfter(weekAgo)).length
    const monthCount = LOGIN_LOG_DB.filter(l => dayjs(l.loginTime).isAfter(monthAgo)).length
    const todayFailCount = LOGIN_LOG_DB.filter(
      l => dayjs(l.loginTime).format('YYYY-MM-DD') === today && l.status === 'fail',
    ).length

    return success({
      todayCount,
      weekCount,
      monthCount,
      todayFailCount,
    }, '获取统计数据成功')
  },
  method: 'GET',
  path: '/system/login-log/stats',
})
