<script setup lang="ts">
import { computed } from 'vue';

import { IconifyIcon } from '@antdv/icons/icon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@antdv/shadcn-ui';

defineOptions({ name: 'FormLabel' });

const props = withDefaults(
  defineProps<{
    align?: 'left' | 'right';
    colon?: boolean;
    helpMessage?: string | string[];
    htmlFor?: string;
    label?: string;
    required?: boolean;
  }>(),
  {
    align: 'right',
    colon: false,
    helpMessage: undefined,
    htmlFor: undefined,
    label: undefined,
    required: false,
  },
);

/**
 * 必填星号走伪元素：它不进标签的文本，`getByLabel` 与读屏拿到的都只有标签本身。
 * 常量放在脚本里，模板里的 `:class="..."` 属性值容不下引号。
 */
const requiredMarkClass = "before:content-['*'] before:text-destructive";

const alignClass = computed(() =>
  props.align === 'left' ? 'justify-start text-left' : 'justify-end text-right',
);

const helpText = computed(() =>
  Array.isArray(props.helpMessage)
    ? props.helpMessage.join('\n')
    : props.helpMessage,
);
</script>

<template>
  <label
    :for="props.htmlFor"
    class="form-item-label flex min-h-9 shrink-0 flex-wrap items-center gap-1 pt-1 text-sm leading-none whitespace-normal"
    :class="[alignClass, props.required ? requiredMarkClass : '']"
  >
    <span class="break-all">{{ props.label }}</span>
    <span v-if="props.colon">:</span>
    <TooltipProvider v-if="props.helpMessage">
      <Tooltip>
        <TooltipTrigger as-child>
          <IconifyIcon
            icon="carbon:information"
            class="cursor-help text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
          />
        </TooltipTrigger>
        <TooltipContent
          side="top"
          :style="{ maxWidth: '280px', wordBreak: 'break-word' }"
        >
          <span>{{ helpText }}</span>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </label>
</template>
