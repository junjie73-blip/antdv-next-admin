import type { FormSchema } from '~/components/business/Form'

export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: { placeholder: '搜索标题', allowClear: true },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: [
        { label: '运行中', value: '0' },
        { label: '已完成', value: '1' },
        { label: '已终止', value: '2' },
        { label: '已挂起', value: '3' },
      ],
    },
  },
]
