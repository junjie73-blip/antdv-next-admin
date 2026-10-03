import { cn } from '~/utils'

/** 变更类型 → 中文 */
export const CHANGE_TYPE_MAP: Record<string, string> = {
  create: '创建',
  update: '更新',
  delete: '删除',
  move: '移动',
  transfer: '调动',
  assign: '分配',
  revoke: '移除',
}

/** 变更类型 → 颜色 */
export const CHANGE_TYPE_COLOR: Record<string, string> = {
  create: 'green',
  update: 'blue',
  delete: 'red',
  move: 'purple',
  transfer: 'cyan',
  assign: 'green',
  revoke: 'orange',
}

/** scope → 中文 */
export const SCOPE_MAP: Record<string, string> = {
  dept_tree: '部门',
  user_profile: '个人信息',
  user_dept: '部门关系',
  user_role: '角色',
  position: '岗位',
}

/** source → tag 展示 */
export const SOURCE_MAP: Record<string, { text: string; color: string }> = {
  trigger: { text: '触发器', color: 'default' },
  import: { text: '导入', color: 'purple' },
  manual: { text: '手动', color: 'blue' },
  api: { text: '接口', color: 'cyan' },
}

export const ENTITY_TYPE_OPTIONS = [
  { label: '部门', value: 'dept' },
  { label: '用户', value: 'user' },
  { label: '用户-部门', value: 'user_dept' },
  { label: '用户-角色', value: 'user_role' },
]

export const SCOPE_OPTIONS = [
  { label: '部门树', value: 'dept_tree' },
  { label: '个人信息', value: 'user_profile' },
  { label: '部门关系', value: 'user_dept' },
  { label: '角色', value: 'user_role' },
  { label: '岗位', value: 'position' },
]

export const CHANGE_TYPE_OPTIONS = Object.entries(CHANGE_TYPE_MAP).map(([value, label]) => ({
  label,
  value,
}))

/** 行 key */
export const HISTORY_ROW_KEY = 'historyId'

/** 类名常量 */
export const pageWrapperClass = cn('space-y-4')
