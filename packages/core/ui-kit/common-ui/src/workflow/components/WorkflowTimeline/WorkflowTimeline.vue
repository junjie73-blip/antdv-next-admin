<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { WorkflowIssue } from '../../core/engine';
import type { WorkflowHistoryEntry } from '../../core/types';

import { computed } from 'vue';

import { Badge, Separator } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { SYSTEM_NODE } from '../../core/engine';
import { ACTION_LABELS } from '../../utils/labels';

/**
 * 审批时间线。
 *
 * 只做渲染，不取数也不发起动作：数据由 `useWorkflow` 交进来，
 * 这样同一个组件既能挂在流程详情页，也能被报表页拿去展示历史单据。
 */
const props = defineProps<{
  class?: HTMLAttributes['class'];
  emptyText?: string;
  entries: WorkflowHistoryEntry[];
  /** 定义期校验的告警：设计器与详情页都要能就地解释"这条流程为什么跑歪了" */
  issues?: WorkflowIssue[];
  /** 节点 id -> 展示名；没给标题时不至于空白 */
  labelOf?: (nodeId: string) => string;
  /** 伪节点（撤回/挂起/超时）的展示名 */
  systemLabel?: string;
}>();

type BadgeVariant = 'default' | 'destructive' | 'outline' | 'secondary';

function tone(action: string): BadgeVariant {
  if (action.startsWith('reject')) return 'destructive';
  if (action === 'approve' || action === 'start') return 'default';
  if (action === 'skip' || action === 'transfer' || action === 'addSign')
    return 'secondary';
  return 'outline';
}

function time(at: number): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

const rows = computed(() =>
  props.entries.map((entry, index) => ({
    ...entry,
    key: `${entry.at}-${entry.nodeId}-${index}`,
    label:
      entry.nodeId === SYSTEM_NODE
        ? (props.systemLabel ?? '系统')
        : (props.labelOf?.(entry.nodeId) ?? entry.nodeId),
    title:
      ACTION_LABELS[entry.action as keyof typeof ACTION_LABELS] ?? entry.action,
  })),
);

const shownIssues = computed(() => props.issues ?? []);
</script>

<template>
  <div
    :class="cn('flex w-full flex-col gap-3', props.class)"
    data-slot="workflow-timeline"
  >
    <ol v-if="rows.length > 0" class="flex flex-col">
      <li v-for="(row, index) in rows" :key="row.key" class="flex flex-col">
        <div class="flex items-start gap-3 py-2">
          <div class="w-32 shrink-0 text-muted-foreground text-xs tabular-nums">
            {{ time(row.at) }}
          </div>
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <Badge :variant="tone(row.action)">{{ row.title }}</Badge>
              <span class="font-medium text-sm">{{ row.label }}</span>
              <span v-if="row.actor" class="text-muted-foreground text-xs">{{
                row.actor
              }}</span>
            </div>
            <p
              v-if="row.comment"
              class="mt-1 break-words text-muted-foreground text-sm"
            >
              {{ row.comment }}
            </p>
          </div>
        </div>
        <Separator v-if="index < rows.length - 1" />
      </li>
    </ol>
    <p
      v-else
      class="py-6 text-center text-muted-foreground text-sm"
      data-slot="workflow-timeline-empty"
    >
      {{ props.emptyText ?? '暂无审批记录' }}
    </p>
    <ul
      v-if="shownIssues.length > 0"
      class="flex flex-col gap-1 rounded-md bg-muted/50 p-3"
    >
      <li
        v-for="(issue, index) in shownIssues"
        :key="index"
        class="text-muted-foreground text-xs"
      >
        <span class="font-medium">{{
          issue.level === 'error' ? '错误' : '提示'
        }}</span>
        <span> · {{ issue.message }}</span>
      </li>
    </ul>
  </div>
</template>
