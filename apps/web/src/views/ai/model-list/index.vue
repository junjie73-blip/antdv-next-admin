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
  deleteAiModel,
  getAiModelList,
  getAiOverview,
  getAiProviderList,
  saveAiModel,
} from '~/api/ai';

defineOptions({ name: 'AiModelList' });

const overview = ref<AiOverview | null>(null);
/** 供应商下拉选项：从 /ai/provider/list 拉取，模型只能挂到真实存在的供应商上 */
const providerOptions = ref<Array<{ label: string; value: number }>>([]);

const STATUS_LABELS: Record<string, string> = {
  error: '异常',
  offline: '离线',
  online: '在线',
};
const STATUS_COLORS: Record<string, string> = {
  error: 'red',
  offline: 'default',
  online: 'green',
};
const PROTOCOL_LABELS: Record<string, string> = {
  dashscope: 'DashScope',
  http: 'HTTP',
  'openai-compatible': 'OpenAI 兼容',
};

const columns = computed<DataColumn[]>(() => [
  { key: 'code', title: '模型 ID', width: '150px' },
  { key: 'name', title: '模型名称', width: '150px' },
  { key: 'providerName', title: '供应商', width: '130px' },
  { key: 'protocolLabel', title: '调用协议', width: '130px' },
  { key: 'context', title: '上下文', width: '100px' },
  { key: 'callsToday', title: '今日调用', width: '110px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'updatedAt', title: '更新时间', width: '160px' },
]);

const filters = computed<DataFilter[]>(() => [
  {
    key: 'status',
    label: '运行状态',
    options: [
      { label: '在线', value: 'online' },
      { label: '离线', value: 'offline' },
      { label: '异常', value: 'error' },
    ],
  },
  {
    key: 'providerId',
    label: '供应商',
    options: providerOptions.value.map((item) => ({
      label: item.label,
      value: String(item.value),
    })),
  },
]);

const statsCards = computed<DataStat[]>(() => [
  {
    icon: 'carbon:model',
    label: '模型总数',
    tone: 'blue',
    value: String(overview.value?.modelTotal ?? 0),
  },
  {
    icon: 'carbon:checkmark',
    label: '在线',
    tone: 'green',
    value: String(overview.value?.modelOnline ?? 0),
  },
  {
    icon: 'carbon:activity',
    label: '今日调用',
    tone: 'violet',
    value: (overview.value?.modelCallsToday ?? 0).toLocaleString(),
  },
  {
    icon: 'carbon:warning-alt',
    label: '异常',
    tone: 'red',
    value: String(overview.value?.modelError ?? 0),
  },
]);

const createSchemas = computed<FormSchema[]>(() => [
  { component: 'Input', field: 'name', label: '模型名称', required: true },
  {
    component: 'Input',
    field: 'code',
    label: '模型 ID（调用别名）',
    required: true,
  },
  {
    component: 'Select',
    componentProps: { options: providerOptions.value },
    field: 'providerId',
    label: '所属供应商',
    required: true,
  },
  {
    component: 'Select',
    componentProps: {
      options: [
        { label: 'OpenAI 兼容', value: 'openai-compatible' },
        { label: 'DashScope', value: 'dashscope' },
        { label: 'HTTP', value: 'http' },
      ],
    },
    field: 'protocol',
    label: '调用协议',
  },
  { component: 'Input', field: 'context', label: '上下文长度' },
  {
    component: 'Select',
    componentProps: {
      options: [
        { label: '在线', value: 'online' },
        { label: '离线', value: 'offline' },
        { label: '异常', value: 'error' },
      ],
    },
    field: 'status',
    label: '状态',
  },
]);

async function listApi(params: Record<string, any>) {
  const result = await getAiModelList(params);
  return {
    list: result.list.map((row) => ({
      ...row,
      protocolLabel: PROTOCOL_LABELS[row.protocol] ?? row.protocol,
    })),
    total: result.total,
  };
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

async function loadProviders() {
  try {
    const result = await getAiProviderList({ pageNum: 1, pageSize: 200 });
    providerOptions.value = result.list.map((item) => ({
      label: item.name,
      value: item.id,
    }));
  } catch (error) {
    handleError(error);
  }
}

async function onSubmit(
  values: Record<string, any>,
  editingKey: null | string,
) {
  try {
    await saveAiModel(
      editingKey ? { ...values, id: Number(editingKey) } : values,
    );
    message.success(editingKey ? '保存成功' : '接入成功');
    await loadOverview();
    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

async function onRemove(row: DataRow) {
  try {
    await deleteAiModel(Number(row.id));
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
  createLabel: '接入模型',
  createSchemas: createSchemas.value,
  description:
    '可调用的大模型清单、协议与启用状态；模型必须关联一个已存在的供应商。',
  filters: filters.value,
  icon: 'carbon:model',
  onSubmit,
  onRemove,
  primaryKey: 'id',
  showDelete: true,
  stats: statsCards.value,
  statusColors: STATUS_COLORS,
  statusLabels: STATUS_LABELS,
  statusKey: 'status',
  title: '模型列表',
}));

onMounted(() => {
  void loadOverview();
  void loadProviders();
});
</script>

<template>
  <DataPage v-bind="config" />
</template>
