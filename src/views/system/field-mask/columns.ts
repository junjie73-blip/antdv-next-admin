import type { BasicColumn } from '~/components/business/Table'

export const fieldMaskColumns: BasicColumn[] = [
  { title: '序号', key: 'index', width: 60, dataIndex: 'policyId', align: 'center' },
  { title: '策略名称', dataIndex: 'name', key: 'name', width: 180, ellipsis: true },
  { title: '字段路径', dataIndex: 'field', key: 'field', width: 200 },
  { title: '掩码类型', dataIndex: 'maskType', key: 'maskType', width: 110, align: 'center' },
  { title: '保留规则', dataIndex: 'keepPrefix', key: 'keepRule', width: 120, align: 'center' },
  { title: '替换字符', dataIndex: 'replaceChar', key: 'replaceChar', width: 90, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center' },
  { title: '描述', dataIndex: 'description', key: 'description', width: 200, ellipsis: true },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
]

export const actionColumn = {
  width: 160,
  fixed: 'right' as const,
  align: 'center' as const,
}

export const pagination = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
}

export const rowKey = (r: { policyId: string }) => r.policyId
