<script setup lang="ts">
import { useStorage } from '@vueuse/core'
import { watch } from 'vue'

import { TIME_RANGE_OPTIONS } from '~/composables/echarts/constants'

defineOptions({ name: 'TimeRangeSwitch' })

type TimeRange = 'today' | '7d' | '30d'

const range = defineModel<TimeRange>('value', { default: '7d' })
const stored = useStorage<TimeRange>('analysis:range', '7d')

watch(
  () => stored.value,
  (v) => {
    if (v && range.value !== v) range.value = v
  },
  { immediate: true },
)

watch(range, (v) => {
  stored.value = v
})
</script>

<template>
  <a-segmented v-model:value="range" :options="TIME_RANGE_OPTIONS" size="small" />
</template>
