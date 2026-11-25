<script setup lang="ts">
import { ref, watch } from 'vue'
import { Brain, ChevronRight } from '@lucide/vue'
import { cn } from '@antdv/shared/utils/cn'

const props = defineProps<{
  text: string
  streaming?: boolean
  class?: string
}>()

// Open while the model thinks, collapse when it starts answering, unless the user toggled it
const open = ref(!!props.streaming)
const touched = ref(false)
watch(() => props.streaming, (streaming) => {
  if (!touched.value) open.value = !!streaming
})

function toggle(): void {
  touched.value = true
  open.value = !open.value
}
</script>

<template>
  <div :class="cn('text-sm text-muted-foreground', props.class)">
    <button
      type="button"
      class="inline-flex items-center gap-1.5 rounded-md py-1 transition-colors hover:text-foreground"
      :aria-expanded="open"
      @click="toggle"
    >
      <Brain class="size-4" />
      <span :class="streaming && 'animate-pulse'">{{ streaming ? 'Thinking…' : 'Reasoning' }}</span>
      <ChevronRight :class="cn('size-4 transition-transform', open && 'rotate-90')" />
    </button>
    <div v-if="open" class="mt-1 whitespace-pre-wrap border-l-2 pl-3 leading-relaxed">
      {{ text }}
    </div>
  </div>
</template>
