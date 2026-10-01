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
import type { TodoItem, TodoSource } from '~/api/workflow'

import { getInitiatedList } from '~/api/workflow'
import { useTable } from '~/components/business/Table'
import StatusTag from '~/components/common/StatusTag.vue'
import { WORKFLOW_PERMS } from '~/enums/permissions'
import dayjs from '~/utils/dayjs'

import FlowDetailDrawer from '../../components/FlowDetailDrawer.vue'
import { SOURCE_MAP, containerClassName } from '../todo/constants'
import { initiatedColumns } from './columns'
import { searchSchemas } from './schemas'
defineOptions({ name: 'WorkflowCenterInitiated' })

const [tableRegister, _] = useTable()

const actionColumn = { width: 100, fixed: 'right' as const, align: 'center' as const }

const detailOpen = ref(false)
const detailSource = ref<TodoSource | null>(null)
const detailInstanceId = ref<string | null>(null)

function getActions(record: TodoItem) {
  return [
    {
      label: '详情',
      icon: 'lucide:eye',
      auth: WORKFLOW_PERMS.center.detail,
      onClick: () => {
        detailSource.value = record.source
        detailInstanceId.value = record.instanceId
        detailOpen.value = true
      },
    },
  ]
}
</script>
