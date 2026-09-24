import type { BasicColumn } from '~/components/business/Table'

import type { ConfigRecord } from './types'

/** 配置表格列 */
export const configColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '配置键', dataIndex: 'configKey', key: 'configKey', width: 220, ellipsis: true },
  { title: '配置值', dataIndex: 'configValue', key: 'configValue', width: 280, ellipsis: true },
  { title: '描述', dataIndex: 'description', key: 'description', ellipsis: true },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170, align: 'center' },
]

/** 操作列配置 */
export const configActionColumn = {
  width: 250,
  title: '操作',
  fixed: 'right' as const,
}

/** 分页配置 */
export const configPagination = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
}

/** 行选择配置 */
export const configRowSelection = { type: 'checkbox' as const }

/** 滚动配置 */
export const configScroll = { x: 1100 } as const

/** 行 key 提取 */
export const configRowKey = (record: ConfigRecord) => record.configId
