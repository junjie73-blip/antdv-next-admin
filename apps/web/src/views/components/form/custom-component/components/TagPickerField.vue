<script setup lang="ts">
import { computed, ref } from 'vue';

import { Tag } from '@antdv/common-ui';
import { Button, Input } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';

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
/** 输入框与按钮拼成一段：各自去掉相邻一侧的圆角 */
const compactClassName = cn('flex w-full items-stretch');

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
      <Tag v-for="tag in tags" :key="tag" color="blue">
        {{ tag }}
        <button
          v-if="!disabled"
          type="button"
          aria-label="移除标签"
          class="ml-0.5 inline-flex cursor-pointer items-center opacity-60 hover:opacity-100"
          @click="removeTag(tag)"
        >
          <Icon icon="carbon:close" class="size-2.5" />
        </button>
      </Tag>
      <Button
        v-if="!disabled"
        variant="link"
        size="sm"
        class="px-1"
        @click="clearAll"
      >
        清空
      </Button>
    </div>

    <div :class="compactClassName">
      <Input
        v-model="draft"
        :disabled="disabled || reachedMax"
        :placeholder="placeholder"
        class="flex-1 rounded-r-none"
        @keyup.enter="addTag()"
      />
      <Button
        :disabled="disabled || reachedMax"
        variant="outline"
        class="shrink-0 rounded-l-none border-l-0"
        @click="addTag()"
      >
        添加
      </Button>
    </div>

    <div v-if="candidates.length > 0" :class="candidatesClassName">
      <span :class="hintClassName">候选：</span>
      <Tag
        v-for="option in candidates"
        :key="option"
        :color="disabled ? undefined : 'default'"
        class="cursor-pointer"
        @click="!disabled && addTag(option)"
      >
        {{ option }}
      </Tag>
    </div>

    <div :class="hintClassName">
      {{ tags.length }} / {{ max }} 个
      <template v-if="reachedMax">（已达上限）</template>
    </div>
  </div>
</template>
