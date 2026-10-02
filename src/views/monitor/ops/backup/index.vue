<script setup lang="ts">
import { message, Modal, Select, Tag, type TableProps } from 'antdv-next'
import dayjs from 'dayjs'
import { onMounted, onUnmounted, ref } from 'vue'

import { listBackups, triggerBackup, getDownloadUrl, deleteBackup, type BackupRecord } from './api'

defineOptions({ name: 'BackupManagement' })

const loading = ref(false)
const dataSource = ref<BackupRecord[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)
const statusFilter = ref<string | undefined>(undefined)
const triggerFilter = ref<string | undefined>(undefined)

let timer: number | null = null

async function load() {
  loading.value = true
  try {
    const res = await listBackups({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      status: statusFilter.value,
      triggerType: triggerFilter.value,
    })
    dataSource.value = res.list
    total.value = res.total
  } finally {
    loading.value = false
  }
}

async function handleTrigger() {
  await triggerBackup({ backupType: 'full', remark: '手动触发' })
  message.success('备份任务已提交，稍后刷新查看进度')
  setTimeout(load, 1500)
}

async function handleDownload(record: BackupRecord) {
  const res = await getDownloadUrl(record.backup_id)
  // 触发浏览器下载
  const a = document.createElement('a')
  a.href = res.url
  a.download = res.fileName
  a.click()
}

async function handleDelete(record: BackupRecord) {
  Modal.confirm({
    title: '删除备份',
    content: `确定删除「${record.file_name}」？对象存储文件将一并删除，无法恢复。`,
    okType: 'danger',
    async onOk() {
      await deleteBackup(record.backup_id)
      message.success('已删除')
      load()
    },
  })
}

function statusColor(s: string) {
  return { completed: 'green', failed: 'red', running: 'blue', pending: 'default' }[s] ?? 'default'
}

function formatSize(bytes: string | null) {
  if (!bytes) return '—'
  const n = Number(bytes)
  if (n < 1024) return `${n} B`
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(2)} KB`
  if (n < 1024 ** 3) return `${(n / 1024 / 1024).toFixed(2)} MB`
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`
}

onMounted(() => {
  load()
  timer = window.setInterval(load, 10_000) // 自动刷新（备份进度）
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
const columns: TableProps['columns'] = [
  {
    title: '文件名',
    dataIndex: 'file_name',
    width: 240,
    fixed: 'left',
    align: 'left',
  },
  {
    title: '触发方式',
    dataIndex: 'trigger_type',
    width: 100,
    render: (text, record) => {
      return record.trigger_type === 'manual' ? '手动' : record.trigger_type === 'cron' ? '定时' : '迁移前'
    },
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'status',
    width: 100,
    render: (text, record) => {
      return h(Tag, { type: statusColor(record.status) }, record.status)
    },
    align: 'center',
  },
  {
    title: '大小',
    dataIndex: 'file_size',
    width: 100,
    render: (text, record) => {
      return formatSize(record.file_size)
    },
    align: 'center',
  },
  {
    title: '耗时',
    dataIndex: 'duration_ms',
    width: 100,
    render: (text, record) => {
      return record.duration_ms ? (record.duration_ms / 1000).toFixed(1) + 's' : '—'
    },
    align: 'center',
  },
  {
    title: '开始时间',
    dataIndex: 'started_at',
    width: 180,
    render: (text, record) => {
      return record.started_at ? dayjs(record.started_at).format('YYYY-MM-DD HH:mm:ss') : '—'
    },
    align: 'center',
  },
  {
    title: '保留至',
    dataIndex: 'retain_until',
    width: 180,
    render: (text, record) => {
      return record.retain_until ? dayjs(record.retain_until).format('YYYY-MM-DD HH:mm:ss') : '—'
    },
    align: 'center',
  },
  {
    title: '操作',
    dataIndex: 'operation',
    width: 180,
    align: 'center',
    fixed: 'right',
  },
]
</script>

<template>
  <div class="space-y-4 p-4">
    <div class="flex items-center justify-between">
      <h1 class="text-lg font-semibold">数据库备份</h1>
      <a-button type="primary" @click="handleTrigger">立即备份</a-button>
    </div>

    <a-card>
      <div class="mb-4 flex gap-3">
        <Select
          v-model:value="statusFilter"
          placeholder="状态"
          allow-clear
          style="width: 140px"
          @change="
            () => {
              pageNum = 1
              load()
            }
          "
        >
          <a-select-option value="completed">成功</a-select-option>
          <a-select-option value="failed">失败</a-select-option>
          <a-select-option value="running">进行中</a-select-option>
          <a-select-option value="pending">等待</a-select-option>
        </Select>

        <Select
          v-model:value="triggerFilter"
          placeholder="触发方式"
          allow-clear
          style="width: 140px"
          @change="
            () => {
              pageNum = 1
              load()
            }
          "
        >
          <a-select-option value="manual">手动</a-select-option>
          <a-select-option value="cron">定时</a-select-option>
          <a-select-option value="pre_migrate">迁移前</a-select-option>
        </Select>
      </div>

      <a-table
        :data-source="dataSource"
        :loading="loading"
        :pagination="{
          current: pageNum,
          pageSize,
          total,
          showSizeChanger: true,
          onChange: (p: number, s: number) => {
            pageNum = p
            pageSize = s
            load()
          },
        }"
        row-key="backup_id"
        size="middle"
        :columns
      >
        <template #bodyCell="{ record, column }">
          <template v-if="column.dataIndex === 'operation'">
            <a-space>
              <a-button
                type="link"
                size="small"
                :disabled="record.status !== 'completed'"
                @click="handleDownload(record)"
              >
                下载
              </a-button>
              <a-button type="link" size="small" danger @click="handleDelete(record)"> 删除 </a-button></a-space
            >
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
