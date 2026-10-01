import type { BasicColumn } from '~/components/business/Table'

export const initiatedColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    dataIndex: 'id',
    align: 'center',
  },
  {
    title: '来源',
    dataIndex: 'source',
    key: 'source',
    width: 90,
    align: 'center',
  },
  {
    title: '标题',
    dataIndex: 'title',
    key: 'title',
    width: 260,
    ellipsis: true,
  },
  {
    title: '当前节点',
    dataIndex: 'nodeName',
    key: 'nodeName',
    width: 160,
  },
  {
    title: '流程标识',
    dataIndex: 'defKey',
    key: 'defKey',
    width: 180,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    align: 'center',
  },
  {
    title: '发起时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
  },
]
