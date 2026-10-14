<script setup lang="ts">
import { computed } from 'vue';

import { Badge } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

defineOptions({ name: 'Tag' });

const props = withDefaults(
  defineProps<{
    bordered?: boolean;
    color?: string;
  }>(),
  {
    bordered: true,
    color: undefined,
  },
);

/** 迁移前的预设色名沿用原名，页面不必再抄一份色值表 */
const PRESET: Record<string, string> = {
  blue: 'border-blue-200 bg-blue-50 text-blue-600 dark:border-blue-900 dark:bg-blue-950/50 dark:text-blue-300',
  cyan: 'border-cyan-200 bg-cyan-50 text-cyan-600 dark:border-cyan-900 dark:bg-cyan-950/50 dark:text-cyan-300',
  default:
    'border-gray-200 bg-gray-50 text-gray-600 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300',
  geekblue:
    'border-indigo-200 bg-indigo-50 text-indigo-600 dark:border-indigo-900 dark:bg-indigo-950/50 dark:text-indigo-300',
  gold: 'border-amber-200 bg-amber-50 text-amber-600 dark:border-amber-900 dark:bg-amber-950/50 dark:text-amber-300',
  green:
    'border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-300',
  lime: 'border-lime-200 bg-lime-50 text-lime-700 dark:border-lime-900 dark:bg-lime-950/50 dark:text-lime-300',
  magenta:
    'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-600 dark:border-fuchsia-900 dark:bg-fuchsia-950/50 dark:text-fuchsia-300',
  orange:
    'border-orange-200 bg-orange-50 text-orange-600 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300',
  purple:
    'border-purple-200 bg-purple-50 text-purple-600 dark:border-purple-900 dark:bg-purple-950/50 dark:text-purple-300',
  red: 'border-red-200 bg-red-50 text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-300',
  volcano:
    'border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/50 dark:text-orange-300',
};

const presetClass = computed(() =>
  props.color ? (PRESET[props.color] ?? PRESET.default) : PRESET.default,
);

/** 非预设色名按迁移前的语义当作自定义底色（antd 的 `color="#722ed1"`） */
const customStyle = computed(() => {
  if (!props.color || PRESET[props.color]) return undefined;
  return {
    backgroundColor: props.color,
    borderColor: props.color,
    color: '#fff',
  };
});

const rootClass = computed(() =>
  cn(
    'gap-1 rounded px-2 py-0.5 text-xs font-normal',
    customStyle.value ? '' : presetClass.value,
    // 放在色板之后：preset 里带 `border-*-200`，先写的 `border-transparent`
    // 会被 twMerge 当成同一个 border-color 冲突项吃掉
    props.bordered ? '' : 'border-transparent'
  )
);
</script>

<template>
  <Badge
    data-common-tag
    :variant="props.bordered ? 'outline' : 'secondary'"
    :class="rootClass"
    :style="customStyle"
  >
    <slot></slot>
  </Badge>
</template>
