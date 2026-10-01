<template>
  <div :class="containerClassName">
    <a-card :bordered="false">
      <BasicTable
        :columns="datasetColumns"
        :api="getDatasetList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :action-column="actionColumn"
        :row-key="(r: DatasetRecord) => r.dataset_id"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button v-permission="REPORT_PERMS.dataset.create" type="primary" @click="handleCreate">
            <template #icon>
              <Icon icon="lucide:plus" class="h-4 w-4" />
            </template>
            新建数据集
          </a-button>
        </template>

        <template #cell-dataset_type="{ record }">
          <a-tag color="blue">{{ (record.dataset_type || 'sql').toUpperCase() }}</a-tag>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="record.status === '1' ? 'success' : 'default'">
            {{ record.status === '1' ? '启用' : '停用' }}
          </a-tag>
        </template>

        <template #cell-updated_at="{ record }">
          <span class="text-gray-600">
            {{ dayjs(record.updated_at).format('YYYY-MM-DD HH:mm') }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getDatasetActions(record as DatasetRecord, actionCtx)" />
        </template>
      </BasicTable>
    </a-card>

    <DatasetEditor v-model:open="editorOpen" :record="currentRecord" @success="onSuccess" />

    <DatasetPreview v-model:open="previewOpen" :dataset="currentRecord" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'

import { deleteDataset, getDatasetList } from '~/api/report'
import { useTable } from '~/components/business/Table'
import { REPORT_PERMS } from '~/enums/permissions'
import dayjs from '~/utils/dayjs'

import type { DatasetActionContext, DatasetRecord } from './types'

import { getDatasetActions } from './actions'
import { datasetColumns } from './columns'
import DatasetEditor from './components/DatasetEditor.vue'
import DatasetPreview from './components/DatasetPreview.vue'
import { containerClassName } from './constants'
import { searchSchemas } from './schemas'

defineOptions({ name: 'ReportDataset' })

const [tableRegister, tableMethods] = useTable()

const actionColumn = { width: 200, fixed: 'right' as const, align: 'center' as const }

const editorOpen = ref(false)
const previewOpen = ref(false)
const currentRecord = ref<DatasetRecord | null>(null)

const actionCtx: DatasetActionContext = {
  onEdit(record) {
    currentRecord.value = record
    editorOpen.value = true
  },
  onPreview(record) {
    currentRecord.value = record
    previewOpen.value = true
  },
  async onDelete(record) {
    await deleteDataset(record.dataset_id)
    message.success('删除成功')
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
