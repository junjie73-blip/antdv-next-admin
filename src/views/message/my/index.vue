<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref, watch } from 'vue'
import { http } from '@/utils'
import { BasicTable, useTable } from '@/components/business/Table'
import { message } from 'antdv-next'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'

dayjs.extend(relativeTime)
defineOptions({ name: 'MessageMy' })

const activeTab = ref<'all' | 'unread' | 'read'>('all')
const [tableRegister, tableMethods] = useTable()

const typeMap: Record<number, { label: string; color: string }> = {
  1: { label: '通知', color: 'blue' },
  2: { label: '公告', color: 'green' },
  3: { label: '提醒', color: 'orange' },
}

async function mockApi(params: any) {
  return await http.Get('/notice/my', { params }).send()
}

async function markRead(noticeId: string) {
  try {
    await http.Put(`/notice/${noticeId}/read`)
    message.success('已标记为已读')
    tableMethods.value?.reload()
  } catch {
    message.error('操作失败')
  }
}

async function markAllRead() {
  try {
    await http.Put('/notice/read-all')
    message.success('已全部标记为已读')
    tableMethods.value?.reload()
  } catch {
    message.error('操作失败')
  }
}

const columns = [
  { title: '类型', key: 'noticeType', width: 90, align: 'center' },
  { title: '标题', dataIndex: 'title', key: 'title', width: 240, ellipsis: true },
  { title: '内容', dataIndex: 'content', key: 'content', ellipsis: true },
  { title: '状态', key: 'isRead', width: 90, align: 'center' },
  {
    title: '发布时间',
    dataIndex: 'publishTime',
    key: 'publishTime',
    width: 180,
  },
]
watch(activeTab, (newVal) => {
  tableMethods.value?.reload({
    searchInfo: {
      isRead: newVal === 'unread' ? 0 : newVal === 'read' ? 1 : undefined,
    },
  })
})
</script>

<template>
  <a-card :bordered="false" class="shadow-sm">
    <div class="flex items-center justify-between mb-4">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="all" tab="全部消息" />
        <a-tab-pane key="unread" tab="未读消息" />
        <a-tab-pane key="read" tab="已读消息" />
      </a-tabs>
      <a-button @click="markAllRead">
        <template #icon><Icon icon="carbon:checkmark-outline" /></template>
        全部已读
      </a-button>
    </div>

    <BasicTable
      :columns="columns"
      :api="mockApi"
      :immediate="true"
      :use-search-form="false"
      :scroll="{ x: 1000 }"
      :row-key="(r: any) => r.noticeId"
      :action-column="{ width: 120, title: '操作', fixed: 'right' }"
      @register="tableRegister"
      :show-table-setting="false"
    >
      <template #cell-noticeType="{ record }">
        <a-tag :color="typeMap[record.noticeType]?.color">{{
          typeMap[record.noticeType]?.label
        }}</a-tag>
      </template>
      <template #cell-isRead="{ record }">
        <a-tag :color="record.isRead === 1 ? 'default' : 'blue'">{{
          record.isRead === 1 ? '已读' : '未读'
        }}</a-tag>
      </template>
      <template #action="{ record }">
        <a-button
          v-if="record.isRead !== 1"
          type="link"
          size="small"
          @click="() => markRead(record.noticeId)"
        >
          标记已读
        </a-button>
      </template>
    </BasicTable>
  </a-card>
</template>
