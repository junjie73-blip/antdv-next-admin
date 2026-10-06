import { defineEventHandler, getQuery } from '#imports'
import { envelope } from '../../utils/response'
import { getStore } from '../../utils/store'

export default defineEventHandler((event) => {
  const query = getQuery(event)
  const limit = Math.min(200, Math.max(1, Number(query.limit) || 50))
  const module = String(query.module ?? '').trim()
  const onlyError = String(query.onlyError ?? '') === 'true'

  let logs = getStore().logs
  if (module) logs = logs.filter(item => item.module === module)
  if (onlyError) logs = logs.filter(item => item.status >= 400 || item.code >= 400)

  return envelope(200, { limit, logs: logs.slice(0, limit), total: logs.length }, '获取命中日志成功')
})
