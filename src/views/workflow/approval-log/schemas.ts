import type { FormSchema } from '~/components/business/Form'

import { ACTION_MAP } from './constants'

export const searchSchemas: FormSchema[] = [
  {
    field: 'title',
    label: '申请标题',
    component: 'Input',
    componentProps: { placeholder: '请输入标题', allowClear: true },
  },
  {
    field: 'action',
    label: '操作类型',
    component: 'Select',
    componentProps: {
      placeholder: '请选择操作类型',
      allowClear: true,
      options: Object.entries(ACTION_MAP).map(([value, meta]) => ({
        value,
        label: meta.label,
      })),
    },
  },
  {
    field: 'operatorName',
    label: '操作人',
    component: 'Input',
    componentProps: { placeholder: '请输入操作人', allowClear: true },
  },
]
