<template>
  <div :class="containerClassName">
    <a-card :bordered="false">
      <BasicTable
        :columns="initiatedColumns"
        :api="getInitiatedList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :row-key="(r: TodoItem) => `${r.source}-${r.id}`"
        :action-column="actionColumn"
        @register="tableRegister"
      >
        <template #cell-source="{ record }">
          <a-tag :color="SOURCE_MAP[record.source]?.color ?? 'default'">
            {{ SOURCE_MAP[record.source]?.label ?? record.source }}
          </a-tag>
        </template>

        <template #cell-status="{ record }">
          <StatusTag :status="record.status" type="instance" />
        </template>

        <template #cell-createdAt="{ record }">
          <span class="text-gray-600">
            {{ dayjs(record.createdAt).format('YYYY-MM-DD HH:mm') }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getActions(record as TodoItem)" />
        </template>
      </BasicTable>
    </a-card>
    <!-- ⭐ 流程详情抽屉 -->
    <FlowDetailDrawer v-model:open="detailOpen" :source="detailSource" :instance-id="detailInstanceId" />
  </div>
</template>

<script setup lang="ts">
import { TextArea } from 'antdv-next'

import type { TodoItem, TodoSource } from '~/api/workflow'

import { getInitiatedList, resumeInstance, suspendInstance, terminateInstance } from '~/api/workflow'
import { useTable } from '~/components/business/Table'
import StatusTag from '~/components/common/StatusTag.vue'
import dayjs from '~/utils/dayjs'

import FlowDetailDrawer from '../../components/FlowDetailDrawer.vue'
import { SOURCE_MAP, containerClassName } from '../todo/constants'
import { getInitiatedActions, type InitiatedActionContext } from './actions.js'
import { initiatedColumns } from './columns'
import { searchSchemas } from './schemas'
defineOptions({ name: 'WorkflowCenterInitiated' })

const [tableRegister, tableMethods] = useTable()

const actionColumn = { width: 100, fixed: 'right' as const, align: 'center' as const }

const detailOpen = ref(false)
const detailSource = ref<TodoSource | null>(null)
const detailInstanceId = ref<string | null>(null)
const actionCtx: InitiatedActionContext = {
  onDetail(item) {
    detailSource.value = item.source
    detailInstanceId.value = item.instanceId
    detailOpen.value = true
  },
  async onSuspend(item) {
    await suspendInstance(item.instanceId)
    message.success('已挂起')
    await tableMethods.value?.reload?.()
  },
  async onResume(item) {
    await resumeInstance(item.instanceId)
    message.success('已恢复')
    await tableMethods.value?.reload?.()
  },
  onTerminate(item) {
    let reason = ''
    Modal.confirm({
      title: '终止流程',
      content: () =>
        h(TextArea, {
          placeholder: '请填写终止原因',
          rows: 3,
          onChange: (e) => (reason = e.target.value!),
        }),
      okType: 'danger',
      async onOk() {
        if (!reason.trim()) {
          message.warning('请填写终止原因')
          return Promise.reject()
        }
        await terminateInstance(item.instanceId, reason.trim())
        message.success('已终止')
        await tableMethods.value?.reload?.()
      },
    })
  },
}

function getActions(record: TodoItem) {
  return getInitiatedActions(record, actionCtx)
}
</script>
