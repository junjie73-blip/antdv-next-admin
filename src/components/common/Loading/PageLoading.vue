<script setup lang="ts">
import { computed } from 'vue'

import { useAppStore } from '~/stores/modules/app'
import { cn } from '~/utils/cn'

defineOptions({ name: 'PageLoading' })

withDefaults(
  defineProps<{
    /** 是否显示 */
    loading?: boolean
    /** 加载提示文本 */
    text?: string
  }>(),
  {
    loading: false,
    text: '页面加载中...',
  },
)

const appStore = useAppStore()
const isDark = computed(() => appStore.themeMode === 'dark')

/* ============================================================
 * 容器类名
 * ============================================================ */
const containerClassName = computed(() =>
  cn(
    'absolute inset-0 z-50 flex flex-col items-center justify-center gap-3',
    'backdrop-blur-sm',
    isDark.value ? 'bg-slate-950/70' : 'bg-white/70',
  ),
)
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-200 ease-out"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-150 ease-in"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div v-if="loading" :class="containerClassName" role="status" aria-live="polite" :aria-label="text">
      <!-- ⭐ 使用 antdv Spin -->
      <a-spin size="large" />

      <!-- 提示文本 -->
      <span :class="cn('text-xs', isDark ? 'text-slate-400' : 'text-slate-500')">
        {{ text }}
      </span>
    </div>
  </Transition>
</template>
