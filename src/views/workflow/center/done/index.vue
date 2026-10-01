<template>
  <div :class="containerClassName">
    <a-card :bordered="false">
      <BasicTable
        :columns="doneColumns"
        :api="getDoneList"
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

        <template #cell-createdAt="{ record }">
          <span class="text-gray-600">
            {{ dayjs(record.createdAt).format('YYYY-MM-DD HH:mm') }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getDoneActions(record as TodoItem)" />
        </template>
      </BasicTable>
    </a-card>
    <FlowDetailDrawer v-model:open="detailOpen" :source="detailSource" :instance-id="detailInstanceId" />
  </div>
</template>

<script setup lang="ts">
import type { TodoItem, TodoSource } from '~/api/workflow'

import { getDoneList } from '~/api/workflow'
import { useTable } from '~/components/business/Table'
import { WORKFLOW_PERMS } from '~/enums/permissions'
import dayjs from '~/utils/dayjs'

import FlowDetailDrawer from '../../components/FlowDetailDrawer.vue'
import { SOURCE_MAP, containerClassName } from '../todo/constants'
import { doneColumns } from './columns'
import { searchSchemas } from './schemas'
defineOptions({ name: 'WorkflowCenterDone' })

const [tableRegister, _] = useTable()
const detailOpen = ref(false)
const detailSource = ref<TodoSource | null>(null)
const detailInstanceId = ref<string | null>(null)
const actionColumn = { width: 100, fixed: 'right' as const, align: 'center' as const }

function getDoneActions(record: TodoItem) {
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
