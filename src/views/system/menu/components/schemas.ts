import type { ComputedRef } from 'vue'

import { computed } from 'vue'

import type { FormSchema } from '~/components/business/Form'

export interface StatusOption {
  label: string
  value: string | number
}

/**
 * 按钮权限表单 schema
 * @param statusOptions 从字典 store 获取的状态选项（响应式）
 */
export function usePermissionFormSchemas(statusOptions: ComputedRef<StatusOption[]>): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'menuName',
      label: '按钮名称',
      component: 'Input',
      required: true,
      componentProps: { placeholder: '请输入按钮名称' },
    },
    {
      field: 'permission',
      label: '权限标识',
      component: 'Input',
      required: true,
      componentProps: { placeholder: '例如：system:user:create' },
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
