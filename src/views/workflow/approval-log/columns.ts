import type { BasicColumn } from '~/components/business/Table'

export const logColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    dataIndex: 'log_id',
    align: 'center',
  },
  { title: '申请标题', dataIndex: 'requestTitle', key: 'requestTitle', width: 220 },
  { title: '操作人', dataIndex: 'operatorName', key: 'operatorName', width: 120 },
  {
    title: '操作类型',
    dataIndex: 'op',
    key: 'op',
    width: 100,
    align: 'center',
  },
  { title: '备注/原因', dataIndex: 'remark', key: 'remark', width: 260, ellipsis: true },
  {
    title: '操作时间',
    key: 'createdAt',
    dataIndex: 'createdAt',
    width: 170,
  },
]
