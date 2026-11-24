<script setup lang="ts">
import type {
  DataColumn,
  DataFilter,
  DataPageProps,
  DataRow,
  DataStat,
} from '@antdv/common-ui';
import type { FormSchema } from '@antdv/form-ui';
import type { ApprovalGroupStats } from '~/api/approval';

import { computed, onMounted, ref } from 'vue';

import { DataPage } from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import {
  deleteApprovalGroup,
  getApprovalGroupList,
  saveApprovalGroup,
} from '~/api/approval';

defineOptions({ name: 'ApprovalGroup' });

const pageRef = ref<{ reload: () => Promise<void> | void }>();
const stats = ref<ApprovalGroupStats | null>(null);

const STATUS_LABELS: Record<string, string> = {
  disabled: '停用',
  enabled: '启用',
};
const STATUS_COLORS: Record<string, string> = {
  disabled: 'default',
  enabled: 'green',
};

const columns = computed<DataColumn[]>(() => [
  { key: 'code', title: '编号', width: '110px' },
  { key: 'name', title: '分组名称', width: '160px' },
  { key: 'processCount', title: '流程数', width: '90px' },
  { key: 'description', title: '适用范围', width: '140px' },
  { key: 'owner', title: '维护人', width: '100px' },
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
    icon: 'carbon:category',
    label: '分组总数',
    tone: 'blue',
    value: String(stats.value?.total ?? 0),
  },
  {
    icon: 'carbon:checkmark',
    label: '启用',
    tone: 'green',
    value: String(stats.value?.enabled ?? 0),
  },
  {
    icon: 'carbon:flow',
    label: '流程定义',
    tone: 'violet',
    value: String(stats.value?.processCount ?? 0),
  },
  {
    icon: 'carbon:warning-alt',
    label: '停用',
    tone: 'amber',
    value: String(stats.value?.disabled ?? 0),
  },
]);

const createSchemas = computed<FormSchema[]>(() => [
  { component: 'Input', field: 'code', label: '分组编号' },
  {
    component: 'Input',
    field: 'name',
    label: '分组名称',
    required: true,
  },
  {
    component: 'Input',
    field: 'owner',
    label: '维护人',
    required: true,
  },
  { component: 'Input', field: 'processCount', label: '流程数' },
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
  { component: 'Input', field: 'description', label: '适用范围' },
]);

async function listApi(params: Record<string, any>) {
  const result = await getApprovalGroupList(params);
  return { list: result.list, total: result.total };
}

function handleError(error: unknown): void {
  message.error(error instanceof Error ? error.message : '操作失败');
}

async function loadStats() {
  try {
    const result = await getApprovalGroupList({ pageNum: 1, pageSize: 1 });
    stats.value = result.stats;
  } catch (error) {
    handleError(error);
  }
}

async function onSubmit(
  values: Record<string, any>,
  editingKey: null | string,
) {
  try {
    await saveApprovalGroup(
      editingKey ? { ...values, id: Number(editingKey) } : values,
    );
    message.success(editingKey ? '保存成功' : '新建成功');
    await loadStats();
    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

async function onRemove(row: DataRow) {
  try {
    await deleteApprovalGroup(Number(row.id));
    message.success('删除成功');
    await loadStats();
    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

/** 列表内快捷启停：编辑路径只回传 id + status，其余字段由 db 层保留 */
async function toggleStatus(row: DataRow) {
  try {
    await saveApprovalGroup({
      id: Number(row.id),
      status: row.status === 'enabled' ? 'disabled' : 'enabled',
    });
    message.success('状态已更新');
    await loadStats();
    await pageRef.value?.reload();
  } catch (error) {
    handleError(error);
  }
}

const config = computed<DataPageProps>(() => ({
  actionWidth: 280,
  api: listApi,
  columns: columns.value,
  createLabel: '新增分组',
  createSchemas: createSchemas.value,
  description: '审批流程的分组与分类维护，控制可见范围与启用状态。',
  filters: filters.value,
  icon: 'carbon:category',
  onSubmit,
  onRemove,
  primaryKey: 'id',
  showDelete: true,
  stats: statsCards.value,
  statusColors: STATUS_COLORS,
  statusLabels: STATUS_LABELS,
  statusKey: 'status',
  title: '流程分组',
}));

onMounted(loadStats);
</script>

<template>
  <DataPage v-bind="config" ref="pageRef">
    <template #action-extra="{ record }">
      <Button
        variant="link"
        class="h-auto px-0.5!"
        @click="toggleStatus(record)"
      >
        <Icon
          :icon="
            record.status === 'enabled'
              ? 'carbon:warning-alt'
              : 'carbon:checkmark'
          "
        />
        {{ record.status === 'enabled' ? '停用' : '启用' }}
      </Button>
    </template>
  </DataPage>
</template>
