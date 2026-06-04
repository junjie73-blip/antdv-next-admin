import type { MockContext } from '../index'
import { defineMock } from '../index'
import { faker } from '@faker-js/faker/locale/zh_CN'
import dayjs from 'dayjs'

faker.seed(500)

const BROWSERS = ['Chrome', 'Firefox', 'Safari', 'Edge'] as const
const OS_LIST = ['Windows 11', 'Windows 10', 'macOS Sonoma', 'Ubuntu 22.04', 'iOS 17', 'Android 14'] as const

interface OnlineUser {
  tokenId: string
  sessionId: string
  username: string
  nickname: string
  ip: string
  location: string
  browser: string
  os: string
  loginTime: string
  status: 0 | 1
}

const ONLINE_DB: OnlineUser[] = []

function initOnlineDB() {
  if (ONLINE_DB.length > 0) return

  const baseDate = dayjs().subtract(2, 'hour')
  const nicknames = [
    { username: 'admin', nickname: '超级管理员' },
    { username: 'zhangsan', nickname: '张三' },
    { username: 'lisi', nickname: '李四' },
    { username: 'wangwu', nickname: '王五' },
    { username: 'zhaoliu', nickname: '赵六' },
    { username: 'qianqi', nickname: '钱七' },
    { username: 'sunba', nickname: '孙八' },
    { username: 'zhoujiu', nickname: '周九' },
    { username: 'wushi', nickname: '吴十' },
    { username: 'zhengshiyi', nickname: '郑十一' },
  ]

  for (let i = 0; i < 10; i++) {
    const user = nicknames[i]!
    ONLINE_DB.push({
      tokenId: faker.string.uuid(),
      sessionId: faker.string.alphanumeric({ length: 32 }),
      username: user.username,
      nickname: user.nickname,
      ip: faker.internet.ipv4(),
      location: `${faker.location.city()}${faker.location.state()}`,
      browser: faker.helpers.arrayElement(BROWSERS),
      os: faker.helpers.arrayElement(OS_LIST),
      loginTime: baseDate.add(faker.number.int({ min: 0, max: 120 }), 'minute').format('YYYY-MM-DD HH:mm:ss'),
      status: faker.datatype.boolean(0.9) ? 0 : 1,
    })
  }
}

initOnlineDB()

export default defineMock({
  '[GET]/system/online/list'({ query }: MockContext) {
    const keyword = query.keyword as string | undefined
    const status = query.status as string | undefined
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10

    let filtered = [...ONLINE_DB]

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      filtered = filtered.filter(
        u => u.username.toLowerCase().includes(kw)
          || u.nickname.toLowerCase().includes(kw)
          || u.ip.includes(kw),
      )
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter(u => u.status === Number(status))
    }

    // 按登录时间倒序排列
    filtered.sort((a, b) => dayjs(b.loginTime).valueOf() - dayjs(a.loginTime).valueOf())

    const total = filtered.length
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize)

    return {
      code: 200,
      data: { list, total },
      message: '获取在线用户列表成功',
    }
  },

  '[DELETE]/system/online/:tokenId'({ params }: MockContext) {
    const tokenId = String(params.tokenId)
    const idx = ONLINE_DB.findIndex(u => u.tokenId === tokenId)

    if (idx === -1) {
      return {
        code: 404,
        data: null,
        message: '在线用户不存在或已下线',
      }
    }

    ONLINE_DB.splice(idx, 1)

    return {
      code: 200,
      data: null,
      message: '强制退出成功',
    }
  },
})
