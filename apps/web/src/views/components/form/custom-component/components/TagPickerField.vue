<script setup lang="ts">
import { computed, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Button as AButton, Input as AInput, SpaceCompact as ASpaceCompact, Tag as ATag } from 'antdv-next';

defineOptions({ name: 'TagPickerField' });

const props = withDefaults(defineProps<Props>(), {
  value: () => [],
  options: () => [],
  max: 5,
  disabled: false,
  placeholder: '输入后回车添加',
});

/**
 * 约定的另一半：每次改动都要 `emit('update:value', 新值)`，
 * `FormItem` 监听的正是这个事件（`@update:value="handleValueChange"`）。
 */
const emit = defineEmits<{
  'update:value': [value: string[]];
}>();

interface Props {
  /**
   * `BasicForm` 与字段组件之间的约定（见 `Form/components/FormItem.vue`）：
   * 表单把 `formModel[field]` 从 `value` 这个 prop 传进来。
   */
  value?: string[];
  /** 候选标签，点一下即选中 / 取消 */
  options?: string[];
  /** 最多能有多少个标签 */
  max?: number;
  /** `FormItem` 会把 `dynamicDisabled` 算出来的结果从这里传下来 */
  disabled?: boolean;
  placeholder?: string;
}

const wrapperClassName = cn('flex w-full flex-col gap-2');
const tagsClassName = cn('flex flex-wrap items-center gap-1');
const candidatesClassName = cn('flex flex-wrap items-center gap-1');
const hintClassName = cn('text-xs text-gray-400 dark:text-gray-500');

const draft = ref('');

const tags = computed(() => props.value ?? []);
const reachedMax = computed(() => tags.value.length >= props.max);
const candidates = computed(() =>
  props.options.filter((option) => !tags.value.includes(option)),
);

function commit(next: string[]) {
  emit('update:value', next);
}

function addTag(raw?: string) {
  const tag = (raw ?? draft.value).trim();
  if (!tag || tags.value.includes(tag) || reachedMax.value) return;
  commit([...tags.value, tag]);
  if (raw === undefined) draft.value = '';
}

function removeTag(tag: string) {
  commit(tags.value.filter((item) => item !== tag));
}

function clearAll() {
  if (tags.value.length > 0) commit([]);
}
</script>

<template>
  <div :class="wrapperClassName">
    <div v-if="tags.length > 0" :class="tagsClassName">
      <ATag
        v-for="tag in tags"
        :key="tag"
        color="blue"
        :closable="!disabled"
        @close="removeTag(tag)"
      >
        {{ tag }}
      </ATag>
      <AButton
        v-if="!disabled"
        type="link"
        size="small"
        class="!px-1"
        @click="clearAll"
      >
        清空
      </AButton>
    </div>

    <ASpaceCompact block>
      <AInput
        v-model:value="draft"
        :disabled="disabled || reachedMax"
        :placeholder="placeholder"
        @press-enter="addTag()"
      />
      <AButton :disabled="disabled || reachedMax" @click="addTag()">
        添加
      </AButton>
    </ASpaceCompact>

    <div v-if="candidates.length > 0" :class="candidatesClassName">
      <span :class="hintClassName">候选：</span>
      <ATag
        v-for="option in candidates"
        :key="option"
        class="cursor-pointer"
        :color="disabled ? undefined : 'default'"
        @click="!disabled && addTag(option)"
      >
        {{ option }}
      </ATag>
    </div>

    <div :class="hintClassName">
      {{ tags.length }} / {{ max }} 个
      <template v-if="reachedMax">（已达上限）</template>
    </div>
  </div>
</template>
