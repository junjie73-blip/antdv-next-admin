import type { BasicColumn } from '~/components/business/Table'

export const ccColumns: BasicColumn[] = [
  { title: '序号', key: 'index', width: 60, dataIndex: 'ccId', align: 'center' },
  { title: '标题', dataIndex: 'title', key: 'title', width: 260, ellipsis: true },
  { title: '节点', dataIndex: 'nodeName', key: 'nodeName', width: 160 },
  { title: '流程标识', dataIndex: 'defKey', key: 'defKey', width: 180 },
  { title: '发起人', dataIndex: 'initiatorName', key: 'initiatorName', width: 120 },
  { title: '抄送时间', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
  { title: '状态', dataIndex: 'isRead', key: 'isRead', width: 90, align: 'center' },
]
