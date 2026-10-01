<template>
  <div :class="containerClassName">
    <a-card :bordered="false">
      <BasicTable
        :columns="definitionColumns"
        :api="getDefinitionList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :action-column="actionColumn"
        :row-key="(r: DefinitionRecord) => r.def_id"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button v-permission="WORKFLOW_PERMS.definition.create" type="primary" @click="handleCreate">
            <template #icon>
              <Icon icon="lucide:plus" class="h-4 w-4" />
            </template>
            新建流程
          </a-button>
        </template>

        <template #cell-def_name="{ record }">
          <div class="flex flex-col">
            <span class="font-medium text-gray-800">{{ record.def_name }}</span>
            <span class="text-xs text-gray-400">{{ record.description || '—' }}</span>
          </div>
        </template>

        <template #cell-version="{ record }">
          <a-tag>v{{ record.version }}</a-tag>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="DEFINITION_STATUS_MAP[record.status]?.color">
            {{ DEFINITION_STATUS_MAP[record.status]?.label ?? record.status }}
          </a-tag>
        </template>

        <template #cell-updated_at="{ record }">
          <span class="text-gray-600">
            {{ dayjs(record.updated_at).format('YYYY-MM-DD HH:mm') }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getDefinitionActions(record as DefinitionRecord, actionCtx)" />
        </template>
      </BasicTable>
      <BpmnEditorDrawer v-model:open="editorOpen" :record="currentRecord" @success="onSuccess" />
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'

import { deleteDefinition, getDefinitionList, newVersionDefinition, publishDefinition } from '~/api/workflow'
import { useTable } from '~/components/business/Table'
import { WORKFLOW_PERMS } from '~/enums/permissions'
import dayjs from '~/utils/dayjs'

import type { DefinitionActionContext, DefinitionRecord } from './types'

import { getDefinitionActions } from './actions'
import { definitionColumns } from './columns'
import { DEFINITION_STATUS_MAP, containerClassName } from './constants'
import BpmnEditorDrawer from './editor/index.vue'
import { searchSchemas } from './schemas'
defineOptions({ name: 'WorkflowDefinition' })

const [tableRegister, tableMethods] = useTable()

const actionColumn = { width: 220, fixed: 'right' as const, align: 'center' as const }
const editorOpen = ref(false)
const currentRecord = ref<DefinitionRecord | null>(null)

const actionCtx: DefinitionActionContext = {
  onEdit(record) {
    // TODO: 跳转编辑器
    editorOpen.value = true
    currentRecord.value = record
  },
  async onPublish(record) {
    await publishDefinition(record.def_id)
    message.success('发布成功')
    await tableMethods.value?.reload?.()
  },
  async onDelete(record) {
    await deleteDefinition(record.def_id)
    message.success('删除成功')
    await tableMethods.value?.reload?.()
  },
  async onNewVersion(record) {
    await newVersionDefinition(record.def_id)
    message.success('新版本已创建')
    await tableMethods.value?.reload?.()
  },
}

function handleCreate() {
  currentRecord.value = null
  editorOpen.value = true
}
async function onSuccess() {
  await tableMethods.value?.reload?.()
}
</script>
