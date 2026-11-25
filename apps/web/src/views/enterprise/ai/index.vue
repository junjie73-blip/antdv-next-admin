<script setup lang="ts">
import type {
  DataColumn,
  DataFilter,
  DataPageProps,
  DataRow,
  DataStat,
} from '@antdv/common-ui';
import type { FormSchema } from '@antdv/form-ui';
import type { AiOverview } from '~/api/ai';

import { computed, onMounted, ref } from 'vue';

import { DataPage } from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import {
  deleteAiAgent,
  getAiAgentList,
  getAiOverview,
  saveAiAgent,
} from '~/api/ai';

defineOptions({ name: 'EnterpriseAiResources' });

const overview = ref<AiOverview | null>(null);

const STATUS_LABELS: Record<string, string> = {
  disabled: '停用',
  draft: '草稿',
  running: '运行中',
};
const STATUS_COLORS: Record<string, string> = {
  disabled: 'default',
  draft: 'amber',
  running: 'green',
};

const columns = computed<DataColumn[]>(() => [
  { key: 'code', title: '编号', width: '100px' },
  { key: 'name', title: 'Agent 名称', width: '160px' },
  { key: 'owner', title: '负责人', width: '120px' },
  { key: 'tags', title: '标签', width: '160px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'description', title: '职责描述', width: '260px' },
  { key: 'updatedAt', title: '更新时间', width: '160px' },
]);

const filters = computed<DataFilter[]>(() => [
  {
    key: 'status',
    label: '运行状态',
    options: [
      { label: '运行中', value: 'running' },
      { label: '草稿', value: 'draft' },
      { label: '停用', value: 'disabled' },
    ],
  },
]);

const statsCards = computed<DataStat[]>(() => [
  {
    icon: 'carbon:machine-learning',
    label: 'Agent 总数',
    tone: 'blue',
    value: String(overview.value?.agentTotal ?? 0),
  },
  {
    icon: 'carbon:activity',
    label: '运行中',
    tone: 'green',
    value: String(overview.value?.agentRunning ?? 0),
  },
  {
    icon: 'carbon:edit',
    label: '草稿',
    tone: 'amber',
    value: String(overview.value?.agentDraft ?? 0),
  },
]);

const createSchemas = computed<FormSchema[]>(() => [
  { component: 'Input', field: 'name', label: 'Agent 名称', required: true },
  { component: 'Input', field: 'owner', label: '负责人', required: true },
  {
    component: 'InputTextArea',
    field: 'description',
    label: '职责描述',
    componentProps: { rows: 3 },
  },
  {
    component: 'Input',
    field: 'tags',
    label: '标签',
    componentProps: { placeholder: '多个标签用逗号分隔' },
  },
  {
    component: 'Select',
    componentProps: {
      options: [
        { label: '运行中', value: 'running' },
        { label: '草稿', value: 'draft' },
        { label: '停用', value: 'disabled' },
      ],
    },
    field: 'status',
    label: '状态',
  },
]);

async function listApi(params: Record<string, any>) {
  const result = await getAiAgentList(params);
  return { list: result.list, total: result.total };
}

function handleError(error: unknown): void {
  message.error(error instanceof Error ? error.message : '操作失败');
}

async function loadOverview() {
  try {
    overview.value = await getAiOverview();
  } catch (error) {
    handleError(error);
  }
}

async function onSubmit(
  values: Record<string, any>,
  editingKey: null | string,
) {
  try {
    await saveAiAgent(
      editingKey ? { ...values, id: Number(editingKey) } : values,
    );
    message.success(editingKey ? '保存成功' : '新建成功');
    await loadOverview();
    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

async function onRemove(row: DataRow) {
  try {
    await deleteAiAgent(Number(row.id));
    message.success('删除成功');
    await loadOverview();
    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

const config = computed<DataPageProps>(() => ({
  actionWidth: 180,
  api: listApi,
  columns: columns.value,
  createLabel: '新建 Agent',
  createSchemas: createSchemas.value,
  description:
    '只维护 Agent 自身的身份、职责、负责人与状态；模型、供应商与知识库请到 AI 配置的对应模块维护。',
  filters: filters.value,
  icon: 'carbon:machine-learning',
  onSubmit,
  onRemove,
  primaryKey: 'id',
  showDelete: true,
  stats: statsCards.value,
  statusColors: STATUS_COLORS,
  statusLabels: STATUS_LABELS,
  statusKey: 'status',
  title: 'Agent 配置',
}));

onMounted(loadOverview);
</script>

<template>
  <DataPage v-bind="config" />
</template>
