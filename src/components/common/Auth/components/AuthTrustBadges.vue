<script setup lang="ts">
import { Icon } from '@iconify/vue'

import { cn } from '~/utils/cn'

import { useAuthStyles } from '../composables/useAuthStyles'

defineOptions({ name: 'AuthTrustBadges' })

export interface TrustBadge {
  icon: string
  text: string
}

withDefaults(
  defineProps<{
    badges?: TrustBadge[]
    className?: string
  }>(),
  {
    badges: () => [
      { icon: 'carbon:locked', text: 'SSL 加密' },
      { icon: 'carbon:shield-alert', text: '隐私保护' },
      { icon: 'carbon:data-base', text: '数据隔离' },
    ],
  },
)

const { trustBadgeClassName } = useAuthStyles()
</script>

<template>
  <div :class="cn('mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2', className)">
    <span v-for="badge in badges" :key="badge.text" :class="trustBadgeClassName">
      <Icon :icon="badge.icon" class="h-3 w-3" />
      {{ badge.text }}
    </span>
  </div>
</template>
