<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <a-spin :spinning="loading">
        <a-table
          :columns="columns"
          :data-source="list"
          :pagination="false"
          :row-key="(r: ArchivePolicyRecord) => r.policyId"
          size="middle"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'tableName'">
              <div class="text-sm font-medium">
                {{ TABLE_LABEL[record.tableName] ?? record.tableName }}
              </div>
              <div class="text-xs text-gray-400">{{ record.tableName }}</div>
            </template>

            <template v-else-if="column.key === 'retentionMonths'"> {{ record.retentionMonths }} 个月 </template>

            <template v-else-if="column.key === 'archiveEnabled'">
              <a-tag :color="record.archiveEnabled === 1 ? 'green' : 'default'">
                {{ record.archiveEnabled === 1 ? '启用' : '禁用' }}
              </a-tag>
            </template>

            <template v-else-if="column.key === 'enabled'">
              <a-switch
                :checked="record.enabled === 1"
                :loading="toggling === record.policyId"
                @change="(v: boolean) => handleToggleEnabled(record, v)"
              />
            </template>

            <template v-else-if="column.key === 'lastStatus'">
              <a-tag v-if="record.lastStatus === 'success'" color="green">成功</a-tag>
              <a-tag v-else-if="record.lastStatus === 'failed'" color="red">失败</a-tag>
              <span v-else class="text-gray-400">—</span>
            </template>

            <template v-else-if="column.key === 'lastRunAt'">
              <span class="text-xs text-gray-500">
                {{ record.lastRunAt ? dayjs(record.lastRunAt).format('YYYY-MM-DD HH:mm') : '—' }}
              </span>
            </template>

            <template v-else-if="column.key === 'action'">
              <div class="flex items-center gap-1">
                <a-button type="link" size="small" @click="handleEdit(record)"> 编辑 </a-button>
                <a-button type="link" size="small" :loading="dryRun === record.policyId" @click="handleDryRun(record)">
                  试运行
                </a-button>
                <a-popconfirm
                  title="立即归档"
                  :description="`确定立即对「${TABLE_LABEL[record.tableName] ?? record.tableName}」执行归档吗？`"
                  ok-text="执行"
                  ok-type="danger"
                  @confirm="handleTrigger(record)"
                >
                  <a-button type="link" size="small" danger :loading="triggering === record.policyId">
                    立即归档
                  </a-button>
                </a-popconfirm>
              </div>
            </template>
          </template>
        </a-table>
      </a-spin>
    </a-card>

    <ArchivePolicyEditorDrawer v-model:open="editorOpen" :record="currentRecord" @success="onSuccess" />
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { onMounted, ref } from 'vue'

import dayjs from '~/utils/dayjs'

import type { ArchivePolicyRecord } from './api'

import { getArchivePolicyList, triggerArchive, updateArchivePolicy } from './api'
import ArchivePolicyEditorDrawer from './components/ArchivePolicyEditorDrawer.vue'
import { TABLE_LABEL, cardClassName, containerClassName } from './constants'

defineOptions({ name: 'SystemArchivePolicy' })

const loading = ref(false)
const list = ref<ArchivePolicyRecord[]>([])
const editorOpen = ref(false)
const currentRecord = ref<ArchivePolicyRecord | null>(null)
const toggling = ref<string | null>(null)
const dryRun = ref<string | null>(null)
const triggering = ref<string | null>(null)

const columns = [
  { title: '表名', key: 'tableName', width: 200 },
  { title: '保留期', key: 'retentionMonths', width: 100, align: 'center' as const },
  { title: '归档', key: 'archiveEnabled', width: 90, align: 'center' as const },
  { title: '最近执行', key: 'lastRunAt', width: 160 },
  { title: '结果', key: 'lastStatus', width: 90, align: 'center' as const },
  { title: '启用', key: 'enabled', width: 90, align: 'center' as const },
  { title: '操作', key: 'action', width: 240, fixed: 'right' as const, align: 'center' as const },
]

async function load() {
  loading.value = true
  try {
    const res: any = await getArchivePolicyList()
    list.value = res?.data ?? res ?? []
  } finally {
    loading.value = false
  }
}

function handleEdit(record: ArchivePolicyRecord) {
  currentRecord.value = record
  editorOpen.value = true
}

async function handleToggleEnabled(record: ArchivePolicyRecord, checked: boolean) {
  toggling.value = record.policyId
  try {
    await updateArchivePolicy(record.tableName as any, {
      enabled: checked ? 1 : 0,
    })
    message.success(checked ? '已启用' : '已禁用')
    record.enabled = checked ? 1 : 0
  } finally {
    toggling.value = null
  }
}

async function handleDryRun(record: ArchivePolicyRecord) {
  dryRun.value = record.policyId
  try {
    const res: any = await triggerArchive({ tableName: record.tableName as any, dryRun: true })
    const data = res?.data ?? res
    message.info(`试运行完成：预计归档 ${data?.wouldArchive ?? 0} 行`)
  } finally {
    dryRun.value = null
  }
}

async function handleTrigger(record: ArchivePolicyRecord) {
  triggering.value = record.policyId
  try {
    const res: any = await triggerArchive({ tableName: record.tableName as any, dryRun: false })
    const data = res?.data ?? res
    message.success(data?.message ?? `归档完成，处理 ${data?.archived ?? 0} 行`)
    await load()
  } finally {
    triggering.value = null
  }
}

async function onSuccess() {
  await load()
}

onMounted(load)
</script>
