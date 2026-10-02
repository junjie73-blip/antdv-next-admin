import type { FormSchema } from '~/components/business/Form'

import { MASK_TYPE_OPTIONS, STATUS_OPTIONS } from './constants'

/** 搜索表单 */
export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: { placeholder: '策略名称或字段', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'maskType',
    label: '类型',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: MASK_TYPE_OPTIONS,
    },
    colProps: { span: 6 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: STATUS_OPTIONS,
    },
    colProps: { span: 6 },
  },
]
