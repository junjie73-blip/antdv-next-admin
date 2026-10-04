import type { FormSchema } from '~/components/business/Form/types'

import { BACKUP_STATUS_OPTIONS, BACKUP_TYPE_OPTIONS, TRIGGER_TYPE_OPTIONS } from './constants'

/**
 * 备份列表搜索表单 schema
 *
 * 字段名与 `BackupListParams` 对齐（camelCase）。
 */
export const backupSearchSchemas: FormSchema[] = [
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      options: BACKUP_STATUS_OPTIONS,
      allowClear: true,
      placeholder: '全部状态',
    },
  },
  {
    field: 'triggerType',
    label: '触发方式',
    component: 'Select',
    componentProps: {
      options: TRIGGER_TYPE_OPTIONS,
      allowClear: true,
      placeholder: '全部方式',
    },
  },
]

/**
 * 备份策略表单 schema（新增 / 编辑共用）
 *
 * 字段名与 BackupPolicy 对齐，enabled 由 Switch 控制（boolean ↔ 0/1 在提交时转换）
 */
export function usePolicyFormSchemas(): FormSchema[] {
  return [
    {
      field: 'name',
      label: '策略名称',
      component: 'Input',
      required: true,
      colProps: { span: 24 },
      componentProps: {
        placeholder: '例如：每日全量备份',
        maxlength: 64,
      },
    },
    {
      field: 'cron',
      label: 'Cron 表达式',
      required: true,
      colProps: { span: 24 },
      helpMessage: 'Quartz 语法：秒 分 时 日 月 周；可从预设中选择或手动输入',
      slot: 'cron-editor',
    },
    {
      field: 'backupType',
      label: '备份类型',
      component: 'Select',
      required: true,
      defaultValue: 'full',
      colProps: { span: 12 },
      componentProps: { options: BACKUP_TYPE_OPTIONS },
    },
    {
      field: 'enabled',
      label: '启用',
      component: 'Switch',
      defaultValue: true,
      colProps: { span: 12 },
    },
    {
      field: 'retainDays',
      label: '保留天数',
      component: 'InputNumber',
      defaultValue: 30,
      colProps: { span: 12 },
      componentProps: { min: 1, max: 365, addonAfter: '天' },
    },
    {
      field: 'retainCount',
      label: '保留份数',
      component: 'InputNumber',
      defaultValue: 10,
      colProps: { span: 12 },
      componentProps: { min: 1, max: 100, addonAfter: '份' },
    },
    {
      field: 'bucket',
      label: '存储桶',
      component: 'Input',
      colProps: { span: 24 },
      componentProps: {
        placeholder: '留空则使用系统默认存储配置',
        maxlength: 128,
      },
    },
    {
      field: 'remark',
      label: '备注',
      component: 'InputTextArea',
      colProps: { span: 24 },
      componentProps: { rows: 3, maxlength: 512, showCount: true },
    },
  ]
}
