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
      class="w-full rounded border border-gray-300 px-2 py-1 text-xs outline-none focus:border-blue-400 dark:border-gray-600 dark:bg-gray-900 dark:text-gray-100"
      @keydown.enter.prevent="confirm"
      @keydown.esc.prevent="emit('cancel')"
    />

    <div class="mt-2 flex justify-end gap-2">
      <button
        type="button"
        class="rounded px-2 py-1 text-xs text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
        @click="emit('cancel')"
      >
        取消
      </button>
      <button
        type="button"
        class="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600"
        @click="confirm"
      >
        确定
      </button>
    </div>
  </div>
</template>
