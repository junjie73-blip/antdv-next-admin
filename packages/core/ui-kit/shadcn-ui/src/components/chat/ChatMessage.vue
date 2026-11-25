<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { Check, Copy, FileText, RotateCcw } from '@lucide/vue'
import type { ToolCallPart, UIMessage } from 'vue-llm'
import { StreamMarkdown } from 'vue-llm/components'
import { cn } from '@antdv/shared/utils/cn'
import ChatReasoning from './ChatReasoning.vue'
import ChatToolCall from './ChatToolCall.vue'

const props = defineProps<{
  message: UIMessage
  /** Components that render tool calls, keyed by tool name (Generative UI) */
  components?: Record<string, Component>
  /** Components that render data parts, keyed by their `name` */
  dataComponents?: Record<string, Component>
  /** Show actions for the latest assistant message */
  isLast?: boolean
  /** The chat is generating this message */
  streaming?: boolean
  class?: string
}>()

const emit = defineEmits<{
  'tool-result': [payload: { toolCallId: string; result: unknown }]
  'regenerate': []
}>()

const isUser = computed(() => props.message.role === 'user')
const text = computed(() => props.message.parts.map(p => (p.type === 'text' ? p.text : '')).join(''))

const copied = ref(false)
async function copy(): Promise<void> {
  try {
    await navigator.clipboard.writeText(text.value)
  } catch {
    // Clipboard blocked (insecure context or denied permission)
    return
  }
  copied.value = true
  setTimeout(() => (copied.value = false), 1500)
}

const toolProps = (part: ToolCallPart) => ({
  toolCallId: part.toolCallId,
  toolName: part.toolName,
  args: part.args,
  state: part.state,
  result: part.result,
  error: part.error,
  addResult: (result: unknown) => emit('tool-result', { toolCallId: part.toolCallId, result }),
})
</script>

<template>
  <div :class="cn('group flex w-full flex-col gap-2', isUser ? 'items-end' : 'items-start', props.class)" :data-role="message.role">
    <template v-for="(part, index) in message.parts" :key="part.type === 'tool-call' ? part.toolCallId : part.type === 'data' && part.id ? `data:${part.name}:${part.id}` : index">
      <template v-if="part.type === 'text'">
        <div v-if="isUser" class="max-w-[85%] whitespace-pre-wrap rounded-2xl bg-primary px-4 py-2 text-primary-foreground">
          {{ part.text }}
        </div>
        <div v-else class="chat-markdown w-full leading-relaxed">
          <StreamMarkdown :content="part.text" :streaming="part.state === 'streaming'" />
        </div>
      </template>

      <ChatReasoning v-else-if="part.type === 'reasoning'" :text="part.text" :streaming="part.state === 'streaming'" />

      <template v-else-if="part.type === 'tool-call'">
        <component :is="components[part.toolName]" v-if="components?.[part.toolName]" v-bind="toolProps(part)" />
        <ChatToolCall v-else class="w-full max-w-md" v-bind="toolProps(part)" />
      </template>

      <component
        :is="dataComponents[part.name]"
        v-else-if="part.type === 'data' && dataComponents?.[part.name]"
        :name="part.name"
        :data="part.data"
      />

      <template v-else-if="part.type === 'file'">
        <img
          v-if="part.mediaType.startsWith('image/')"
          :src="part.url"
          :alt="part.filename ?? ''"
          class="max-h-48 max-w-[60%] rounded-xl border object-cover"
        >
        <span v-else class="inline-flex items-center gap-1.5 rounded-lg border bg-muted px-2.5 py-1.5 text-sm">
          <FileText class="size-4 text-muted-foreground" />
          {{ part.filename ?? part.mediaType }}
        </span>
      </template>

      <a
        v-else-if="part.type === 'source' && /^https?:/i.test(part.url)"
        :href="part.url"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
      >{{ part.title ?? part.url }}</a>
    </template>

    <div
      v-if="!isUser && text && !streaming"
      :class="cn('flex gap-1 text-muted-foreground transition-opacity', !isLast && 'opacity-0 group-hover:opacity-100 focus-within:opacity-100')"
    >
      <button type="button" class="rounded-md p-1.5 hover:bg-muted hover:text-foreground" :aria-label="copied ? 'Copied' : 'Copy'" @click="copy">
        <Check v-if="copied" class="size-4" />
        <Copy v-else class="size-4" />
      </button>
      <button v-if="isLast" type="button" class="rounded-md p-1.5 hover:bg-muted hover:text-foreground" aria-label="Regenerate" @click="emit('regenerate')">
        <RotateCcw class="size-4" />
      </button>
    </div>
  </div>
</template>

<style scoped>
/* Markdown from the model; uses the shadcn theme variables */
.chat-markdown :deep(.vue-llm-cursor) { display: none; }
.chat-markdown :deep(.vue-llm-markdown > :first-child) { margin-top: 0; }
.chat-markdown :deep(.vue-llm-markdown > :last-child) { margin-bottom: 0; }
.chat-markdown :deep(p),
.chat-markdown :deep(ul),
.chat-markdown :deep(ol),
.chat-markdown :deep(pre),
.chat-markdown :deep(blockquote),
.chat-markdown :deep(table) { margin: 0.75em 0; }
.chat-markdown :deep(h1),
.chat-markdown :deep(h2),
.chat-markdown :deep(h3) { margin: 1em 0 0.5em; font-weight: 600; line-height: 1.3; }
.chat-markdown :deep(h1) { font-size: 1.4em; }
.chat-markdown :deep(h2) { font-size: 1.2em; }
.chat-markdown :deep(h3) { font-size: 1.05em; }
.chat-markdown :deep(ul) { list-style: disc; padding-left: 1.5em; }
.chat-markdown :deep(ol) { list-style: decimal; padding-left: 1.5em; }
.chat-markdown :deep(li) { margin: 0.25em 0; }
.chat-markdown :deep(a) { text-decoration: underline; text-underline-offset: 4px; }
.chat-markdown :deep(code) { font-size: 0.875em; background: var(--muted); border-radius: 0.375rem; padding: 0.1em 0.35em; }
.chat-markdown :deep(pre) { overflow-x: auto; background: var(--muted); border-radius: 0.5rem; padding: 0.75em 1em; }
.chat-markdown :deep(pre code) { background: none; padding: 0; }
.chat-markdown :deep(blockquote) { border-left: 2px solid var(--border); padding-left: 1em; color: var(--muted-foreground); }
.chat-markdown :deep(table) { display: block; overflow-x: auto; border-collapse: collapse; font-size: 0.9em; }
.chat-markdown :deep(th),
.chat-markdown :deep(td) { border: 1px solid var(--border); padding: 0.4em 0.75em; }
.chat-markdown :deep(hr) { border-color: var(--border); margin: 1.5em 0; }
</style>
