import type { ActionColumnProps, BasicColumn } from '~/components/business/Table/types'

import dayjs from '~/utils/dayjs'

import { formatDuration, formatSize } from './utils'

export const backupColumns: BasicColumn[] = [
  {
    key: 'index',
    dataIndex: 'backupId',
    width: 60,
    align: 'center',
    title: '序号',
  },
  {
    title: '文件名',
    dataIndex: 'fileName',
    key: 'fileName',
    width: 240,
    fixed: 'left',
    align: 'left',
    ellipsis: true,
  },
  {
    title: '触发方式',
    dataIndex: 'triggerType',
    key: 'trigger_type',
    width: 100,
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    align: 'center',
  },
  {
    title: '大小',
    dataIndex: 'fileSize',
    key: 'file_size',
    width: 110,
    align: 'center',
    customRender: ({ record }) => formatSize(record.fileSize),
  },
  {
    title: '耗时',
    dataIndex: 'durationMs',
    key: 'duration_ms',
    width: 100,
    align: 'center',
    customRender: ({ record }) => formatDuration(record.durationMs),
  },
  {
    title: '开始时间',
    dataIndex: 'startedAt',
    key: 'started_at',
    width: 180,
    align: 'center',
    customRender: ({ record }) => (record.startedAt ? dayjs(record.startedAt).format('YYYY-MM-DD HH:mm:ss') : '—'),
  },
  {
    title: '保留至',
    dataIndex: 'retainUntil',
    key: 'retainUntil',
    width: 180,
    align: 'center',
    customRender: ({ record }) => (record.retainUtil ? dayjs(record.retainUntil).format('YYYY-MM-DD HH:mm:ss') : '—'),
  },
]

/** 操作列（由 BasicTable 渲染，内容走 `#action` 插槽） */
export const backupActionColumn: ActionColumnProps = {
  fixed: 'right',
  width: 160,
  align: 'center',
}
export const policyColumns: BasicColumn[] = [
  {
    key: 'index',
    dataIndex: 'policyId',
    width: 60,
    align: 'center',
    title: '序号',
  },
  {
    title: '策略名称',
    dataIndex: 'name',
    key: 'name',
    width: 140,
    ellipsis: true,
  },
  {
    title: 'Cron',
    dataIndex: 'cron',
    key: 'cron',
    width: 130,
    ellipsis: true,
  },
  {
    title: '类型',
    dataIndex: 'backupType',
    key: 'backupType',
    width: 80,
    align: 'center',
  },
  {
    title: '保留',
    dataIndex: 'retain',
    key: 'retain',
    width: 100,
    align: 'center',
    customRender: ({ record }) => `${record.retainDays}天/${record.retainCount}份`,
  },
  {
    title: '启用',
    dataIndex: 'enabled',
    key: 'enabled',
    width: 70,
    align: 'center',
  },
]

export const policyActionColumn: ActionColumnProps = {
  dataIndex: 'action',
  width: 100,
  fixed: 'right',
}
