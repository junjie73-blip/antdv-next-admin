import type { ComputedRef } from 'vue'

import { computed } from 'vue'

import type { FormSchema } from '~/components/business/Form'

export interface StatusOption {
  label: string
  value: string | number
}

/**
 * 搜索表单 schema
 * 依赖 statusOptions（字典异步加载）——必须用工厂函数保证响应性
 */
export function useRoleSearchSchemas(statusOptions: ComputedRef<StatusOption[]>): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'keyword',
      label: '关键词',
      component: 'Input',
      colProps: { span: 6 },
      componentProps: {
        placeholder: '搜索角色名称/编码...',
        allowClear: true,
      },
    },
    {
      field: 'status',
      label: '状态',
      component: 'Select',
      defaultValue: '1',
      colProps: { span: 6 },
      componentProps: {
        placeholder: '选择状态',
        allowClear: true,
        options: statusOptions.value,
      },
    },
  ])
}

/**
 * 抽屉表单 schema
 * 依赖 statusOptions（同上）
 */
export function useRoleFormSchemas(statusOptions: ComputedRef<StatusOption[]>): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'roleName',
      label: '角色名称',
      component: 'Input',
      required: true,
      colProps: { span: 24 },
      componentProps: { placeholder: '请输入角色名称' },
    },
    {
      field: 'roleCode',
      label: '角色编码',
      component: 'Input',
      required: true,
      colProps: { span: 24 },
      componentProps: { placeholder: '请输入角色编码，如 admin' },
    },
    {
      field: 'sortOrder',
      label: '排序',
      component: 'InputNumber',
      colProps: { span: 12 },
      defaultValue: 0,
      componentProps: { min: 0, placeholder: '数字越小越靠前', style: { width: '100%' } },
    },
    {
      field: 'status',
      label: '状态',
      component: 'RadioGroup',
      defaultValue: '1',
      colProps: { span: 12 },
      componentProps: () => ({
        optionType: 'button',
        buttonStyle: 'solid',
        options: statusOptions.value,
      }),
    },
    {
      field: 'dataScope',
      label: '数据权限',
      component: 'Select',
      defaultValue: '1',
      colProps: { span: 24 },
      componentProps: {
        placeholder: '选择数据权限范围',
        options: [
          { label: '全部数据', value: '1' },
          { label: '自定义数据', value: '2' },
          { label: '本部门数据', value: '3' },
          { label: '本部门及以下数据', value: '4' },
          { label: '仅本人数据', value: '5' },
        ],
      },
      helpMessage: '自定义时需在「权限分配」抽屉中额外配置部门范围',
    },
    {
      field: 'description',
      label: '描述',
      component: 'InputTextArea',
      colProps: { span: 24 },
      componentProps: { placeholder: '请输入角色描述...', rows: 3 },
    },
  ])
}
