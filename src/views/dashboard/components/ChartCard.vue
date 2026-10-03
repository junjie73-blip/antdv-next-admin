<script setup lang="ts">
import { Icon } from '@iconify/vue'

import { cn } from '~/utils'

defineOptions({ name: 'ChartCard' })

interface Props {
  title: string
  loading?: boolean
  action?: 'refresh' | 'tag' | 'none'
  tagText?: string
  class?: string
  stretch?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  action: 'none',
  stretch: true,
  class: '',
})

const emit = defineEmits<{ refresh: [] }>()
</script>

<template>
  <a-card
    variant="borderless"
    :class="
      cn(
        'group relative overflow-hidden rounded-xl',
        'border border-slate-100 bg-white',
        'transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)]',
        'dark:border-slate-800 dark:bg-slate-900',
        props.class,
      )
    "
    :styles="{
      body: {
        padding: '20px 24px',
        height: props.stretch ? '100%' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      },
    }"
  >
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100"
    />

    <div class="mb-4 flex items-center justify-between">
      <h3 class="text-base font-semibold text-slate-800 dark:text-slate-200">
        {{ title }}
      </h3>

      <div class="flex items-center gap-2">
        <a-tag v-if="action === 'tag' && tagText" color="blue" class="!text-[11px]">
          {{ tagText }}
        </a-tag>
        <a-button v-if="action === 'refresh'" size="small" type="text" @click="emit('refresh')">
          <Icon icon="carbon:renew" class="text-sm" />
        </a-button>
      </div>
    </div>

    <a-spin :spinning="loading" description="加载中...">
      <div class="min-h-0 flex-1">
        <slot />
      </div>
    </a-spin>
  </a-card>
</template>
