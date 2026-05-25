<script setup lang="ts">
import { cn } from '@/utils/cn'

interface Props {
  name: string
  url?: string
  className?: string
  baseroute?: string
  keepAlive?: boolean
  disableMemoryRouter?: boolean
  disablePatchRequest?: boolean
}

const props = defineProps<Props>()

const containerClassName = computed(() =>
  cn(
    'micro-app-container',
    'w-full h-full',
    props.className,
  ),
)
</script>

<template>
  <div :class="containerClassName">
    <micro-app
      :name="props.name"
      :url="props.url"
      :baseroute="props.baseroute"
      :keep-alive="props.keepAlive"
      :disable-memory-router="props.disableMemoryRouter ?? true"
      :disable-patch-request="props.disablePatchRequest ?? false"
    />
  </div>
</template>

<style scoped>
.micro-app-container {
  :deep(micro-app) {
    width: 100%;
    height: 100%;
  }
}
</style>
