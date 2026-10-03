<script setup lang="ts">
import { ref } from 'vue'

import { useTable } from '~/components/business/Table'

import type { OrgHistoryEvent, OrgHistoryListParams } from './types'

import { getOrgHistoryActions } from './actions'
import { listOrgHistory, revertOrgHistory } from './api'
import { orgHistoryActionColumn, orgHistoryColumns } from './columns'
import DeptTimelineDrawer from './components/DeptTimelineDrawer.vue'
import HistoryDiffDrawer from './components/HistoryDiffDrawer.vue'
import OrgTimelineDrawer from './components/OrgTimelineDrawer.vue'
import RevertChainDrawer from './components/RevertChainDrawer.vue'
import StatsBar from './components/StatsBar.vue'
import { CHANGE_TYPE_MAP, HISTORY_ROW_KEY, pageWrapperClass, SCOPE_MAP } from './constants'
import { orgHistoryPagination } from './pagination'
import { orgHistorySearchSchemas } from './schemas'

defineOptions({ name: 'OrgHistoryList' })

const [tableRegister, tableMethods] = useTable()

/* 详情抽屉 */
const diffOpen = ref(false)
const activeId = ref<string | null>(null)

/* 员工时间线抽屉 */
const userTimelineOpen = ref(false)
const timelineUserId = ref<string | null>(null)

/* 部门时间线抽屉 */
const deptTimelineOpen = ref(false)
const timelineDeptId = ref<string | null>(null)

/* 撤销链抽屉 */
const chainOpen = ref(false)
const chainRootId = ref<string | null>(null)

function handleViewDetail(record: OrgHistoryEvent) {
  activeId.value = record.historyId
  diffOpen.value = true
}

function handleViewUserTimeline(record: OrgHistoryEvent) {
  timelineUserId.value = record.entityId
  userTimelineOpen.value = true
}

function handleViewDeptTimeline(record: OrgHistoryEvent) {
  timelineDeptId.value = record.entityId
  deptTimelineOpen.value = true
}

function handleViewRevertChain(record: OrgHistoryEvent) {
  chainRootId.value = record.relatedId ?? record.historyId
  chainOpen.value = true
}

async function handleRevert(record: OrgHistoryEvent) {
  try {
    await revertOrgHistory(record.historyId)
    message.success('撤销成功')
    tableMethods.value?.reload()
  } catch {
    /* alova 已统一处理错误提示 */
  }
}

const actionCtx = {
  onViewDetail: handleViewDetail,
  onViewUserTimeline: handleViewUserTimeline,
  onViewDeptTimeline: handleViewDeptTimeline,
  onViewRevertChain: handleViewRevertChain,
  onRevert: handleRevert,
}
</script>

<template>
  <a-card variant="borderless" :class="pageWrapperClass">
    <!-- 顶部统计（对接 /stats 接口） -->
    <StatsBar :days="30" />

    <BasicTable
      class="mt-2"
      :columns="orgHistoryColumns"
      :api="listOrgHistory"
      :immediate="true"
      :use-search-form="true"
      :form-config="{
        schemas: orgHistorySearchSchemas,
        labelWidth: 80,
        fieldMapToTime: [['timeRange', ['startTime', 'endTime']]],
      }"
      :action-column="orgHistoryActionColumn"
      :row-key="HISTORY_ROW_KEY"
      :pagination="orgHistoryPagination"
      :scroll="{ x: 1100 }"
      @register="tableRegister"
    >
      <template #cell-summary="{ record }">
        <span class="text-slate-700">{{ record.summary ?? '—' }}</span>
      </template>
      <template #cell-scope="{ record }">
        {{ SCOPE_MAP[record.scope ?? ''] ?? record.scope }}
      </template>
      <template #cell-operatorName="{ record }">
        {{ record.operatorName ?? '系统' }}
      </template>
      <template #cell-changeType="{ record }">
        {{ CHANGE_TYPE_MAP[record.changeType] ?? record.changeType }}
      </template>
      <template #cell-source="{ record }">
        <a-tag v-if="record.source === 'trigger'" color="default">触发器</a-tag>
        <a-tag v-else-if="record.source === 'import'" color="purple">导入</a-tag>
        <a-tag v-else color="blue">{{ record.source }}</a-tag>
      </template>

      <template #action="{ record }">
        <TableAction :actions="getOrgHistoryActions(record as OrgHistoryEvent, actionCtx)" />
      </template>
    </BasicTable>

    <!-- 变更详情 -->
    <HistoryDiffDrawer v-model:open="diffOpen" :history-id="activeId" />

    <!-- 员工时间线（含部门回溯 dept-at） -->
    <OrgTimelineDrawer v-model:open="userTimelineOpen" :user-id="timelineUserId" />

    <!-- 部门时间线 -->
    <DeptTimelineDrawer v-model:open="deptTimelineOpen" :dept-id="timelineDeptId" />

    <!-- 撤销链 -->
    <RevertChainDrawer v-model:open="chainOpen" :root-id="chainRootId" />
  </a-card>
</template>
