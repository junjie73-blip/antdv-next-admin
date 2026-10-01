import type { BasicColumn } from '~/components/business/Table'

export const doneColumns: BasicColumn[] = [
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
    title: '任务标题',
    dataIndex: 'title',
    key: 'title',
    width: 260,
    ellipsis: true,
  },
  {
    title: '节点',
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
    title: '发起人',
    dataIndex: 'initiatorName',
    key: 'initiatorName',
    width: 120,
  },
  {
    title: '完成时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
  },
]
