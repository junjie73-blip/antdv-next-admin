<script setup lang="ts">
import { Icon } from '@iconify/vue'

import { itemDescClassName, itemLabelClassName, itemRowClassName } from '../constants'

defineOptions({ name: 'SettingItem' })

defineProps<{
  label: string
  desc?: string
  /** 是否显示 tooltip 图标 */
  tooltip?: string
}>()
</script>

<template>
  <div :class="itemRowClassName">
    <div class="min-w-0 flex-1">
      <div class="flex items-center gap-1">
        <span :class="itemLabelClassName">{{ label }}</span>
        <a-tooltip v-if="tooltip" :title="tooltip">
          <Icon icon="carbon:information" class="text-xs text-slate-400" />
        </a-tooltip>
      </div>
      <div v-if="desc" :class="itemDescClassName">{{ desc }}</div>
    </div>
    <div class="shrink-0">
      <slot />
    </div>
  </div>
</template>
