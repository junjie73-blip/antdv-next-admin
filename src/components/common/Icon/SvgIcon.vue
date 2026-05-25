<script setup lang="ts">
import { computed } from 'vue'

interface Props {
  name: string
  prefix?: string
  size?: number | string
  color?: string
  className?: string
}

const props = withDefaults(defineProps<Props>(), {
  prefix: 'icon',
  size: 16,
  color: 'currentColor',
  className: '',
})

const symbolId = computed(() => `#${props.prefix}-${props.name}`)

const sizeValue = computed(() => {
  if (typeof props.size === 'number') {
    return `${props.size}px`
  }
  return props.size
})

const svgClassName = computed(() => `svg-icon ${props.className}`.trim())
</script>

<template>
  <svg
    :class="svgClassName"
    :style="{
      width: sizeValue,
      height: sizeValue,
      color: props.color,
    }"
    aria-hidden="true"
  >
    <use :xlink:href="symbolId" />
  </svg>
</template>

<style scoped>
.svg-icon {
  display: inline-block;
  fill: currentColor;
  overflow: hidden;
  vertical-align: -0.15em;
}
</style>
