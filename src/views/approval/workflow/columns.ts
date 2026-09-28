import type { BasicColumn } from '~/components/business/Table'

export const flowColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    dataIndex: 'requestId',
    align: 'center',
  },
  { title: '申请标题', dataIndex: 'title', width: 200 },
  { title: '申请人', dataIndex: 'applicantName', width: 120 },
  { title: '当前审批部门', dataIndex: 'currentDeptName', width: 160 },
  {
    title: '状态',
    key: 'status',
    dataIndex: 'status',
    width: 100,
  },
  {
    title: '提交时间',
    key: 'createdAt',
    dataIndex: 'createdAt',
    width: 170,
  },
]
