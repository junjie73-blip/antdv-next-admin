<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { ref } from 'vue'

import type { CacheOperationLog } from '~/api'

import { getCacheOperations } from '~/api'
import dayjs from '~/utils/dayjs'

import { OPERATION_MAP } from '../constants'

defineOptions({ name: 'CacheOperationLogPanel' })

const loading = ref(false)
const list = ref<CacheOperationLog[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(20)

async function load() {
  loading.value = true
  try {
    const res: any = await getCacheOperations({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
    })
    const data = res?.data ?? res ?? {}
    list.value = data.list ?? []
    total.value = data.total ?? 0
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number, size: number) {
  pageNum.value = page
  pageSize.value = size
  void load()
}

function handleRefresh() {
  pageNum.value = 1
  void load()
}

defineExpose({ reload: load })

void load()
</script>

<template>
  <div
    class="flex h-full flex-col rounded-lg border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <!-- 头部 -->
    <div class="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
      <div class="flex items-center gap-2">
        <span class="h-3 w-0.5 rounded bg-blue-500" />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200"> 缓存操作日志 </span>
        <a-tag color="blue" class="!m-0 !text-[10px]"> 共 {{ total }} 条 </a-tag>
      </div>
      <button
        type="button"
        class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        title="刷新"
        @click="handleRefresh"
      >
        <Icon icon="carbon:renew" class="text-sm" />
      </button>
    </div>

    <!-- 内容 -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <div v-if="loading" class="p-4 text-center text-xs text-gray-400">加载中...</div>

      <div
        v-else-if="list.length === 0"
        class="flex h-full flex-col items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500"
      >
        <Icon icon="carbon:document-blank" class="text-3xl" />
        <span>暂无操作记录</span>
      </div>

      <template v-else>
        <Scrollbar :max-height="495">
          <div
            v-for="item in list"
            :key="item.logId"
            class="border-b border-gray-50 px-3 py-2.5 last:border-b-0 dark:border-gray-800/50"
          >
            <div class="flex items-center gap-2 text-xs">
              <a-tag :color="OPERATION_MAP[item.operation]?.color ?? 'default'" class="!m-0 !text-[10px]">
                {{ OPERATION_MAP[item.operation]?.label ?? item.operation }}
              </a-tag>
              <a-tag :color="item.status === '1' ? 'green' : 'red'" class="!m-0 !text-[10px]">
                {{ item.status === '1' ? '成功' : '失败' }}
              </a-tag>
              <span class="text-gray-500 dark:text-gray-400">
                {{ item.operatorName || '系统' }}
              </span>
              <span class="text-gray-400 dark:text-gray-500">
                {{ dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
              </span>
            </div>

            <div class="mt-1 flex items-center gap-2 text-xs">
              <span class="text-gray-500 dark:text-gray-400">目标：</span>
              <code
                class="truncate rounded bg-gray-50 px-1.5 py-0.5 font-mono text-[11px] text-gray-700 dark:bg-gray-800/60 dark:text-gray-200"
                :title="item.target"
              >
                {{ item.target }}
              </code>
            </div>

            <div class="mt-1 flex items-center gap-3 text-[11px] text-gray-400 dark:text-gray-500">
              <span v-if="item.keyCount > 0">影响 {{ item.keyCount }} 个 key</span>
              <span v-if="item.durationMs > 0">耗时 {{ item.durationMs }} ms</span>
            </div>

            <div
              v-if="item.errorMsg"
              class="mt-1 rounded bg-red-50 px-2 py-1 text-[11px] text-red-600 dark:bg-red-950/30 dark:text-red-400"
            >
              {{ item.errorMsg }}
            </div>
          </div>
        </Scrollbar>

        <!-- 分页 -->
        <div
          v-if="total > pageSize"
          class="flex items-center justify-end border-t border-gray-100 px-3 py-2 dark:border-gray-800"
        >
          <a-pagination
            v-model:current="pageNum"
            v-model:page-size="pageSize"
            :total="total"
            :show-size-changer="true"
            :page-size-options="['10', '20', '50']"
            :show-total="(t: number) => `共 ${t} 条`"
            size="small"
            @change="handlePageChange"
          />
        </div>
      </template>
    </div>
  </div>
</template>
