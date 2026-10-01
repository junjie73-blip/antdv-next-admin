import type { FormSchema } from '~/components/business/Form'

import { SOURCE_MAP } from './constants'

export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: { placeholder: '搜索标题', allowClear: true },
  },
  {
    field: 'source',
    label: '来源',
    component: 'Select',
    componentProps: {
      placeholder: '全部来源',
      allowClear: true,
      options: Object.entries(SOURCE_MAP).map(([value, meta]) => ({
        value,
        label: meta.label,
      })),
    },
  },
  {
    field: 'priority',
    label: '优先级',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: [
        { label: '普通', value: 0 },
        { label: '重要', value: 1 },
        { label: '紧急', value: 2 },
      ],
    },
  },
]
