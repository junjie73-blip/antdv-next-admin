<script setup lang="ts">
import type { HTMLAttributes } from 'vue';

import type { WorkflowTask } from '../../core/types';

import { computed } from 'vue';

import {
  Badge,
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
  Separator,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';

import { TASK_STATUS_LABELS, TASK_STATUS_VARIANTS } from '../../utils/labels';

/**
 * 待办 / 待阅列表。
 *
 * 与 ApprovalBar 同样的分工：不取数、不动引擎，只把 `WorkflowTask[]` 画出来并回抛选中项。
 * 列表的筛选、分页、轮询都在 `useWorkflowTasks` 里，页面负责把两者接起来。
 */
const props = defineProps<{
  class?: HTMLAttributes['class'];
  emptyText?: string;
  /** 节点 id -> 展示名 */
  labelOf?: (nodeId: string) => string;
  loading?: boolean;
  tasks: WorkflowTask[];
  title?: string;
}>();

const emit = defineEmits<{
  (event: 'select', task: WorkflowTask): void;
}>();

const rows = computed(() => props.tasks);

function time(at: number): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
</script>

<template>
  <div
    :class="cn('flex w-full flex-col', props.class)"
    data-slot="workflow-task-list"
  >
    <div v-if="props.title" class="px-1 py-2 font-medium text-sm">
      {{ props.title }}
    </div>
    <div v-if="rows.length > 0" class="flex flex-col">
      <template v-for="(task, index) in rows" :key="task.id">
        <button
          type="button"
          class="flex w-full items-center gap-3 rounded-md px-2 py-3 text-left transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
          :data-task-id="task.id"
          @click="emit('select', task)"
        >
          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <span class="truncate text-sm font-medium">{{
                props.labelOf?.(task.nodeId) ?? task.nodeId
              }}</span>
              <Badge :variant="TASK_STATUS_VARIANTS[task.status]">
                {{ TASK_STATUS_LABELS[task.status] }}
              </Badge>
            </div>
            <div class="mt-1 text-muted-foreground text-xs">
              <span>{{ task.assignee }}</span>
              <span v-if="task.seq > 0" class="ml-2">第 {{ task.seq + 1 }} 位</span>
            </div>
          </div>
          <div class="shrink-0 text-muted-foreground text-xs tabular-nums">
            {{ time(task.createdAt) }}
          </div>
        </button>
        <Separator v-if="index < rows.length - 1" />
      </template>
    </div>
    <Empty v-else-if="!props.loading" class="border border-dashed">
      <EmptyHeader>
        <EmptyTitle>{{ props.emptyText ?? '没有待办' }}</EmptyTitle>
        <EmptyDescription>
          流程办结后这里就空了，去「我发起的」看历史单据。
        </EmptyDescription>
      </EmptyHeader>
    </Empty>
    <p v-else class="py-6 text-center text-muted-foreground text-sm">加载中…</p>
  </div>
</template>
