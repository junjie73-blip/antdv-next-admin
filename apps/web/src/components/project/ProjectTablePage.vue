<script setup lang="ts">
import type {
  DataColumn,
  DataFilter,
  DataPageProps,
  DataRow,
  DataStat,
} from '@antdv/common-ui';
import type { FormSchema } from '@antdv/form-ui';
import type {
  ProjectOptions,
  ProjectOverview,
  ProjectPhase,
} from '~/api/project';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { DataPage } from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import {
  addProjectMember,
  createProject,
  createProjectPhase,
  createProjectTask,
  deleteProject,
  deleteProjectTask,
  getProjectList,
  getProjectMembers,
  getProjectOptions,
  getProjectOverview,
  getProjectPhases,
  getProjectTasks,
  removeProjectMember,
  updateProject,
  updateProjectMember,
  updateProjectPhase,
  updateProjectTask,
} from '~/api/project';

import ProjectDetailPanel from './ProjectDetailPanel.vue';

/**
 * 项目管理 4 类列表页的共用骨架：
 * 数据来自 backend-mock 的 SQLite 接口，写入后统一刷新表格与看板统计，
 * 「项目 / 任务 / 里程碑 / 成员」通过 projectId / phaseId 串成同一条链。
 */
type Kind = 'members' | 'milestones' | 'projects' | 'tasks';

const props = withDefaults(
  defineProps<{
    description?: string;
    icon?: string;
    kind: Kind;
    mine?: boolean;
    title: string;
  }>(),
  { description: '', icon: 'carbon:list', mine: false },
);

const router = useRouter();
const pageRef = ref<{ reload: () => Promise<void> | void }>();

const overview = ref<null | ProjectOverview>(null);
const options = ref<null | ProjectOptions>(null);
const projectOptions = ref<Array<{ label: string; value: number }>>([]);
const phasesByProject = ref<Record<number, ProjectPhase[]>>({});
const memberTotal = ref(0);

const METADATA = {
  members: {
    createLabel: '添加成员',
    primaryKey: 'id',
    statusKey: 'status',
  },
  milestones: {
    createLabel: '新增里程碑',
    primaryKey: 'id',
    statusKey: 'status',
  },
  projects: {
    createLabel: '新建项目',
    primaryKey: 'id',
    statusKey: 'status',
  },
  tasks: {
    createLabel: '新增任务',
    primaryKey: 'id',
    statusKey: 'status',
  },
} as const;

const STATUS_LABELS: Record<string, string> = {
  active: '进行中',
  blocked: '已阻塞',
  disabled: '停用',
  done: '已完成',
  enabled: '启用',
  on_hold: '已暂停',
  pending: '待开始',
  planning: '待开始',
  running: '进行中',
};
const STATUS_COLORS: Record<string, string> = {
  active: 'blue',
  blocked: 'red',
  disabled: 'default',
  done: 'green',
  enabled: 'green',
  on_hold: 'default',
  pending: 'gold',
  planning: 'gold',
  running: 'blue',
};

const columns = computed<DataColumn[]>(() => {
  if (props.kind === 'projects')
    return [
      { key: 'code', title: '编号', width: '100px' },
      { key: 'name', title: '项目名称', width: '180px' },
      { key: 'owner', title: '负责人', width: '90px' },
      { key: 'progress', title: '进度', width: '160px' },
      { key: 'status', title: '状态', width: '100px' },
      { key: 'delayText', title: '交付风险', width: '110px' },
      { key: 'planEndDate', title: '计划交付', width: '120px' },
    ];
  if (props.kind === 'tasks')
    return [
      { key: 'id', title: '编号', width: '90px' },
      { key: 'title', title: '任务标题', width: '200px' },
      { key: 'projectName', title: '所属项目', width: '150px' },
      { key: 'owner', title: '负责人', width: '90px' },
      { key: 'priority', title: '优先级', width: '80px' },
      { key: 'progress', title: '进度', width: '160px' },
      { key: 'status', title: '状态', width: '100px' },
      { key: 'dueDate', title: '截止日期', width: '120px' },
      { key: 'delayText', title: '交付风险', width: '110px' },
    ];
  if (props.kind === 'milestones')
    return [
      { key: 'id', title: '编号', width: '90px' },
      { key: 'name', title: '里程碑', width: '180px' },
      { key: 'projectName', title: '所属项目', width: '150px' },
      { key: 'owner', title: '负责人', width: '90px' },
      { key: 'progress', title: '完成度', width: '160px' },
      { key: 'status', title: '状态', width: '100px' },
      { key: 'endDate', title: '截止日期', width: '120px' },
      { key: 'delayText', title: '交付风险', width: '110px' },
    ];
  return [
    { key: 'id', title: '编号', width: '90px' },
    { key: 'name', title: '成员', width: '110px' },
    { key: 'projectName', title: '所属项目', width: '150px' },
    { key: 'dept', title: '部门', width: '110px' },
    { key: 'roleLabel', title: '项目角色', width: '120px' },
    { key: 'email', title: '邮箱', width: '200px' },
    { key: 'status', title: '状态', width: '100px' },
  ];
});

const filters = computed<DataFilter[]>(() => {
  const statusOptions = [
    { label: '待开始', value: 'pending' },
    { label: '进行中', value: 'running' },
    { label: '已完成', value: 'done' },
    { label: '已阻塞', value: 'blocked' },
  ];
  if (props.kind === 'projects')
    return [
      {
        key: 'status',
        label: '项目状态',
        options: [
          { label: '待开始', value: 'planning' },
          { label: '进行中', value: 'active' },
          { label: '已暂停', value: 'on_hold' },
          { label: '已完成', value: 'done' },
        ],
      },
      {
        key: 'priority',
        label: '优先级',
        options: [
          { label: '高', value: 'high' },
          { label: '中', value: 'middle' },
          { label: '低', value: 'low' },
        ],
      },
    ];
  if (props.kind === 'tasks')
    return [
      { key: 'status', label: '任务状态', options: statusOptions },
      {
        key: 'priority',
        label: '优先级',
        options: [
          { label: '高', value: 'high' },
          { label: '中', value: 'middle' },
          { label: '低', value: 'low' },
        ],
      },
      {
        key: 'projectId',
        label: '所属项目',
        options: projectOptions.value.map((item) => ({
          label: item.label,
          value: String(item.value),
        })),
      },
    ];
  if (props.kind === 'milestones')
    return [
      { key: 'status', label: '里程碑状态', options: statusOptions },
      {
        key: 'projectId',
        label: '所属项目',
        options: projectOptions.value.map((item) => ({
          label: item.label,
          value: String(item.value),
        })),
      },
    ];
  return [
    {
      key: 'role',
      label: '项目角色',
      options:
        options.value?.memberRoles.map((item) => ({
          label: item.label,
          value: String(item.value),
        })) ?? [],
    },
    {
      key: 'status',
      label: '账号状态',
      options: [
        { label: '启用', value: 'enabled' },
        { label: '停用', value: 'disabled' },
      ],
    },
  ];
});

/** 把数字进度与延期布尔值归一成 DataPage 可直接展示的字符串列 */
function shape(row: DataRow): DataRow {
  return {
    ...row,
    delayText: row.delayed ? `延期 ${row.delayDays} 天` : '正常',
    progress: `${row.progress ?? 0}%`,
  };
}

async function listApi(params: Record<string, any>) {
  const extra = props.mine ? { mine: 'true' } : {};
  if (props.kind === 'projects') {
    const result = await getProjectList({ ...params, ...extra });
    return { list: result.list.map(shape), total: result.total };
  }
  if (props.kind === 'tasks') {
    const result = await getProjectTasks({ ...params, ...extra });
    return { list: result.list.map(shape), total: result.total };
  }
  if (props.kind === 'milestones') {
    const result = await getProjectPhases({ ...params, milestone: 'true' });
    return { list: result.list.map(shape), total: result.total };
  }
  const result = await getProjectMembers(params);
  return { list: result.list, total: result.total };
}

const stats = computed<DataStat[]>(() => {
  const board = overview.value;
  if (props.kind === 'projects')
    return [
      {
        label: '项目总数',
        value: String(board?.stats.projectTotal ?? 0),
        icon: 'carbon:folder',
        tone: 'blue',
      },
      {
        label: '进行中',
        value: String(board?.stats.projectActive ?? 0),
        icon: 'carbon:in-progress',
        tone: 'violet',
      },
      {
        label: '已完成',
        value: String(board?.stats.projectDone ?? 0),
        icon: 'carbon:checkmark',
        tone: 'green',
      },
      {
        label: '延期风险',
        value: String(board?.stats.projectDelayed ?? 0),
        icon: 'carbon:warning-alt',
        tone: 'red',
      },
    ];
  if (props.kind === 'tasks')
    return [
      {
        label: '任务总数',
        value: String(board?.stats.taskTotal ?? 0),
        icon: 'carbon:task',
        tone: 'blue',
      },
      {
        label: '待办/阻塞',
        value: String(board?.stats.taskPending ?? 0),
        icon: 'carbon:time',
        tone: 'amber',
      },
      {
        label: '进行中',
        value: String(board?.stats.taskRunning ?? 0),
        icon: 'carbon:in-progress',
        tone: 'violet',
      },
      {
        label: '已完成',
        value: String(board?.stats.taskDone ?? 0),
        icon: 'carbon:checkmark',
        tone: 'green',
      },
    ];
  if (props.kind === 'milestones')
    return [
      {
        label: '里程碑总数',
        value: String(board?.milestones.total ?? 0),
        icon: 'carbon:milestone',
        tone: 'blue',
      },
      {
        label: '已达成',
        value: String(board?.milestones.done ?? 0),
        icon: 'carbon:checkmark',
        tone: 'green',
      },
      {
        label: '待完成',
        value: String(
          (board?.milestones.total ?? 0) - (board?.milestones.done ?? 0),
        ),
        icon: 'carbon:in-progress',
        tone: 'violet',
      },
      {
        label: '延期',
        value: String(board?.milestones.delayed ?? 0),
        icon: 'carbon:warning-alt',
        tone: 'red',
      },
    ];
  return [
    {
      label: '成员总数',
      value: String(memberTotal.value),
      icon: 'carbon:group',
      tone: 'blue',
    },
    { label: '项目负责', value: '—', icon: 'carbon:user', tone: 'violet' },
    { label: '研发设计', value: '—', icon: 'carbon:terminal', tone: 'green' },
    { label: '已停用', value: '—', icon: 'carbon:warning-alt', tone: 'amber' },
  ];
});

const createSchemas = computed<FormSchema[]>(() => {
  const projectSelect: FormSchema = {
    component: 'Select',
    componentProps: {
      options: projectOptions.value.map((item) => ({
        label: item.label,
        value: item.value,
      })),
      placeholder: '请选择所属项目',
    },
    field: 'projectId',
    label: '所属项目',
    required: true,
  };
  const phaseSelect: FormSchema = {
    component: 'Select',
    componentProps: (params) => ({
      options: (
        phasesByProject.value[Number(params.values.projectId)] ?? []
      ).map((phase) => ({
        label: phase.name,
        value: phase.id,
      })),
      placeholder: '请选择阶段',
    }),
    field: 'phaseId',
    label: '所属阶段',
    required: true,
  };
  const priority: FormSchema = {
    component: 'Select',
    componentProps: {
      options: [
        { label: '高', value: 'high' },
        { label: '中', value: 'middle' },
        { label: '低', value: 'low' },
      ],
    },
    field: 'priority',
    label: '优先级',
  };

  if (props.kind === 'projects')
    return [
      { component: 'Input', field: 'name', label: '项目名称', required: true },
      { component: 'Input', field: 'owner', label: '负责人' },
      {
        component: 'Input',
        field: 'startDate',
        label: '开始日期',
        componentProps: { placeholder: 'YYYY-MM-DD' },
      },
      {
        component: 'Input',
        field: 'planEndDate',
        label: '计划交付',
        componentProps: { placeholder: 'YYYY-MM-DD' },
      },
      { component: 'Input', field: 'code', label: '项目编号' },
      priority,
      { component: 'Input', field: 'description', label: '项目描述' },
    ];
  if (props.kind === 'tasks')
    return [
      { component: 'Input', field: 'title', label: '任务标题', required: true },
      projectSelect,
      phaseSelect,
      { component: 'Input', field: 'owner', label: '负责人' },
      {
        component: 'Input',
        field: 'startDate',
        label: '开始日期',
        componentProps: { placeholder: 'YYYY-MM-DD' },
      },
      {
        component: 'Input',
        field: 'dueDate',
        label: '截止日期',
        componentProps: { placeholder: 'YYYY-MM-DD' },
      },
      priority,
    ];
  if (props.kind === 'milestones')
    return [
      {
        component: 'Input',
        field: 'name',
        label: '里程碑名称',
        required: true,
      },
      projectSelect,
      { component: 'Input', field: 'owner', label: '负责人' },
      {
        component: 'Input',
        field: 'startDate',
        label: '开始日期',
        componentProps: { placeholder: 'YYYY-MM-DD' },
      },
      {
        component: 'Input',
        field: 'endDate',
        label: '截止日期',
        componentProps: { placeholder: 'YYYY-MM-DD' },
      },
    ];
  return [
    { component: 'Input', field: 'name', label: '成员姓名', required: true },
    projectSelect,
    { component: 'Input', field: 'dept', label: '部门' },
    { component: 'Input', field: 'email', label: '邮箱' },
    {
      component: 'Select',
      componentProps: {
        options:
          options.value?.memberRoles.map((item) => ({
            label: item.label,
            value: item.value,
          })) ?? [],
      },
      field: 'role',
      label: '项目角色',
    },
  ];
});

const config = computed<DataPageProps>(() => ({
  actionWidth: props.kind === 'members' ? 200 : 320,
  api: listApi,
  columns: columns.value,
  createLabel: METADATA[props.kind].createLabel,
  createSchemas: createSchemas.value,
  description: props.description,
  filters: filters.value,
  icon: props.icon,
  onSubmit,
  onRemove,
  primaryKey: METADATA[props.kind].primaryKey,
  showDelete: props.kind !== 'milestones',
  stats: stats.value,
  statusColors: STATUS_COLORS,
  statusLabels: STATUS_LABELS,
  statusKey: METADATA[props.kind].statusKey,
  title: props.title,
}));

async function loadMeta() {
  const [board, list, opts, members] = await Promise.all([
    getProjectOverview(),
    getProjectList({ pageNum: 1, pageSize: 200 }),
    getProjectOptions(),
    getProjectMembers(),
  ]);
  overview.value = board;
  options.value = opts;
  memberTotal.value = members.total;
  projectOptions.value = list.list.map((item) => ({
    label: item.name,
    value: item.id,
  }));
  const phaseLists = await Promise.all(
    list.list.map((item) => getProjectPhases({ projectId: item.id })),
  );
  const map: Record<number, ProjectPhase[]> = {};
  list.list.forEach((item, index) => {
    map[item.id] = phaseLists[index]?.list ?? [];
  });
  phasesByProject.value = map;
}

function handleError(error: unknown): void {
  message.error(error instanceof Error ? error.message : '操作失败');
}

async function onSubmit(
  values: Record<string, any>,
  editingKey: null | string,
) {
  try {
    if (props.kind === 'projects') {
      if (editingKey) await updateProject(Number(editingKey), values);
      else await createProject(values);
    } else if (props.kind === 'tasks') {
      if (editingKey) await updateProjectTask(Number(editingKey), values);
      else await createProjectTask(values);
    } else if (props.kind === 'milestones') {
      if (editingKey) await updateProjectPhase(Number(editingKey), values);
      else await createProjectPhase({ ...values, isMilestone: true });
    } else {
      if (editingKey) await updateProjectMember(Number(editingKey), values);
      else await addProjectMember(values);
    }
    message.success(editingKey ? '保存成功' : '新建成功');
    await loadMeta();
    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

async function onRemove(row: DataRow) {
  try {
    if (props.kind === 'projects') await deleteProject(Number(row.id));
    else if (props.kind === 'tasks') await deleteProjectTask(Number(row.id));
    else if (props.kind === 'members')
      await removeProjectMember(Number(row.id));
    else return false; // 里程碑属于项目排期的一部分，删除走排期页，避免阶段被误删
    message.success('删除成功');
    await loadMeta();
    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

/* --------------------------- 页面跳转 --------------------------- */

/**
 * 进度列只读：任务/阶段/项目进度全部由后端按「状态 + 进度占比 + 时间节点 + 优先级」
 * 的权重算法统一计算，通过列表接口返回。这里不提供任何人工改进度的入口。
 */

function openSchedule(row?: DataRow) {
  void router.push({
    path: '/project/schedule',
    query: { projectId: String(row?.projectId ?? row?.id ?? '') },
  });
}
function openBoard(row?: DataRow) {
  void router.push({
    path: '/project/progress',
    query: { projectId: String(row?.projectId ?? row?.id ?? '') },
  });
}
function openTasks(row: DataRow) {
  void router.push({
    path: '/project/task-manage',
    query: { projectId: String(row.id) },
  });
}

onMounted(loadMeta);
</script>

<template>
  <DataPage v-bind="config" ref="pageRef">
    <template #action-extra="{ record }">
      <template v-if="kind === 'projects'">
        <Button
          variant="link"
          class="h-auto px-0.5!"
          @click="openSchedule(record)"
        >
          <Icon icon="carbon:timeline" /> 排期
        </Button>
        <Button
          variant="link"
          class="h-auto px-0.5!"
          @click="openTasks(record)"
        >
          <Icon icon="carbon:task" /> 任务
        </Button>
      </template>
      <template v-else-if="kind === 'milestones'">
        <Button
          variant="link"
          class="h-auto px-0.5!"
          @click="openTasks(record)"
        >
          <Icon icon="carbon:task" /> 任务
        </Button>
        <Button
          variant="link"
          class="h-auto px-0.5!"
          @click="openSchedule(record)"
        >
          <Icon icon="carbon:timeline" /> 排期
        </Button>
      </template>
    </template>

    <template #detail-extra="{ record }">
      <ProjectDetailPanel :kind="kind" :record="record" />
    </template>
  </DataPage>
</template>
