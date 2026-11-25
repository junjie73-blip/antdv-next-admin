<script setup lang="ts">
import { computed, ref } from 'vue'
import { ArrowUp, FileText, Paperclip, Square, X } from '@lucide/vue'
import { usePromptInput, type PromptInputChat } from 'vue-llm'
import { cn } from '@antdv/shared/utils/cn'

const props = withDefaults(defineProps<{
  chat: PromptInputChat & { stop: () => void }
  placeholder?: string
  /** Accepted attachments, as in `<input accept>`. Set to `false` to hide the attach button. */
  accept?: string | false
  maxFiles?: number
  class?: string
}>(), {
  placeholder: 'Send a message…',
  accept: 'image/*,application/pdf,text/*',
  maxFiles: undefined,
  class: undefined,
})

const prompt = usePromptInput(props.chat, {
  accept: props.accept || undefined,
  maxFiles: props.maxFiles,
})
const { files, isDragging, canSubmit, handlers, dropzone } = prompt
const input = props.chat.input

const busy = computed(() => props.chat.status.value === 'submitted' || props.chat.status.value === 'streaming')
const fileInput = ref<HTMLInputElement | null>(null)

const previews = new WeakMap<File, string>()
function preview(file: File): string | undefined {
  if (!file.type.startsWith('image/')) return undefined
  if (!previews.has(file)) previews.set(file, URL.createObjectURL(file))
  return previews.get(file)
}

function onPick(event: Event): void {
  const input = event.target as HTMLInputElement
  prompt.addFiles(input.files)
  input.value = ''
}

function remove(file: File): void {
  const url = previews.get(file)
  if (url) URL.revokeObjectURL(url)
  prompt.removeFile(file)
}
</script>

<template>
  <form
    :class="cn(
      'relative flex flex-col rounded-2xl border bg-background shadow-xs transition-colors focus-within:border-ring',
      isDragging && 'border-primary bg-primary/5',
      props.class,
    )"
    v-bind="dropzone"
    @submit.prevent="prompt.submit()"
  >
    <div v-if="files.length" class="flex flex-wrap gap-2 px-3 pt-3">
      <div v-for="file in files" :key="file.name + file.size + file.lastModified" class="group relative">
        <img v-if="preview(file)" :src="preview(file)" :alt="file.name" class="size-14 rounded-lg border object-cover">
        <div v-else class="flex h-14 max-w-40 items-center gap-1.5 rounded-lg border bg-muted px-2.5 text-xs">
          <FileText class="size-4 shrink-0 text-muted-foreground" />
          <span class="truncate">{{ file.name }}</span>
        </div>
        <button
          type="button"
          class="absolute -top-1.5 -right-1.5 rounded-full border bg-background p-0.5 text-muted-foreground shadow-xs hover:text-foreground"
          :aria-label="`Remove ${file.name}`"
          @click="remove(file)"
        >
          <X class="size-3" />
        </button>
      </div>
    </div>

    <textarea
      :ref="prompt.textarea"
      v-model="input"
      rows="1"
      :placeholder="placeholder"
      class="max-h-60 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
      v-bind="handlers"
    />

    <div class="flex items-center gap-2 p-2">
      <template v-if="accept !== false">
        <input ref="fileInput" type="file" multiple :accept="accept || undefined" class="hidden" @change="onPick">
        <button
          type="button"
          class="inline-flex size-8 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Attach files"
          @click="fileInput?.click()"
        >
          <Paperclip class="size-4" />
        </button>
      </template>

      <button
        v-if="busy"
        type="button"
        class="ml-auto inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90"
        aria-label="Stop generating"
        @click="chat.stop()"
      >
        <Square class="size-3.5 fill-current" />
      </button>
      <button
        v-else
        type="submit"
        class="ml-auto inline-flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-30"
        :disabled="!canSubmit"
        aria-label="Send"
      >
        <ArrowUp class="size-4" />
      </button>
    </div>

    <div
      v-if="isDragging"
      class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl text-sm font-medium text-primary"
    >
      Drop files to attach
    </div>
  </form>
</template>
