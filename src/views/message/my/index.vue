<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { getMyNoticeList, markAllNoticeRead, markNoticeRead } from '~/api'
import { BasicTable, useTable } from '~/components/business/Table'
import { MESSAGE_PERMS } from '~/enums/permissions'

import type { NoticeSourceFilter, NoticeTabKey } from './types'

import { getNoticeActions } from './actions'
import { noticeActionColumn, noticeColumns, noticeRowKey, noticeScroll } from './columns'
import { NOTICE_TYPE_MAP, SOURCE_MAP, TAB_TO_IS_READ } from './constants'

defineOptions({ name: 'MessageMy' })

const route = useRoute()
const router = useRouter()

const activeTab = ref<NoticeTabKey>('all')
const activeSource = ref<NoticeSourceFilter>('')
const [tableRegister, tableMethods] = useTable()

/* 高亮当前通知（从通知小部件跳转过来） */
const highlightId = ref<string | null>((route.query.noticeId as string) ?? null)

function handleMarkReadSuccess() {
  message.success('已标记为已读')
  tableMethods.value?.reload()
}

function handleMarkReadError() {
  message.error('操作失败')
}

function getActions(record: any) {
  return getNoticeActions(record, {
    onSuccess: handleMarkReadSuccess,
    onError: handleMarkReadError,
  })
}

async function markAllRead() {
  try {
    await markAllNoticeRead({
      source: activeSource.value || undefined,
      noticeType: Number(activeTab.value) || undefined,
    })
    message.success('已全部标记为已读')
    tableMethods.value?.reload()
  } catch {
    message.error('操作失败')
  }
}

/* 打开工作流详情 */
function handleOpenFlow(record: any) {
  if (record.source === 'workflow' && record.bizId && record.bizSource) {
    router.push(`/workflow/center/detail/${record.bizSource}/${record.bizId}`)
  }
}

watch(activeTab, (newVal) => {
  tableMethods.value?.reload({
    searchInfo: { isRead: TAB_TO_IS_READ[newVal] },
  })
})

watch(activeSource, (newVal) => {
  tableMethods.value?.reload({
    searchInfo: { source: newVal || undefined },
  })
})

const SOURCE_TABS = [
  { key: '', label: '全部来源', icon: 'lucide:inbox' },
  { key: 'notice', label: '系统通知', icon: 'lucide:bell' },
  { key: 'workflow', label: '工作流', icon: 'lucide:git-branch' },
  { key: 'report', label: '报表', icon: 'lucide:bar-chart-3' },
  { key: 'system', label: '系统', icon: 'lucide:settings' },
]
</script>

<template>
  <a-card :bordered="false" class="shadow-sm">
    <div class="mb-4 flex items-center justify-between">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="all" tab="全部消息" />
        <a-tab-pane key="unread" tab="未读消息" />
        <a-tab-pane key="read" tab="已读消息" />
      </a-tabs>
      <a-button v-permission="MESSAGE_PERMS.my.readAll" @click="markAllRead">
        <template #icon>
          <Icon icon="lucide:check-check" class="h-4 w-4" />
        </template>
        全部已读
      </a-button>
    </div>

    <!-- 来源筛选 -->
    <div class="mb-4 flex flex-wrap gap-2">
      <button
        v-for="tab in SOURCE_TABS"
        :key="tab.key"
        type="button"
        :class="[
          'flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all',
          activeSource === tab.key
            ? 'bg-slate-900 text-white shadow-sm'
            : 'bg-white text-slate-600 ring-1 ring-slate-200 ring-inset hover:bg-slate-50',
        ]"
        @click="activeSource = tab.key as NoticeSourceFilter"
      >
        <Icon :icon="tab.icon" class="h-3.5 w-3.5" />
        {{ tab.label }}
      </button>
    </div>

    <BasicTable
      :columns="noticeColumns"
      :api="getMyNoticeList"
      :immediate="true"
      :use-search-form="false"
      :scroll="noticeScroll"
      :row-key="noticeRowKey"
      :action-column="noticeActionColumn"
      :show-table-setting="false"
      :row-class-name="(record: any) => (record.noticeId === highlightId ? 'bg-blue-50' : '')"
      @register="tableRegister"
    >
      <template #cell-noticeType="{ record }">
        <a-tag :color="NOTICE_TYPE_MAP[record.noticeType]?.color">
          {{ NOTICE_TYPE_MAP[record.noticeType]?.label }}
        </a-tag>
      </template>

      <template #cell-source="{ record }">
        <a-tag :color="SOURCE_MAP[record.source]?.color ?? 'default'">
          {{ SOURCE_MAP[record.source]?.label ?? record.source }}
        </a-tag>
      </template>

      <template #cell-title="{ record }">
        <div class="flex items-center gap-2">
          <span :class="['truncate', record.isRead === 0 && 'font-medium text-slate-800']">
            {{ record.title }}
          </span>
          <a-button
            v-if="record.source === 'workflow' && record.bizId"
            type="link"
            size="small"
            @click="handleOpenFlow(record)"
          >
            查看流程
          </a-button>
        </div>
      </template>

      <template #cell-isRead="{ record }">
        <a-tag :color="record.isRead === 1 ? 'default' : 'blue'">
          {{ record.isRead === 1 ? '已读' : '未读' }}
        </a-tag>
      </template>

      <template #cell-publishTime="{ record }">
        <span class="text-xs text-slate-500">
          {{ record.publishTime ? new Date(record.publishTime).toLocaleString('zh-CN') : '—' }}
        </span>
      </template>

      <template #action="{ record }">
        <table-action :actions="getActions(record)" />
      </template>
    </BasicTable>
  </a-card>
</template>
