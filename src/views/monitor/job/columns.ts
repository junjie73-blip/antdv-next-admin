import dayjs from 'dayjs'

import type { BasicColumn } from '~/components/business/Table'

import type { JobLogRecord, JobRecord } from './types'

/** 任务列表列定义 */
export const jobColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    dataIndex: 'jobId',
    width: 60,
    align: 'center',
    customRender: ({ index }: any) => index + 1,
  },
  { title: '任务名称', dataIndex: 'jobName', key: 'jobName', width: 160 },
  { title: '分组', dataIndex: 'jobGroup', key: 'jobGroup', width: 100, align: 'center' },
  { title: '执行目标', dataIndex: 'invokeTarget', key: 'invokeTarget', width: 200 },
  { title: 'Cron 表达式', dataIndex: 'cronExpression', key: 'cronExpression', width: 200 },
  { title: '状态', key: 'status', dataIndex: 'status', width: 90, align: 'center' },
  {
    title: '是否暂停',
    dataIndex: 'isPaused',
    key: 'isPaused',
    width: 100,
    align: 'center',
    ifShow: () => false,
  },
]

/** 执行日志列定义 */
export const logColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    dataIndex: 'logId',
    width: 60,
    align: 'center',
    customRender: ({ index }: any) => index + 1,
  },
  { title: '任务名称', dataIndex: 'jobName', key: 'jobName', width: 160 },
  { title: '执行目标', dataIndex: 'invokeTarget', key: 'invokeTarget', width: 200 },
  { title: '状态', dataIndex: 'status', key: 'status', width: 80, align: 'center' },
  { title: '消息', dataIndex: 'jobMessage', key: 'jobMessage', ellipsis: true },
  {
    title: '执行时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
    customRender: ({ record }: any) => dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss'),
  },
]

/** 任务表格操作列 */
export const jobActionColumn = {
  width: 350,
  title: '操作',
  fixed: 'right' as const,
}

/** 两张表的滚动配置 */
export const jobScroll = { x: 900 } as const

/** 行 key 提取 */
export const jobRowKey = (r: JobRecord) => r.jobId
export const logRowKey = (r: JobLogRecord) => r.logId
