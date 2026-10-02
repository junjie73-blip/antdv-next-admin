import type { FormSchema } from '~/components/business/Form'

import { GROUP_TYPE_OPTIONS, STATUS_OPTIONS } from './constants'

/** 搜索表单 */
export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: { placeholder: '组编码或名称', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'groupType',
    label: '类型',
    component: 'Select',
    componentProps: {
      placeholder: '全部',
      allowClear: true,
      options: GROUP_TYPE_OPTIONS,
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

/** 创建/编辑表单 */
export const formSchemas: FormSchema[] = [
  {
    field: 'groupCode',
    label: '组编码',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: {
      placeholder: '字母开头，含字母数字下划线中划线',
      maxlength: 64,
    },
  },
  {
    field: 'groupName',
    label: '组名称',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入组名称', maxlength: 128 },
  },
  {
    field: 'groupType',
    label: '组类型',
    component: 'Select',
    defaultValue: 'custom',
    componentProps: { options: GROUP_TYPE_OPTIONS },
    colProps: { span: 12 },
  },
  {
    field: 'sortOrder',
    label: '排序',
    component: 'InputNumber',
    defaultValue: 0,
    componentProps: { min: 0, class: 'w-full' },
    colProps: { span: 12 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    defaultValue: '1',
    componentProps: { optionType: 'button', buttonStyle: 'solid', options: STATUS_OPTIONS },
    colProps: { span: 24 },
  },
  {
    field: 'description',
    label: '描述',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { rows: 3, maxlength: 512, placeholder: '可选' },
  },
]
