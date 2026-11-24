<script setup lang="ts">
import type {
  GanttChangePayload,
  GanttFieldMap,
  GanttViewMode,
} from '@antdv/common-ui/report';
import type { FormSchema } from '@antdv/form-ui';
import type { GanttRow, ProjectTask, ScheduleIssue } from '~/api/project';

import type { QueuedGanttChange } from './change-batch';

import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { ReportGantt } from '@antdv/common-ui/report';
import { BasicForm, useForm } from '@antdv/form-ui';
import { BasicModal, message, useModal } from '@antdv/popup-ui';
import { Button, Card } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import {
  assignTaskGroup,
  createProjectPhase,
  getProjectGantt,
  getProjectList,
  getProjectTasks,
  rescheduleTask,
  updateProjectPhase,
  validateProjectSchedule,
} from '~/api/project';

import { dedupeGanttChanges, isProgressOnly } from './change-batch';

defineOptions({ name: 'ProjectSchedule' });

/**
 * 项目排期：把项目下的阶段/里程碑/任务放进同一条时间轴。
 *
 * 进度口径（与后端权重算法一致）：
 * - 所有条（阶段 / 里程碑 / 任务）的进度都是后端按任务状态、占比、时间节点、优先级
 *   加权算出的**只读值**；甘特进度手柄不写接口，拖动会被驳回并提示；
 * - 排期节点（阶段 / 里程碑 / 任务）可以拖动改期；改期后立即重新校验与名下任务的
 *   时间匹配度，异常清单与提示同屏展示；
 * - 一次拖拽可能触发 frappe 多个回调（自身 + 依赖联动 + 进度手柄），这里按 120ms
 *   窗口合并成一批，只提交一次、重绘一次、弹一条提示。
 */
const route = useRoute();
const selectedProject = ref<'' | number>(
  route.query.projectId ? Number(route.query.projectId) : '',
);
const projectOptions = ref<Array<{ label: string; value: number }>>([]);
const rows = ref<GanttRow[]>([]);
const projectName = ref('');
const loading = ref(false);
const viewMode = ref<GanttViewMode>('Week');
const issues = ref<ScheduleIssue[]>([]);

const fieldMap: GanttFieldMap = {
  dependencies: 'deps',
  end: 'end',
  id: 'id',
  name: 'name',
  progress: 'progress',
  start: 'start',
};

const delayedRows = computed(() => rows.value.filter((row) => row.delayed));

const phaseSchemas: FormSchema[] = [
  { component: 'Input', field: 'name', label: '阶段名称', required: true },
  {
    component: 'Input',
    field: 'startDate',
    label: '开始日期',
    componentProps: { placeholder: 'YYYY-MM-DD' },
  },
  {
    component: 'Input',
    field: 'endDate',
    label: '结束日期',
    componentProps: { placeholder: 'YYYY-MM-DD' },
  },
];
const [phaseModalRegister, phaseModalMethods] = useModal();
const [phaseFormRegister, phaseFormMethods] = useForm();

/** 任务组关联弹层的状态 */
const groupPhaseId = ref<null | number>(null);
const groupPhaseName = ref('');
const allTasks = ref<ProjectTask[]>([]);
const groupTaskIds = ref<number[]>([]);
const [groupModalRegister, groupModalMethods] = useModal();

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
    const params =
      selectedProject.value === ''
        ? undefined
        : { projectId: selectedProject.value };
    const [chart, check] = await Promise.all([
      getProjectGantt(params),
      validateProjectSchedule(params),
    ]);
    rows.value = chart.rows;
    projectName.value = chart.projectName;
    issues.value = check.issues;
  } finally {
    loading.value = false;
  }
}

watch(selectedProject, () => void load(), { immediate: true });

/**
 * 甘特拖拽批次。
 *
 * frappe 在一次拖拽里可能连发多个回调：拖阶段条会触发 dateChange，
 * 依赖联动的下游条又各触发一次；拖进度手柄时还会并出一个 progressChange。
 * 旧实现每个回调弹一条 message，用户拖一次看到三条。这里把短窗口内的
 * 全部变更收进一个批次，只提交一次、只重绘一次、只弹一条提示。
 */
const pendingChanges: QueuedGanttChange[] = [];
let flushTimer: ReturnType<typeof setTimeout> | undefined;

function queueChange(
  payload: GanttChangePayload,
  channel: 'date' | 'progress',
) {
  pendingChanges.push({ channel, payload });
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flushChanges(), 120);
}

async function flushChanges() {
  const batch = dedupeGanttChanges(pendingChanges);
  pendingChanges.length = 0;
  if (batch.length === 0) return;

  let changed = 0;
  try {
    for (const { channel, payload } of batch) {
      // 进度手柄全部只读：任务/阶段进度都由后端按权重算法统一计算
      if (channel === 'progress') continue;
      const numericId = Number(payload.id.slice(1));
      if (payload.id.startsWith('t')) {
        await rescheduleTask(numericId, {
          dueDate: payload.end.slice(0, 10),
          startDate: payload.start.slice(0, 10),
        });
        changed += 1;
      } else if (payload.id.startsWith('p')) {
        await updateProjectPhase(numericId, {
          endDate: payload.end.slice(0, 10),
          startDate: payload.start.slice(0, 10),
        });
        changed += 1;
      }
    }
    await load(); // load 内已重新拉取排期校验，issues 面板与下方提示用同一份结果
    if (isProgressOnly(batch)) {
      // 只拖了进度手柄：进度由后端统一计算，静默重绘回真实值 + 一条说明
      message.info('进度由后端按任务状态与时间节点统一计算，暂不支持手动修改');
      return;
    }
    if (!changed) return;
    if (issues.value.length > 0) {
      message.warning(
        `排期已更新，当前有 ${issues.value.length} 处时间点不匹配，见上方异常清单`,
      );
    } else {
      message.success('排期已更新，所有时间点校验通过');
    }
  } catch (error) {
    message.error(error instanceof Error ? error.message : '排期更新失败');
    await load();
  }
}

function onDateChange(payload: GanttChangePayload) {
  queueChange(payload, 'date');
}

function onProgressChange(payload: GanttChangePayload) {
  // 进度由后端统一计算，甘特进度手柄只读：入队只为在批次里触发一次重绘，
  // 不写接口、不单独弹提示，避免一次拖拽冒出多条 message。
  queueChange(payload, 'progress');
}

async function addPhase() {
  const values = await phaseFormMethods.validate();
  if (!values || !selectedProject.value) return;
  try {
    await createProjectPhase({
      ...values,
      isMilestone: false,
      projectId: selectedProject.value,
    });
    message.success('阶段已加入排期');
    phaseModalMethods.closeModal();
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '新增阶段失败');
  }
}

async function openGroup(row: GanttRow) {
  if (selectedProject.value === '') return;
  groupPhaseId.value = Number(row.id.slice(1));
  groupPhaseName.value = row.name;
  try {
    const res = await getProjectTasks({
      projectId: selectedProject.value,
      pageSize: 200,
    });
    allTasks.value = res.list;
    groupTaskIds.value = allTasks.value
      .filter((task) => task.phaseId === groupPhaseId.value)
      .map((task) => task.id);
    groupModalMethods.openModal();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '加载任务失败');
  }
}

async function submitGroup() {
  if (groupPhaseId.value === null) return;
  try {
    const res = await assignTaskGroup(groupPhaseId.value, groupTaskIds.value);
    message.success(
      `已关联 ${res.assigned} 个任务${res.rejected.length > 0 ? `，${res.rejected.length} 个被拒绝` : ''}`,
    );
    groupModalMethods.closeModal();
    await load();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '关联任务失败');
  }
}
</script>

<template>
  <div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 class="text-xl font-semibold">项目排期</h2>
        <p class="mt-1 text-sm text-muted-foreground">
          阶段、里程碑与任务共用一条时间轴；拖动节点可改期并立即校验时间点。进度由后端按任务状态与时间节点统一计算，此处只读。
        </p>
      </div>
      <div class="flex flex-wrap items-center gap-2">
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
        <Button
          size="sm"
          :disabled="!selectedProject"
          @click="phaseModalMethods.openModal()"
        >
          <Icon icon="carbon:add" /> 新增阶段
        </Button>
      </div>
    </div>

    <div
      v-if="delayedRows.length"
      class="rounded-md border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm"
    >
      <span class="font-medium text-destructive">延期提醒：</span>
      {{ delayedRows.length }} 个阶段/任务已超过计划日期 —
      <span class="text-muted-foreground">
        {{
          delayedRows
            .slice(0, 4)
            .map((row) => row.name)
            .join('、')
        }}
      </span>
    </div>

    <div
      v-if="issues.length"
      class="rounded-md border border-amber-500/40 bg-amber-500/5 px-4 py-3 text-sm"
    >
      <span class="font-medium text-amber-600">排期异常（{{ issues.length }}）：</span>
      <ul class="mt-1 list-disc pl-5 text-muted-foreground">
        <li v-for="(issue, index) in issues.slice(0, 6)" :key="index">
          {{ issue.message }}
        </li>
      </ul>
    </div>

    <Card class="p-3">
      <ReportGantt
        :field-map="fieldMap"
        :loading="loading"
        :readonly="false"
        :rows="rows"
        :title="projectName ? `${projectName} · 项目时间轴` : '全部项目时间轴'"
        :view-mode="viewMode"
        :view-modes="['Day', 'Week', 'Month']"
        class="h-[560px]"
        @date-change="onDateChange"
        @progress-change="onProgressChange"
        @update:view-mode="viewMode = $event"
      />
    </Card>

    <Card
      v-if="selectedProject"
      title="阶段任务组"
      description="选择阶段关联的任务；阶段完成率由这些任务按权重自动计算。"
    >
      <ul class="space-y-2">
        <li
          v-for="row in rows.filter(
            (item) => item.kind === 'phase' || item.kind === 'milestone',
          )"
          :key="row.id"
          class="flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
        >
          <span class="min-w-0 truncate">{{ row.name }}</span>
          <Button variant="outline" size="sm" @click="openGroup(row)">
            <Icon icon="carbon:task" /> 关联任务
          </Button>
        </li>
      </ul>
    </Card>

    <BasicModal
      title="新增阶段"
      :width="480"
      @ok="addPhase"
      @register="phaseModalRegister"
    >
      <BasicForm
        :grid="{ cols: 1, gutter: 16 }"
        :label-width="90"
        :schemas="phaseSchemas"
        :show-action-button-group="false"
        @register="phaseFormRegister"
      />
    </BasicModal>

    <BasicModal
      :title="`关联任务组 · ${groupPhaseName}`"
      :width="520"
      @ok="submitGroup"
      @register="groupModalRegister"
    >
      <div class="max-h-80 space-y-2 overflow-auto py-2">
        <label
          v-for="task in allTasks"
          :key="task.id"
          class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm"
        >
          <input v-model="groupTaskIds" type="checkbox" :value="task.id" />
          <span class="min-w-0 flex-1 truncate">{{ task.title }}</span>
          <span class="shrink-0 text-xs text-muted-foreground">{{ task.progress }}%</span>
        </label>
        <p v-if="!allTasks.length" class="text-sm text-muted-foreground">
          该项目暂无任务
        </p>
      </div>
    </BasicModal>
  </div>
</template>
