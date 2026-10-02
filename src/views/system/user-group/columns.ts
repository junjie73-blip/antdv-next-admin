import type { BasicColumn } from '~/components/business/Table'

export const userGroupColumns: BasicColumn[] = [
  { title: '序号', key: 'index', width: 60, dataIndex: 'groupId', align: 'center' },
  { title: '组编码', dataIndex: 'groupCode', key: 'groupCode', width: 160 },
  { title: '组名称', dataIndex: 'groupName', key: 'groupName', width: 200, ellipsis: true },
  { title: '类型', dataIndex: 'groupType', key: 'groupType', width: 100, align: 'center' },
  { title: '排序', dataIndex: 'sortOrder', key: 'sortOrder', width: 80, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center' },
  { title: '描述', dataIndex: 'description', key: 'description', width: 240, ellipsis: true },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
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

export const rowKey = (r: { groupId: string }) => r.groupId
