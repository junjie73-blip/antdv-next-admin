<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <BasicTable
        :columns="storageColumns"
        :api="getStorageBackendList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :action-column="actionColumn"
        :pagination="pagination"
        :row-key="rowKey"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" v-permission="SYSTEM_PERMS.storage.manage" @click="handleAdd">
            <template #icon><Icon icon="lucide:plus" class="h-4 w-4" /></template>
            新增后端
          </a-button>
        </template>

        <template #cell-backendType="{ record }">
          <a-tag :color="BACKEND_TYPE_MAP[record.backendType]?.color">
            <Icon :icon="BACKEND_TYPE_MAP[record.backendType]?.icon" class="mr-1 inline" />
            {{ BACKEND_TYPE_MAP[record.backendType]?.label ?? record.backendType }}
          </a-tag>
        </template>

        <template #cell-isActive="{ record }">
          <a-tag v-if="record.isActive === 1" color="green">
            <Icon icon="lucide:check-circle" class="mr-1 inline" /> 使用中
          </a-tag>
          <span v-else class="text-gray-400">—</span>
        </template>

        <template #cell-isHealthy="{ record }">
          <a-tooltip v-if="record.isHealthy === 0" :title="record.lastCheckErr">
            <a-tag color="red">异常</a-tag>
          </a-tooltip>
          <a-tag v-else color="green">正常</a-tag>
        </template>

        <template #cell-lastCheckAt="{ record }">
          <span class="text-gray-600">
            {{ record.lastCheckAt ? dayjs(record.lastCheckAt).format('YYYY-MM-DD HH:mm:ss') : '—' }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getStorageActions(record, actionCtx)" />
        </template>
      </BasicTable>
    </a-card>

    <BackendEditorDrawer v-model:open="editorOpen" :record="currentRecord" @success="onSuccess" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'

import { BasicTable, TableAction, useTable } from '~/components/business/Table'
import { SYSTEM_PERMS } from '~/enums/permissions'
import dayjs from '~/utils/dayjs'

import type { StorageBackendActionContext, StorageBackendRecord } from './types'

import { getStorageActions } from './actions'
import { activateStorageBackend, checkStorageBackend, deleteStorageBackend, getStorageBackendList } from './api'
import { actionColumn, pagination, rowKey, storageColumns } from './columns'
import BackendEditorDrawer from './components/BackendEditorDrawer.vue'
import { BACKEND_TYPE_MAP, cardClassName, containerClassName } from './constants'
import { searchSchemas } from './schemas'

defineOptions({ name: 'SystemStorageBackend' })

const [tableRegister, tableMethods] = useTable()
const editorOpen = ref(false)
const currentRecord = ref<StorageBackendRecord | null>(null)

async function reload() {
  await tableMethods.value?.reload?.()
}

const actionCtx: StorageBackendActionContext = {
  onEdit(record) {
    currentRecord.value = record
    editorOpen.value = true
  },
  async onActivate(record) {
    await activateStorageBackend(record.backendId)
    message.success(`已激活「${record.backendName}」`)
    await reload()
  },
  async onCheck(record) {
    await checkStorageBackend(record.backendId)
    message.success('检查完成')
    await reload()
  },
  async onDelete(record) {
    await deleteStorageBackend(record.backendId)
    message.success('删除成功')
    await reload()
  },
}

function handleAdd() {
  currentRecord.value = null
  editorOpen.value = true
}

async function onSuccess() {
  await reload()
}
</script>
