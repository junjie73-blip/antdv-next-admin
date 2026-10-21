<script setup lang="ts">
import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { cn } from '@antdv/shared/utils/cn';

import { useGlobalConfig } from '../config-provider';

defineOptions({ name: 'Steps' });

const props = withDefaults(
  defineProps<{
    clickable?: boolean;
    current?: number;
    direction?: 'horizontal' | 'vertical';
    items?: StepItem[];
    size?: 'default' | 'small';
    status?: 'error' | 'finish' | 'process';
  }>(),
  {
    clickable: false,
    current: 0,
    direction: 'horizontal',
    items: () => [],
    size: undefined,
    status: undefined,
  },
);

const emit = defineEmits<{ change: [number]; 'update:current': [number] }>();

interface StepItem {
  description?: string;
  title?: string;
}

type StepStatus = 'error' | 'finish' | 'process' | 'wait';

/** literal class，状态到配色一张表兜住所有档位 */
const CIRCLE: Record<StepStatus, string> = {
  error: 'border-destructive bg-background text-destructive',
  finish: 'border-transparent bg-primary text-primary-foreground',
  process: 'border-primary bg-background text-primary ring-2 ring-primary/20',
  wait: 'border-input bg-background text-muted-foreground',
};

const vertical = computed(() => props.direction === 'vertical');

/** 档位兜底到全局 `componentSize`：这一族只有"小一档"与"默认"两种视觉，large 落回默认 */
const globalConfig = useGlobalConfig();
const small = computed(
  () => (props.size ?? globalConfig.componentSize) === 'small',
);

const iconSize = computed(() => (small.value ? 12 : 14));

/** 外部 status 只改写当前这一步，其余仍由 current 推导 */
function stateOf(index: number): StepStatus {
  if (index < props.current) return 'finish';
  if (index > props.current) return 'wait';
  return props.status ?? 'process';
}

function isLast(index: number) {
  return index >= props.items.length - 1;
}

function select(index: number) {
  if (!props.clickable) return;
  emit('update:current', index);
  emit('change', index);
}

const rootClass = computed(() =>
  cn('flex', vertical.value ? 'flex-col' : 'items-start'),
);

const itemClass = computed(() =>
  cn(
    'flex shrink-0 gap-2',
    props.clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-default',
    vertical.value ? 'relative pb-8 last:pb-0' : 'items-center',
  ),
);

const circleClass = (index: number) =>
  cn(
    'flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-medium',
    small.value && 'size-5',
    CIRCLE[stateOf(index)],
  );

const titleClass = (index: number) =>
  cn(
    'text-sm/6 ',
    stateOf(index) === 'wait' ? 'text-muted-foreground' : 'font-medium',
    stateOf(index) === 'error' ? 'text-destructive' : '',
  );

/** 横向连接线夹在两个步骤之间，竖向连接线挂在圆点下方 */
const hLineClass = (index: number) =>
  cn(
    'mx-2 h-px flex-1 self-start',
    small.value ? 'mt-2.5' : 'mt-3',
    index < props.current ? 'bg-primary' : 'bg-border',
  );

const vLineClass = (index: number) =>
  cn(
    'absolute top-7 bottom-0 w-px',
    small.value ? 'left-2.5' : 'left-3',
    index < props.current ? 'bg-primary' : 'bg-border',
  );
</script>

<template>
  <div data-common-steps :class="rootClass">
    <template v-for="(item, index) in props.items" :key="index">
      <div
        data-common-steps-item
        :data-status="stateOf(index)"
        :class="itemClass"
      >
        <button
          v-if="props.clickable"
          type="button"
          :class="circleClass(index)"
          :aria-label="item.title"
          @click="select(index)"
        >
          <Icon
            v-if="stateOf(index) === 'finish'"
            icon="carbon:checkmark"
            :width="iconSize"
          />
          <template v-else>{{ index + 1 }}</template>
        </button>
        <span v-else :class="circleClass(index)">
          <Icon
            v-if="stateOf(index) === 'finish'"
            icon="carbon:checkmark"
            :width="iconSize"
          />
          <template v-else>{{ index + 1 }}</template>
        </span>

        <div class="min-w-0 text-left">
          <div :class="titleClass(index)">{{ item.title }}</div>
          <div
            v-if="item.description"
            class="mt-0.5 text-xs text-muted-foreground"
          >
            {{ item.description }}
          </div>
        </div>

        <span
          v-if="vertical && !isLast(index)"
          :class="vLineClass(index)"
        ></span>
      </div>

      <span
        v-if="!vertical && !isLast(index)"
        :class="hLineClass(index)"
      ></span>
    </template>
  </div>
</template>
