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

import { computed, ref } from 'vue';

import { DataPage } from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import {
  deleteAiProvider,
  getAiOverview,
  getAiProviderList,
  saveAiProvider,
} from '~/api/ai';

defineOptions({ name: 'AiProvider' });

const pageRef = ref<{ reload: () => Promise<void> | void }>();
const overview = ref<AiOverview | null>(null);

const STATUS_LABELS: Record<string, string> = {
  disabled: '停用',
  enabled: '启用',
};
const STATUS_COLORS: Record<string, string> = {
  disabled: 'default',
  enabled: 'green',
};
const KEY_STATUS_LABELS: Record<string, string> = {
  configured: '已配置',
  missing: '未配置',
  rotate: '待轮换',
};
const PROTOCOL_LABELS: Record<string, string> = {
  dashscope: 'DashScope',
  http: 'HTTP',
  'openai-compatible': 'OpenAI 兼容',
};

const columns = computed<DataColumn[]>(() => [
  { key: 'code', title: '编号', width: '100px' },
  { key: 'name', title: '供应商名称', width: '160px' },
  { key: 'protocolLabel', title: '调用协议', width: '130px' },
  { key: 'endpoint', title: 'API Endpoint', width: '200px' },
  { key: 'keyMasked', title: 'API Key（脱敏）', width: '130px' },
  { key: 'keyStatusLabel', title: '密钥状态', width: '110px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'updatedAt', title: '更新时间', width: '160px' },
]);

const filters = computed<DataFilter[]>(() => [
  {
    key: 'status',
    label: '启用状态',
    options: [
      { label: '启用', value: 'enabled' },
      { label: '停用', value: 'disabled' },
    ],
  },
]);

const statsCards = computed<DataStat[]>(() => [
  {
    icon: 'carbon:api',
    label: '供应商总数',
    tone: 'blue',
    value: String(overview.value?.providerTotal ?? 0),
  },
  {
    icon: 'carbon:checkmark',
    label: '已启用',
    tone: 'green',
    value: String(overview.value?.providerEnabled ?? 0),
  },
  {
    icon: 'carbon:time',
    label: '密钥待轮换',
    tone: 'amber',
    value: String(overview.value?.keyRotate ?? 0),
  },
  {
    icon: 'carbon:warning-alt',
    label: '未配置密钥',
    tone: 'red',
    value: String(overview.value?.keyMissing ?? 0),
  },
]);

const createSchemas = computed<FormSchema[]>(() => [
  { component: 'Input', field: 'name', label: '供应商名称', required: true },
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
  {
    component: 'Input',
    field: 'endpoint',
    label: 'API Endpoint',
    required: true,
  },
  {
    component: 'Input',
    field: 'key',
    label: 'API Key（仅保留末 4 位掩码，明文不落库）',
    placeholder: '留空表示沿用已配置密钥',
  },
  {
    component: 'Select',
    componentProps: {
      options: [
        { label: '已配置', value: 'configured' },
        { label: '待轮换', value: 'rotate' },
        { label: '未配置', value: 'missing' },
      ],
    },
    field: 'keyStatus',
    label: '密钥状态',
  },
  {
    component: 'Select',
    componentProps: {
      options: [
        { label: '启用', value: 'enabled' },
        { label: '停用', value: 'disabled' },
      ],
    },
    field: 'status',
    label: '状态',
  },
  { component: 'Input', field: 'description', label: '描述' },
]);

async function listApi(params: Record<string, any>) {
  const result = await getAiProviderList(params);
  // 展示层把语义 key 翻译成中文；落库仍只存语义值，接口契约不变。
  return {
    list: result.list.map((row) => ({
      ...row,
      keyStatusLabel: KEY_STATUS_LABELS[row.keyStatus] ?? row.keyStatus,
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

async function onSubmit(
  values: Record<string, any>,
  editingKey: null | string,
) {
  try {
    await saveAiProvider(
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
    await deleteAiProvider(Number(row.id));
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
  createLabel: '新增供应商',
  createSchemas: createSchemas.value,
  description:
    '模型供应商接入、调用协议与密钥状态管理；密钥只在服务端托管，前端仅见脱敏串。',
  filters: filters.value,
  icon: 'carbon:api',
  onSubmit,
  onRemove,
  primaryKey: 'id',
  showDelete: true,
  stats: statsCards.value,
  statusColors: STATUS_COLORS,
  statusLabels: STATUS_LABELS,
  statusKey: 'status',
  title: '模型供应商',
}));
</script>

<template>
  <DataPage v-bind="config" ref="pageRef" />
</template>
