import { cn } from '~/utils/cn'

import type { MenuLayout, MenuType } from './types'

// ========== 样式类名 ==========
export const containerClassName = cn('space-y-4 h-full')
export const cardClassName = cn('shadow-sm')
export const tagClassName = cn('inline-flex items-center gap-1')

// ========== 菜单类型映射 ==========
export const MENU_TYPE_COLOR_MAP: Record<MenuType, string> = {
  1: 'blue',
  2: 'green',
  3: 'orange',
}

export const MENU_TYPE_LABEL_MAP: Record<MenuType, string> = {
  1: '目录',
  2: '菜单',
  3: '按钮',
}

export const MENU_TYPE_ICON_MAP: Record<MenuType, string> = {
  1: 'carbon:folder',
  2: 'carbon:document',
  3: 'carbon:cu3',
}

/** 菜单类型选项（表单用） */
export const MENU_TYPE_OPTIONS = [
  { label: '目录', value: 1 as MenuType },
  { label: '菜单', value: 2 as MenuType },
  { label: '按钮', value: 3 as MenuType },
]

// ========== 状态映射 ==========
export const MENU_STATUS_COLOR_MAP: Record<string, string> = {
  '1': 'green',
  '0': 'red',
}

export const MENU_STATUS_LABEL_MAP: Record<string, string> = {
  '1': '正常',
  '0': '停用',
}

export const MENU_STATUS_ICON_MAP: Record<string, string> = {
  '1': 'carbon:checkmark-outline',
  '0': 'carbon:close-outline',
}

// ========== useCRUD 表单联动校验规则 ==========
/**
 * 菜单表单的业务校验
 * 返回 false 表示校验不通过，会中断提交
 */
export function validateMenuForm(
  values: Partial<{
    menuName: string
    menuType: number
    path: string
    component: string
    isExternal: boolean
    microAppName: string
    microAppUrl: string
    microAppBaseroute: string
  }>,
): true | string {
  if (!values.menuName) return '请填写菜单名称'

  if (values.menuType === 2) {
    // 外链：不要求 component
    if (values.isExternal) {
      if (!values.path) return '外链菜单必须填写外链地址'
      return true
    }

    // 微应用：component 可以空，但 name / url / baseroute 必填
    const isMicroApp = !!values.microAppName || !!values.microAppUrl || !!values.microAppBaseroute
    if (isMicroApp) {
      if (!values.microAppName) return '微应用名称必填'
      if (!values.microAppUrl) return '微应用入口 URL 必填'
      if (!values.microAppBaseroute) return '微应用路由前缀必填'
      if (!values.path) return '微应用菜单必须填写路由地址'
      return true
    }

    // 普通菜单：path + component 都必填
    if (!values.path) return '菜单必须填写路由地址'
    if (!values.component) return '菜单必须填写组件路径'
  }

  return true
}

export const MENU_EMPTY_VALUES = {
  parentId: undefined,
  menuType: 1,
  menuName: '',
  icon: '',
  path: '',
  component: '',
  permission: '',
  sortOrder: 0,
  status: '1',
  isExternal: false,
  layout: null as MenuLayout | null,
  hidden: false,
  keepAlive: false,

  microAppName: '',
  microAppUrl: '',
  microAppBaseroute: '',
  microAppKeepAlive: false,
}
export const MENU_LAYOUT_OPTIONS: Array<{ label: string; value: MenuLayout }> = [
  { label: '默认布局', value: 'default' },
  { label: '无布局全屏', value: 'blank' },
]
export const YES_NO_OPTIONS = [
  { label: '否', value: false },
  { label: '是', value: true },
]
