import type { BasicColumn } from '~/components/business/Table'

/** 接口清单列：状态、命中与运行时配置均由单元格插槽渲染 */
export const routeColumns: BasicColumn[] = [
  {
    title: '分组',
    dataIndex: 'module',
    key: 'module',
    width: 130,
    align: 'center',
  },
  {
    title: '方法',
    dataIndex: 'method',
    key: 'method',
    width: 90,
    align: 'center',
  },
  {
    title: '接口地址',
    dataIndex: 'path',
    key: 'path',
    width: 300,
    ellipsis: true,
  },
  {
    title: '来源',
    dataIndex: 'source',
    key: 'source',
    width: 110,
    align: 'center',
  },
  {
    title: '运行时',
    dataIndex: 'effective',
    key: 'runtime',
    width: 210,
    align: 'center',
  },
  {
    title: '命中',
    dataIndex: 'count',
    key: 'count',
    width: 80,
    align: 'center',
  },
  {
    title: '均耗时',
    dataIndex: 'avgMs',
    key: 'avgMs',
    width: 90,
    align: 'center',
  },
  {
    title: '错误',
    dataIndex: 'errors',
    key: 'errors',
    width: 80,
    align: 'center',
  },
  {
    title: '最近命中',
    dataIndex: 'lastAt',
    key: 'lastAt',
    width: 165,
    align: 'center',
  },
]

/** 命中日志列 */
export const logColumns: BasicColumn[] = [
  { title: '时间', dataIndex: 'at', key: 'at', width: 170, align: 'center' },
  {
    title: '方法',
    dataIndex: 'method',
    key: 'method',
    width: 90,
    align: 'center',
  },
  {
    title: '请求地址',
    dataIndex: 'path',
    key: 'path',
    width: 280,
    ellipsis: true,
  },
  {
    title: 'HTTP',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    align: 'center',
  },
  {
    title: '业务码',
    dataIndex: 'code',
    key: 'code',
    width: 90,
    align: 'center',
  },
  { title: '耗时', dataIndex: 'ms', key: 'ms', width: 90, align: 'right' },
  {
    title: '结果',
    dataIndex: 'skipped',
    key: 'result',
    width: 120,
    align: 'center',
  },
]
