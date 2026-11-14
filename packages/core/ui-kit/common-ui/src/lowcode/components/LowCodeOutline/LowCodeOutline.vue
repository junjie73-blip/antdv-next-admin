<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { LowcodeContext } from '../../config';
import type { FlatNode, NodeSchema } from '../../core/types';
import type { OutlineDropPayload, OutlineMovePayload } from './types';

import { computed } from 'vue';

import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { useLowcodeContext } from '../../composables/use-lowcode-page';
import { toFlatList } from '../../core/dsl';
import { readDndPayload, writeDndData } from '../../utils/dnd';
import { indentClass, nodeLabel } from '../../utils/node-label';

/**
 * 结构大纲：把树拍平成有序行，提供选中、上下移、复制、删除与拖放落点。
 *
 * 分层位置：`components/`。**不改 Schema**：所有动作都以事件抛给宿主，
 * 由宿主调 `dsl.shiftNode / duplicateNode / removeNode / insertNode / moveNode` 生成新树 ——
 * 撤销栈只有宿主拿得全（它才知道这一步叫什么名字）。
 *
 * 可达性：每行是一个真正的 `<button>`，`Alt + ↑/↓` 同层移动、`↑/↓` 换选中、`Delete` 删除，
 * 不依赖拖拽也能搭完一页；按钮组与拖放是同一批事件的两种触发方式。
 *
 * 本文件**不做**的事：不做虚拟滚动（行数到了性能阈值请宿主换成列表虚拟化）、
 * 不渲染组件外观（画布是 `LowCodeRenderer` 的事）。
 */

const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    context?: LowcodeContext;
    /** 当前整棵树：通常来自 `useLowcodePage().nodes` */
    nodes?: NodeSchema[];
    /** 高亮用；选中态由宿主持有，面板不自己存 */
    selectedId?: string;
    /** 关掉行内按钮组（只想看结构、或在只读预览里复用本组件时用） */
    showActions?: boolean;
  }>(),
  {
    class: undefined,
    context: undefined,
    nodes: () => [],
    selectedId: undefined,
    showActions: true,
  },
);

const emit = defineEmits<{
  duplicate: [nodeId: string];
  drop: [payload: OutlineDropPayload];
  move: [payload: OutlineMovePayload];
  remove: [nodeId: string];
  select: [nodeId: string];
}>();

// 取值走门面：`:context` 换了，节点标签里的物料名要跟着换（传死值会一直显示旧物料名）
const context = useLowcodeContext(() => props.context);

const rows = computed<FlatNode[]>(() =>
  toFlatList(props.nodes ?? [], {
    labelOf: (node) => nodeLabel(node, context.registry),
  }),
);

/** 容器能不能收子节点：以元数据为准，没登记的类型按「能」处理（别让降级节点变得不能编辑） */
const isContainer = (node: NodeSchema): boolean =>
  context.registry.getMeta(node.type)?.container !== false;

function canMove(row: FlatNode, direction: 'down' | 'up'): boolean {
  const siblings = rowsOfSameParent(row);
  const index = siblings.findIndex((item) => item.node.id === row.node.id);
  return (
    index !== -1 &&
    index + (direction === 'up' ? -1 : 1) >= 0 &&
    index + (direction === 'up' ? -1 : 1) < siblings.length
  );
}

/** 同层兄弟：`toFlatList` 是前序的，父与插槽相同的相邻行即同层 */
function rowsOfSameParent(row: FlatNode): FlatNode[] {
  return rows.value.filter(
    (item) =>
      item.depth === row.depth &&
      item.parentId === row.parentId &&
      item.slot === row.slot,
  );
}

function onKeydown(row: FlatNode, event: KeyboardEvent) {
  if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    emit('remove', row.node.id);
    return;
  }
  if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
  event.preventDefault();
  const direction: 'down' | 'up' = event.key === 'ArrowUp' ? 'up' : 'down';
  if (event.altKey) {
    if (canMove(row, direction))
      emit('move', { direction, nodeId: row.node.id });
    return;
  }
  const siblings = rowsOfSameParent(row);
  const next =
    siblings[
      siblings.findIndex((item) => item.node.id === row.node.id) +
        (direction === 'up' ? -1 : 1)
    ];
  if (next) emit('select', next.node.id);
}

/**
 * 落点判定：行高 1/3 之前、2/3 之后，中间留给容器。
 * `height` 为 0（jsdom、或者还没布局完）时退化成「容器 inside、其余 after」，
 * 保证测试与非浏览器环境仍能拿到一个确定且合法的位置。
 */
function dropPositionOf(
  row: FlatNode,
  event: DragEvent,
): 'after' | 'before' | 'inside' {
  const rect =
    event.currentTarget instanceof HTMLElement
      ? event.currentTarget.getBoundingClientRect()
      : undefined;
  const height = rect?.height ?? 0;
  if (!height) return isContainer(row.node) ? 'inside' : 'after';
  const ratio = ((event.clientY ?? rect!.top) - rect!.top) / height;
  if (ratio < 1 / 3) return 'before';
  if (ratio > 2 / 3) return 'after';
  return isContainer(row.node) ? 'inside' : ratio < 0.5 ? 'before' : 'after';
}

function onDragStartRow(row: FlatNode, event: DragEvent) {
  writeDndData(event, { kind: 'node', nodeId: row.node.id });
}

function onDropRow(row: FlatNode, event: DragEvent) {
  const payload = readDndPayload(event);
  if (!payload) return;
  emit('drop', {
    materialType: payload.kind === 'material' ? payload.type : undefined,
    nodeId: payload.kind === 'node' ? payload.nodeId : undefined,
    position: dropPositionOf(row, event),
    refId: row.node.id,
    slot: row.slot ?? 'children',
  });
}

function onDropRoot(event: DragEvent) {
  const payload = readDndPayload(event);
  if (!payload) return;
  emit('drop', {
    materialType: payload.kind === 'material' ? payload.type : undefined,
    nodeId: payload.kind === 'node' ? payload.nodeId : undefined,
    position: 'inside',
  });
}
</script>

<template>
  <div
    :class="cn('flex w-full flex-col', props.class)"
    data-slot="lowcode-outline"
  >
    <div
      v-if="rows.length === 0"
      class="rounded-md border border-dashed px-3 py-6 text-center text-xs text-muted-foreground"
      data-slot="lowcode-outline-empty"
      @dragover.prevent
      @drop.prevent="onDropRoot"
    >
      页面还是空的，从物料面板拖一个组件进来
    </div>

    <div
      v-for="row in rows"
      :key="row.node.id"
      :data-depth="row.depth"
      :data-node-id="row.node.id"
      :data-parent-id="row.parentId"
      data-slot="lowcode-outline-row"
      :data-type="row.node.type"
      class="flex items-center gap-1 border-b py-0.5 pr-1"
      draggable="true"
      @dragstart="onDragStartRow(row, $event)"
      @dragover.prevent
      @drop.prevent="onDropRow(row, $event)"
    >
      <button
        :class="
          cn(
            indentClass(row.depth),
            props.selectedId === row.node.id
              ? 'bg-accent text-accent-foreground'
              : 'text-foreground hover:bg-accent/60',
          )
        "
        :data-selected="props.selectedId === row.node.id ? 'true' : 'false'"
        class="min-w-0 flex-1 truncate rounded-md py-1 text-left text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        data-action="select"
        type="button"
        @click="emit('select', row.node.id)"
        @keydown="onKeydown(row, $event)"
      >
        <span v-if="row.slot" class="text-xs text-muted-foreground">[{{ row.slot }}]</span>
        {{ row.label }}
      </button>

      <template v-if="showActions">
        <Button
          :disabled="!canMove(row, 'up')"
          aria-label="上移"
          data-action="move-up"
          size="xs"
          variant="ghost"
          @click="emit('move', { direction: 'up', nodeId: row.node.id })"
        >
          上移
        </Button>
        <Button
          :disabled="!canMove(row, 'down')"
          aria-label="下移"
          data-action="move-down"
          size="xs"
          variant="ghost"
          @click="emit('move', { direction: 'down', nodeId: row.node.id })"
        >
          下移
        </Button>
        <Button
          aria-label="复制"
          data-action="duplicate"
          size="xs"
          variant="ghost"
          @click="emit('duplicate', row.node.id)"
        >
          复制
        </Button>
        <Button
          aria-label="删除"
          data-action="remove"
          size="xs"
          variant="ghost"
          @click="emit('remove', row.node.id)"
        >
          删除
        </Button>
      </template>
    </div>

    <div
      v-if="rows.length > 0"
      class="mt-1 rounded-md border border-dashed px-3 py-1 text-center text-xs text-muted-foreground"
      data-action="drop-root"
      data-slot="lowcode-outline-root-drop"
      @dragover.prevent
      @drop.prevent="onDropRoot"
    >
      放到页面末尾
    </div>
  </div>
</template>
