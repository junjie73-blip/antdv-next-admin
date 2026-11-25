<script setup lang="ts">
import type { Edge, NodeProps } from '@vue-flow/core';
import type { ApprovalFlowNode, ApprovalSignMode } from '~/api/approval';

import type {
  ApprovalGraphNode,
  ApprovalGraphNodeData,
} from './approval-flow-graph';

import { computed, ref, watch } from 'vue';

import { Background } from '@vue-flow/background';
import { Handle, Position, VueFlow } from '@vue-flow/core';

import { buildApprovalGraph } from './approval-flow-graph';

import '@vue-flow/core/dist/style.css';
import '@vue-flow/core/dist/theme-default.css';

/**
 * 审批流程可视化：vue-flow 画布替代纯文字时间线。
 * 节点位置与连线全部由 approval-flow-graph 的纯函数算出，这里只做展示；
 * 新一轮审批追加在旧轮次下方，历史节点不被覆盖。
 */
const props = withDefaults(
  defineProps<{
    ccPersons?: string[];
    currentStep?: number;
    nodes?: ApprovalFlowNode[];
    signMode?: ApprovalSignMode;
  }>(),
  {
    ccPersons: () => [],
    currentStep: 0,
    nodes: () => [],
    signMode: undefined,
  },
);

const STATUS_META: Record<
  string,
  { card: string; label: string; text: string }
> = {
  approved: {
    card: 'border-emerald-500/45 bg-emerald-500/5',
    label: '已通过',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  current: {
    card: 'border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/20',
    label: '处理中',
    text: 'text-amber-600 dark:text-amber-400',
  },
  pending: {
    card: 'border-border bg-muted/30',
    label: '待处理',
    text: 'text-muted-foreground',
  },
  rejected: {
    card: 'border-rose-500/50 bg-rose-500/5',
    label: '已驳回',
    text: 'text-rose-600 dark:text-rose-400',
  },
  skipped: {
    card: 'border-dashed border-border bg-muted/20 opacity-70',
    label: '已跳过',
    text: 'text-muted-foreground',
  },
};

const graph = computed(() =>
  buildApprovalGraph(props.nodes ?? [], props.currentStep),
);

// VueFlow 会在内部写节点尺寸，v-model 必须是可变 ref；computed 直接传进去会被写穿
const flowNodes = ref<ApprovalGraphNode[]>([]);
const flowEdges = ref<Edge[]>([]);
watch(
  graph,
  (value) => {
    flowNodes.value = value.nodes;
    flowEdges.value = value.edges;
  },
  { immediate: true },
);

function metaOf(status: string) {
  return STATUS_META[status] ?? STATUS_META.pending!;
}

function dataOf(slotProps: NodeProps): ApprovalGraphNodeData {
  return slotProps.data as ApprovalGraphNodeData;
}
</script>

<template>
  <div class="space-y-3" data-approval-flow-chart>
    <div class="flex flex-wrap items-center gap-2">
      <h3 class="text-sm font-semibold">审批进度</h3>
      <span
        class="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
      >
        共 {{ graph.roundCount }} 轮
      </span>
      <span
        v-if="signMode"
        class="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground"
      >
        {{ signMode === 'countersign' ? '会签' : '顺序审批' }}
      </span>
    </div>

    <div
      class="w-full overflow-hidden rounded-lg border border-border bg-background"
      :style="{ height: `${graph.height}px` }"
    >
      <!-- 轮次变化时重新挂载，让 fitView 把新一轮也纳入视野 -->
      <VueFlow
        :key="graph.roundCount"
        v-model:edges="flowEdges"
        v-model:nodes="flowNodes"
        :edges-updatable="false"
        :fit-view-on-init="true"
        :max-zoom="1.6"
        :min-zoom="0.4"
        :nodes-connectable="false"
        :nodes-draggable="false"
        :pan-on-drag="true"
        :zoom-on-scroll="true"
      >
        <template #node-approval="slotProps">
          <div
            class="w-[208px] rounded-lg border px-3 py-2 text-left shadow-sm"
            :class="metaOf(dataOf(slotProps).approvalNode.status).card"
            :data-current="dataOf(slotProps).current ? 'true' : 'false'"
            :data-node-status="dataOf(slotProps).approvalNode.status"
            data-slot="approval-flow-node"
          >
            <Handle
              id="top"
              :position="Position.Top"
              type="target"
              class="opacity-0"
            />
            <Handle
              id="bottom"
              :position="Position.Bottom"
              type="source"
              class="opacity-0"
            />
            <div class="flex items-center justify-between gap-2">
              <span class="truncate text-sm font-medium">
                {{ dataOf(slotProps).approvalNode.title }}
              </span>
              <span
                class="shrink-0 text-[10px] font-medium"
                :class="metaOf(dataOf(slotProps).approvalNode.status).text"
              >
                {{ metaOf(dataOf(slotProps).approvalNode.status).label }}
              </span>
            </div>
            <p class="mt-1 truncate text-xs text-muted-foreground">
              处理人：{{ dataOf(slotProps).approvalNode.approver || '待指定' }}
            </p>
            <div class="mt-1.5 flex flex-wrap items-center gap-1">
              <span
                class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground"
              >
                第 {{ dataOf(slotProps).approvalNode.round }} 轮 · 步骤
                {{ dataOf(slotProps).approvalNode.step }}
              </span>
              <span
                v-if="dataOf(slotProps).approvalNode.auto"
                class="rounded bg-indigo-500/10 px-1.5 py-0.5 text-[10px] text-indigo-600 dark:text-indigo-400"
              >
                超时自动
              </span>
              <span
                v-if="dataOf(slotProps).overdue"
                class="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-600 dark:text-rose-400"
              >
                已超时
              </span>
            </div>
            <p
              v-if="dataOf(slotProps).approvalNode.actedAt"
              class="mt-1 truncate text-[10px] text-muted-foreground"
            >
              {{ dataOf(slotProps).approvalNode.actedAt }}
            </p>
            <p
              v-else-if="dataOf(slotProps).approvalNode.dueAt"
              class="mt-1 truncate text-[10px] text-muted-foreground"
            >
              时限 {{ dataOf(slotProps).approvalNode.dueAt }}
            </p>
            <p
              v-if="dataOf(slotProps).approvalNode.comment"
              class="mt-1 line-clamp-2 rounded bg-muted/60 px-1.5 py-1 text-[11px]"
            >
              {{ dataOf(slotProps).approvalNode.comment }}
            </p>
          </div>
        </template>

        <Background :gap="20" pattern-color="hsl(var(--border))" />
      </VueFlow>
    </div>

    <p v-if="!graph.nodes.length" class="text-sm text-muted-foreground">
      暂无审批节点记录
    </p>
    <p v-if="ccPersons?.length" class="text-xs text-muted-foreground">
      抄送对象：{{ ccPersons.join('、') }}
    </p>
  </div>
</template>
