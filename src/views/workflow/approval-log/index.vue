<template>
  <div :class="containerClassName">
    <a-card :bordered="false">
      <BasicTable
        :columns="logColumns"
        :api="getApprovalLogs"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :row-key="(r: ApprovalLogRecord) => r.log_id"
        @register="tableRegister"
      >
        <template #cell-op="{ record }">
          <a-tag :color="ACTION_MAP[record.action]?.color ?? 'default'">
            {{ ACTION_MAP[record.action]?.label ?? record.action }}
          </a-tag>
        </template>

        <template #cell-createdAt="{ record }">
          <span class="text-gray-600">
            {{ dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') }}
          </span>
        </template>
      </BasicTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { getApprovalLogs } from '~/api/workflow'
import { useTable } from '~/components/business/Table'
import dayjs from '~/utils/dayjs'

import type { ApprovalLogRecord } from './types'

import { logColumns } from './columns'
import { ACTION_MAP, containerClassName } from './constants'
import { searchSchemas } from './schemas'

defineOptions({ name: 'WorkflowApprovalLog' })

const [tableRegister, _] = useTable()
</script>
