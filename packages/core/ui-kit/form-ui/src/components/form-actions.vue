<script setup lang="ts">
import type { ActionButtonOptions } from './form-render/schema';

import { IconifyIcon } from '@antdv/icons/icon';
import { Button } from '@antdv/shadcn-ui';

defineOptions({ name: 'FormActions' });

/**
 * 操作区（查询 / 重置 / 展开收起）。
 *
 * 折叠时整行右对齐独占一行，展开时贴着行尾——这两套定位规则都写在下面的
 * `:style` 里，改之前先在表单页看一眼 `showAdvancedButton` 开与关两种形态。
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
    rowStyle: Record<string, any>;
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

const padding = () => `${props.gutterPx / 2}px`;
</script>

<template>
  <div class="flex flex-wrap items-center" :style="props.rowStyle">
    <div
      class="box-border shrink-0"
      :style="{
        width: props.collapse ? '100%' : undefined,
        paddingLeft: padding(),
        paddingRight: padding(),
        ...(props.collapse
          ? {}
          : {
              marginLeft: 'auto',
              display: 'flex',
              gap: '8px',
              alignItems: 'center',
            }),
        ...props.actionColStyle,
      }"
    >
      <div
        class="flex flex-wrap items-center gap-2"
        :class="props.collapse ? 'justify-end' : ''"
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
    </div>
  </div>
</template>
