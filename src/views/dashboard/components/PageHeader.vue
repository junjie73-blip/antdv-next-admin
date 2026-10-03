<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

import dayjs from '~/utils/dayjs'

defineOptions({ name: 'PageHeader' })

interface Props {
  title: string
  subtitle?: string
  lastUpdated?: string | null
}

const props = defineProps<Props>()

const emit = defineEmits<{ refresh: [] }>()

const lastUpdatedText = computed(() => {
  if (!props.lastUpdated) return null
  return dayjs(props.lastUpdated).format('YYYY-MM-DD HH:mm:ss')
})
</script>

<template>
  <header class="mb-4 flex flex-wrap items-center justify-between gap-3">
    <div>
      <h1 class="text-2xl font-bold text-slate-800 dark:text-slate-100">
        {{ title }}
      </h1>
      <p v-if="subtitle" class="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {{ subtitle }}
      </p>
      <p v-if="lastUpdatedText" class="mt-0.5 text-xs text-slate-400">最后更新：{{ lastUpdatedText }}</p>
    </div>
    <div class="flex items-center gap-2">
      <slot name="actions" />
      <a-button size="small" @click="emit('refresh')">
        <template #icon><Icon icon="carbon:renew" /></template>
        刷新
      </a-button>
    </div>
  </header>
</template>
