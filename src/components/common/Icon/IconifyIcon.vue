<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'

interface Props {
  icon: string
  size?: number | string
  color?: string
  className?: string
  inline?: boolean
  width?: number | string
  height?: number | string
  horizontalFlip?: boolean
  verticalFlip?: boolean
  rotate?: number
  mode?: 'svg' | 'style' | 'bg'
  ssr?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  size: 16,
  inline: false,
  mode: 'svg',
  ssr: false,
})

const iconSize = computed(() => {
  if (props.width !== undefined || props.height !== undefined) {
    return {
      width: props.width ?? props.size,
      height: props.height ?? props.size,
    }
  }
  return props.size
})

const iconStyle = computed(() => ({
  color: props.color,
  fontSize: typeof iconSize.value === 'number' ? `${iconSize.value}px` : iconSize.value,
}))
</script>

<template>
  <Icon
    :icon="props.icon"
    :width="typeof iconSize === 'object' ? iconSize.width : iconSize"
    :height="typeof iconSize === 'object' ? iconSize.height : iconSize"
    :inline="props.inline"
    :horizontal-flip="props.horizontalFlip"
    :vertical-flip="props.verticalFlip"
    :rotate="props.rotate"
    :mode="props.mode"
    :ssr="props.ssr"
    :class="props.className"
    :style="iconStyle"
  />
</template>
