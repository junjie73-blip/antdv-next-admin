import type { BasicColumn } from '~/components/business/Table'

export const definitionColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    dataIndex: 'def_id',
    align: 'center',
  },
  {
    title: '流程名称',
    dataIndex: 'def_name',
    key: 'def_name',
    width: 220,
  },
  {
    title: '流程标识',
    dataIndex: 'def_key',
    key: 'def_key',
    width: 180,
  },
  {
    title: '版本',
    dataIndex: 'version',
    key: 'version',
    width: 90,
    align: 'center',
  },
  {
    title: '分类',
    dataIndex: 'category',
    key: 'category',
    width: 120,
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    align: 'center',
  },
  {
    title: '更新时间',
    dataIndex: 'updated_at',
    key: 'updated_at',
    width: 170,
  },
]
