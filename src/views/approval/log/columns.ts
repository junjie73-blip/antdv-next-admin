import type { BasicColumn } from '~/components/business/Table'

export const logColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    dataIndex: 'logId',
    align: 'center',
  },
  { title: '申请标题', dataIndex: 'title', width: 200 },
  { title: '操作人', dataIndex: 'operator_name', width: 120 },
  {
    title: '操作类型',
    dataIndex: 'action',
    key: 'action',
    width: 100,
  },
  { title: '备注/原因', dataIndex: 'remark', width: 200 },
  {
    title: '操作时间',
    key: 'created_at',
    dataIndex: 'created_at',
    width: 170,
  },
]
