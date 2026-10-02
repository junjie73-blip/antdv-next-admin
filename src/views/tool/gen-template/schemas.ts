import type { FormSchema } from '~/components/business/Form'

import { CATEGORY_OPTIONS } from './constants'

export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: { placeholder: '模板名称', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'category',
    label: '分类',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: CATEGORY_OPTIONS,
    },
    colProps: { span: 6 },
  },
]
