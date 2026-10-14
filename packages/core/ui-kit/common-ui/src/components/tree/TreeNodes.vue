<script setup lang="ts">
import type { NormalTreeNode, TreeContext } from './types';

import { computed } from 'vue';

import { IconifyIcon as Icon } from '@antdv/icons/icon';
import { Checkbox } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { treeKey } from './types';

defineOptions({ name: 'TreeNodes' });

const props = defineProps<{
  context: TreeContext;
  depth: number;
  nodes: NormalTreeNode[];
}>();

const style = computed(() => ({
  paddingLeft: `${props.depth * 16 + 4}px`,
}));

const isExpanded = (node: NormalTreeNode) =>
  props.context.expandedKeys.has(treeKey(node.key));
const isSelected = (node: NormalTreeNode) =>
  props.context.selectedKeys.has(treeKey(node.key));
const isChecked = (node: NormalTreeNode) =>
  props.context.checkedKeys.has(treeKey(node.key));
const isHalf = (node: NormalTreeNode) =>
  props.context.halfCheckedKeys.has(treeKey(node.key));

function rowClass(node: NormalTreeNode) {
  const { blockNode, selectable } = props.context;
  return cn(
    'flex items-center gap-1 rounded py-1 pr-2 text-sm',
    blockNode ? 'w-full' : '',
    selectable && !node.disabled ? 'cursor-pointer hover:bg-muted' : '',
    isSelected(node) ? 'bg-primary/10 text-primary' : '',
  );
}
</script>

<template>
  <div data-common-tree-nodes class="flex flex-col">
    <template v-for="node in props.nodes" :key="treeKey(node.key)">
      <div
        data-common-tree-node
        :class="rowClass(node)"
        :style="style"
        @click="props.context.onSelect(node)"
      >
        <button
          v-if="node.hasChildren"
          type="button"
          aria-label="展开/收起"
          data-common-tree-switcher
          class="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
          @click.stop="props.context.onExpand(node)"
        >
          <Icon
            icon="carbon:chevron-right"
            :class="cn('text-xs transition-transform', isExpanded(node) && 'rotate-90')"
          />
        </button>
        <span v-else class="size-5 shrink-0"></span>

        <span
          v-if="props.context.checkable"
          data-common-tree-checkbox
          class="shrink-0"
          @click.stop
        >
          <Checkbox
            :model-value="isHalf(node) ? 'indeterminate' : isChecked(node)"
            :disabled="node.disabled"
            @update:model-value="
              (value: any) => props.context.onCheck(node, value === true)
            "
          />
        </span>

        <span class="min-w-0 truncate">{{ node.title }}</span>
      </div>

      <TreeNodes
        v-if="node.hasChildren && isExpanded(node)"
        :context="props.context"
        :depth="props.depth + 1"
        :nodes="node.children"
      />
    </template>
  </div>
</template>
