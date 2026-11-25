<script setup lang="ts">
import { computed, ref } from 'vue'
import { Check, ChevronRight, CircleAlert, LoaderCircle, Wrench } from '@lucide/vue'
import type { ToolCallState } from 'vue-llm'
import { cn } from '@antdv/shared/utils/cn'

const props = defineProps<{
  toolName: string
  state: ToolCallState
  args?: unknown
  result?: unknown
  error?: string
  class?: string
}>()

const open = ref(false)

const label = computed(() => ({
  streaming: 'Preparing',
  pending: 'Waiting',
  running: 'Running',
  result: 'Done',
  error: 'Failed',
})[props.state])

const json = (value: unknown): string => (typeof value === 'string' ? value : JSON.stringify(value, null, 2))
</script>

<template>
  <div :class="cn('rounded-lg border bg-card text-card-foreground text-sm', props.class)">
    <button
      type="button"
      class="flex w-full items-center gap-2 px-3 py-2 text-left"
      :aria-expanded="open"
      @click="open = !open"
    >
      <Wrench class="size-4 shrink-0 text-muted-foreground" />
      <span class="truncate font-mono text-xs">{{ toolName }}</span>
      <span
        :class="cn(
          'ml-auto inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs',
          state === 'error' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground',
        )"
      >
        <LoaderCircle v-if="state === 'streaming' || state === 'running'" class="size-3 animate-spin" />
        <Check v-else-if="state === 'result'" class="size-3" />
        <CircleAlert v-else-if="state === 'error'" class="size-3" />
        {{ label }}
      </span>
      <ChevronRight :class="cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')" />
    </button>
    <div v-if="open" class="space-y-2 border-t px-3 py-2">
      <div>
        <div class="mb-1 text-xs font-medium text-muted-foreground">
          Arguments
        </div>
        <pre class="overflow-x-auto rounded-md bg-muted p-2 text-xs">{{ json(args ?? {}) }}</pre>
      </div>
      <div v-if="state === 'result'">
        <div class="mb-1 text-xs font-medium text-muted-foreground">
          Result
        </div>
        <pre class="overflow-x-auto rounded-md bg-muted p-2 text-xs">{{ json(result) }}</pre>
      </div>
      <p v-if="error" class="text-xs text-destructive">
        {{ error }}
      </p>
    </div>
  </div>
</template>
