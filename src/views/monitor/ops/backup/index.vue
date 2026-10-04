<script setup lang="ts">
import { useIntervalFn, useTimeoutFn } from '@vueuse/core'
import { message } from 'antdv-next'

import { BasicTable, TableAction, useTable } from '~/components/business/Table'
import { downloadFile } from '~/utils/download'

import type { BackupRecord } from './types'

import { getBackupActions } from './actions'
import { deleteBackup, getDownloadUrl, listBackups, triggerBackup } from './api'
import { backupActionColumn, backupColumns } from './columns'
import BackupPolicyDrawer from './components/BackupPolicyDrawer.vue'
import {
  BACKUP_POLL_INTERVAL,
  BACKUP_RELOAD_DELAY,
  BACKUP_ROW_KEY,
  BACKUP_STATUS_MAP,
  TRIGGER_TYPE_MAP,
} from './constants'
import { backupPagination } from './pagination'
import { backupSearchSchemas } from './schemas'
defineOptions({ name: 'BackupManagement' })
const policyDrawerOpen = ref(false)
/* ============================================================
 * 表格
 * ============================================================ */

const [tableRegister, tableMethods] = useTable()

/* ============================================================
 * 手动备份
 * ============================================================ */

const triggering = ref(false)

/** 触发备份后延迟刷新（给后端一点落库时间） */
const { start: scheduleReload } = useTimeoutFn(() => tableMethods.value?.reload(), BACKUP_RELOAD_DELAY, {
  immediate: false,
})

async function handleTrigger() {
  if (triggering.value) return
  triggering.value = true
  try {
    await triggerBackup({ backupType: 'full', remark: '手动触发' })
    message.success('备份任务已提交，稍后刷新查看进度')
    scheduleReload()
  } finally {
    triggering.value = false
  }
}

/* ============================================================
 * 行操作
 * ============================================================ */

async function handleDownload(record: BackupRecord) {
  const info = await getDownloadUrl(record.backupId)
  const filename = info.fileName || record.fileName || `backup-${record.backupId}.sql`

  await downloadFile(info.url, filename)
}

async function handleDelete(record: BackupRecord) {
  await deleteBackup(record.backupId)
  message.success('已删除')
  tableMethods.value?.reload()
}

const actionCtx = {
  onDownload: handleDownload,
  onDelete: handleDelete,
}

/* ============================================================
 * 轮询：备份进度
 * ============================================================
 * useIntervalFn 会在组件卸载时自动清理，无需手动 clearInterval
 */
useIntervalFn(() => tableMethods.value?.reload(), BACKUP_POLL_INTERVAL, { immediate: true, immediateCallback: false })

/* ============================================================
 * 状态渲染辅助
 * ============================================================ */

function getStatusConfig(status: keyof typeof BACKUP_STATUS_MAP) {
  return BACKUP_STATUS_MAP[status] ?? { text: status, color: 'default' }
}

function getTriggerText(type: keyof typeof TRIGGER_TYPE_MAP) {
  return TRIGGER_TYPE_MAP[type] ?? type
}
</script>

<template>
  <a-card>
    <BasicTable
      :columns="backupColumns"
      :api="listBackups"
      :immediate="true"
      :use-search-form="true"
      :form-config="{ schemas: backupSearchSchemas, labelWidth: 80 }"
      :action-column="backupActionColumn"
      :row-key="BACKUP_ROW_KEY"
      :pagination="backupPagination"
      :scroll="{ x: 1200 }"
      size="middle"
      @register="tableRegister"
    >
      <template #toolbar>
        <a-button @click="policyDrawerOpen = true"> 策略管理 </a-button>
        <a-button type="primary" :loading="triggering" @click="handleTrigger"> 立即备份 </a-button>
      </template>
      <!-- 触发方式 -->
      <template #cell-trigger_type="{ record }">
        {{ getTriggerText(record.trigger_type) }}
      </template>

      <!-- 状态 -->
      <template #cell-status="{ record }">
        <a-tag :color="getStatusConfig(record.status).color">
          {{ getStatusConfig(record.status).text }}
        </a-tag>
      </template>

      <!-- 操作 -->
      <template #action="{ record }">
        <TableAction :actions="getBackupActions(record as BackupRecord, actionCtx)" />
      </template>
    </BasicTable>
    <BackupPolicyDrawer v-model:open="policyDrawerOpen" />
  </a-card>
</template>
