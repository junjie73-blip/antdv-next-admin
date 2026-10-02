<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <BasicTable
        :columns="templateColumns"
        :api="getGenTemplateList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :action-column="actionColumn"
        :pagination="pagination"
        :row-key="rowKey"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" v-permission="SYSTEM_PERMS.genTemplate.manage" @click="handleAdd">
            <template #icon><Icon icon="lucide:plus" class="h-4 w-4" /></template>
            新增模板
          </a-button>
        </template>

        <template #cell-category="{ record }">
          <a-tag :color="CATEGORY_MAP[record.category]?.color">
            {{ CATEGORY_MAP[record.category]?.label ?? record.category }}
          </a-tag>
        </template>

        <template #cell-currentVersion="{ record }">
          <a-tag>v{{ record.currentVersion }}</a-tag>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="record.status === '1' ? 'green' : 'default'">
            {{ record.status === '1' ? '启用' : '禁用' }}
          </a-tag>
        </template>

        <template #cell-updatedAt="{ record }">
          <span class="text-gray-600">
            {{ dayjs(record.updatedAt).format('YYYY-MM-DD HH:mm') }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getTemplateActions(record as GenTemplateRecord, actionCtx)" />
        </template>
      </BasicTable>
    </a-card>

    <TemplateEditorDrawer v-model:open="editorOpen" :record="currentRecord" @success="onSuccess" />

    <VersionDrawer
      v-model:open="versionOpen"
      :template-id="currentVersionTemplateId"
      :template-name="currentVersionTemplateName"
      @success="onSuccess"
    />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'

import { BasicTable, TableAction, useTable } from '~/components/business/Table'
import { SYSTEM_PERMS } from '~/enums/permissions'
import dayjs from '~/utils/dayjs'

import type { GenTemplateRecord, TemplateActionContext } from './types'

import { getTemplateActions } from './actions'
import { deleteGenTemplate, getGenTemplateList } from './api'
import { actionColumn, pagination, rowKey, templateColumns } from './columns'
import TemplateEditorDrawer from './components/TemplateEditorDrawer.vue'
import VersionDrawer from './components/VersionDrawer.vue'
import { CATEGORY_MAP, cardClassName, containerClassName } from './constants'
import { searchSchemas } from './schemas'

defineOptions({ name: 'ToolGenTemplate' })

const [tableRegister, tableMethods] = useTable()
const editorOpen = ref(false)
const currentRecord = ref<GenTemplateRecord | null>(null)
const versionOpen = ref(false)
const currentVersionTemplateId = ref<string | null>(null)
const currentVersionTemplateName = ref('')

const actionCtx: TemplateActionContext = {
  onEdit(record) {
    currentRecord.value = record
    editorOpen.value = true
  },
  onVersions(record) {
    currentVersionTemplateId.value = record.templateId
    currentVersionTemplateName.value = record.templateName
    versionOpen.value = true
  },
  async onDelete(record) {
    await deleteGenTemplate(record.templateId)
    message.success('删除成功')
    await tableMethods.value?.reload?.()
  },
}

function handleAdd() {
  currentRecord.value = null
  editorOpen.value = true
}

async function onSuccess() {
  await tableMethods.value?.reload?.()
}
</script>
