import type { BasicColumn } from '~/components/business/Table'

export const datasetColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    dataIndex: 'dataset_id',
    align: 'center',
  },
  {
    title: '数据集名称',
    dataIndex: 'dataset_name',
    key: 'dataset_name',
    width: 220,
  },
  {
    title: '数据集编码',
    dataIndex: 'dataset_code',
    key: 'dataset_code',
    width: 180,
  },
  {
    title: '类型',
    dataIndex: 'dataset_type',
    key: 'dataset_type',
    width: 100,
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
    width: 90,
    align: 'center',
  },
  {
    title: '更新时间',
    dataIndex: 'updated_at',
    key: 'updated_at',
    width: 170,
  },
]
