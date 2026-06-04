import type { MockContext } from '../index'
import { defineMock } from '../index'
import { faker } from '@faker-js/faker/locale/zh_CN'
import dayjs from 'dayjs'

faker.seed(400)

const OPER_TYPES = ['登录', '新增', '修改', '删除', '授权', '导出', '导入', '强退', '生成代码', '清空数据'] as const
const REQUEST_METHODS = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

interface OperLog {
  id: number
  operName: string
  operType: string
  title: string
  method: string
  requestMethod: string
  operatorType: 1 | 2
  operUrl: string
  operIp: string
  operLocation: string
  operParam: string
  jsonResult: string
  status: 0 | 1
  errorMsg: string
  operTime: string
  costTime: number
}

const LOG_DB: OperLog[] = []

function initLogDB() {
  if (LOG_DB.length > 0) return

  const baseDate = dayjs().subtract(30, 'day')
  const nicknames = ['admin', '张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十', '郑十一']

  for (let i = 0; i < 20; i++) {
    const operType = faker.helpers.arrayElement(OPER_TYPES)
    const isSuccess = faker.datatype.boolean(0.9)

    LOG_DB.push({
      id: i + 1,
      operName: faker.helpers.arrayElement(nicknames),
      operType,
      title: `${operType}操作`,
      method: `com.antdv.controller.${faker.helpers.arrayElement(['User', 'Role', 'Dict', 'Menu', 'Log', 'Online', 'Notice', 'File', 'Config', 'Dept'])}${faker.helpers.arrayElement(['Controller', 'Service', 'ServiceImpl'])}.${faker.hacker.verb()}`,
      requestMethod: faker.helpers.arrayElement(REQUEST_METHODS),
      operatorType: faker.helpers.arrayElement([1, 2]),
      operUrl: `/${faker.helpers.arrayElement(['system', 'api', 'admin', 'manage', 'controller'])}/${faker.helpers.arrayElement(['user', 'role', 'dict', 'menu', 'log', 'file', 'config'])}`,
      operIp: faker.internet.ipv4(),
      operLocation: `${faker.location.city()}${faker.location.state()}`,
      operParam: JSON.stringify({ page: 1, pageSize: 10, keyword: faker.word.sample() }),
      jsonResult: isSuccess ? JSON.stringify({ code: 200, message: '操作成功' }) : '',
      status: isSuccess ? 0 : 1,
      errorMsg: isSuccess ? '' : faker.hacker.phrase(),
      operTime: baseDate.add(faker.number.int({ min: 0, max: 720 }), 'hour').format('YYYY-MM-DD HH:mm:ss'),
      costTime: faker.number.int({ min: 5, max: 500 }),
    })
  }
}

initLogDB()

let autoIncrementId = 21

export default defineMock({
  '[GET]/system/log/list'({ query }: MockContext) {
    const operName = query.operName as string | undefined
    const operType = query.operType as string | undefined
    const status = query.status as string | undefined
    const dateRange = query.dateRange as string | undefined
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10

    let filtered = [...LOG_DB]

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

    return {
      code: 200,
      data: { list, total },
      message: '获取操作日志列表成功',
    }
  },

  '[DELETE]/system/log/:id'({ params }: MockContext) {
    const id = Number(params.id)
    const idx = LOG_DB.findIndex(l => l.id === id)

    if (idx === -1) {
      return {
        code: 404,
        data: null,
        message: '日志记录不存在',
      }
    }

    LOG_DB.splice(idx, 1)

    return {
      code: 200,
      data: null,
      message: '删除日志成功',
    }
  },
})
