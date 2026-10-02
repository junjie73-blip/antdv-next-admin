import type { BasicColumn } from '~/components/business/Table'

export const delegateColumns: BasicColumn[] = [
  { title: '序号', key: 'index', width: 60, dataIndex: 'delegateId', align: 'center' },
  { title: '被委托人', dataIndex: 'delegateeName', key: 'delegateeName', width: 140 },
  { title: '委托范围', dataIndex: 'scope', key: 'scope', width: 120 },
  { title: '流程限定', dataIndex: 'defKeys', key: 'defKeys', width: 240, ellipsis: true },
  { title: '开始时间', dataIndex: 'startAt', key: 'startAt', width: 170 },
  { title: '结束时间', dataIndex: 'endAt', key: 'endAt', width: 170 },
  { title: '状态', dataIndex: 'enabled', key: 'enabled', width: 90, align: 'center' },
  { title: '备注', dataIndex: 'reason', key: 'reason', width: 200, ellipsis: true },
]
