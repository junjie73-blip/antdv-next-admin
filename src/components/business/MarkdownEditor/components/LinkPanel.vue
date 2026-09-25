<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'

const props = defineProps<{
  /** 已有链接时回填，便于修改 */
  initialUrl?: string
}>()

const emit = defineEmits<{ confirm: [url: string]; cancel: [] }>()

const url = ref(props.initialUrl ?? '')
const inputRef = ref<HTMLInputElement | null>(null)

function confirm() {
  emit('confirm', url.value.trim())
}

onMounted(async () => {
  await nextTick()
  inputRef.value?.focus()
})
</script>

<template>
  <!-- 阻止冒泡，避免点击输入框时被下拉容器直接关闭 -->
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
      <button type="button" class="rounded bg-blue-500 px-2 py-1 text-xs text-white hover:bg-blue-600" @click="confirm">
        确定
      </button>
    </div>
  </div>
</template>
