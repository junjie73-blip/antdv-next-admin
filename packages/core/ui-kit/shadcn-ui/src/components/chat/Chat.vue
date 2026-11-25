<script setup lang="ts">
import { computed, type Component } from 'vue'
import { ArrowDown, CircleAlert } from '@lucide/vue'
import { useAutoScroll, type UseChatReturn } from 'vue-llm'
import { cn } from '@antdv/shared/utils/cn'
import ChatMessage from './ChatMessage.vue'
import ChatPromptInput from './ChatPromptInput.vue'

const props = withDefaults(defineProps<{
  chat: UseChatReturn
  /** Components that render tool calls, keyed by tool name (Generative UI) */
  components?: Record<string, Component>
  /** Components that render data parts, keyed by their `name` */
  dataComponents?: Record<string, Component>
  /** Prompts shown while the chat is empty */
  suggestions?: string[]
  placeholder?: string
  /** Accepted attachments, as in `<input accept>`. `false` hides the attach button. */
  accept?: string | false
  class?: string
}>(), {
  components: undefined,
  dataComponents: undefined,
  suggestions: () => [],
  placeholder: undefined,
  accept: undefined,
  class: undefined,
})

const { messages, status, error } = props.chat
const scroll = useAutoScroll()
const { isAtBottom, scrollToBottom } = scroll

const visible = computed(() => messages.value.filter(m => m.role !== 'system'))
const busy = computed(() => status.value === 'submitted' || status.value === 'streaming')
const lastAssistantId = computed(() => [...visible.value].reverse().find(m => m.role === 'assistant')?.id)

function send(text: string): void {
  if (!busy.value) void props.chat.sendMessage(text)
}
</script>

<template>
  <div :class="cn('relative flex h-full min-h-0 flex-col', props.class)">
    <div :ref="scroll.container" class="min-h-0 flex-1 overflow-y-auto">
      <div class="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
        <div v-if="!visible.length" class="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
          <slot name="empty">
            <p class="text-lg font-medium">
              How can I help?
            </p>
          </slot>
          <div v-if="suggestions.length" class="flex flex-wrap justify-center gap-2">
            <button
              v-for="s in suggestions"
              :key="s"
              type="button"
              class="rounded-full border px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="send(s)"
            >
              {{ s }}
            </button>
          </div>
        </div>

        <ChatMessage
          v-for="message in visible"
          :key="message.id"
          :message="message"
          :components="components"
          :data-components="dataComponents"
          :is-last="message.id === lastAssistantId"
          :streaming="busy && message.id === lastAssistantId"
          @tool-result="chat.addToolResult"
          @regenerate="chat.regenerate()"
        />

        <div v-if="status === 'submitted'" class="flex gap-1 py-2" aria-label="Generating">
          <span v-for="i in 3" :key="i" class="size-1.5 animate-bounce rounded-full bg-muted-foreground" :style="{ animationDelay: `${(i - 1) * 150}ms` }" />
        </div>

        <div v-if="error" class="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          <CircleAlert class="mt-0.5 size-4 shrink-0" />
          <span class="flex-1">{{ error.message }}</span>
          <button type="button" class="shrink-0 font-medium underline underline-offset-4" @click="chat.regenerate()">
            Retry
          </button>
        </div>
      </div>
    </div>

    <div class="mx-auto w-full max-w-3xl px-4 pb-4">
      <div class="relative">
        <button
          v-if="!isAtBottom"
          type="button"
          class="absolute -top-12 left-1/2 inline-flex size-8 -translate-x-1/2 items-center justify-center rounded-full border bg-background text-muted-foreground shadow-sm hover:text-foreground"
          aria-label="Scroll to bottom"
          @click="scrollToBottom('smooth')"
        >
          <ArrowDown class="size-4" />
        </button>
        <ChatPromptInput :chat="chat" :placeholder="placeholder" :accept="accept" />
      </div>
    </div>
  </div>
</template>
