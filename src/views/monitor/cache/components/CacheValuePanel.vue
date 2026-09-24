<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, ref, watch } from 'vue'

import { clearCacheAll, getCacheValue } from '~/api'

import type { CacheKeyValue } from '../types'

import { formatTtl, formatValue } from '../utils'

defineOptions({ name: 'CacheValuePanel' })

const props = defineProps<{
  cacheKey: string | null
}>()

const loading = ref(false)
const detail = ref<CacheKeyValue | null>(null)

async function loadValue() {
  if (!props.cacheKey) {
    detail.value = null
    return
  }
  loading.value = true
  try {
    const res = (await getCacheValue({ key: props.cacheKey })) as { data?: CacheKeyValue } | CacheKeyValue
    detail.value = (res as { data?: CacheKeyValue })?.data ?? (res as CacheKeyValue) ?? null
  } catch {
    detail.value = null
  } finally {
    loading.value = false
  }
}

watch(
  () => props.cacheKey,
  () => void loadValue(),
  { immediate: true },
)

const formattedValue = computed(() => (detail.value ? formatValue(detail.value.value) : ''))

async function handleCopy() {
  if (!formattedValue.value) return
  try {
    await navigator.clipboard.writeText(formattedValue.value)
    message.success('已复制')
  } catch {
    message.error('复制失败')
  }
}

async function handleClearAll() {
  await clearCacheAll()
  message.success('已清空所有缓存')
  detail.value = null
}
</script>

<template>
  <div
    class="flex h-full flex-col rounded-lg border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <!-- 头部 -->
    <div class="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2.5 dark:border-gray-800">
      <div class="flex items-center gap-2">
        <span class="h-3 w-0.5 rounded bg-blue-500" />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200"> 缓存内容 </span>
      </div>
      <button
        type="button"
        class="rounded p-1 text-gray-400 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40"
        title="清空全部缓存"
        @click="handleClearAll"
      >
        <Icon icon="carbon:trash-can" class="text-sm" />
      </button>
    </div>

    <!-- 内容 -->
    <div class="min-h-0 flex-1 overflow-auto">
      <!-- 未选中 key -->
      <div
        v-if="!cacheKey"
        class="flex h-full flex-col items-center justify-center gap-3 text-xs text-gray-400 dark:text-gray-500"
      >
        <Icon icon="carbon:document-blank" class="text-5xl" />
        <span>选择键名后查看缓存内容</span>
      </div>

      <!-- 加载中 -->
      <div v-else-if="loading" class="p-4 text-center text-xs text-gray-400">加载中...</div>

      <!-- 详情 -->
      <div v-else-if="detail" class="space-y-3 p-3">
        <!-- Key 信息 -->
        <div class="grid grid-cols-3 gap-2 text-xs">
          <div
            class="col-span-3 rounded border border-gray-100 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-800/40"
          >
            <span class="text-gray-500 dark:text-gray-400">Key：</span>
            <span class="font-mono break-all text-gray-800 dark:text-gray-100">
              {{ detail.key }}
            </span>
          </div>
          <div class="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-800/40">
            <div class="text-gray-500 dark:text-gray-400">类型</div>
            <div class="mt-0.5 font-medium text-gray-800 dark:text-gray-100">
              {{ detail.type }}
            </div>
          </div>
          <div class="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-800/40">
            <div class="text-gray-500 dark:text-gray-400">TTL</div>
            <div class="mt-0.5 font-medium text-gray-800 dark:text-gray-100">
              {{ formatTtl(detail.ttl) }}
            </div>
          </div>
          <div class="rounded border border-gray-100 bg-gray-50 px-2 py-1.5 dark:border-gray-800 dark:bg-gray-800/40">
            <div class="text-gray-500 dark:text-gray-400">元素数量</div>
            <div class="mt-0.5 font-medium text-gray-800 dark:text-gray-100">
              {{ detail.total ?? '-' }}
            </div>
          </div>
        </div>

        <!-- 值 -->
        <div class="rounded border border-gray-100 dark:border-gray-800">
          <div class="flex items-center justify-between border-b border-gray-100 px-2 py-1.5 dark:border-gray-800">
            <span class="text-xs font-medium text-gray-600 dark:text-gray-300"> 值 </span>
            <div class="flex items-center gap-2">
              <span v-if="detail.truncated" class="text-[10px] text-amber-500 dark:text-amber-400"> 已截断 </span>
              <button
                type="button"
                class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
                title="复制"
                @click="handleCopy"
              >
                <Icon icon="carbon:copy" class="text-sm" />
              </button>
            </div>
          </div>
          <pre
            class="max-h-[calc(100vh-380px)] overflow-auto p-2 text-xs leading-relaxed text-gray-800 dark:text-gray-200"
            >{{ formattedValue }}</pre>
        </div>
      </div>

      <!-- 读取失败 -->
      <div v-else class="p-4 text-center text-xs text-red-500">读取失败</div>
    </div>
  </div>
</template>
