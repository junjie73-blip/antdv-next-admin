import type { FormSchema } from '~/components/business/Form'

import { BACKEND_TYPE_OPTIONS } from './constants'

export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: { placeholder: '后端名称', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'backendType',
    label: '类型',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: BACKEND_TYPE_OPTIONS,
    },
    colProps: { span: 6 },
  },
]
