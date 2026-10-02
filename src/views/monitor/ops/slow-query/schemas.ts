import type { FormSchema } from '~/components/business/Form'

import { ORDER_BY_OPTIONS, STATUS_OPTIONS } from './constants'

export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: 'SQL',
    component: 'Input',
    componentProps: { placeholder: '模糊匹配 SQL', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: { placeholder: '全部', allowClear: true, options: STATUS_OPTIONS },
    colProps: { span: 4 },
  },
  {
    field: 'orderBy',
    label: '排序',
    component: 'Select',
    componentProps: {
      placeholder: '平均耗时',
      allowClear: true,
      options: ORDER_BY_OPTIONS,
    },
    colProps: { span: 4 },
  },
  {
    field: 'minMeanMs',
    label: '最低均耗',
    component: 'InputNumber',
    componentProps: { placeholder: 'ms', min: 0, class: 'w-full' },
    colProps: { span: 4 },
  },
]
