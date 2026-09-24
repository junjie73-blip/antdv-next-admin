import type { BasicColumn } from '~/components/business/Table'

import type { DeptRecord } from './types'

/**
 * 部门表格列：总宽约 950px
 * 列宽调整策略：
 *  - 部门名称 220（给树形缩进留空间）
 *  - 部门编码 180
 *  - 负责人/联系电话 各 100/130
 *  - 邮箱 200
 *  - 排序号 80
 *  - 状态 90
 *  - 创建时间 170
 *  - 操作 260（4 个按钮）
 */
export const deptColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  {
    title: '部门名称',
    dataIndex: 'deptName',
    key: 'deptName',
    width: 220,
    ellipsis: true,
  },
  {
    title: '部门编码',
    dataIndex: 'deptCode',
    key: 'deptCode',
    width: 180,
    ellipsis: true,
  },
  {
    title: '负责人',
    dataIndex: 'leader',
    key: 'leader',
    width: 100,
    align: 'center',
    ellipsis: true,
  },
  {
    title: '联系电话',
    dataIndex: 'phone',
    key: 'phone',
    width: 130,
    align: 'center',
  },
  {
    title: '邮箱',
    dataIndex: 'email',
    key: 'email',
    width: 200,
    ellipsis: true,
  },
  {
    title: '排序号',
    dataIndex: 'sortOrder',
    key: 'sortOrder',
    width: 80,
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
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
    align: 'center',
  },
]

/** 操作列 */
export const deptActionColumn = {
  width: 350,
  title: '操作',
  fixed: 'right' as const,
  align: 'center' as const,
}

/** 滚动：总宽约 1230 + 操作 260 = 1490 */
export const deptScroll = { x: 1230 } as const

/** 行 key */
export const deptRowKey = (record: DeptRecord) => record.deptId
