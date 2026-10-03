<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { onMounted, onUnmounted } from 'vue'

import { BasicTable, TableAction, useTable } from '~/components/business/Table'
import dayjs from '~/utils/dayjs'
import { downloadFile } from '~/utils/download'

import type { ExportTask } from './types'

import { getExportActions } from './actions'
import { cancelExport, deleteExport, getExportDownloadUrl, listExports } from './api'
import { exportActionColumn, exportColumns, exportPagination, exportRowKey } from './columns'
import { cardClassName, containerClassName, REFRESH_INTERVAL_MS } from './constants'
import { useExportSearchSchemas } from './schemas'
import { formatDuration, formatFileSize, getStatusColor, getStatusLabel } from './utils'

defineOptions({ name: 'ExportCenter' })

// ========== 实例 ==========
const [tableRegister, tableMethods] = useTable()

// ========== Schema ==========
const searchFormSchemas = useExportSearchSchemas()

// ========== 操作 ==========
async function handleDownload(record: ExportTask) {
  const { data } = await getExportDownloadUrl(record.taskId)
  downloadFile(data.url, data.fileName ?? 'export')
}

async function handleCancel(record: ExportTask) {
  await cancelExport(record.taskId)
  message.success('已取消')
  tableMethods.value?.reload()
}

async function handleDelete(record: ExportTask) {
  await deleteExport(record.taskId)
  message.success('已删除')
  tableMethods.value?.reload()
}

function getActions(record: ExportTask) {
  return getExportActions(record, {
    onDownload: handleDownload,
    onCancel: handleCancel,
    onDelete: handleDelete,
  })
}

// ========== 生命周期 ==========
let timer: number | null = null

onMounted(() => {
  timer = window.setInterval(() => {
    tableMethods.value?.reload()
  }, REFRESH_INTERVAL_MS)
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName">
      <BasicTable
        :columns="exportColumns"
        :api="listExports"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :pagination="exportPagination"
        :action-column="exportActionColumn"
        :row-key="exportRowKey"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="tableMethods?.reload()">
            <template #icon><Icon icon="ant-design:reload-outlined" /></template>
            刷新
          </a-button>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="getStatusColor(record.status)">{{ getStatusLabel(record.status) }}</a-tag>
        </template>

        <template #cell-progress="{ record }">
          <a-progress :percent="record.progress" size="small" />
        </template>

        <template #cell-errorMsg="{ record }">{{ record.errorMsg || '—' }}</template>

        <template #cell-fileName="{ record }">{{ record.fileName || '—' }}</template>

        <template #cell-fileSize="{ record }">{{ formatFileSize(record.fileSize) }}</template>

        <template #cell-durationMs="{ record }">{{ formatDuration(record.durationMs) }}</template>

        <template #cell-createdAt="{ record }">
          {{ dayjs(record.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
        </template>

        <template #action="{ record }">
          <TableAction :actions="getActions(record as ExportTask)" />
        </template>
      </BasicTable>
    </a-card>
  </div>
</template>
