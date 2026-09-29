import type { BasicColumn } from '~/components/business/Table'

export const templateColumns: BasicColumn[] = [
  { title: '序号', key: 'index', dataIndex: 'templateId', width: 120, align: 'center' },
  { title: '模板名称', dataIndex: 'templateName', width: 180, ellipsis: true },
  { title: '模板编码', dataIndex: 'templateCode', width: 180, ellipsis: true },
  { title: '渠道', dataIndex: 'channelType', width: 110, align: 'center' },
  { title: '模板标题', dataIndex: 'title', width: 200, ellipsis: true },
  { title: '变量数', dataIndex: 'params', width: 90, align: 'center' },
  { title: '状态', dataIndex: 'status', width: 80, align: 'center' },
  { title: '更新时间', dataIndex: 'updatedAt', width: 170 },
]

export const templateActionColumn = {
  width: 300,
  title: '操作',
  fixed: 'right' as const,
}

export const templateRowKey = (record: { templateId: string }) => record.templateId
