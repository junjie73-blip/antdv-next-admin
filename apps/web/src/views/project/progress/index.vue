<script setup lang="ts">
import type { ProjectDetail, ProjectOverview } from '~/api/project';

import { computed, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Button, Card, Progress } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import {
  getProjectDetail,
  getProjectList,
  getProjectOverview,
} from '~/api/project';

defineOptions({ name: 'ProjectProgress' });

/** 进度看板：全局视图看项目进度与延期清单；带 projectId 时下钻到阶段/任务明细。 */
const route = useRoute();
const router = useRouter();
const overview = ref<null | ProjectOverview>(null);
const detail = ref<null | ProjectDetail>(null);
const selectedProject = ref<'' | number>(
  route.query.projectId ? Number(route.query.projectId) : '',
);
const projectOptions = ref<Array<{ label: string; value: number }>>([]);
const loading = ref(false);

const stats = computed(() => [
  {
    label: '项目总数',
    value: overview.value?.stats.projectTotal ?? 0,
    icon: 'carbon:folder',
    tone: 'text-blue-600 bg-blue-500/10',
  },
  {
    label: '进行中',
    value: overview.value?.stats.projectActive ?? 0,
    icon: 'carbon:in-progress',
    tone: 'text-violet-600 bg-violet-500/10',
  },
  {
    label: '已完成',
    value: overview.value?.stats.projectDone ?? 0,
    icon: 'carbon:checkmark',
    tone: 'text-emerald-600 bg-emerald-500/10',
  },
  {
    label: '延期风险',
    value: overview.value?.stats.projectDelayed ?? 0,
    icon: 'carbon:warning-alt',
    tone: 'text-rose-600 bg-rose-500/10',
  },
]);

const visibleProjects = computed(() => {
  const all = overview.value?.projects ?? [];
  return selectedProject.value === ''
    ? all
    : all.filter((item) => item.id === selectedProject.value);
});

async function load() {
  loading.value = true;
  try {
    if (projectOptions.value.length === 0) {
      const list = await getProjectList({ pageNum: 1, pageSize: 200 });
      projectOptions.value = list.list.map((item) => ({
        label: item.name,
        value: item.id,
      }));
    }
    overview.value = await getProjectOverview();
    detail.value =
      selectedProject.value === ''
        ? null
        : await getProjectDetail(selectedProject.value);
  } finally {
    loading.value = false;
  }
}

watch(selectedProject, () => {
  const query =
    selectedProject.value === ''
      ? {}
      : { projectId: String(selectedProject.value) };
  void router.replace({ path: '/project/progress', query });
  void load();
});

function openSchedule() {
  void router.push({
    path: '/project/schedule',
    query:
      selectedProject.value === ''
        ? {}
        : { projectId: String(selectedProject.value) },
  });
}

onMounted(load);
</script>

<template>
  <div class="space-y-5">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">进度看板</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          进度由任务操作驱动汇总，延期按计划日期实时计算；可下钻查看完成到哪个阶段或任务。
        </p>
      </div>
      <div class="flex items-center gap-2">
        <select
          v-model="selectedProject"
          class="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="">全部项目</option>
          <option
            v-for="item in projectOptions"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </option>
        </select>
        <Button size="sm" variant="outline" @click="openSchedule">
          <Icon icon="carbon:timeline" /> 查看甘特图
        </Button>
      </div>
    </div>

    <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <Card v-for="stat in stats" :key="stat.label">
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="text-xs text-muted-foreground">{{ stat.label }}</p>
            <p class="mt-1 text-2xl font-semibold tabular-nums">
              {{ stat.value }}
            </p>
          </div>
          <div
            class="flex size-10 items-center justify-center rounded-lg" :class="[
              stat.tone,
            ]"
          >
            <Icon :icon="stat.icon" class="size-5" />
          </div>
        </div>
      </Card>
    </div>

    <p v-if="loading" class="text-sm text-muted-foreground">
      正在加载看板数据…
    </p>

    <Card title="项目进度">
      <ul class="space-y-3">
        <li
          v-for="project in visibleProjects"
          :key="project.id"
          class="grid grid-cols-1 gap-2 rounded-md border px-4 py-3 sm:grid-cols-[180px_1fr_140px]"
        >
          <div class="min-w-0">
            <p class="truncate font-medium">{{ project.name }}</p>
            <p class="text-xs text-muted-foreground">
              负责人 {{ project.owner }}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <Progress :model-value="project.progress" class="h-2 flex-1" />
            <span class="w-10 shrink-0 text-right text-sm tabular-nums">{{ project.progress }}%</span>
          </div>
          <div class="flex items-center gap-2 text-xs sm:justify-end">
            <span v-if="project.delayed" class="font-medium text-destructive">
              延期 {{ project.delayDays }} 天
            </span>
            <span v-else class="text-muted-foreground">计划 {{ project.planEndDate }}</span>
            <Button
              variant="link"
              class="h-auto px-0.5 text-xs"
              @click="selectedProject = project.id"
            >
              详情
            </Button>
          </div>
        </li>
        <li
          v-if="!visibleProjects.length"
          class="text-sm text-muted-foreground"
        >
          暂无项目数据
        </li>
      </ul>
    </Card>

    <template v-if="detail">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card title="阶段完成度">
          <ul class="space-y-2">
            <li
              v-for="phase in detail.phases"
              :key="phase.id"
              class="flex items-center gap-3 text-sm"
            >
              <span class="w-28 shrink-0 truncate">{{ phase.name }}</span>
              <Progress :model-value="phase.progress" class="h-1.5 flex-1" />
              <span class="w-10 shrink-0 text-right tabular-nums">{{ phase.progress }}%</span>
              <span v-if="phase.delayed" class="text-xs text-destructive">延期</span>
            </li>
          </ul>
        </Card>

        <Card title="任务完成情况">
          <ul class="space-y-2">
            <li
              v-for="task in detail.tasks"
              :key="task.id"
              class="flex items-center gap-2 text-sm"
            >
              <span class="min-w-0 flex-1 truncate">{{ task.title }}</span>
              <span class="shrink-0 text-xs text-muted-foreground">{{
                task.owner
              }}</span>
              <span class="w-10 shrink-0 text-right tabular-nums">{{ task.progress }}%</span>
              <span v-if="task.delayed" class="text-xs text-destructive">延期</span>
            </li>
            <li
              v-if="!detail.tasks.length"
              class="text-sm text-muted-foreground"
            >
              尚未拆分任务
            </li>
          </ul>
        </Card>
      </div>
    </template>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card title="延期任务">
        <ul class="space-y-2">
          <li
            v-for="task in overview?.delayedTasks ?? []"
            :key="task.id"
            class="flex items-center justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm"
          >
            <span class="min-w-0 truncate">{{ task.title }}</span>
            <span class="shrink-0 text-xs text-destructive">
              {{ task.projectName }} · 逾期 {{ task.delayDays }} 天
            </span>
          </li>
          <li
            v-if="!overview?.delayedTasks.length"
            class="text-sm text-muted-foreground"
          >
            暂无延期任务
          </li>
        </ul>
      </Card>

      <Card title="最近进度流水">
        <ol class="space-y-2">
          <li
            v-for="log in overview?.recentLogs ?? []"
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
          </li>
        </ol>
      </Card>
    </div>
  </div>
</template>
