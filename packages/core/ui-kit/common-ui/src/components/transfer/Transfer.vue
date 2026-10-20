<script setup lang="ts">
import type { CSSProperties } from 'vue';

import type { TransferDirection, TransferItem, TransferKey } from './types';

import { computed, reactive, ref } from 'vue';

import { Button, Checkbox, Input } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { useGlobalConfig } from '../config-provider';
import { transferKey } from './types';

defineOptions({ name: 'Transfer' });

const props = withDefaults(
  defineProps<{
    dataSource?: TransferItem[];
    disabled?: boolean;
    listStyle?: CSSProperties;
    oneWay?: boolean;
    operation?: [string, string];
    render?: (item: TransferItem) => string;
    showSearch?: boolean;
    titles?: [string, string];
  }>(),
  {
    dataSource: () => [],
    disabled: false,
    listStyle: undefined,
    oneWay: false,
    operation: () => ['>', '<'],
    render: undefined,
    showSearch: false,
    titles: () => ['源列表', '目标列表'],
  },
);

const emit = defineEmits<{
  change: [TransferKey[], TransferDirection, TransferKey[]];
  select: [TransferDirection, TransferKey[]];
}>();

/** 空列表提示取全局词条，其余文案（titles / operation / 搜索占位）由宿主显式给 */
const globalConfig = useGlobalConfig();

const targetKeys = defineModel<TransferKey[]>('targetKeys', {
  default: () => [],
});

/** 面板内勾选态各自维护，键统一按字符串比较（mock 接口混用数字/字符串） */
const leftSelected = ref<Set<string>>(new Set());
const rightSelected = ref<Set<string>>(new Set());
const search = reactive<Record<TransferDirection, string>>({
  left: '',
  right: '',
});

function displayLabel(item: TransferItem) {
  return props.render?.(item) ?? item.title ?? String(item.key);
}

const itemMap = computed(() => {
  const map = new Map<string, TransferItem>();
  props.dataSource.forEach((item) => map.set(transferKey(item.key), item));
  return map;
});

const targetSet = computed(
  () => new Set((targetKeys.value ?? []).map(transferKey)),
);

/** 右栏跟随 targetKeys 顺序，左栏保持 dataSource 顺序 */
const rightList = computed(() =>
  (targetKeys.value ?? [])
    .map((key) => itemMap.value.get(transferKey(key)))
    .filter((item): item is TransferItem => Boolean(item)),
);
const leftList = computed(() =>
  props.dataSource.filter(
    (item) => !targetSet.value.has(transferKey(item.key)),
  ),
);

function listOf(direction: TransferDirection) {
  return direction === 'left' ? leftList.value : rightList.value;
}
function selectedOf(direction: TransferDirection) {
  return direction === 'left' ? leftSelected.value : rightSelected.value;
}
function setSelected(direction: TransferDirection, next: Set<string>) {
  if (direction === 'left') leftSelected.value = next;
  else rightSelected.value = next;
}

function isSelected(direction: TransferDirection, key: TransferKey) {
  return selectedOf(direction).has(transferKey(key));
}

function selectedKeysOf(direction: TransferDirection): TransferKey[] {
  return listOf(direction)
    .filter((item) => isSelected(direction, item.key))
    .map((item) => item.key);
}

const panels = computed(() => {
  const directions: TransferDirection[] = ['left', 'right'];
  return directions.map((direction) => {
    const all = listOf(direction);
    const word = search[direction].trim();
    const items = word
      ? all.filter((item) => displayLabel(item).includes(word))
      : all;
    const checkable = props.disabled
      ? []
      : items.filter((item) => !item.disabled);
    const checkedCount = checkable.filter((item) =>
      isSelected(direction, item.key),
    ).length;
    return {
      checkedCount,
      direction,
      headerState:
        checkable.length > 0 && checkedCount === checkable.length
          ? true
          : checkedCount > 0
            ? ('indeterminate' as const)
            : false,
      items,
      title: direction === 'left' ? props.titles[0] : props.titles[1],
      total: all.length,
    };
  });
});

function onItemSelect(
  direction: TransferDirection,
  item: TransferItem,
  value: 'indeterminate' | boolean,
) {
  if (props.disabled || item.disabled || value === 'indeterminate') return;
  const next = new Set(selectedOf(direction));
  if (value) next.add(transferKey(item.key));
  else next.delete(transferKey(item.key));
  setSelected(direction, next);
  emit('select', direction, selectedKeysOf(direction));
}

/** 头部全选只作用于当前可见（搜索过滤后）的可选项 */
function onSelectAll(
  direction: TransferDirection,
  panelItems: TransferItem[],
  value: 'indeterminate' | boolean,
) {
  if (props.disabled || value === 'indeterminate') return;
  const next = new Set(selectedOf(direction));
  panelItems
    .filter((item) => !item.disabled)
    .forEach((item) => {
      if (value) next.add(transferKey(item.key));
      else next.delete(transferKey(item.key));
    });
  setSelected(direction, next);
  emit('select', direction, selectedKeysOf(direction));
}

function move(to: TransferDirection) {
  const from: TransferDirection = to === 'right' ? 'left' : 'right';
  const movedKeys = selectedKeysOf(from);
  if (!movedKeys.length) return;

  const current = targetKeys.value ?? [];
  let next: TransferKey[];
  if (to === 'right') {
    const existing = new Set(current.map(transferKey));
    next = [
      ...current,
      ...movedKeys.filter((k) => !existing.has(transferKey(k))),
    ];
  } else {
    const removing = new Set(movedKeys.map(transferKey));
    next = current.filter((k) => !removing.has(transferKey(k)));
  }
  setSelected(from, new Set());
  targetKeys.value = next;
  emit('change', next, to, movedKeys);
}

const canMoveRight = computed(
  () => !props.disabled && leftSelected.value.size > 0,
);
const canMoveLeft = computed(
  () => !props.disabled && rightSelected.value.size > 0,
);
</script>

<template>
  <div data-common-transfer class="flex items-stretch gap-2">
    <template v-for="(panel, index) in panels" :key="panel.direction">
      <div
        data-common-transfer-panel
        :data-direction="panel.direction"
        class="flex w-full min-w-0 flex-col rounded-md border"
      >
        <div class="flex items-center gap-2 border-b px-3 py-2 text-sm">
          <Checkbox
            :disabled="props.disabled"
            :model-value="panel.headerState"
            @update:model-value="
              onSelectAll(panel.direction, panel.items, $event)
            "
          />
          <span class="min-w-0 flex-1 truncate">{{ panel.title }}</span>
          <span class="text-xs text-gray-400">
            {{ panel.checkedCount }}/{{ panel.items.length }}
          </span>
        </div>

        <div v-if="props.showSearch" class="p-2 pb-0">
          <Input
            data-common-transfer-search
            :disabled="props.disabled"
            :model-value="search[panel.direction]"
            class="h-8 text-xs"
            placeholder="请输入搜索内容"
            @update:model-value="search[panel.direction] = String($event)"
          />
        </div>

        <div
          class="max-h-56 min-h-24 flex-1 overflow-auto py-1 text-sm"
          :style="props.listStyle"
        >
          <div
            v-for="item in panel.items"
            :key="transferKey(item.key)"
            data-common-transfer-item
            :data-key="String(item.key)"
            :class="
              cn(
                'flex items-center gap-2 px-3 py-1.5',
                item.disabled || props.disabled
                  ? 'cursor-not-allowed text-gray-400'
                  : '',
              )
            "
          >
            <Checkbox
              :disabled="props.disabled || item.disabled"
              :model-value="isSelected(panel.direction, item.key)"
              @update:model-value="onItemSelect(panel.direction, item, $event)"
            />
            <span class="min-w-0 flex-1 truncate">{{
              displayLabel(item)
            }}</span>
          </div>
          <div
            v-if="!panel.items.length"
            class="py-6 text-center text-xs text-gray-400"
          >
            {{ globalConfig.emptyText }}
          </div>
        </div>

        <div class="border-t px-3 py-2 text-xs text-gray-400">
          共 {{ panel.total }} 条
        </div>
      </div>

      <div
        v-if="index === 0"
        class="flex shrink-0 flex-col items-center justify-center gap-2 self-center"
      >
        <Button
          data-common-transfer-move="right"
          aria-label="向右移动"
          :disabled="!canMoveRight"
          size="icon-sm"
          variant="outline"
          @click="move('right')"
        >
          {{ props.operation[0] }}
        </Button>
        <Button
          v-if="!props.oneWay"
          data-common-transfer-move="left"
          aria-label="向左移动"
          :disabled="!canMoveLeft"
          size="icon-sm"
          variant="outline"
          @click="move('left')"
        >
          {{ props.operation[1] }}
        </Button>
      </div>
    </template>
  </div>
</template>
