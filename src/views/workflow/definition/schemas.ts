import type { FormSchema } from '~/components/business/Form'

export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: { placeholder: '搜索流程名称或标识', allowClear: true },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: [
        { label: '草稿', value: '0' },
        { label: '已发布', value: '1' },
        { label: '已停用', value: '2' },
      ],
    },
  },
]
