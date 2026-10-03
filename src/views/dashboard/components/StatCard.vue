<script setup lang="ts">
import { Icon } from '@iconify/vue'

import { cn } from '~/utils'

defineOptions({ name: 'StatCard' })

interface Props {
  label: string
  value: string | number
  color?: 'red' | 'amber' | 'blue' | 'emerald' | 'slate' | 'violet' | 'cyan'
  icon?: string
  trend?: number
  class?: string
}

const props = withDefaults(defineProps<Props>(), { color: 'blue' })

const COLOR = {
  red: {
    bg: 'bg-rose-50 dark:bg-rose-500/10',
    border: 'border-l-rose-500',
    text: 'text-rose-600 dark:text-rose-400',
    icon: 'text-rose-500',
  },
  amber: {
    bg: 'bg-amber-50 dark:bg-amber-500/10',
    border: 'border-l-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    icon: 'text-amber-500',
  },
  blue: {
    bg: 'bg-blue-50 dark:bg-blue-500/10',
    border: 'border-l-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    icon: 'text-blue-500',
  },
  emerald: {
    bg: 'bg-emerald-50 dark:bg-emerald-500/10',
    border: 'border-l-emerald-500',
    text: 'text-emerald-600 dark:text-emerald-400',
    icon: 'text-emerald-500',
  },
  slate: {
    bg: 'bg-slate-50 dark:bg-slate-500/10',
    border: 'border-l-slate-400',
    text: 'text-slate-700 dark:text-slate-300',
    icon: 'text-slate-500',
  },
  violet: {
    bg: 'bg-violet-50 dark:bg-violet-500/10',
    border: 'border-l-violet-500',
    text: 'text-violet-600 dark:text-violet-400',
    icon: 'text-violet-500',
  },
  cyan: {
    bg: 'bg-cyan-50 dark:bg-cyan-500/10',
    border: 'border-l-cyan-500',
    text: 'text-cyan-600 dark:text-cyan-400',
    icon: 'text-cyan-500',
  },
} as const
</script>

<template>
  <div
    :class="
      cn(
        'relative rounded-lg border-l-4 bg-white p-4 transition-all duration-300',
        'hover:shadow-md dark:bg-slate-900',
        COLOR[color].border,
        props.class,
      )
    "
  >
    <div class="flex items-start justify-between gap-2">
      <div class="min-w-0 flex-1">
        <div class="text-xs font-medium text-slate-500 dark:text-slate-400">
          {{ label }}
        </div>
        <div :class="cn('mt-1.5 text-2xl font-bold tracking-tight', COLOR[color].text)">
          {{ value }}
        </div>
        <div v-if="trend !== undefined" class="mt-1 text-xs text-slate-400">
          <span :class="trend >= 0 ? 'text-emerald-500' : 'text-rose-500'">
            {{ trend >= 0 ? '↑' : '↓' }} {{ Math.abs(trend) }}%
          </span>
          <span class="ml-1">较昨日</span>
        </div>
      </div>
      <div v-if="icon" :class="cn('flex h-9 w-9 items-center justify-center rounded-lg', COLOR[color].bg)">
        <Icon :icon="icon" :class="cn('text-lg', COLOR[color].icon)" />
      </div>
    </div>
  </div>
</template>
