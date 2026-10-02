import type { BasicColumn } from '~/components/business/Table'

export const slowQueryColumns: BasicColumn[] = [
  { title: '序号', key: 'index', width: 60, dataIndex: 'id', align: 'center' },
  { title: 'SQL 样本', dataIndex: 'querySample', key: 'querySample', ellipsis: true, width: 400 },
  { title: '调用次数', dataIndex: 'calls', key: 'calls', width: 100, align: 'right' },
  { title: '平均耗时', dataIndex: 'meanTimeMs', key: 'meanTimeMs', width: 110, align: 'right' },
  { title: '最大耗时', dataIndex: 'maxTimeMs', key: 'maxTimeMs', width: 110, align: 'right' },
  { title: 'P95', dataIndex: 'p95TimeMs', key: 'p95TimeMs', width: 100, align: 'right' },
  { title: '总耗时', dataIndex: 'totalTimeMs', key: 'totalTimeMs', width: 110, align: 'right' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center' },
  { title: '最近出现', dataIndex: 'lastSeenAt', key: 'lastSeenAt', width: 170 },
]

export const actionColumn = {
  width: 200,
  fixed: 'right' as const,
  align: 'center' as const,
}

export const pagination = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
}

export const rowKey = (r: { id: string }) => r.id
