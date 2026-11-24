<script setup lang="ts">
import type {
  ProjectDetail,
  ProjectLog,
  ProjectPhase,
  ProjectTask,
} from '~/api/project';

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Button, Progress } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import { getProjectDetail, getProjectTaskDetail } from '~/api/project';

/**
 * 详情抽屉里的「业务上下文」：项目带阶段/任务/流水，任务带自己的进度流水，
 * 里程碑带同阶段任务。列表页只展示行字段，这里补的是"完成到哪个阶段或任务"。
 */
type Kind = 'members' | 'milestones' | 'projects' | 'tasks';

const props = withDefaults(
  defineProps<{
    kind: Kind;
    record: null | Record<string, any>;
  }>(),
  { record: null },
);

const router = useRouter();
const loading = ref(false);
const project = ref<null | ProjectDetail>(null);
const taskLogs = ref<ProjectLog[]>([]);

const phases = computed<ProjectPhase[]>(() => {
  if (props.kind === 'projects') return project.value?.phases ?? [];
  if (props.kind === 'milestones')
    return (project.value?.phases ?? []).filter(
      (phase) => phase.id === Number(props.record?.id),
    );
  return [];
});

const tasks = computed<ProjectTask[]>(() => {
  if (props.kind === 'projects') return project.value?.tasks ?? [];
  if (props.kind === 'milestones')
    return (project.value?.tasks ?? []).filter(
      (task) => task.phaseId === Number(props.record?.id),
    );
  return [];
});

const logs = computed<ProjectLog[]>(() => {
  if (props.kind === 'tasks') return taskLogs.value;
  return project.value?.logs ?? [];
});

async function load() {
  const record = props.record;
  if (!record) return;
  loading.value = true;
  try {
    if (props.kind === 'tasks') {
      const detail = await getProjectTaskDetail(Number(record.id));
      taskLogs.value = detail.logs;
    } else if (props.kind !== 'members') {
      const projectId = Number(
        props.kind === 'projects' ? record.id : record.projectId,
      );
      project.value = await getProjectDetail(projectId);
    }
  } finally {
    loading.value = false;
  }
}

watch(
  () => [props.kind, props.record?.id],
  () => void load(),
  { immediate: true },
);

function openSchedule() {
  void router.push({
    path: '/project/schedule',
    query: { projectId: String(props.record?.id ?? '') },
  });
}
</script>

<template>
  <div v-if="kind !== 'members'" class="mt-6 space-y-5 border-t pt-4">
    <p v-if="loading" class="text-sm text-muted-foreground">
      正在加载进度明细…
    </p>

    <template v-if="kind === 'projects'">
      <section>
        <div class="mb-2 flex items-center justify-between">
          <h4 class="text-sm font-semibold">阶段进度</h4>
          <Button size="sm" variant="link" @click="openSchedule">
            <Icon icon="carbon:timeline" /> 查看排期
          </Button>
        </div>
        <ul class="space-y-2">
          <li
            v-for="phase in phases"
            :key="phase.id"
            class="flex items-center gap-3 rounded-md border px-3 py-2 text-sm"
          >
            <span class="w-28 shrink-0 truncate">{{ phase.name }}</span>
            <Progress :model-value="phase.progress" class="h-1.5 flex-1" />
            <span
              class="w-10 shrink-0 text-right tabular-nums text-muted-foreground"
            >
              {{ phase.progress }}%
            </span>
            <span v-if="phase.delayed" class="text-xs text-destructive">
              延期 {{ phase.delayDays }} 天
            </span>
          </li>
        </ul>
      </section>

      <section>
        <h4 class="mb-2 text-sm font-semibold">任务完成情况</h4>
        <ul class="space-y-1.5">
          <li
            v-for="task in tasks"
            :key="task.id"
            class="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-sm"
          >
            <span class="min-w-0 flex-1 truncate">{{ task.title }}</span>
            <span class="shrink-0 text-xs text-muted-foreground">{{
              task.owner
            }}</span>
            <span class="w-10 shrink-0 text-right tabular-nums">{{ task.progress }}%</span>
          </li>
          <li v-if="!tasks.length" class="text-sm text-muted-foreground">
            尚未拆分任务
          </li>
        </ul>
      </section>
    </template>

    <template v-else-if="kind === 'milestones'">
      <section>
        <h4 class="mb-2 text-sm font-semibold">该阶段的任务</h4>
        <ul class="space-y-1.5">
          <li
            v-for="task in tasks"
            :key="task.id"
            class="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-1.5 text-sm"
          >
            <span class="min-w-0 flex-1 truncate">{{ task.title }}</span>
            <span class="w-10 shrink-0 text-right tabular-nums">{{ task.progress }}%</span>
          </li>
          <li v-if="!tasks.length" class="text-sm text-muted-foreground">
            该阶段尚未拆分任务
          </li>
        </ul>
      </section>
    </template>

    <section>
      <h4 class="mb-2 text-sm font-semibold">进度流水</h4>
      <ol class="space-y-2">
        <li
          v-for="log in logs.slice(0, 8)"
          :key="log.id"
          class="rounded-md border px-3 py-2 text-xs"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium">{{ log.title }}</span>
            <span class="shrink-0 text-muted-foreground">{{
              log.createdAt
            }}</span>
          </div>
          <p class="mt-1 text-muted-foreground">
            {{ log.operator }} · {{ log.action }} · {{ log.value }}
          </p>
          <p v-if="log.note" class="mt-0.5">{{ log.note }}</p>
        </li>
        <li v-if="!logs.length" class="text-sm text-muted-foreground">
          暂无进度记录
        </li>
      </ol>
    </section>
  </div>
</template>
