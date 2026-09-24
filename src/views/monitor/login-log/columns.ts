import type { BasicColumn } from '~/components/business/Table'

import type { LoginLogRecord } from './types'

/** 登录日志表格列 */
export const loginLogColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    dataIndex: 'logId',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '用户名', dataIndex: 'username', key: 'username', width: 120, align: 'center' },
  { title: 'IP地址', dataIndex: 'ipAddress', key: 'ipAddress', width: 140, ellipsis: true },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '消息', dataIndex: 'message', key: 'message', width: 200, ellipsis: true },
  { title: '登录时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
]

/** 操作列配置 */
export const loginLogActionColumn = {
  width: 80,
  title: '操作',
  fixed: 'right' as const,
}

/** 分页配置 */
export const loginLogPagination = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
}

/** 滚动配置 */
export const loginLogScroll = { x: 1200 } as const

/** 行 key 提取 */
export const loginLogRowKey = (record: LoginLogRecord) => record.logId
