import type { MockContext } from '../index'
import { defineMock } from '../index'
import { faker } from '@faker-js/faker/locale/zh_CN'
import dayjs from 'dayjs'

// 固定种子保证每次生成的数据一致
faker.seed(100)

// 部门固定集合 — 与页面保持一致
const DEPT_LIST = [
  { id: 1, name: '总公司' },
  { id: 2, name: '技术部' },
  { id: 3, name: '产品部' },
  { id: 4, name: '市场部' },
  { id: 5, name: '运营部' },
  { id: 6, name: '财务部' },
  { id: 7, name: '人事部' },
  { id: 8, name: '行政部' },
]

// 角色选项集合
const ROLE_OPTIONS = [
  { label: '超级管理员', value: 1 },
  { label: '管理员', value: 2 },
  { label: '普通用户', value: 3 },
  { label: '运维人员', value: 4 },
]

// 预生成 50 条用户数据，确保分页和筛选一致性
const USER_DB: Array<{
  id: number
  username: string
  nickname: string
  email: string
  phone: string
  gender: number
  avatar: string
  status: 0 | 1
  deptId: number
  deptName: string
  roles: string[]
  remark: string
  createdAt: string
  updatedAt: string
}> = []

// 初始化用户数据库
function initUserDB() {
  if (USER_DB.length > 0) return

  // 第一条是内置管理员
  USER_DB.push({
    id: 1,
    username: 'admin',
    nickname: '超级管理员',
    email: 'admin@example.com',
    phone: '13800000001',
    gender: 1,
    avatar: faker.image.avatar(),
    status: 1,
    deptId: 1,
    deptName: '总公司',
    roles: ['超级管理员'],
    remark: '系统内置管理员',
    createdAt: '2024-01-01 10:00:00',
    updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  })

  // 生成 49 条 faker 数据
  for (let i = 2; i <= 50; i++) {
    const dept = DEPT_LIST[faker.number.int({ min: 0, max: DEPT_LIST.length - 1 })]!
    const role = ROLE_OPTIONS[faker.number.int({ min: 0, max: ROLE_OPTIONS.length - 1 })]!
    const baseDate = dayjs('2024-01-01')

    USER_DB.push({
      id: i,
      username: faker.internet.username().toLowerCase(),
      nickname: faker.person.fullName(),
      email: faker.internet.email().toLowerCase(),
      phone: faker.phone.number('1##########'),
      gender: faker.helpers.arrayElement([0, 1, 2]),
      avatar: faker.image.avatar(),
      status: faker.datatype.boolean(0.85) ? 1 : 0,
      deptId: dept.id,
      deptName: dept.name,
      roles: [role.label],
      remark: faker.datatype.boolean(0.3) ? faker.company.catchPhrase() : '',
      createdAt: baseDate.add(faker.number.int({ min: 0, max: 365 }), 'day').format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    })
  }
}

initUserDB()

let autoIncrementId = 51

export default defineMock({
  '[GET]/system/user/list'({ query }: MockContext) {
    const keyword = query.keyword as string | undefined
    const status = query.status as string | undefined
    const deptId = query.deptId as string | undefined
    const page = Number(query.page) || 1
    const pageSize = Number(query.pageSize) || 10

    let filtered = [...USER_DB]

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      filtered = filtered.filter(
        u => u.username.toLowerCase().includes(kw)
          || u.nickname.toLowerCase().includes(kw)
          || u.email.toLowerCase().includes(kw)
          || u.phone.includes(kw),
      )
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter(u => u.status === Number(status))
    }

    // 按部门筛选
    if (deptId !== undefined && deptId !== null && deptId !== '') {
      filtered = filtered.filter(u => u.deptId === Number(deptId))
    }

    const total = filtered.length
    const start = (page - 1) * pageSize
    const list = filtered.slice(start, start + pageSize)

    return {
      code: 200,
      data: { list, total },
      message: '获取用户列表成功',
    }
  },

  '[GET]/system/user/:id'({ params }: MockContext) {
    const id = Number(params.id)
    const user = USER_DB.find(u => u.id === id)

    if (!user) {
      return {
        code: 404,
        data: null,
        message: '用户不存在',
      }
    }

    return {
      code: 200,
      data: user,
      message: '获取用户详情成功',
    }
  },

  '[POST]/system/user'({ data }: MockContext) {
    const body = data as Record<string, unknown>
    const dept = DEPT_LIST.find(d => d.id === body.deptId)
    const role = ROLE_OPTIONS.find(r => r.value === body.roleId)

    const newUser = {
      id: autoIncrementId++,
      username: String(body.username || ''),
      nickname: String(body.nickname || ''),
      email: String(body.email || ''),
      phone: String(body.phone || ''),
      gender: 1,
      avatar: faker.image.avatar(),
      status: (body.status as number) ?? 1,
      deptId: Number(body.deptId || 0),
      deptName: dept?.name || '',
      roles: role ? [role.label] : [],
      remark: String(body.remark || ''),
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }

    USER_DB.push(newUser)

    return {
      code: 200,
      data: newUser,
      message: '新增用户成功',
    }
  },

  '[PUT]/system/user/:id'({ params, data }: MockContext) {
    const id = Number(params.id)
    const idx = USER_DB.findIndex(u => u.id === id)

    if (idx === -1) {
      return {
        code: 404,
        data: null,
        message: '用户不存在',
      }
    }

    const body = data as Record<string, unknown>
    const dept = DEPT_LIST.find(d => d.id === body.deptId)
    const role = ROLE_OPTIONS.find(r => r.value === body.roleId)

    USER_DB[idx] = {
      ...USER_DB[idx]!,
      ...(body.username !== undefined && { username: String(body.username) }),
      ...(body.nickname !== undefined && { nickname: String(body.nickname) }),
      ...(body.email !== undefined && { email: String(body.email) }),
      ...(body.phone !== undefined && { phone: String(body.phone) }),
      ...(body.deptId !== undefined && { deptId: Number(body.deptId), deptName: dept?.name || '' }),
      ...(body.roleId !== undefined && { roleId: body.roleId, role: role?.label || '' }),
      ...(body.status !== undefined && { status: body.status as 0 | 1 }),
      ...(body.remark !== undefined && { remark: String(body.remark) }),
      updatedAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }

    return {
      code: 200,
      data: USER_DB[idx],
      message: '更新用户成功',
    }
  },

  '[DELETE]/system/user/:id'({ params }: MockContext) {
    const id = Number(params.id)
    const idx = USER_DB.findIndex(u => u.id === id)

    if (idx === -1) {
      return {
        code: 404,
        data: null,
        message: '用户不存在',
      }
    }

    USER_DB.splice(idx, 1)

    return {
      code: 200,
      data: null,
      message: '删除用户成功',
    }
  },

  '[GET]/system/user/options'() {
    return {
      code: 200,
      data: USER_DB.map(u => ({ label: u.nickname, value: u.id, username: u.username })),
      message: '获取用户选项成功',
    }
  },
})
