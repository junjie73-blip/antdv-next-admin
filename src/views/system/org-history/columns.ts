import type { BasicColumn } from '~/components/business/Table'

export const orgHistoryColumns: BasicColumn[] = [
  { title: '序号', dataIndex: 'historyId', key: 'index', width: 120 },
  {
    title: '时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
  },
  {
    title: '范围',
    dataIndex: 'scope',
    key: 'scope',
    width: 100,
  },
  {
    title: '变更',
    dataIndex: 'changeType',
    key: 'changeType',
    width: 90,
  },
  { title: '摘要', dataIndex: 'summary', key: 'summary', ellipsis: true },
  {
    title: '操作者',
    dataIndex: 'operatorName',
    key: 'operatorName',
    width: 120,
  },
  { title: '来源', dataIndex: 'source', key: 'source', width: 90 },
]

/** 操作列配置 */
export const orgHistoryActionColumn = {
  title: '操作',
  dataIndex: 'action',
  key: 'action',
  width: 220,
  fixed: 'right' as const,
}
