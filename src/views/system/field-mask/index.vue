<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <BasicTable
        :columns="fieldMaskColumns"
        :api="getFieldMaskList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :action-column="actionColumn"
        :pagination="pagination"
        :row-key="rowKey"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" v-permission="SYSTEM_PERMS.fieldMask.manage" @click="handleAdd">
            <template #icon><Icon icon="lucide:plus" class="h-4 w-4" /></template>
            新增策略
          </a-button>
        </template>

        <template #cell-maskType="{ record }">
          <a-tag :color="MASK_TYPE_MAP[record.maskType]?.color">
            {{ MASK_TYPE_MAP[record.maskType]?.label ?? record.maskType }}
          </a-tag>
        </template>

        <template #cell-keepRule="{ record }">
          <span class="font-mono text-xs text-gray-600"> 前{{ record.keepPrefix }} / 后{{ record.keepSuffix }} </span>
        </template>

        <template #cell-replaceChar="{ record }">
          <code class="rounded bg-gray-100 px-1.5 py-0.5 text-xs">
            {{ record.replaceChar }}
          </code>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="STATUS_MAP[record.status]?.color">
            {{ STATUS_MAP[record.status]?.label ?? record.status }}
          </a-tag>
        </template>

        <template #cell-updatedAt="{ record }">
          <span class="text-gray-600">
            {{ dayjs(record.updatedAt).format('YYYY-MM-DD HH:mm') }}
          </span>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getFieldMaskActions(record as FieldMaskRecord, actionCtx)" />
        </template>
      </BasicTable>
    </a-card>

    <FieldMaskEditorDrawer v-model:open="editorOpen" :record="currentRecord" @success="onSuccess" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { ref } from 'vue'

import { BasicTable, TableAction, useTable } from '~/components/business/Table'
import { SYSTEM_PERMS } from '~/enums/permissions'
import dayjs from '~/utils/dayjs'

import type { FieldMaskActionContext, FieldMaskRecord } from './types'

import { getFieldMaskActions } from './actions'
import { deleteFieldMask, getFieldMaskList } from './api'
import { actionColumn, fieldMaskColumns, pagination, rowKey } from './columns'
import FieldMaskEditorDrawer from './components/FieldMaskEditorDrawer.vue'
import { MASK_TYPE_MAP, STATUS_MAP, cardClassName, containerClassName } from './constants'
import { searchSchemas } from './schemas'

defineOptions({ name: 'SystemFieldMask' })

const [tableRegister, tableMethods] = useTable()
const editorOpen = ref(false)
const currentRecord = ref<FieldMaskRecord | null>(null)

const actionCtx: FieldMaskActionContext = {
  onEdit(record) {
    currentRecord.value = record
    editorOpen.value = true
  },
  async onDelete(record) {
    await deleteFieldMask(record.policyId)
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
