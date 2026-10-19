<script setup lang="ts">
import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { useGlobalConfig } from '../config-provider';

defineOptions({ name: 'Popconfirm' });

const props = withDefaults(
  defineProps<{
    /** 不传则取 `ConfigProvider`（或内置默认）的取消文案 */
    cancelText?: string;
    /** 危险确认：确认按钮走 destructive，图标也换成警示色 */
    danger?: boolean;
    description?: string;
    disabled?: boolean;
    /** 隐藏左侧图标（纯文字确认） */
    showIcon?: boolean;
    okText?: string;
    placement?: 'bottom' | 'left' | 'right' | 'top';
    title?: string;
  }>(),
  {
    cancelText: undefined,
    danger: false,
    description: undefined,
    disabled: false,
    showIcon: true,
    okText: undefined,
    placement: 'top',
    title: undefined,
  },
);

/** 按钮文案：显式 prop > 全局配置 > 包内置词条 */
const globalConfig = useGlobalConfig();
const okLabel = computed(() => props.okText ?? globalConfig.okText);
const cancelLabel = computed(() => props.cancelText ?? globalConfig.cancelText);

const emit = defineEmits<{
  cancel: [e: MouseEvent];
  confirm: [e: MouseEvent];
}>();

const open = defineModel<boolean>('open', { default: false });

/**
 * 面板宽度：左右两侧留给触发按钮的横向空间更少，所以收窄一档。
 * `p-0` 覆盖 `PopoverContent` 的 `p-4`，内边距由下面的内容层统一给，
 * 图标列与文字列才能共用同一套间距刻度。
 */
const panelClass = computed(() =>
  cn(
    'flex w-64 flex-col gap-3 p-3',
    props.placement === 'left' || props.placement === 'right'
      ? 'sm:w-60'
      : 'sm:w-64',
  ),
);

function handleConfirm(e: MouseEvent) {
  open.value = false;
  emit('confirm', e);
}

function handleCancel(e: MouseEvent) {
  open.value = false;
  emit('cancel', e);
}
</script>

<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child :disabled="props.disabled">
      <slot></slot>
    </PopoverTrigger>
    <PopoverContent
      data-common-popconfirm
      :side="props.placement"
      align="center"
      :side-offset="8"
      :class="panelClass"
    >
      <div class="flex items-start gap-2">
        <Icon
          v-if="props.showIcon"
          :icon="props.danger ? 'lucide:circle-alert' : 'lucide:circle-help'"
          :class="
            cn(
              'mt-px size-4 shrink-0',
              props.danger ? 'text-destructive' : 'text-warning',
            )
          "
        />
        <div class="min-w-0 flex-1">
          <div
            v-if="props.title || $slots.title"
            class="text-sm leading-5 font-medium break-words"
          >
            <slot name="title">{{ props.title }}</slot>
          </div>
          <div
            v-if="props.description || $slots.description"
            :class="
              cn(
                'text-xs leading-5 text-muted-foreground break-words',
                props.title || $slots.title ? 'mt-1' : '',
              )
            "
          >
            <slot name="description">{{ props.description }}</slot>
          </div>
        </div>
      </div>

      <div class="flex items-center justify-end gap-2">
        <Button size="xs" variant="outline" @click="handleCancel">
          {{ cancelLabel }}
        </Button>
        <Button
          size="xs"
          :variant="props.danger ? 'destructive' : 'default'"
          @click="handleConfirm"
        >
          {{ okLabel }}
        </Button>
      </div>
    </PopoverContent>
  </Popover>
</template>
