<template>
  <div :class="containerClassName">
    <a-card :bordered="false">
      <BasicTable
        :columns="todoColumns"
        :api="getCenterTodoList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :action-column="actionColumn"
        :row-selection="{
          type: 'checkbox' as const,
          columnWidth: 48,
        }"
        :row-key="(r: TodoItem) => `${r.source}-${r.id}`"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button
            v-permission="WORKFLOW_PERMS.center.batch"
            type="primary"
            :disabled="tableMethods?.getSelectRows()?.length === 0"
            :loading="batchLoading"
            @click="handleBatchApprove"
          >
            <template #icon>
              <Icon icon="lucide:check-check" class="h-4 w-4" />
            </template>
            批量通过 ({{ tableMethods?.getSelectRows()?.length ?? 0 }})
          </a-button>
        </template>

        <template #cell-source="{ record }">
          <a-tag :color="SOURCE_MAP[record.source]?.color ?? 'default'">
            {{ SOURCE_MAP[record.source]?.label ?? record.source }}
          </a-tag>
        </template>

        <template #cell-priority="{ record }">
          <a-tag
            v-if="record.source === 'workflow' && record.priority != null"
            :color="PRIORITY_MAP[record.priority]?.color"
          >
            {{ PRIORITY_MAP[record.priority]?.label }}
          </a-tag>
          <span v-else class="text-gray-300">—</span>
        </template>

        <template #cell-dueAt="{ record }">
          <span :class="isOverdue(record.dueAt) ? 'font-medium text-red-600' : 'text-gray-600'">
            {{ record.dueAt ? dayjs(record.dueAt).format('YYYY-MM-DD HH:mm') : '—' }}
          </span>
        </template>

        <template #cell-createdAt="{ record }">
          <span class="text-gray-600">
            {{ dayjs(record.createdAt).format('YYYY-MM-DD HH:mm') }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getTodoActions(record as TodoItem, actionCtx)" />
        </template>
      </BasicTable>
    </a-card>

    <ApproveModal v-model:open="approveOpen" :record="currentRecord" @success="onSuccess" />

    <!-- 流程详情抽屉 -->
    <FlowDetailDrawer v-model:open="detailOpen" :source="detailSource" :instance-id="detailInstanceId" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'

import type { TodoSource } from '~/api'

import { useTable } from '~/components/business/Table'
import { TableAction } from '~/components/business/Table'
import { WORKFLOW_PERMS } from '~/enums/permissions'
import dayjs from '~/utils/dayjs'

import type { TodoActionContext, TodoItem } from './types'

import ApproveModal from '../../components/ApproveModal.vue'
import FlowDetailDrawer from '../../components/FlowDetailDrawer.vue'
import { getTodoActions } from './actions'
import { centerBatchComplete, getCenterTodoList } from './api'
import { todoColumns } from './columns'
import { PRIORITY_MAP, SOURCE_MAP, containerClassName } from './constants'
import { searchSchemas } from './schemas'
defineOptions({ name: 'WorkflowCenterTodo' })

const [tableRegister, tableMethods] = useTable()

const actionColumn = { width: 220, fixed: 'right' as const, align: 'center' as const }

const batchLoading = ref(false)
const approveOpen = ref(false)
const currentRecord = ref<TodoItem | null>(null)
const detailOpen = ref(false)
const detailSource = ref<TodoSource | null>(null)
const detailInstanceId = ref<string | null>(null)

function isOverdue(due?: string | null) {
  if (!due) return false
  return new Date(due) < new Date()
}

const actionCtx: TodoActionContext = {
  onApprove(item) {
    currentRecord.value = item
    approveOpen.value = true
  },
  onReject(item) {
    currentRecord.value = item
    approveOpen.value = true
  },
  onDetail(item) {
    detailSource.value = item.source
    detailInstanceId.value = item.instanceId
    detailOpen.value = true
  },
}

async function handleBatchApprove() {
  batchLoading.value = true
  const selectedItems = tableMethods.value?.getSelectRows()
  try {
    const res = await centerBatchComplete({
      action: 'approve',
      items: selectedItems?.map((i) => ({ source: i.source, id: i.id })) ?? [],
    })
    message.success(`成功 ${res.success} 个，失败 ${res.failed} 个`)
    await tableMethods.value?.reload?.()
  } finally {
    batchLoading.value = false
  }
}

async function onSuccess() {
  await tableMethods.value?.reload?.()
}
</script>
