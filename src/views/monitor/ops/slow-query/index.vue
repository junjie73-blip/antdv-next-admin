<template>
  <div :class="containerClassName">
    <!-- 概览 -->
    <a-row :gutter="16">
      <a-col :span="8">
        <a-card :class="cardClassName" :bordered="false">
          <a-statistic title="慢查询总数" :value="stats.total" :value-style="{ color: '#3b82f6' }">
            <template #prefix><Icon icon="lucide:database" /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card :class="cardClassName" :bordered="false">
          <a-statistic
            title="未处理"
            :value="stats.open"
            :value-style="{ color: stats.open > 0 ? '#ef4444' : '#22c55e' }"
          >
            <template #prefix><Icon icon="lucide:alert-triangle" /></template>
          </a-statistic>
        </a-card>
      </a-col>
      <a-col :span="8">
        <a-card :class="cardClassName" :bordered="false">
          <a-statistic title="已解决" :value="stats.total - stats.open" :value-style="{ color: '#22c55e' }">
            <template #prefix><Icon icon="lucide:check-circle" /></template>
          </a-statistic>
        </a-card>
      </a-col>
    </a-row>

    <a-card :class="cardClassName" :bordered="false">
      <BasicTable
        :columns="slowQueryColumns"
        :api="getSlowQueryList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 80 }"
        :action-column="actionColumn"
        :pagination="pagination"
        :row-key="rowKey"
        @register="tableRegister"
      >
        <template #cell-querySample="{ record }">
          <code
            class="line-clamp-2 cursor-pointer font-mono text-xs break-all text-gray-700"
            :title="record.querySample"
            @click="handleDetail(record)"
          >
            {{ record.querySample }}
          </code>
        </template>
        <template #cell-meanTimeMs="{ record }">
          <span :class="record.meanTimeMs > 2000 ? 'font-medium text-red-600' : ''">
            {{ formatMs(record.meanTimeMs) }}
          </span>
        </template>
        <template #cell-maxTimeMs="{ record }">
          {{ formatMs(record.maxTimeMs) }}
        </template>
        <template #cell-p95TimeMs="{ record }">
          {{ formatMs(record.p95TimeMs) }}
        </template>
        <template #cell-totalTimeMs="{ record }">
          {{ formatMs(record.totalTimeMs) }}
        </template>
        <template #cell-status="{ record }">
          <a-tag :color="STATUS_MAP[record.status]?.color">
            {{ STATUS_MAP[record.status]?.label ?? record.status }}
          </a-tag>
        </template>
        <template #cell-lastSeenAt="{ record }">
          {{ dayjs(record.lastSeenAt).format('YYYY-MM-DD HH:mm:ss') }}
        </template>
        <template #action="{ record }">
          <TableAction :actions="getSlowQueryActions(record, actionCtx)" />
        </template>
      </BasicTable>
    </a-card>

    <SlowQueryDetailDrawer v-model:open="detailOpen" :record="currentRecord" @reviewed="onReviewed" />
  </div>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { onMounted, ref } from 'vue'

import { BasicTable, TableAction, useTable } from '~/components/business/Table'
import dayjs from '~/utils/dayjs'

import type { SlowQueryRecord, SlowQueryStats } from './api'

import { getSlowQueryActions, type SlowQueryActionContext } from './actions'
import { getSlowQueryList, getSlowQueryStats, reviewSlowQuery } from './api'
import { actionColumn, pagination, rowKey, slowQueryColumns } from './columns'
import SlowQueryDetailDrawer from './components/SlowQueryDetailDrawer.vue'
import { STATUS_MAP, cardClassName, containerClassName, formatMs } from './constants'
import { searchSchemas } from './schemas'

defineOptions({ name: 'MonitorSlowQuery' })

const [tableRegister, tableMethods] = useTable()
const stats = ref<SlowQueryStats>({ total: 0, open: 0 })
const detailOpen = ref(false)
const currentRecord = ref<SlowQueryRecord | null>(null)

async function loadStats() {
  try {
    const res: any = await getSlowQueryStats()
    stats.value = res?.data ?? res ?? { total: 0, open: 0 }
  } catch {
    /* ignore */
  }
}

function handleDetail(record: SlowQueryRecord) {
  currentRecord.value = record
  detailOpen.value = true
}

async function handleReview(record: SlowQueryRecord, status: 'resolved' | 'ignored') {
  await reviewSlowQuery(record.id, { status })
  message.success('已标记')
  await Promise.all([tableMethods.value?.reload?.(), loadStats()])
}

const actionCtx: SlowQueryActionContext = {
  onDetail: handleDetail,
  onResolve: (r) => handleReview(r, 'resolved'),
  onIgnore: (r) => handleReview(r, 'ignored'),
}

async function onReviewed() {
  await Promise.all([tableMethods.value?.reload?.(), loadStats()])
}

onMounted(loadStats)
</script>
