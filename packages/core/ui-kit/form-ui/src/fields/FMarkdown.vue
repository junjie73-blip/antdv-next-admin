<script setup lang="ts">
import { computed } from 'vue';

import { MarkdownEditor } from '@antdv/common-ui';

defineOptions({ name: 'FMarkdown', inheritAttrs: false });

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  id: undefined,
  placeholder: undefined,
  rows: undefined,
  value: undefined,
});

const emit = defineEmits<{ 'update:value': [value: any] }>();

/**
 * Markdown 字段：直接套 `@antdv/common-ui` 的 tiptap 富文本编辑器。
 *
 * 与 `FTextarea` 的区别只在存储形态 —— 这里把 `content-type` 固定成 `markdown`，
 * 所以 `value` / `update:value` 走的都是 Markdown 源码，不是 HTML。
 */
interface Props {
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  /** 兼容旧字段的行数语义：换算成编辑区最小高度 */
  rows?: number;
  value?: any;
  [key: string]: any;
}

/** 行高按 24px 估，与编辑区 `line-height: 1.6` / `font-size: 14px` 观感一致 */
const minHeight = computed(() =>
  props.rows ? Math.max(props.rows * 24, 60) : undefined,
);

function onUpdateValue(next: string) {
  emit('update:value', next);
}
</script>

<template>
  <MarkdownEditor
    v-bind="$attrs"
    :id="id"
    content-type="markdown"
    :value="value === undefined || value === null ? '' : String(value)"
    :disabled="disabled"
    :placeholder="placeholder ?? '请输入 Markdown 内容'"
    :min-height="minHeight"
    data-field-control
    class="w-full"
    @update:value="onUpdateValue"
  />
</template>
