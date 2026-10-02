import type { BasicColumn } from '~/components/business/Table'

export const templateColumns: BasicColumn[] = [
  { title: '序号', key: 'index', width: 60, dataIndex: 'templateId', align: 'center' },
  { title: '模板标识', dataIndex: 'templateKey', key: 'templateKey', width: 220, ellipsis: true },
  { title: '模板名称', dataIndex: 'templateName', key: 'templateName', width: 220, ellipsis: true },
  { title: '分类', dataIndex: 'category', key: 'category', width: 100, align: 'center' },
  {
    title: '当前版本',
    dataIndex: 'currentVersion',
    key: 'currentVersion',
    width: 100,
    align: 'center',
  },
  { title: '状态', dataIndex: 'status', key: 'status', width: 90, align: 'center' },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
]

export const actionColumn = {
  width: 240,
  fixed: 'right' as const,
  align: 'center' as const,
}

export const pagination = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
}

export const rowKey = (r: { templateId: string }) => r.templateId
