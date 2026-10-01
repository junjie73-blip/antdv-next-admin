<script setup lang="ts">
defineProps<{
  label: string
  value: number | string
  icon?: string
  trend?: { value: number; type: 'up' | 'down' }
  accent?: 'blue' | 'emerald' | 'amber' | 'rose' | 'violet'
}>()

const ACCENT_MAP = {
  blue: 'bg-blue-50 text-blue-600',
  emerald: 'bg-emerald-50 text-emerald-600',
  amber: 'bg-amber-50 text-amber-600',
  rose: 'bg-rose-50 text-rose-600',
  violet: 'bg-violet-50 text-violet-600',
}
</script>

<template>
  <div
    class="group rounded-xl border border-gray-200/70 bg-white p-5 transition-all hover:border-gray-300 hover:shadow-sm"
  >
    <div class="flex items-start justify-between">
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-gray-500">{{ label }}</p>
        <p class="mt-2 text-2xl font-semibold text-gray-900 tabular-nums">
          {{ value }}
        </p>
        <div v-if="trend" class="mt-2 flex items-center gap-1 text-xs">
          <span :class="trend.type === 'up' ? 'text-emerald-600' : 'text-rose-600'" class="font-medium">
            {{ trend.type === 'up' ? '↑' : '↓' }} {{ Math.abs(trend.value) }}%
          </span>
          <span class="text-gray-400">较昨日</span>
        </div>
      </div>
      <div
        v-if="icon"
        :class="[
          'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-xl',
          ACCENT_MAP[accent ?? 'blue'],
        ]"
      >
        <Icon :icon="icon" />
      </div>
    </div>
  </div>
</template>
