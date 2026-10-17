<script setup lang="ts">
import { ref } from 'vue';

import { useFocus } from '@vueuse/core';

const props = defineProps<{
  initialUrl?: string;
}>();

const emit = defineEmits<{ confirm: [url: string]; cancel: [] }>();

const url = ref(props.initialUrl ?? '');
const inputRef = ref<HTMLInputElement | null>(null);

// useFocus：挂载时自动 focus，组件卸载时自动 blur，无需 nextTick
useFocus(inputRef, { initialValue: true });

function confirm() {
  emit('confirm', url.value.trim());
}
</script>

<template>
  <div class="w-64 p-2" @click.stop>
    <input
      ref="inputRef"
      v-model="url"
      type="text"
      placeholder="请输入链接地址"
      class="border-input bg-background text-foreground w-full rounded border px-2 py-1 text-xs outline-none focus:border-ring"
      @keydown.enter.prevent="confirm"
      @keydown.esc.prevent="emit('cancel')"
    />

    <div class="mt-2 flex justify-end gap-2">
      <button
        type="button"
        class="text-muted-foreground rounded px-2 py-1 text-xs hover:bg-accent hover:text-accent-foreground"
        @click="emit('cancel')"
      >
        取消
      </button>
      <button
        type="button"
        class="bg-primary text-primary-foreground hover:bg-primary/90 rounded px-2 py-1 text-xs"
        @click="confirm"
      >
        确定
      </button>
    </div>
  </div>
</template>
