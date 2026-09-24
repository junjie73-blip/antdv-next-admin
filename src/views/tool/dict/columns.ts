import type { BasicColumn } from '~/components/business/Table'

/** 字典项表格列 */
export const dictItemColumns: BasicColumn[] = [
  {
    title: '字典标签',
    dataIndex: 'dictLabel',
    key: 'dictLabel',
    width: 140,
    ellipsis: true,
  },
  {
    title: '字典编码',
    dataIndex: 'dictValue',
    key: 'dictValue',
    width: 140,
    ellipsis: true,
  },
  {
    title: '排序',
    dataIndex: 'sortOrder',
    key: 'sortOrder',
    width: 80,
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    align: 'center',
  },
  {
    title: '备注',
    dataIndex: 'remark',
    key: 'remark',
    minWidth: 160,
    ellipsis: true,
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
    align: 'center',
  },
]

/** 字典项操作列 */
export const dictItemActionColumn = {
  width: 140,
  title: '操作',
  fixed: 'right' as const,
  align: 'center' as const,
}

/** 字典项分页配置 */
export const dictItemPagination = {
  showSizeChanger: true,
  showQuickJumper: false,
  size: 'small' as const,
  pageSizeOptions: ['10', '20', '50'],
  showTotal: (total: number) => `共 ${total} 条`,
}

/** 表格滚动配置（总宽约 930px，小屏横向滚动） */
export const dictItemScroll = { x: 930 } as const

export const dictTypeRowSelection = { type: 'checkbox' as const }
export const dictTypeRowKey = (record: { dictDataId: string }) => record.dictDataId
