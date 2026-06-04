import type { MockContext } from '../index'
import { defineMock } from '../index'
import { faker } from '@faker-js/faker/locale/zh_CN'
import dayjs from 'dayjs'

faker.seed(300)

interface LoginLogRecord {
  id: number
  username: string
  loginAccount: string
  ip: string
  location: string
  browser: string
  os: string
  status: 'success' | 'fail'
  message: string
  loginTime: string
  duration: number
  userAgent: string
}

const CHINESE_CITIES = [
  '北京市朝阳区', '北京市海淀区', '上海市浦东新区', '广州市天河区',
  '深圳市南山区', '杭州市西湖区', '成都市武侯区', '武汉市洪山区',
  '南京市鼓楼区', '西安市雁塔区', '重庆市渝中区', '郑州市金水区',
  '长沙市岳麓区', '沈阳市和平区', '青岛市市南区', '苏州市姑苏区',
  '天津市和平区', '厦门市思明区', '宁波市鄞州区', '无锡市梁溪区',
]

const BROWSER_CONFIG = [
  { name: 'Chrome', weight: 60 },
  { name: 'Firefox', weight: 10 },
  { name: 'Safari', weight: 15 },
  { name: 'Edge', weight: 10 },
  { name: 'Opera', weight: 5 },
]

const OS_CONFIG = [
  { name: 'Windows', weight: 65 },
  { name: 'macOS', weight: 18 },
  { name: 'Linux', weight: 7 },
  { name: 'iOS', weight: 5 },
  { name: 'Android', weight: 5 },
]

const SYSTEM_USERS = [
  { username: 'admin', nickname: '超级管理员' },
  { username: 'zhangsan', nickname: '张三' },
  { username: 'lisi', nickname: '李四' },
  { username: 'wangwu', nickname: '王五' },
  { username: 'zhaoliu', nickname: '赵六' },
  { username: 'sunqi', nickname: '孙七' },
  { username: 'zhouba', nickname: '周八' },
  { username: 'wujiu', nickname: '吴九' },
  { username: 'zhengshi', nickname: '郑十' },
  { username: 'chenyi', nickname: '陈一' },
]

const FAIL_MESSAGES = [
  '密码错误，请重新输入',
  '验证码错误或已过期',
  '账号已被锁定，请联系管理员',
  '账号不存在，请检查输入',
  '登录次数过多，请稍后再试',
  'Token 已失效，请重新登录',
  'IP 地址不在白名单内',
  '账号已过期，请联系管理员',
]

function weightedRandom<T extends { name: string; weight: number }>(items: T[]): string {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0)
  let random = Math.random() * totalWeight
  for (const item of items) {
    random -= item.weight
    if (random <= 0) return item.name
  }
  return items[0]!.name
}

function generateLoginLogs(count: number = 35): LoginLogRecord[] {
  const records: LoginLogRecord[] = []
  const now = dayjs()

  for (let i = 0; i < count; i++) {
    const user = SYSTEM_USERS[Math.floor(Math.random() * SYSTEM_USERS.length)]!
    const browserName = weightedRandom(BROWSER_CONFIG)
    const osName = weightedRandom(OS_CONFIG)

    const browserVersionMap: Record<string, string> = {
      Chrome: `${faker.number.int({ min: 120, max: 130 })}.0`,
      Firefox: `${faker.number.int({ min: 125, max: 135 })}.0`,
      Safari: `${faker.number.int({ min: 17, max: 18 })}.${faker.number.int({ min: 0, max: 9 })}`,
      Edge: `${faker.number.int({ min: 120, max: 130 })}.0`,
      Opera: `${faker.number.int({ min: 110, max: 115 })}.0`,
    }

    const osVersionMap: Record<string, string> = {
      Windows: `Windows ${faker.helpers.arrayElement(['10', '11'])}`,
      macOS: `macOS ${faker.helpers.arrayElement(['Sonoma', 'Ventura', 'Monterey'])}`,
      Linux: faker.helpers.arrayElement(['Ubuntu 22.04', 'Debian 12', 'CentOS 9']),
      iOS: `iOS ${faker.number.int({ min: 16, max: 18 })}.${faker.number.int({ min: 0, max: 5 })}`,
      Android: `Android ${faker.number.int({ min: 13, max: 15 })}`,
    }

    const browser = `${browserName} ${browserVersionMap[browserName]}`
    const os = osVersionMap[osName]!
    const isSuccess = Math.random() < 0.9
    const status: 'success' | 'fail' = isSuccess ? 'success' : 'fail'

    const userAgentTemplates: Record<string, (b: string, o: string) => string> = {
      Chrome: (b, o) => {
        const platform = o.includes('Windows') ? 'Windows NT 10.0; Win64; x64' : o.includes('Mac') ? 'Macintosh; Intel Mac OS X 10_15_7' : 'X11; Linux x86_64'
        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${b.split(' ')[1]} Safari/537.36`
      },
      Firefox: (b, o) => {
        const platform = o.includes('Windows') ? 'Windows NT 10.0; Win64; x64' : o.includes('Mac') ? 'Macintosh; Intel Mac OS X 10.15' : 'X11; Linux x86_64'
        return `Mozilla/5.0 (${platform}) Gecko/20100101 Firefox/${b.split(' ')[1]}`
      },
      Safari: (_b) => `Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/${_b.split(' ')[1]} Safari/605.1.15`,
      Edge: (b, o) => {
        const platform = o.includes('Windows') ? 'Windows NT 10.0; Win64; x64' : 'Macintosh; Intel Mac OS X 10_15_7'
        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${b.split(' ')[1]} Safari/537.36 Edg/${b.split(' ')[1]}`
      },
      Opera: (b, o) => {
        const platform = o.includes('Windows') ? 'Windows NT 10.0; Win64; x64' : 'X11; Linux x86_64'
        return `Mozilla/5.0 (${platform}) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/${b.split(' ')[1]} Safari/537.36 OPR/${b.split(' ')[1]}`
      },
    }

    const userAgentFn = userAgentTemplates[browserName] || userAgentTemplates.Chrome!
    const userAgent = userAgentFn(browser, os)

    const daysAgo = faker.number.int({ min: 0, max: 29 })
    const hoursAgo = faker.number.int({ min: 0, max: 23 })
    const minutesAgo = faker.number.int({ min: 0, max: 59 })
    const secondsAgo = faker.number.int({ min: 0, max: 59 })
    const loginTime = now.subtract(daysAgo, 'day')
      .subtract(hoursAgo, 'hour')
      .subtract(minutesAgo, 'minute')
      .subtract(secondsAgo, 'second')
      .format('YYYY-MM-DD HH:mm:ss')

    records.push({
      id: i + 1,
      username: user.username,
      loginAccount: user.username,
      ip: faker.internet.ipv4(),
      location: CHINESE_CITIES[Math.floor(Math.random() * CHINESE_CITIES.length)]!,
      browser,
      os,
      status,
      message: isSuccess ? '登录成功' : FAIL_MESSAGES[Math.floor(Math.random() * FAIL_MESSAGES.length)]!,
      loginTime,
      duration: faker.number.int({ min: 45, max: 2500 }),
      userAgent,
    })
  }

  return records
}

const LOG_DB = generateLoginLogs()

export default defineMock({
  '[GET]/system/login-log/list'({ query }: MockContext) {
    const username = query.username as string | undefined
    const ip = query.ip as string | undefined
    const status = query.status as string | undefined
    const dateRange = query.dateRange as string | string[] | undefined
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10

    let filtered = [...LOG_DB]

    if (username) {
      const kw = String(username).toLowerCase()
      filtered = filtered.filter(l => l.username.toLowerCase().includes(kw))
    }

    if (ip) {
      filtered = filtered.filter(l => l.ip.includes(String(ip)))
    }

    if (status && status !== '') {
      filtered = filtered.filter(l => l.status === status)
    }

    if (dateRange && Array.isArray(dateRange) && dateRange.length === 2) {
      const start = dayjs(dateRange[0])
      const end = dayjs(dateRange[1])
      filtered = filtered.filter(item =>
        dayjs(item.loginTime).isAfter(start.subtract(1, 'second'))
        && dayjs(item.loginTime).isBefore(end.add(1, 'second')),
      )
    }

    filtered.sort((a, b) => dayjs(b.loginTime).valueOf() - dayjs(a.loginTime).valueOf())

    const total = filtered.length
    const startIdx = (page - 1) * pageSize
    const list = filtered.slice(startIdx, startIdx + pageSize)

    return {
      code: 200,
      data: { list, total },
      message: '获取登录日志列表成功',
    }
  },

  '[GET]/system/login-log/stats'() {
    const today = dayjs().format('YYYY-MM-DD')
    const weekAgo = dayjs().subtract(7, 'day').startOf('day')
    const monthAgo = dayjs().subtract(30, 'day').startOf('day')

    const todayCount = LOG_DB.filter(l => dayjs(l.loginTime).format('YYYY-MM-DD') === today).length
    const weekCount = LOG_DB.filter(l => dayjs(l.loginTime).isAfter(weekAgo)).length
    const monthCount = LOG_DB.filter(l => dayjs(l.loginTime).isAfter(monthAgo)).length
    const todayFailCount = LOG_DB.filter(
      l => dayjs(l.loginTime).format('YYYY-MM-DD') === today && l.status === 'fail',
    ).length

    return {
      code: 200,
      data: {
        todayCount,
        weekCount,
        monthCount,
        todayFailCount,
      },
      message: '获取统计数据成功',
    }
  },
})
