import type { MockContext } from '../index'
import { defineMock } from '../index'
import { faker } from '@faker-js/faker/locale/zh_CN'
import dayjs from 'dayjs'

faker.seed(200)

interface RoleItem {
  id: number
  name: string
  code: string
  description: string
  sort: number
  status: number
  menuIds: number[]
  createdAt: string
}

const ROLE_DB: RoleItem[] = [
  { id: 1, name: '超级管理员', code: 'super_admin', description: '拥有系统所有权限，不可删除', sort: 0, status: 1, menuIds: [1, 2, 3, 4, 5, 6, 7, 8], createdAt: '2024-01-01 10:00:00' },
  { id: 2, name: '管理员', code: 'admin', description: '拥有大部分管理权限', sort: 1, status: 1, menuIds: [1, 2, 3, 5, 6], createdAt: '2024-01-02 11:00:00' },
  { id: 3, name: '普通用户', code: 'user', description: '普通用户基础权限', sort: 2, status: 1, menuIds: [1, 7], createdAt: '2024-01-03 12:00:00' },
  { id: 4, name: '访客', code: 'guest', description: '只读权限，仅可浏览公开内容', sort: 3, status: 0, menuIds: [1], createdAt: '2024-01-05 14:00:00' },
  { id: 5, name: '运营人员', code: 'operator', description: '负责日常运营操作', sort: 4, status: 1, menuIds: [1, 2, 7, 8], createdAt: '2024-02-10 09:30:00' },
  { id: 6, name: '开发人员', code: 'developer', description: '拥有开发和调试相关权限', sort: 5, status: 1, menuIds: [1, 2, 3, 4, 9], createdAt: '2024-03-15 16:20:00' },
]

let autoIncrementId = 7

export default defineMock({
  '[GET]/system/role/list'({ query }: MockContext) {
    const keyword = query.keyword as string | undefined
    const status = query.status as string | undefined

    let filtered = [...ROLE_DB]

    if (keyword) {
      const kw = String(keyword).toLowerCase()
      filtered = filtered.filter(
        r => r.name.toLowerCase().includes(kw) || r.code.toLowerCase().includes(kw),
      )
    }

    if (status !== undefined && status !== null && status !== '') {
      filtered = filtered.filter(r => r.status === Number(status))
    }

    return {
      code: 200,
      data: { list: filtered, total: filtered.length },
      message: '获取角色列表成功',
    }
  },

  '[POST]/system/role'({ data }: MockContext) {
    const body = data as Record<string, unknown>

    const newRole: RoleItem = {
      id: autoIncrementId++,
      name: String(body.name || ''),
      code: String(body.code || ''),
      description: String(body.description || ''),
      sort: Number(body.sort ?? 0),
      status: Number(body.status ?? 1),
      menuIds: [],
      createdAt: dayjs().format('YYYY-MM-DD HH:mm:ss'),
    }

    ROLE_DB.push(newRole)

    return {
      code: 200,
      data: newRole,
      message: '新增角色成功',
    }
  },

  '[PUT]/system/role/:id'({ params, data }: MockContext) {
    const id = Number(params.id)
    const idx = ROLE_DB.findIndex(r => r.id === id)

    if (idx === -1) {
      return { code: 404, data: null, message: '角色不存在' }
    }

    const body = data as Record<string, unknown>
    ROLE_DB[idx] = {
      ...ROLE_DB[idx]!,
      ...(body.name !== undefined && { name: String(body.name) }),
      ...(body.code !== undefined && { code: String(body.code) }),
      ...(body.description !== undefined && { description: String(body.description) }),
      ...(body.sort !== undefined && { sort: Number(body.sort) }),
      ...(body.status !== undefined && { status: Number(body.status) }),
    }

    return {
      code: 200,
      data: ROLE_DB[idx],
      message: '更新角色成功',
    }
  },

  '[DELETE]/system/role/:id'({ params }: MockContext) {
    const id = Number(params.id)
    const role = ROLE_DB.find(r => r.id === id)

    if (!role) {
      return { code: 404, data: null, message: '角色不存在' }
    }

    if (role.code === 'super_admin') {
      return { code: 400, data: null, message: '超级管理员角色不允许删除' }
    }

    const idx = ROLE_DB.findIndex(r => r.id === id)
    ROLE_DB.splice(idx, 1)

    return {
      code: 200,
      data: null,
      message: '删除角色成功',
    }
  },

  '[GET]/system/user/options'() {
    return {
      code: 200,
      data: [
        { label: '张三', value: 101 },
        { label: '李四', value: 102 },
        { label: '王五', value: 103 },
        { label: '赵六', value: 104 },
        { label: '孙七', value: 105 },
        { label: '周八', value: 106 },
        { label: '吴九', value: 107 },
        { label: '郑十', value: 108 },
      ],
      message: '获取用户选项成功',
    }
  },
})
