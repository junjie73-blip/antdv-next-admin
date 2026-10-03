<script setup lang="ts">
import { Icon } from '@iconify/vue'

import { KPI_COLOR_MAP } from '~/composables/echarts/constants'
import { cn } from '~/utils'

defineOptions({ name: 'KpiCard' })

interface KpiItem {
  title: string
  value: string | number
  trend: number
  trendLabel: string
  icon: string
  color: string
}

defineProps<{ item: KpiItem }>()
</script>

<template>
  <a-border-beam
    :color="KPI_COLOR_MAP[item.color]?.beam ?? KPI_COLOR_MAP.blue?.beam"
    :size="160"
    :duration="8"
    :border-width="1.5"
  >
    <div
      class="rounded-xl bg-white p-5 transition-all duration-300 hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12)] dark:bg-slate-900"
    >
      <div class="flex items-start justify-between gap-4">
        <div class="min-w-0 flex-1">
          <span class="text-xs font-medium tracking-wider text-gray-400 uppercase dark:text-gray-500">
            {{ item.title }}
          </span>
          <div class="mt-2 text-3xl font-bold tracking-tight text-gray-800 dark:text-white">
            {{ item.value }}
          </div>
          <div class="mt-2 flex items-center gap-1">
            <span
              :class="
                cn(
                  'inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-semibold',
                  item.trend >= 0
                    ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                    : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400',
                )
              "
            >
              <Icon :icon="item.trend >= 0 ? 'carbon:arrow-up' : 'carbon:arrow-down'" :width="12" />
              {{ Math.abs(item.trend) }}%
            </span>
            <span class="text-xs text-gray-400 dark:text-gray-500">{{ item.trendLabel }}</span>
          </div>
        </div>

        <div
          :class="
            cn(
              'flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl',
              'transition-transform duration-300 group-hover:scale-110',
              KPI_COLOR_MAP[item.color]?.wrap ?? KPI_COLOR_MAP.blue?.wrap,
            )
          "
        >
          <Icon :icon="item.icon" :width="24" :height="24" />
        </div>
      </div>
    </div>
  </a-border-beam>
</template>
