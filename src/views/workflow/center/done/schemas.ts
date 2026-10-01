import type { FormSchema } from '~/components/business/Form'

export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: { placeholder: '搜索标题', allowClear: true },
  },
]
