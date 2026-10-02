import type { BasicColumn } from '~/components/business/Table'

export const templateColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    dataIndex: 'templateId',
    width: 60, // ⭐ 120 → 60
    align: 'center',
    customRender: ({ index }: any) => index + 1,
  },
  {
    title: '模板名称',
    dataIndex: 'templateName',
    width: 200,
    ellipsis: true,
  },
  {
    title: '模板编码',
    dataIndex: 'templateCode',
    width: 180,
    ellipsis: true,
  },
  {
    title: '渠道',
    dataIndex: 'channelType',
    key: 'channelType',
    width: 110,
    align: 'center',
  },
  {
    title: '模板标题',
    dataIndex: 'title',
    width: 220,
    ellipsis: true,
  },
  {
    title: '变量数',
    dataIndex: 'params',
    key: 'params',
    width: 90,
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    align: 'center',
  },
  {
    title: '更新时间',
    dataIndex: 'updatedAt',
    key: 'updatedAt',
    width: 170,
  },
]

export const templateActionColumn = {
  width: 280, // 5 个按钮，300 → 280 压缩一下
  title: '操作',
  fixed: 'right' as const,
  align: 'center' as const,
}

export const templateRowKey = (record: { templateId: string }) => record.templateId

export const templatePagination = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
}
