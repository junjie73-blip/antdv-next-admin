<script setup lang="ts">
import type { Connection, Edge, Node, NodeProps } from '@vue-flow/core';

import type { HTMLAttributes } from 'vue';

import type { WorkflowIssue } from '../../core/engine';
import type { NodeHandlerRegistry } from '../../core/registry';
import type { WorkflowDefinition, WorkflowNodeKind } from '../../core/types';
import type { WorkflowCanvasNodeData } from './to-canvas';

import { computed, ref, watch } from 'vue';

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  ButtonGroup,
  ScrollArea,
  Separator,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Background } from '@vue-flow/background';
import { Controls } from '@vue-flow/controls';
import { Handle, Position, VueFlow } from '@vue-flow/core';

import {
  addNode,
  autoLayout,
  connect,
  DESIGNER_NODE_KINDS,
  moveNode,
  nodeKindMeta,
  removeEdge,
  removeNode,
  WorkflowDesignerError,
} from '../../core/designer';
import { validateWorkflowDefinition } from '../../core/engine';
import { WorkflowNodeInspector } from '../WorkflowNodeInspector';
import {
  hasUnpositionedNodes,
  nodeToneOf,
  toCanvasEdges,
  toCanvasNodes,
} from './to-canvas';

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';
import '@vue-flow/controls/dist/style.css';

/**
 * 审批流设计器：画布是 `@vue-flow`，节点卡片与所有控件出自 `@antdv/shadcn-ui`。
 *
 * 三层分工是硬切的：
 * - `core/designer.ts` —— 定义的增删改与自动布局（纯函数，可单测）；
 * - `to-canvas.ts` —— 定义到 vue-flow 元素的映射（纯函数，可单测）；
 * - 本组件 —— 只做「把 vue-flow 的事件翻译成一次纯函数调用，再把新定义 emit 出去」。
 *
 * 所以这个组件里没有一条流程语义：能不能连由 `connect()` 判，
 * 能不能上线由 `validateWorkflowDefinition()` 判。想换画布库的人只需要重写这一层，
 * 语义与它的测试都不用动 —— 这也是当初把编辑动作抽成纯函数的全部理由。
 *
 * 两个刻意的取舍：
 * - **不持有定义的私有副本**。宿主用 `v-model:definition` 接住 emit 即可；
 *   不接（只读展示）也不会出现「画布和数据不同步」，因为每次事件都从 props 重新算。
 * - **不做撤销/重做**。那是宿主的状态管理（把 emit 序列压栈就行）；组件里塞 history
 *   反而会让「保存前后 diff 了哪些字段」这件事做歪。
 */
const props = withDefaults(
  defineProps<{
    class?: HTMLAttributes['class'];
    definition: WorkflowDefinition;
    /** 只读模式：隐藏调色板，锁死拖动与连线 */
    editable?: boolean;
    height?: string;
    /** 宿主注册过自定义节点时传进来，否则校验会把自定义类型报成"没有处理器" */
    registry?: NodeHandlerRegistry;
    showInspector?: boolean;
    showToolbar?: boolean;
  }>(),
  {
    class: undefined,
    editable: true,
    height: '520px',
    registry: undefined,
    showInspector: true,
    showToolbar: true,
  },
);

const emit = defineEmits<{
  selectEdge: [edgeId: string];
  selectNode: [nodeId: string];
  'update:definition': [definition: WorkflowDefinition];
  /** 一句话中文错误（来自 WorkflowDesignerError.code 对应的文案），宿主可直接 toast */
  warn: [message: string];
}>();

const selectedNodeId = ref<string>();
const selectedEdgeId = ref<string>();

// vue-flow 用 v-model 持有元素的内部副本，这里必须是可变 ref 而不是 computed：
// 传 computed 进去，用户一拖拽就会撞在「不能写 computed」上
const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);

watch(
  () => [props.definition, selectedNodeId.value, selectedEdgeId.value] as const,
  () => {
    nodes.value = toCanvasNodes(
      props.definition,
      selectedNodeId.value,
    ) as unknown as Node[];
    edges.value = toCanvasEdges(
      props.definition,
      selectedEdgeId.value,
    ) as unknown as Edge[];
    /**
     * 定义里有节点没画过坐标时，把自动布局的结果交回宿主 —— 只在可编辑时做。
     *
     * `to-canvas.ts` 里的兜底只解决"第一次打开就能看清"；坐标只有写进定义，
     * 拖拽回写、保存、下次打开才是同一个样子。`autoLayout()` 给每个节点都放了坐标，
     * 所以这一次 emit 之后条件就不再成立，不会和上面的 watch 形成回环。
     * 只读展示（`editable: false`）不改宿主的数据，靠映射层的兜底就够了。
     */
    if (props.editable && hasUnpositionedNodes(props.definition)) {
      apply(autoLayout(props.definition));
    }
  },
  { immediate: true },
);

const palette = computed(() => DESIGNER_NODE_KINDS);

/**
 * 校验结果直接摊在画布下方。
 *
 * 为什么不等点「保存」再报：设计器里最常见的成本是"连完 12 个节点才发现有 3 处悬空引用"，
 * 而 `validateWorkflowDefinition` 是纯函数、代价只有一次拓扑排序，
 * 放在 computed 里每次定义变化重算一次完全可接受。
 */
const issues = computed<WorkflowIssue[]>(() => {
  try {
    return validateWorkflowDefinition(props.definition, props.registry);
  } catch (error) {
    return [
      {
        code: 'unknown' as WorkflowIssue['code'],
        level: 'error',
        message: errorMessage(error),
      },
    ];
  }
});

const errorCount = computed(
  () => issues.value.filter((item) => item.level === 'error').length,
);

function errorMessage(error: unknown): string {
  return error instanceof WorkflowDesignerError ? error.message : String(error);
}

function apply(next: WorkflowDefinition): void {
  emit('update:definition', next);
}

function fail(error: unknown): void {
  emit('warn', errorMessage(error));
}

// ---------- 画布事件 ----------
/**
 * vue-flow 只管"用户从锚点拖到另一个节点"，能不能落边由 `connect()` 决定
 * （自环、重复边、终点是 start 都拒）。被拒时我们不改定义，props 没变，
 * 上面那个 watch 也不会重绘 —— vue-flow 自己的临时连线在 pointerup 后本来就会消失。
 */
function onConnect(connection: Connection): void {
  if (!connection.source || !connection.target) return;
  try {
    const { definition, edge } = connect(props.definition, {
      source: connection.source,
      target: connection.target,
    });
    apply(definition);
    selectedEdgeId.value = edge.id;
  } catch (error) {
    fail(error);
  }
}

function onNodeClick(nodeId: string): void {
  selectedNodeId.value = nodeId;
  selectedEdgeId.value = undefined;
  emit('selectNode', nodeId);
}

function onEdgeClick(edgeId: string): void {
  selectedEdgeId.value = edgeId;
  selectedNodeId.value = undefined;
  emit('selectEdge', edgeId);
}

function onPaneClick(): void {
  selectedNodeId.value = undefined;
  selectedEdgeId.value = undefined;
}

/** 拖拽结束把全部坐标一次性写回定义：逐条 emit 会往宿主撤销栈里塞 N 条记录 */
function onNodeDragStop(): void {
  let def = props.definition;
  for (const node of nodes.value) {
    const target = def.nodes.find((item) => item.id === node.id);
    if (!target) continue;
    if (
      target.position?.x === node.position.x &&
      target.position?.y === node.position.y
    )
      continue;
    def = moveNode(def, node.id, { x: node.position.x, y: node.position.y });
  }
  if (def !== props.definition) apply(def);
}

// ---------- 调色板 / 工具条 ----------
function onAdd(kind: WorkflowNodeKind): void {
  try {
    const { definition, nodeId } = addNode(props.definition, { kind });
    apply(definition);
    selectedNodeId.value = nodeId;
  } catch (error) {
    fail(error);
  }
}

function onAutoLayout(): void {
  apply(autoLayout(props.definition));
}

function onRemoveSelectedNode(): void {
  if (!selectedNodeId.value) return;
  const nodeId = selectedNodeId.value;
  try {
    apply(removeNode(props.definition, nodeId).definition);
    selectedNodeId.value = undefined;
  } catch (error) {
    fail(error);
  }
}

function onRemoveSelectedEdge(): void {
  if (!selectedEdgeId.value) return;
  const edgeId = selectedEdgeId.value;
  try {
    apply(removeEdge(props.definition, edgeId));
    selectedEdgeId.value = undefined;
  } catch (error) {
    fail(error);
  }
}

function canvasDataOf(slotProps: NodeProps): WorkflowCanvasNodeData {
  return slotProps.data as unknown as WorkflowCanvasNodeData;
}

defineExpose({ edges, nodes, onAutoLayout, selectedEdgeId, selectedNodeId });
</script>

<template>
  <div
    :class="
      cn(
        'flex w-full flex-col overflow-hidden rounded-md border bg-card',
        props.class,
      )
    "
    data-slot="workflow-definition-designer"
  >
    <div
      v-if="props.showToolbar"
      class="flex items-center justify-between gap-2 border-b bg-muted/30 px-3 py-2"
      data-slot="designer-toolbar"
    >
      <div class="flex min-w-0 items-center gap-2">
        <span class="truncate font-medium text-sm">{{
          props.definition.name
        }}</span>
        <Badge variant="outline">v{{ props.definition.version }}</Badge>
        <ButtonGroup>
          <Button
            :disabled="!selectedNodeId"
            data-testid="designer-remove-node"
            size="xs"
            variant="outline"
            @click="onRemoveSelectedNode"
          >
            删除节点
          </Button>
          <Button
            :disabled="!selectedEdgeId"
            data-testid="designer-remove-edge"
            size="xs"
            variant="outline"
            @click="onRemoveSelectedEdge"
          >
            删除连线
          </Button>
        </ButtonGroup>
        <Button
          data-testid="designer-auto-layout"
          size="xs"
          variant="outline"
          @click="onAutoLayout"
        >
          自动布局
        </Button>
      </div>
      <Badge
        :variant="errorCount > 0 ? 'destructive' : 'secondary'"
        data-testid="designer-issue-badge"
      >
        {{ errorCount > 0 ? `${errorCount} 个错误` : '定义可用' }}
      </Badge>
    </div>

    <div class="flex min-h-0 flex-1">
      <div
        v-if="props.editable"
        class="w-40 shrink-0 border-r bg-muted/20"
        data-slot="designer-palette"
      >
        <ScrollArea class="h-full">
          <div class="space-y-1 p-2">
            <p class="px-1 pb-1 text-muted-foreground text-[11px]">添加节点</p>
            <Button
              v-for="kind in palette"
              :key="kind.kind"
              class="w-full justify-start"
              data-testid="designer-palette-item"
              size="xs"
              variant="ghost"
              @click="onAdd(kind.kind)"
            >
              {{ kind.label }}
            </Button>
          </div>
        </ScrollArea>
      </div>

      <div
        class="relative min-w-0 flex-1 overflow-hidden"
        data-slot="designer-canvas"
        :style="{ height: props.height }"
      >
        <VueFlow
          v-model:edges="edges"
          v-model:nodes="nodes"
          :elements-selectable="props.editable"
          :fit-view-on-init="true"
          :fit-view-options="{ padding: 0.05 }"
          :min-zoom="0.4"
          :nodes-connectable="props.editable"
          :nodes-draggable="props.editable"
          @connect="onConnect"
          @edge-click="({ edge }) => onEdgeClick(edge.id)"
          @node-click="({ node }) => onNodeClick(node.id)"
          @node-drag-stop="onNodeDragStop"
          @pane-click="onPaneClick"
        >
          <template #node-workflow="slotProps">
            <div
              :class="
                cn(
                  // 卡片必须是**定宽**：布局的列距按占位盒算（`LAYOUT_COLUMN_GAP`），
                  // 用 min-w 让长标题把卡片撑开，节点就会互相压住 —— 那种重合在单测里量不出来，
                  // 只有真浏览器按屏幕矩形才看得出来
                  'w-[220px] rounded-md border px-3 py-2 shadow-sm',
                  // 端点放大到 12px：vue-flow 默认 6px，画布 fitView 之后整图常常只有 0.5 倍，
                  // 屏幕上一个 3 像素的点，鼠标根本抓不住。带 `!` 是因为 vue-flow 的 CSS
                  // 不在任何 @layer 里，同权重的工具类压不过它
                  '[&_.vue-flow__handle]:size-3!',
                  nodeToneOf(canvasDataOf(slotProps).kind),
                  canvasDataOf(slotProps).selected && 'ring-2 ring-primary/60',
                )
              "
              data-testid="designer-node"
            >
              <Handle :position="Position.Left" type="target" />
              <Handle :position="Position.Right" type="source" />
              <div class="flex items-center justify-between gap-2">
                <span
                  :title="canvasDataOf(slotProps).title"
                  class="truncate font-medium text-sm"
                >
                  {{ canvasDataOf(slotProps).title }}
                </span>
                <span
                  class="shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase"
                >
                  {{ canvasDataOf(slotProps).kindLabel }}
                </span>
              </div>
              <p
                class="mt-1 truncate text-muted-foreground text-xs"
                :title="canvasDataOf(slotProps).summary"
              >
                {{ canvasDataOf(slotProps).summary }}
              </p>
              <p class="mt-0.5 truncate text-[10px] text-muted-foreground/70">
                {{ nodeKindMeta(canvasDataOf(slotProps).kind).hint }}
              </p>
            </div>
          </template>

          <Background />
          <Controls />
        </VueFlow>
      </div>

      <WorkflowNodeInspector
        v-if="props.showInspector"
        class="w-72 shrink-0"
        :definition="props.definition"
        :node-id="selectedNodeId"
        @update:definition="apply"
        @warn="fail"
      />
    </div>

    <div
      v-if="issues.length > 0"
      class="border-t bg-muted/30"
      data-slot="designer-issues"
    >
      <div class="max-h-32 space-y-1 overflow-y-auto p-2">
        <Alert
          v-for="(issue, index) in issues"
          :key="`${issue.code}-${index}`"
          :variant="issue.level === 'error' ? 'destructive' : 'default'"
          class="py-2"
          data-testid="designer-issue"
        >
          <AlertTitle class="text-xs">
{{
            issue.level === 'error' ? '错误' : '提醒'
          }}
</AlertTitle>
          <AlertDescription class="text-xs">
{{
            issue.message
          }}
</AlertDescription>
        </Alert>
      </div>
      <Separator />
    </div>
  </div>
</template>
