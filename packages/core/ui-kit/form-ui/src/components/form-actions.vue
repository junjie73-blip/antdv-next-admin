<script setup lang="ts">
import type { ActionButtonOptions } from './form-render/schema';

import { computed } from 'vue';

import { IconifyIcon } from '@antdv/icons/icon';
import { Button } from '@antdv/shadcn-ui';

defineOptions({ name: 'FormActions' });

/**
 * 操作区（查询 / 重置 / 展开收起）。
 *
 * 它不是「另起一行」的块，而是宿主行容器里的一个栅格单元：`span` 由 form.vue
 * 按最后一个可见行的剩余栅格算出，剩余为 0（或末行是 Divider）时给满 24。
 * `min-width: max-content` + 行容器的 `flex-wrap` 保证「剩余空间放不下按钮」时
 * 整块自动落到下一行，而不是把按钮挤到换行。
 */
const props = withDefaults(
  defineProps<{
    actionColStyle?: Record<string, any>;
    /** 展开/收起按钮的文案与箭头方向，由 form.vue 按当前折叠态算好传进来 */
    advancedOptions: { icon: string; text: string };
    collapse?: boolean;
    disabled?: boolean;
    gutterPx: number;
    resetOptions: ActionButtonOptions;
    /** 动作区占用的栅格数（24 制） */
    span: number;
    showReset?: boolean;
    showSubmit?: boolean;
    submitOptions: ActionButtonOptions;
  }>(),
  {
    actionColStyle: undefined,
    collapse: false,
    disabled: false,
    showReset: true,
    showSubmit: true,
  },
);

const emit = defineEmits<{
  reset: [];
  toggleAdvanced: [];
}>();

const cellStyle = computed<Record<string, any>>(() => ({
  // 独占一行时靠它右对齐；行内时剩余空间已被宽度吃掉，auto 边距解析为 0
  marginLeft: 'auto',
  // 栅格算出的宽度不够放按钮时，宁可整块换行也不压缩按钮
  minWidth: 'max-content',
  paddingLeft: `${props.gutterPx / 2}px`,
  paddingRight: `${props.gutterPx / 2}px`,
  width: `${(props.span / 24) * 100}%`,
  ...props.actionColStyle,
}));
</script>

<template>
  <div
    class="form-actions box-border flex shrink-0 flex-wrap items-center justify-end gap-2"
    data-form-actions
    :style="cellStyle"
  >
    <slot name="submitBefore"></slot>
    <Button
      v-if="props.showSubmit"
      type="submit"
      :disabled="props.submitOptions.disabled || props.disabled"
    >
      <IconifyIcon
        v-if="props.submitOptions.preIcon"
        :icon="props.submitOptions.preIcon"
        class="mr-1"
      />
      {{ props.submitOptions.text }}
    </Button>
    <slot name="resetBefore"></slot>
    <Button
      v-if="props.showReset"
      type="button"
      variant="outline"
      :disabled="props.resetOptions.disabled"
      @click="emit('reset')"
    >
      <IconifyIcon
        v-if="props.resetOptions.preIcon"
        :icon="props.resetOptions.preIcon"
        class="mr-1"
      />
      {{ props.resetOptions.text }}
    </Button>
    <Button
      v-if="props.collapse"
      type="button"
      variant="ghost"
      size="sm"
      @click="emit('toggleAdvanced')"
    >
      <IconifyIcon :icon="props.advancedOptions.icon" class="mr-1" />
      {{ props.advancedOptions.text }}
    </Button>
    <slot name="actionAfter"></slot>
  </div>
</template>
