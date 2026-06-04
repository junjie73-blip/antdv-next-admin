import type { MockContext } from '../index'
import { defineMock } from '../index'
import { faker } from '@faker-js/faker/locale/zh_CN'
import dayjs from 'dayjs'

faker.seed(600)

const SENDERS = [
  '系统管理员',
  '安全中心',
  '工作流系统',
  '产品团队',
  '监控系统',
  '运维平台',
  '数据分析平台',
  '技术架构组',
  '人力资源部',
  '合同管理系统',
] as const

interface Notice {
  id: number
  title: string
  content: string
  type: 1 | 2 | 3
  status: 0 | 1
  priority: 0 | 1 | 2
  sender: string
  sendTime: string
  readTime?: string
}

const NOTICE_DB: Notice[] = []

function initNoticeDB() {
  if (NOTICE_DB.length > 0) return

  const baseDate = dayjs().subtract(7, 'day')

  const notices = [
    { title: '系统升级维护通知', content: '为提升系统性能和稳定性，计划于本周六凌晨2:00-6:00进行系统升级维护，届时服务将暂停访问，请提前做好相关工作安排。', type: 1 as const, priority: 2 as const },
    { title: '新功能上线公告', content: 'V2.5.0版本已正式发布，新增数据可视化大屏、多主题切换、国际化支持等功能，欢迎体验！', type: 1 as const, priority: 1 as const },
    { title: '密码安全提醒', content: '您的账号密码已超过90天未修改，建议您及时更新密码以保障账户安全。如需帮助请联系安全中心。', type: 2 as const, priority: 1 as const },
    { title: '服务器资源使用率预警', content: '生产环境CPU使用率已超过85%，请相关同事关注并排查是否存在异常进程。', type: 2 as const, priority: 2 as const },
    { title: '审批任务待处理', content: '您有3条审批任务等待处理，请登录系统及时完成审批操作。', type: 3 as const, priority: 0 as const },
    { title: '数据备份完成通知', content: '昨日全量数据备份已完成，备份文件已存储至异地灾备中心，校验通过。', type: 2 as const, priority: 0 as const },
    { title: 'API接口变更通知', content: '用户管理模块部分API接口将于下月进行调整，涉及字段变更及废弃接口，请各开发团队提前适配。', type: 1 as const, priority: 1 as const },
    { title: '假期排班确认提醒', content: '下月节假日排班表已发布，请在3个工作日内确认您的排班时间，如有调整请联系人力资源部。', type: 3 as const, priority: 0 as const },
    { title: 'SSL证书即将到期', content: '域名证书将于30天后到期，请运维团队及时更新证书以避免影响正常访问。', type: 2 as const, priority: 1 as const },
    { title: '周报提交提醒', content: '本周周报提交截止时间为周五18:00，请各位同事按时提交。', type: 3 as const, priority: 0 as const },
    { title: '新员工入职培训通知', content: '本月新员工入职培训将于下周一开始，为期三天，请新入职同事准时参加。', type: 1 as const, priority: 0 as const },
    { title: '数据库优化建议', content: '经分析发现慢查询TOP10清单，已发送详细报告至技术群，请相关负责人评估优化方案。', type: 2 as const, priority: 1 as const },
  ]

  for (let i = 0; i < notices.length; i++) {
    const notice = notices[i]!
    const isRead = faker.datatype.boolean(0.6)

    NOTICE_DB.push({
      id: i + 1,
      ...notice,
      status: isRead ? 1 : 0,
      sender: faker.helpers.arrayElement(SENDERS),
      sendTime: baseDate.add(faker.number.int({ min: 0, max: 168 }), 'hour').format('YYYY-MM-DD HH:mm:ss'),
      readTime: isRead ? dayjs(faker.date.recent({ days: 3 })).format('YYYY-MM-DD HH:mm:ss') : undefined,
    })
  }
}

initNoticeDB()

let autoIncrementId = 13

export default defineMock({
  '[GET]/system/notice/list'({ query }: MockContext) {
    const keyword = query.keyword as string | undefined
    const type = query.type as string | undefined
    const status = query.status as string | undefined
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10

    let filtered = [...NOTICE_DB]

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      filtered = filtered.filter(
        n => n.title.toLowerCase().includes(kw) || n.content.toLowerCase().includes(kw),
      )
    }

    if (type && type !== '') {
      filtered = filtered.filter(n => n.type === Number(type))
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter(n => n.status === Number(status))
    }

    // 按发送时间倒序排列
    filtered.sort((a, b) => dayjs(b.sendTime).valueOf() - dayjs(a.sendTime).valueOf())

    const total = filtered.length
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize)

    return {
      code: 200,
      data: { list, total },
      message: '获取消息通知列表成功',
    }
  },

  '[PUT]/system/notice/read/:id'({ params }: MockContext) {
    const id = Number(params.id)
    const notice = NOTICE_DB.find(n => n.id === id)

    if (!notice) {
      return {
        code: 404,
        data: null,
        message: '通知不存在',
      }
    }

    notice.status = 1
    notice.readTime = dayjs().format('YYYY-MM-DD HH:mm:ss')

    return {
      code: 200,
      data: notice,
      message: '标记已读成功',
    }
  },

  '[PUT]/system/notice/read-all'() {
    const now = dayjs().format('YYYY-MM-DD HH:mm:ss')
    let count = 0

    for (const notice of NOTICE_DB) {
      if (notice.status === 0) {
        notice.status = 1
        notice.readTime = now
        count++
      }
    }

    return {
      code: 200,
      data: { count },
      message: `已将${count}条消息标记为已读`,
    }
  },

  '[DELETE]/system/notice/:id'({ params }: MockContext) {
    const id = Number(params.id)
    const idx = NOTICE_DB.findIndex(n => n.id === id)

    if (idx === -1) {
      return {
        code: 404,
        data: null,
        message: '通知不存在',
      }
    }

    NOTICE_DB.splice(idx, 1)

    return {
      code: 200,
      data: null,
      message: '删除通知成功',
    }
  },
})
