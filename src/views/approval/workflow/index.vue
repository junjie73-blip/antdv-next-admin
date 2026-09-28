<template>
  <div :class="containerClassName">
    <a-card :bordered="false">
      <BasicTable
        :columns="flowColumns"
        :api="getApprovalFlowList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :action-column="actionColumn"
        :row-key="(r: ApprovalFlowRecord) => r.requestId"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="handleCreate">
            <template #icon>
              <Icon icon="lucide:plus" class="h-4 w-4" />
            </template>
            发起审批
          </a-button>
        </template>
        <!-- 状态列 -->
        <template #cell-status="{ record }">
          <a-tag :color="STATUS_MAP[record.status]?.color ?? 'default'">
            {{ STATUS_MAP[record.status]?.label ?? record.status }}
          </a-tag>
        </template>

        <!-- 操作列 -->
        <template #action="{ record }">
          <table-action :actions="getApprovalActions(record as ApprovalFlowRecord, actionCtx)"></table-action>
        </template>
      </BasicTable>
    </a-card>

    <!-- Vue Flow 流程图抽屉 -->
    <ApprovalFlowDrawer v-model:open="flowDrawerOpen" :request-id="flowRequestId" />
    <!-- 发起/修改弹窗 -->
    <ApprovalCreateModal v-model:open="createModalOpen" :record="currentRecord" @success="onSuccess" />

    <!-- 驳回弹窗 -->
    <ApprovalRejectModal v-model:open="rejectModalOpen" :record="currentRecord" @success="onSuccess" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'

import { useTable } from '~/components/business/Table'

import type { ApprovalActionContext, ApprovalFlowRecord } from './types'

import { getApprovalActions } from './actions'
import { getApprovalFlowList, approveApproval, deleteApproval } from './api'
import { flowColumns } from './columns'
import ApprovalCreateModal from './components/ApprovalCreateModal.vue'
import ApprovalFlowDrawer from './components/ApprovalFlowDrawer.vue'
import ApprovalRejectModal from './components/ApprovalRejectModal.vue'
import { STATUS_MAP, containerClassName } from './constants'
import { searchSchemas } from './schemas'
defineOptions({ name: 'ApprovalFlowPage' })

const [tableRegister, tableMethods] = useTable()

const actionColumn = {
  width: 260,
  fixed: 'right' as const,
  align: 'center' as const,
}

/* ========== 弹窗状态 ========== */
const flowDrawerOpen = ref(false)
const flowRequestId = ref<string | undefined>()

const createModalOpen = ref(false)
const rejectModalOpen = ref(false)
const currentRecord = ref<ApprovalFlowRecord | null>(null)

/* ========== 操作 ========== */
function handleCreate() {
  currentRecord.value = null
  createModalOpen.value = true
}

const actionCtx: ApprovalActionContext = {
  onViewFlow(record) {
    flowRequestId.value = record.requestId
    flowDrawerOpen.value = true
  },
  async onApprove(record) {
    await approveApproval(record.requestId)
    message.success('审批已通过')
    await tableMethods.value?.reload?.()
  },
  onReject(record) {
    currentRecord.value = record
    rejectModalOpen.value = true
  },
  onResubmit(record) {
    currentRecord.value = record
    createModalOpen.value = true
  },
  async onDelete(record) {
    await deleteApproval(record.requestId)
    message.success('删除成功')
    await tableMethods.value?.reload?.()
  },
}

async function onSuccess() {
  await tableMethods.value?.reload?.()
}
</script>
