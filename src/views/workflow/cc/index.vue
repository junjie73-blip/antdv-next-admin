<template>
  <div :class="containerClassName">
    <a-card :bordered="false">
      <BasicTable
        :columns="ccColumns"
        :api="getMyCcList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :action-column="actionColumn"
        :row-selection="{ type: 'checkbox' as const, columnWidth: 48 }"
        :row-key="(r: WfCcItem) => r.ccId"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button :disabled="!hasSelection" @click="handleBatchRead"> 批量已读 ({{ selectedCount }}) </a-button>
          <a-button :disabled="unreadCount === 0" @click="handleReadAll"> 全部已读 </a-button>
        </template>

        <template #cell-isRead="{ record }">
          <a-tag :color="record.isRead === 1 ? 'default' : 'red'">
            {{ record.isRead === 1 ? '已读' : '未读' }}
          </a-tag>
        </template>

        <template #cell-createdAt="{ record }">
          <span class="text-gray-600">
            {{ dayjs(record.createdAt).format('YYYY-MM-DD HH:mm') }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getCcActions(record as WfCcItem, actionCtx)" />
        </template>
      </BasicTable>
    </a-card>

    <FlowDetailDrawer v-model:open="detailOpen" :source="detailSource" :instance-id="detailInstanceId" />
  </div>
</template>

<script setup lang="ts">
import { message } from 'antdv-next'
import { computed, onMounted, ref } from 'vue'

import type { WfCcItem } from '~/api/workflow'

import { getMyCcList, getUnreadCcCount, markCcRead, markCcReadAll, markCcReadBatch } from '~/api/workflow'
import { TableAction, useTable } from '~/components/business/Table'
import dayjs from '~/utils/dayjs'

import FlowDetailDrawer from '../components/FlowDetailDrawer.vue'
import { getCcActions, type CcActionContext } from './actions'
import { ccColumns } from './columns'
import { containerClassName } from './constants'
import { searchSchemas } from './schemas'

defineOptions({ name: 'WorkflowCenterCc' })

const [tableRegister, tableMethods] = useTable()

const actionColumn = { width: 140, fixed: 'right' as const, align: 'center' as const }
const detailOpen = ref(false)
const detailSource = ref<'workflow'>('workflow')
const detailInstanceId = ref<string | null>(null)
const unreadCount = ref(0)

const selectedCount = computed(() => (tableMethods.value?.getSelectRows?.()?.length as number) ?? 0)
const hasSelection = computed(() => selectedCount.value > 0)

async function loadUnread() {
  try {
    const res: any = await getUnreadCcCount()
    unreadCount.value = (res?.data ?? res)?.count ?? 0
  } catch {
    /* ignore */
  }
}

const actionCtx: CcActionContext = {
  async onRead(item) {
    await markCcRead(item.ccId)
    message.success('已读')
    await tableMethods.value?.reload?.()
    await loadUnread()
  },
  onDetail(item) {
    detailInstanceId.value = item.instanceId
    detailOpen.value = true
  },
}

async function handleBatchRead() {
  const rows = (tableMethods.value?.getSelectRows?.() ?? []) as WfCcItem[]
  if (rows.length === 0) return
  await markCcReadBatch(rows.map((r) => r.ccId))
  message.success(`已标记 ${rows.length} 条`)
  await tableMethods.value?.reload?.()
  await loadUnread()
}

async function handleReadAll() {
  await markCcReadAll()
  message.success('已全部标记')
  await tableMethods.value?.reload?.()
  await loadUnread()
}

onMounted(loadUnread)
</script>
