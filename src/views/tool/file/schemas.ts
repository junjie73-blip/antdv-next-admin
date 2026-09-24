import type { FormSchema } from '~/components/business/Form'

/** 文件搜索表单 schema */
export const fileSearchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '文件名',
    component: 'Input',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '搜索文件名...',
      allowClear: true,
    },
  },
]
