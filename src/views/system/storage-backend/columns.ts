import type { BasicColumn } from '~/components/business/Table'

export const storageColumns: BasicColumn[] = [
  { title: '序号', key: 'index', width: 60, dataIndex: 'backendId', align: 'center' },
  { title: '后端名称', dataIndex: 'backendName', key: 'backendName', width: 180, ellipsis: true },
  { title: '类型', dataIndex: 'backendType', key: 'backendType', width: 130, align: 'center' },
  { title: '优先级', dataIndex: 'priority', key: 'priority', width: 90, align: 'center' },
  { title: '激活状态', dataIndex: 'isActive', key: 'isActive', width: 100, align: 'center' },
  { title: '健康状态', dataIndex: 'isHealthy', key: 'isHealthy', width: 100, align: 'center' },
  { title: '最近检查', dataIndex: 'lastCheckAt', key: 'lastCheckAt', width: 170 },
  { title: '备注', dataIndex: 'remark', key: 'remark', width: 180, ellipsis: true },
]

export const actionColumn = {
  width: 300,
  fixed: 'right' as const,
  align: 'center' as const,
}

export const pagination = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
}

export const rowKey = (r: { backendId: string }) => r.backendId
