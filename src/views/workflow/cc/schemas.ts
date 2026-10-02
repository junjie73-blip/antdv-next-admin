import type { FormSchema } from '~/components/business/Form'

export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: { placeholder: '搜索标题', allowClear: true },
  },
  {
    field: 'isRead',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: [
        { label: '未读', value: 0 },
        { label: '已读', value: 1 },
      ],
    },
  },
]
