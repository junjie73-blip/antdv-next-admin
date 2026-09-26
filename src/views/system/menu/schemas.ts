import type { ComputedRef } from 'vue'

import { computed } from 'vue'

import type { FormSchema } from '~/components/business/Form'

import { MENU_LAYOUT_OPTIONS, MENU_TYPE_OPTIONS, YES_NO_OPTIONS } from './constants'

/** 状态选项类型 */
export interface StatusOption {
  label: string
  value: string | number
}

/**
 * 菜单抽屉表单 schema
 * @param statusOptions 从字典 store 获取的状态选项（响应式）
 */
export function useMenuFormSchemas(statusOptions: ComputedRef<StatusOption[]>): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'menuType',
      label: '菜单类型',
      component: 'RadioGroup',
      defaultValue: 1,
      componentProps: {
        optionType: 'button',
        buttonStyle: 'solid',
        options: MENU_TYPE_OPTIONS,
      },
    },
    {
      field: 'parentId',
      label: '上级菜单',
      component: 'ATreeSelect',
      componentProps: {
        api: '/menu/tree',
        placeholder: '请选择上级菜单（留空为顶级）',
        allowClear: true,
        treeDefaultExpandAll: true,
        fieldNames: {
          label: 'menuName',
          value: 'menuId',
          children: 'children',
        },
      },
    },
    {
      field: 'menuName',
      label: '菜单名称',
      component: 'Input',
      required: true,
      componentProps: { placeholder: '请输入菜单名称' },
    },
    {
      field: 'icon',
      label: '图标',
      component: 'Input',
      slot: 'iconPicker',
      componentProps: { placeholder: '点击选择图标', readonly: true },
      dynamicDisabled: ({ model }) => (model as any).menuType === 3,
    },
    {
      field: 'path',
      label: '路由地址',
      component: 'Input',
      componentProps: { placeholder: '例如：/system/user' },
      dynamicDisabled: ({ model }) => (model as any).menuType !== 2,
    },
    {
      field: 'component',
      label: '组件路径',
      component: 'Input',
      componentProps: { placeholder: '例如：system/user/index' },
      dynamicDisabled: ({ model }) => (model as any).menuType !== 2,
    },
    {
      field: 'isExternal',
      label: '是否外链',
      component: 'RadioGroup',
      defaultValue: false,
      componentProps: {
        optionType: 'button',
        buttonStyle: 'solid',
        options: YES_NO_OPTIONS,
      },
      ifShow: ({ model }) => (model as any).menuType === 2,
    },
    {
      field: 'layout',
      label: '布局类型',
      component: 'Select',
      componentProps: {
        placeholder: '默认使用主布局',
        allowClear: true,
        options: MENU_LAYOUT_OPTIONS,
      },
      ifShow: ({ model }) => (model as any).menuType !== 3,
    },
    {
      field: 'hidden',
      label: '侧边栏隐藏',
      component: 'RadioGroup',
      defaultValue: false,
      componentProps: {
        optionType: 'button',
        buttonStyle: 'solid',
        options: YES_NO_OPTIONS,
      },
      ifShow: ({ model }) => (model as any).menuType !== 3,
    },
    {
      field: 'keepAlive',
      label: '页面缓存',
      component: 'RadioGroup',
      defaultValue: false,
      componentProps: {
        optionType: 'button',
        buttonStyle: 'solid',
        options: YES_NO_OPTIONS,
      },
      ifShow: ({ model }) => (model as any).menuType !== 3,
    },
    {
      field: 'microAppName',
      label: '微应用名称',
      component: 'Input',
      componentProps: { placeholder: '例如：app-a' },
      ifShow: ({ model }) => {
        const m = model as any
        // 只在菜单类型、非外链时展示
        if (m.menuType !== 2) return false
        if (m.isExternal) return false
        // 已有微应用配置，或组件路径为空时展示
        return !!(m.microAppName || m.microAppUrl || m.microAppBaseroute || !m.component)
      },
    },
    {
      field: 'microAppUrl',
      label: '微应用入口',
      component: 'Input',
      componentProps: { placeholder: '例如：https://app-a.example.com' },
      ifShow: ({ model }) => {
        const m = model as any
        return m.menuType === 2 && !m.isExternal && !!m.microAppName
      },
    },
    {
      field: 'microAppBaseroute',
      label: '微应用前缀',
      component: 'Input',
      componentProps: { placeholder: '例如：/app-a' },
      ifShow: ({ model }) => {
        const m = model as any
        return m.menuType === 2 && !m.isExternal && !!m.microAppName
      },
    },
    {
      field: 'microAppKeepAlive',
      label: '微应用缓存',
      component: 'Switch',
      defaultValue: false,
      ifShow: ({ model }) => {
        const m = model as any
        return m.menuType === 2 && !m.isExternal && !!m.microAppName
      },
    },
    {
      field: 'permission',
      label: '权限标识',
      component: 'Input',
      componentProps: { placeholder: '例如：system:user:list' },
    },
    {
      field: 'sortOrder',
      label: '排序',
      component: 'InputNumber',
      componentProps: { min: 0, placeholder: '请输入排序号', style: { width: '100%' } },
    },
    {
      field: 'status',
      label: '状态',
      component: 'RadioGroup',
      defaultValue: '1',
      componentProps: () => ({
        optionType: 'button',
        buttonStyle: 'solid',
        options: statusOptions.value,
      }),
    },
  ])
}

/** 新增菜单时的空表单值 */
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
  layout: null as null | 'blank' | 'default',
  hidden: false,
  keepAlive: false,

  microAppName: '',
  microAppUrl: '',
  microAppBaseroute: '',
  microAppKeepAlive: false,
}
