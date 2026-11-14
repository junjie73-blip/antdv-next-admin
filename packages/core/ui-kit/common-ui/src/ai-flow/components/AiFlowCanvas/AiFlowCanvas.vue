<script setup lang="ts">
import type { Edge, Node, NodeProps } from '@vue-flow/core';

import type { HTMLAttributes } from 'vue';

import type { AiFlowDefinition, AiRunState } from '../../core/types';
import type { AiCanvasEdge, AiCanvasNode, AiCanvasNodeData } from './to-canvas';

import { computed, ref, watch } from 'vue';

import { cn } from '@antdv/shared/utils/cn';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { VueFlow } from '@vue-flow/core';
import { MiniMap } from '@vue-flow/minimap';

import {
  nodePaletteOf,
  nodeStatusRingOf,
  toCanvasEdges,
  toCanvasNodes,
} from './to-canvas';

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';
import '@vue-flow/minimap/dist/style.css';

/**
 * AI 流程图画布。
 *
 * 分层位置：`components/AiFlowCanvas`，最外层，只读 `core/types` 的形状与 `to-canvas` 的纯映射。
 *
 * **这里没有运行语义，一条都没有。** 节点往哪走、重试几次、调哪个模型，全在 `core/` 里算完，
 * 到这儿只剩「已经发生的结论」：状态涂成外环、产物键写在小字上。
 * 反过来讲更实用：想在画布上加「点一下就重跑这个节点」，正确做法是 emit 出去、
 * 由 composable 调运行器，而不是在组件里 import provider 自己发请求 ——
 * 那样凭据就会顺着组件跑到前端代码里。
 *
 * 刻意不做的事：不内置编辑器（新增/删除节点的 UI 属于第二个图编辑库，仓库里禁止）、
 * 不做自动排版（只兜底坐标）、不改图结构；拖动后只把新坐标 emit 给宿主写回 `position`。
 */
const props = defineProps<{
  class?: HTMLAttributes['class'];
  /** 只读展示时全关掉交互，免得用户以为能编辑 */
  editable?: boolean;
  flow: AiFlowDefinition;
  /** 传了就把运行态涂到节点上；不传是纯设计态 */
  state?: AiRunState;
}>();

const emit = defineEmits<{
  /** 拖动结束后的节点坐标，宿主据此写回定义的 `position` */
  change: [positions: Array<{ id: string; x: number; y: number }>];
  edgeSelect: [edgeId: string];
  paneClick: [];
  select: [nodeId: string];
}>();

// VueFlow 用 v-model 持有元素的内部副本，所以这里必须是可变 ref 而不是 computed：
// 传 computed 进去，用户一拖动就会撞在「不能写 computed」上
const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);

const mappedNodes = computed<AiCanvasNode[]>(() =>
  toCanvasNodes(props.flow, props.state),
);
const mappedEdges = computed<AiCanvasEdge[]>(() =>
  toCanvasEdges(props.flow, props.state),
);

watch(
  mappedNodes,
  (value) => {
    nodes.value = value as unknown as Node[];
  },
  { immediate: true },
);

watch(
  mappedEdges,
  (value) => {
    edges.value = value as unknown as Edge[];
  },
  { immediate: true },
);

/** 插槽作用域里 `data` 的类型来自 VueFlow（`any`），收进一个函数比在模板里堆一串断言好读 */
function canvasDataOf(slotProps: NodeProps): AiCanvasNodeData {
  return slotProps.data as unknown as AiCanvasNodeData;
}

function selectNode(nodeId: string): void {
  emit('select', nodeId);
}

function onNodeDragStop(): void {
  // 显式声明结果类型：VueFlow 的 `Node` 是带一堆泛型的内部类型，直接 `.map` 出去会让
  // emit 的载荷类型走到「深度实例化」那条路上（TS2589），先落成普通对象数组最稳
  const positions: Array<{ id: string; x: number; y: number }> = [];
  for (const node of nodes.value)
    positions.push({ id: node.id, x: node.position.x, y: node.position.y });
  emit('change', positions);
}

defineExpose({ edges, nodes, selectNode });
</script>

<template>
  <div
    :class="
      cn(
        'relative h-[520px] w-full overflow-hidden rounded-md border bg-background',
        props.class,
      )
    "
    data-slot="ai-flow-canvas"
  >
    <VueFlow
      v-model:edges="edges"
      v-model:nodes="nodes"
      :edges-updatable="false"
      :fit-view-on-init="true"
      :nodes-connectable="editable ?? false"
      :nodes-draggable="editable ?? true"
      :pan-on-drag="true"
      :zoom-on-scroll="true"
      @edge-click="({ edge }) => emit('edgeSelect', edge.id)"
      @node-click="({ node }) => selectNode(node.id)"
      @node-drag-stop="onNodeDragStop"
      @pane-click="emit('paneClick')"
    >
      <template #node-ai="slotProps">
        <div
          :class="
            cn(
              'min-w-[190px] rounded-md border px-3 py-2 text-left shadow-sm',
              nodePaletteOf(canvasDataOf(slotProps).kind),
              nodeStatusRingOf(canvasDataOf(slotProps).status),
            )
          "
          data-slot="ai-flow-canvas-node"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="truncate font-medium text-sm">{{
              canvasDataOf(slotProps).label
            }}</span>
            <span
              class="shrink-0 text-[10px] tracking-wide uppercase opacity-70"
            >
              {{ canvasDataOf(slotProps).kind }}
            </span>
          </div>
          <p class="mt-1 truncate text-muted-foreground text-xs">
            {{
              canvasDataOf(slotProps).description ||
              canvasDataOf(slotProps).status
            }}
          </p>
          <p
            v-if="canvasDataOf(slotProps).valueKey"
            class="mt-1 truncate font-mono text-[10px] opacity-70"
          >
            {{ canvasDataOf(slotProps).valueKey }}
          </p>
        </div>
      </template>

      <Background />
      <Controls />
      <MiniMap />
    </VueFlow>
  </div>
</template>
