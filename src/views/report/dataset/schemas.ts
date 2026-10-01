import type { FormSchema } from '~/components/business/Form'

export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: { placeholder: '搜索名称或编码', allowClear: true },
  },
  {
    field: 'category',
    label: '分类',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: [
        { label: '业务', value: 'business' },
        { label: '财务', value: 'finance' },
        { label: '系统', value: 'system' },
      ],
    },
  },
]
