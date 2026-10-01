import type { BasicColumn } from '~/components/business/Table'

export const exportTaskColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    dataIndex: 'task_id',
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  {
    title: '文件',
    dataIndex: 'file_name',
    key: 'file_name',
    width: 260,
    ellipsis: true,
  },
  {
    title: '报表',
    dataIndex: 'report_code',
    key: 'report_code',
    width: 160,
    ellipsis: true,
  },
  {
    title: '格式',
    dataIndex: 'export_type',
    key: 'export_type',
    width: 90,
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 160,
  },
  {
    title: '数据量',
    dataIndex: 'row_count',
    key: 'row_count',
    width: 100,
    align: 'right',
  },
  {
    title: '耗时',
    dataIndex: 'duration_ms',
    key: 'duration_ms',
    width: 100,
    align: 'right',
  },
  {
    title: '重试',
    dataIndex: 'retry_count',
    key: 'retry_count',
    width: 100,
    align: 'center',
  },
  {
    title: '创建时间',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 170,
  },
]

export const exportTaskActionColumn = {
  width: 200,
  title: '操作',
  fixed: 'right' as const,
  align: 'center' as const,
}

export const exportTaskRowKey = (record: { task_id: string }) => record.task_id
