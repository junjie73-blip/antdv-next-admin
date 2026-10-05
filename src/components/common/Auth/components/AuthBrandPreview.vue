<script setup lang="ts">
import { useAuthStyles } from '../composables/useAuthStyles'

defineOptions({ name: 'AuthBrandPreview' })

defineProps<{
  year: number
  appTitle: string
}>()

const { brandPreviewClassName } = useAuthStyles()
</script>

<template>
  <div class="mt-12">
    <div :class="brandPreviewClassName">
      <!-- 窗口控制点 -->
      <div class="mb-2.5 flex items-center gap-1.5">
        <div class="h-2 w-2 rounded-full bg-white/40" />
        <div class="h-2 w-2 rounded-full bg-white/30" />
        <div class="h-2 w-2 rounded-full bg-white/20" />
      </div>

      <!-- 内容占位 -->
      <div class="space-y-1.5">
        <div class="h-1.5 w-3/4 rounded-full bg-white/20" />
        <div class="h-1.5 w-1/2 rounded-full bg-white/15" />
        <div class="h-1.5 w-2/3 rounded-full bg-white/10" />
      </div>
    </div>

    <div class="mt-3 text-[11px] text-white/60">© {{ year }} {{ appTitle }} Team</div>
  </div>
</template>
