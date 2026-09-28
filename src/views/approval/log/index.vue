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
        <template #cell-action="{ record }">
          <a-tag :color="ACTION_MAP[record.action]?.color ?? 'default'">
            {{ ACTION_MAP[record.action]?.label ?? record.action }}
          </a-tag>
        </template>
      </BasicTable>
    </a-card>
  </div>
</template>

<script setup lang="ts">
import { useTable } from '~/components/business/Table'

import type { ApprovalLogRecord } from './types'

import { getApprovalLogs } from './api'
import { logColumns } from './columns'
import { ACTION_MAP, containerClassName } from './constants'
import { searchSchemas } from './schemas'

defineOptions({ name: 'ApprovalLogPage' })

const [tableRegister, _] = useTable()
</script>
