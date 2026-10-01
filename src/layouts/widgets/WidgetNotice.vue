<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message, Popover, Spin } from 'antdv-next'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { NoticeRecord } from '~/views/message/my/types'

import { useNotice } from '~/composables/useNotice.js'

import NoticeItem from './components/NoticeItem.vue'

defineOptions({ name: 'WidgetNotice' })

const router = useRouter()
const { list, unreadCount, loading, loadList, read, readAll } = useNotice()

const open = ref(false)
const markingAll = ref(false)

const hasUnread = computed(() => unreadCount.value > 0)

async function handleOpenChange(v: boolean) {
  open.value = v
  if (v) await loadList({ pageNum: 1, pageSize: 5 })
}

async function handleRead(item: NoticeRecord) {
  if (item.isRead === 1) return
  try {
    await read(item)
  } catch {
    message.error('标记已读失败')
  }
}

function handleClick(item: NoticeRecord) {
  // 先标记已读（异步，不阻塞跳转）
  void handleRead(item).catch(() => undefined)

  open.value = false

  // ⭐ 工作流通知 → 打开流程详情抽屉
  if (item.source === 'workflow' && item.bizId && item.bizSource) {
    router.push({
      path: `/workflow/center/detail/${item.bizSource}/${item.bizId}`,
    })
    return
  }
  if (item.source === 'report') {
    router.push('/report/export-task')
    return
  }
  // 其它通知 → 消息中心
  router.push(`/message/my?noticeId=${item.noticeId}`)
}

async function handleMarkAllRead() {
  if (!hasUnread.value || markingAll.value) return
  markingAll.value = true
  try {
    await readAll()
    message.success('已全部标记为已读')
  } catch {
    message.error('操作失败')
  } finally {
    markingAll.value = false
  }
}

function handleViewAll() {
  open.value = false
  router.push('/message/my')
}

const popoverStyles = { body: { padding: 0 } }
</script>

<template>
  <Popover
    v-model:open="open"
    placement="bottomRight"
    trigger="click"
    :arrow="false"
    :styles="popoverStyles"
    @open-change="handleOpenChange"
  >
    <!-- 触发按钮 -->
    <button
      type="button"
      class="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100"
    >
      <Icon icon="lucide:bell" class="h-4.5 w-4.5" />
      <span
        v-if="unreadCount > 0"
        class="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] leading-none font-medium text-white"
      >
        {{ unreadCount > 99 ? '99+' : unreadCount }}
      </span>
    </button>

    <!-- 内容 -->
    <template #content>
      <div class="flex w-[380px] flex-col">
        <!-- 头部 -->
        <div class="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3">
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-700">通知</span>
            <span
              v-if="unreadCount > 0"
              class="rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] leading-none font-medium text-white"
            >
              {{ unreadCount }}
            </span>
          </div>
          <button
            v-if="hasUnread"
            type="button"
            :disabled="markingAll"
            class="rounded px-2 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            @click="handleMarkAllRead"
          >
            {{ markingAll ? '处理中...' : '全部已读' }}
          </button>
        </div>

        <!-- 列表 -->
        <div class="max-h-[420px] min-h-[140px] overflow-y-auto p-2">
          <Spin :spinning="loading">
            <div v-if="!loading && list.length === 0" class="flex flex-col items-center justify-center gap-2 py-12">
              <div class="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                <Icon icon="lucide:bell-off" class="h-5 w-5 text-slate-400" />
              </div>
              <span class="text-xs text-slate-400">暂无通知</span>
            </div>

            <div v-else class="space-y-1">
              <NoticeItem v-for="item in list.slice(0, 5)" :key="item.noticeId" :item="item" @click="handleClick" />
            </div>
          </Spin>
        </div>

        <!-- 底部 -->
        <div class="flex shrink-0 items-center justify-center border-t border-slate-100 py-2.5">
          <button
            type="button"
            class="text-xs text-blue-600 transition-colors hover:text-blue-700"
            @click="handleViewAll"
          >
            查看全部通知 →
          </button>
        </div>
      </div>
    </template>
  </Popover>
</template>
