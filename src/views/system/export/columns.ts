import type { BasicColumn } from '~/components/business/Table'

import type { ExportTask } from './types'

/** 导出任务表格列 */
export const exportColumns: BasicColumn[] = [
  {
    title: '序号',
    key: 'index',
    width: 60,
    align: 'center',
    dataIndex: 'taskId',
    customRender: ({ index }) => index + 1,
  },
  { title: '文件名', dataIndex: 'fileName', key: 'fileName', width: 200, ellipsis: true },
  { title: '类型', dataIndex: 'bizType', key: 'bizType', width: 140 },
  { title: '格式', dataIndex: 'exportFormat', key: 'exportFormat', width: 80, align: 'center' },
  { title: '状态', dataIndex: 'status', key: 'status', width: 120, align: 'center' },
  { title: '进度', dataIndex: 'progress', key: 'progress', width: 160, align: 'center' },
  { title: '错误消息', dataIndex: 'errorMsg', key: 'errorMsg', width: 200, ellipsis: true },
  { title: '行数', dataIndex: 'rowCount', key: 'rowCount', width: 120, align: 'center' },
  { title: '大小', dataIndex: 'fileSize', key: 'fileSize', width: 120, align: 'center' },
  { title: '耗时', dataIndex: 'durationMs', key: 'durationMs', width: 120, align: 'center' },
  { title: '创建时间', dataIndex: 'createdAt', key: 'createdAt', width: 180 },
]

/** 操作列配置 */
export const exportActionColumn = {
  width: 200,
  title: '操作',
  fixed: 'right' as const,
}

/** 分页配置 */
export const exportPagination = {
  showSizeChanger: true,
  pageSizeOptions: ['10', '20', '50'],
  defaultPageSize: 20,
}

/** 行 key 提取 */
export const exportRowKey = (record: ExportTask) => record.taskId
