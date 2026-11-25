<script setup lang="ts">
import type {
  ApprovalAiAssessment,
  ApprovalFlowNode,
  ApprovalSignMode,
} from '~/api/approval';

import { computed } from 'vue';

/**
 * 审批进度时间线：列表详情抽屉与审批详情共用。
 * 节点状态 / 处理人 / 处理时间全部来自后端，不在前端推算审批结果。
 */
const props = withDefaults(
  defineProps<{
    assessment?: ApprovalAiAssessment;
    ccPersons?: string[];
    currentStep?: number;
    nodes?: ApprovalFlowNode[];
    signMode?: ApprovalSignMode;
  }>(),
  {
    assessment: undefined,
    ccPersons: () => [],
    currentStep: 0,
    nodes: () => [],
    signMode: undefined,
  },
);

const STATUS_META: Record<
  string,
  { dot: string; label: string; text: string }
> = {
  approved: {
    dot: 'bg-emerald-500 border-emerald-500',
    label: '已处理',
    text: 'text-emerald-600 dark:text-emerald-400',
  },
  current: {
    dot: 'bg-amber-500 border-amber-500 ring-4 ring-amber-500/15',
    label: '处理中',
    text: 'text-amber-600 dark:text-amber-400',
  },
  pending: {
    dot: 'bg-background border-muted-foreground/40',
    label: '待处理',
    text: 'text-muted-foreground',
  },
  rejected: {
    dot: 'bg-rose-500 border-rose-500',
    label: '已驳回',
    text: 'text-rose-600 dark:text-rose-400',
  },
  skipped: {
    dot: 'bg-background border-muted-foreground/30',
    label: '已跳过',
    text: 'text-muted-foreground',
  },
};

const RISK_META: Record<string, { label: string; className: string }> = {
  critical: { label: '高风险', className: 'bg-rose-500/10 text-rose-600 dark:text-rose-400' },
  high: { label: '较高风险', className: 'bg-orange-500/10 text-orange-600 dark:text-orange-400' },
  medium: { label: '中风险', className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400' },
  low: { label: '低风险', className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' },
};

const sortedNodes = computed(() =>
  [...(props.nodes ?? [])].sort((a, b) => a.step - b.step),
);

function meta(status: string) {
  return STATUS_META[status] ?? STATUS_META.pending!;
}

function overdue(node: ApprovalFlowNode): boolean {
  return Boolean(
    node.dueAt &&
      node.status !== 'approved' &&
      node.status !== 'rejected' &&
      new Date(node.dueAt.replace(' ', 'T')).getTime() < Date.now(),
  );
}

const risk = computed(() =>
  props.assessment ? (RISK_META[props.assessment.risk] ?? RISK_META.low) : null,
);
</script>

<template>
  <div class="space-y-5" data-approval-timeline>
    <div v-if="sortedNodes.length" class="space-y-0">
      <div
        v-for="(node, index) in sortedNodes"
        :key="`${node.step}-${node.title}-${index}`"
        class="relative flex gap-3 pb-5 last:pb-0"
        :data-node-status="node.status"
      >
        <div
          v-if="index < sortedNodes.length - 1"
          class="absolute left-[7px] top-4 h-full w-px bg-border"
        ></div>
        <span
          class="relative z-10 mt-1 size-[15px] shrink-0 rounded-full border-2"
          :class="meta(node.status).dot"
        ></span>
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            <span class="text-sm font-medium">{{ node.title }}</span>
            <span class="text-xs" :class="meta(node.status).text">
              {{ meta(node.status).label }}
            </span>
            <span v-if="signMode && node.kind === 'approval' && node.step > 2" class="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {{ signMode === 'countersign' ? '会签' : '顺序审批' }}
            </span>
            <span v-if="overdue(node)" class="rounded bg-rose-500/10 px-1.5 py-0.5 text-[10px] text-rose-600">
              已超时
            </span>
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            处理人：{{ node.approver || '待指定' }}
            <span v-if="node.actedAt"> · {{ node.actedAt }}</span>
            <span v-else-if="node.dueAt"> · 时限 {{ node.dueAt }}</span>
          </p>
          <p v-if="node.comment" class="mt-1 rounded bg-muted/60 px-2 py-1 text-xs">
            {{ node.comment }}
          </p>
        </div>
      </div>
    </div>
    <p v-else class="text-sm text-muted-foreground">暂无审批节点记录</p>

    <div v-if="assessment" class="rounded-lg border border-border bg-muted/30 p-3" data-ai-assessment>
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium">AI 预研判</span>
        <span v-if="risk" class="rounded px-1.5 py-0.5 text-[11px]" :class="risk.className">
          {{ risk.label }}
        </span>
        <span class="text-[11px] text-muted-foreground">
          {{ assessment.generatedAt }} · {{ assessment.source }}
        </span>
      </div>
      <p class="mt-2 text-xs">{{ assessment.summary }}</p>
      <ul class="mt-2 space-y-1">
        <li
          v-for="(suggestion, index) in assessment.suggestions"
          :key="index"
          class="flex gap-1.5 text-xs text-muted-foreground"
        >
          <span class="text-primary">·</span>{{ suggestion }}
        </li>
      </ul>
    </div>

    <div v-if="ccPersons?.length" class="text-xs text-muted-foreground">
      抄送对象：{{ ccPersons.join('、') }}
    </div>
  </div>
</template>
