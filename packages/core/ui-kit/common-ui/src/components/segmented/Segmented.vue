<script setup lang="ts">
import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { ToggleGroup, ToggleGroupItem } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { useGlobalConfig } from '../config-provider';

defineOptions({ name: 'Segmented' });

const props = withDefaults(
  defineProps<{
    block?: boolean;
    disabled?: boolean;
    options?: (SegmentedOption | string)[];
    size?: 'large' | 'middle' | 'small';
    value?: number | string;
  }>(),
  {
    block: false,
    disabled: false,
    options: () => [],
    size: undefined,
    value: undefined,
  },
);

const emit = defineEmits<{
  change: [number | string];
  'update:value': [number | string];
}>();

interface SegmentedOption {
  disabled?: boolean;
  icon?: string;
  label: string;
  value: number | string;
}

const items = computed<SegmentedOption[]>(() =>
  props.options.map((option) =>
    typeof option === 'string' ? { label: option, value: option } : option,
  ),
);

/** 档位兜底到全局 `componentSize`；这一族把中等档叫 `middle`，不叫 `default` */
const globalConfig = useGlobalConfig();
const resolvedSize = computed(() =>
  props.size === undefined && globalConfig.componentSize === 'medium'
    ? 'middle'
    : (props.size ?? globalConfig.componentSize),
);

const groupSize = computed(() => {
  if (resolvedSize.value === 'large') return 'lg';
  return resolvedSize.value === 'small' ? 'sm' : 'default';
});

function select(item: SegmentedOption) {
  if (props.disabled || item.disabled) return;
  emit('update:value', item.value);
  emit('change', item.value);
}
</script>

<template>
  <ToggleGroup
    data-common-segmented
    type="single"
    variant="outline"
    :size="groupSize"
    :model-value="props.value === undefined ? '' : String(props.value)"
    :disabled="props.disabled"
    :class="cn('rounded-md bg-muted/50 p-0.5', props.block && 'flex w-full')"
  >
    <ToggleGroupItem
      v-for="item in items"
      :key="String(item.value)"
      :value="String(item.value)"
      :disabled="item.disabled || props.disabled"
      :aria-label="item.label"
      :class="
        cn(
          'rounded-md data-[state=on]:bg-background data-[state=on]:shadow-sm',
          props.block && 'flex-1',
        )
      "
      @click="select(item)"
    >
      <Icon v-if="item.icon" :icon="item.icon" class="text-sm" />
      {{ item.label }}
    </ToggleGroupItem>
  </ToggleGroup>
</template>
