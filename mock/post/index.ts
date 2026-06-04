import type { MockContext } from '../index'
import { defineMock } from '../index'
import { faker } from '@faker-js/faker/locale/zh_CN'
import dayjs from 'dayjs'

faker.seed(2024)

interface PostRecord {
  id: number
  name: string
  code: string
  deptId: number
  deptName: string
  sortOrder: number
  status: 0 | 1
  remark: string
  createdAt: string
  userCount: number
  userIds: number[]
}

const DEPT_MAP: Record<number, string> = {
  1: '总公司',
  2: '技术部',
  3: '产品部',
  4: '市场部',
  5: '运营部',
  6: '财务部',
  7: '人事部',
  8: '行政部',
}

const POST_TEMPLATES: Array<{ name: string; codePrefix: string; deptId: number; remark: string }> = [
  { name: '前端开发工程师', codePrefix: 'FE', deptId: 2, remark: '负责 Web 前端开发与交互实现' },
  { name: '后端开发工程师', codePrefix: 'BE', deptId: 2, remark: '负责服务端架构与 API 开发' },
  { name: '测试工程师', codePrefix: 'QA', deptId: 2, remark: '负责产品质量保障与自动化测试' },
  { name: '运维工程师', codePrefix: 'OPS', deptId: 2, remark: '负责系统运维、部署与监控' },
  { name: '技术经理', codePrefix: 'TECH_MGR', deptId: 2, remark: '负责技术团队管理与技术决策' },
  { name: '产品经理', codePrefix: 'PM', deptId: 3, remark: '负责产品规划、需求分析与路线图制定' },
  { name: 'UI 设计师', codePrefix: 'UI', deptId: 3, remark: '负责界面视觉设计与用户体验优化' },
  { name: '用户体验研究员', codePrefix: 'UX', deptId: 3, remark: '负责用户研究与可用性测试' },
  { name: '市场专员', codePrefix: 'MKT', deptId: 4, remark: '负责市场推广活动策划与执行' },
  { name: '品牌经理', codePrefix: 'BRAND', deptId: 4, remark: '负责品牌建设与市场定位策略' },
  { name: '运营专员', codePrefix: 'OP', deptId: 5, remark: '负责日常运营与数据分析' },
  { name: '内容运营', codePrefix: 'CONTENT', deptId: 5, remark: '负责内容生产与分发策略' },
  { name: '财务会计', codePrefix: 'ACC', deptId: 6, remark: '负责账务处理与财务报表编制' },
  { name: '财务经理', codePrefix: 'FIN_MGR', deptId: 6, remark: '负责财务管理与预算控制' },
  { name: 'HR 专员', codePrefix: 'HR', deptId: 7, remark: '负责招聘、培训与员工关系管理' },
  { name: '人事经理', codePrefix: 'HR_MGR', deptId: 7, remark: '负责人力资源战略规划' },
  { name: '行政助理', codePrefix: 'ADMIN', deptId: 8, remark: '负责行政事务与后勤保障' },
  { name: 'CEO / 总经理', codePrefix: 'CEO', deptId: 1, remark: '公司最高管理者，负责战略决策' },
  { name: 'CTO / 技术总监', codePrefix: 'CTO', deptId: 1, remark: '技术负责人，负责技术战略与研发管理' },
  { name: 'CFO / 财务总监', codePrefix: 'CFO', deptId: 1, remark: '财务负责人，负责财务管理与投融资' },
  { name: 'COO / 运营总监', codePrefix: 'COO', deptId: 1, remark: '运营负责人，负责日常运营管理' },
]

function generatePostData(): PostRecord[] {
  const baseDate = dayjs('2024-01-01')
  return POST_TEMPLATES.map((tpl, index) => ({
    id: index + 1,
    name: tpl.name,
    code: `POST_${tpl.codePrefix}_${String(index + 1).padStart(3, '0')}`,
    deptId: tpl.deptId,
    deptName: DEPT_MAP[tpl.deptId] || '',
    sortOrder: index + 1,
    status: faker.datatype.boolean(0.9) ? 1 : 0,
    remark: tpl.remark,
    createdAt: baseDate.add(faker.number.int({ min: 0, max: 180 }), 'day').format('YYYY-MM-DD HH:mm:ss'),
    userCount: faker.number.int({ min: 0, max: 8 }),
    userIds: [],
  }))
}

const POST_DB = generatePostData()
let autoIncrementId = 22

export default defineMock({
  '[GET]/system/post/list'({ query }: MockContext) {
    const name = query.name as string | undefined
    const deptId = query.deptId as string | undefined
    const status = query.status as string | undefined

    let filtered = [...POST_DB]

    if (name) {
      const kw = String(name).toLowerCase()
      filtered = filtered.filter(p => p.name.toLowerCase().includes(kw))
    }

    if (deptId !== undefined && deptId !== null && deptId !== '') {
      filtered = filtered.filter(p => p.deptId === Number(deptId))
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter(p => p.status === Number(status))
    }

    return {
      code: 200,
      data: { list: filtered, total: filtered.length },
      message: '获取岗位列表成功',
    }
  },

  '[POST]/system/post'({ data }: MockContext) {
    const body = data as Record<string, unknown>

    const newPost: PostRecord = {
      id: autoIncrementId++,
      name: String(body.name || ''),
      code: String(body.code || ''),
      deptId: Number(body.deptId || 0),
      deptName: DEPT_MAP[Number(body.deptId)] || '',
      sortOrder: Number(body.sortOrder ?? 0),
      status: (body.status as 0 | 1) ?? 1,
      remark: String(body.remark || ''),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      userCount: 0,
      userIds: [],
    }

    POST_DB.push(newPost)

    return {
      code: 200,
      data: newPost,
      message: '新增岗位成功',
    }
  },

  '[PUT]/system/post/:id'({ params, data }: MockContext) {
    const id = Number(params.id)
    const idx = POST_DB.findIndex(p => p.id === id)

    if (idx === -1) {
      return { code: 404, data: null, message: '岗位不存在' }
    }

    const body = data as Record<string, unknown>
    POST_DB[idx] = {
      ...POST_DB[idx]!,
      ...(body.name !== undefined && { name: String(body.name) }),
      ...(body.code !== undefined && { code: String(body.code) }),
      ...(body.deptId !== undefined && { deptId: Number(body.deptId), deptName: DEPT_MAP[Number(body.deptId)] || '' }),
      ...(body.sortOrder !== undefined && { sortOrder: Number(body.sortOrder) }),
      ...(body.status !== undefined && { status: body.status as 0 | 1 }),
      ...(body.remark !== undefined && { remark: String(body.remark) }),
    }

    return {
      code: 200,
      data: POST_DB[idx],
      message: '更新岗位成功',
    }
  },

  '[DELETE]/system/post/:id'({ params }: MockContext) {
    const id = Number(params.id)
    const idx = POST_DB.findIndex(p => p.id === id)

    if (idx === -1) {
      return { code: 404, data: null, message: '岗位不存在' }
    }

    POST_DB.splice(idx, 1)

    return {
      code: 200,
      data: null,
      message: '删除岗位成功',
    }
  },

  '[GET]/system/post/users/:postId'({ params }: MockContext) {
    const postId = Number(params.postId)
    const post = POST_DB.find(p => p.id === postId)

    if (!post) {
      return { code: 404, data: { list: [], total: 0 }, message: '岗位不存在' }
    }

    // 模拟返回该岗位关联的用户列表
    const users = Array.from({ length: post.userCount }, (_, i) => ({
      id: postId * 100 + i + 1,
      username: `user_${String(postId * 100 + i + 1).padStart(3, '0')}`,
      nickname: faker.person.fullName(),
      deptName: post.deptName,
    }))

    return {
      code: 200,
      data: { list: users, total: users.length },
      message: '获取岗位用户列表成功',
    }
  },
})
