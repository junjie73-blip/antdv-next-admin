import type { DescriptionItem } from '~/components/business/Description'
import type { FormSchema } from '~/components/business/Form'

import { LOGIN_STATUS_OPTIONS } from './constants'

/** 搜索表单 schema */
export const loginLogSearchSchemas: FormSchema[] = [
  {
    field: 'username',
    label: '用户名',
    component: 'Input',
    componentProps: { placeholder: '请输入用户名', allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '选择状态',
      allowClear: true,
      options: LOGIN_STATUS_OPTIONS,
    },
    colProps: { span: 6 },
  },
  {
    field: 'dateRange',
    label: '登录时间',
    component: 'RangePicker',
    componentProps: {
      placeholder: ['开始时间', '结束时间'],
      format: 'YYYY-MM-DD HH:mm:ss',
      showTime: true,
      allowClear: true,
    },
    colProps: { span: 8 },
  },
]

/** 详情描述 schema */
export const loginLogDetailSchemas: DescriptionItem[] = [
  { field: 'logId', label: '日志编号' },
  { field: 'tenantId', label: '租户ID' },
  { field: 'userId', label: '用户ID' },
  { field: 'username', label: '用户名' },
  { field: 'ipAddress', label: 'IP地址' },
  { field: 'status', label: '状态' },
  { field: 'message', label: '消息' },
  { field: 'createdAt', label: '登录时间' },
  { field: 'userAgent', label: 'User-Agent' },
]
