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
  deleteAiKnowledge,
  getAiKnowledgeList,
  getAiOverview,
  saveAiKnowledge,
} from '~/api/ai';

defineOptions({ name: 'AiKnowledge' });

const overview = ref<AiOverview | null>(null);

const STATUS_LABELS: Record<string, string> = {
  disabled: '停用',
  enabled: '启用',
};
const STATUS_COLORS: Record<string, string> = {
  disabled: 'default',
  enabled: 'green',
};

const columns = computed<DataColumn[]>(() => [
  { key: 'code', title: '编号', width: '100px' },
  { key: 'name', title: '知识库名称', width: '160px' },
  { key: 'docs', title: '文档数', width: '100px' },
  { key: 'vectorModel', title: '向量模型', width: '150px' },
  { key: 'scope', title: '可见范围', width: '110px' },
  { key: 'vectors', title: '已向量化', width: '110px' },
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
    icon: 'carbon:book',
    label: '知识库',
    tone: 'blue',
    value: String(overview.value?.knowledgeTotal ?? 0),
  },
  {
    icon: 'carbon:document',
    label: '文档总数',
    tone: 'violet',
    value: (overview.value?.knowledgeDocs ?? 0).toLocaleString(),
  },
  {
    icon: 'carbon:checkmark',
    label: '已向量化',
    tone: 'green',
    value: (overview.value?.knowledgeVectors ?? 0).toLocaleString(),
  },
  {
    icon: 'carbon:time',
    label: '待处理',
    tone: 'amber',
    value: (overview.value?.knowledgePending ?? 0).toLocaleString(),
  },
]);

const createSchemas = computed<FormSchema[]>(() => [
  { component: 'Input', field: 'name', label: '知识库名称', required: true },
  { component: 'Input', field: 'vectorModel', label: '向量模型' },
  { component: 'Input', field: 'docs', label: '文档数' },
  { component: 'Input', field: 'chunks', label: '分片数' },
  { component: 'Input', field: 'vectors', label: '已向量化数' },
  { component: 'Input', field: 'scope', label: '可见范围', required: true },
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
]);

async function listApi(params: Record<string, any>) {
  const result = await getAiKnowledgeList(params);
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
    await saveAiKnowledge(
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
    await deleteAiKnowledge(Number(row.id));
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
  createLabel: '新建知识库',
  createSchemas: createSchemas.value,
  description:
    '知识库元数据、向量状态与检索可见范围管理；向量检索能力需外部依赖接入。',
  filters: filters.value,
  icon: 'carbon:book',
  onSubmit,
  onRemove,
  primaryKey: 'id',
  showDelete: true,
  stats: statsCards.value,
  statusColors: STATUS_COLORS,
  statusLabels: STATUS_LABELS,
  statusKey: 'status',
  title: '知识库',
}));

onMounted(loadOverview);
</script>

<template>
  <DataPage v-bind="config" />
</template>
