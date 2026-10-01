import type { BasicColumn } from '~/components/business/Table'

export const logColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    dataIndex: 'log_id',
    align: 'center',
  },
  { title: '申请标题', dataIndex: 'request_title', key: 'request_title', width: 220 },
  { title: '操作人', dataIndex: 'operator_name', key: 'operator_name', width: 120 },
  {
    title: '操作类型',
    dataIndex: 'action',
    key: 'action',
    width: 100,
    align: 'center',
  },
  { title: '备注/原因', dataIndex: 'remark', key: 'remark', width: 260, ellipsis: true },
  {
    title: '操作时间',
    key: 'created_at',
    dataIndex: 'created_at',
    width: 170,
  },
]
