<script setup lang="ts">
import type {
  DataColumn,
  DataPageProps,
  DataRow,
  DataStat,
} from '@antdv/common-ui';
import type { FormSchema } from '@antdv/form-ui';

import { computed, onMounted, ref } from 'vue';

import { DataPage } from '@antdv/common-ui';
import { BasicForm, useForm } from '@antdv/form-ui';
import { BasicModal, message, useModal } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import {
  deleteAiPolicy,
  getAiPolicyList,
  previewSecurityGuard,
  saveAiPolicy,
} from '~/api/security';

defineOptions({ name: 'SecurityAiPolicy' });

const policies = ref<DataRow[]>([]);
const [previewModalRegister, previewModalMethods] = useModal();
const [previewFormRegister, previewFormMethods] = useForm();

const ACTION_LABELS: Record<string, string> = {
  audit: '仅留痕',
  block: '直接阻断',
  mask: '自动脱敏',
  pass: '放行',
};

const previewSchemas: FormSchema[] = [
  {
    component: 'Select',
    componentProps: {
      options: [
        { label: '输入检测', value: 'prompt' },
        { label: '输出审核', value: 'output' },
      ],
    },
    field: 'mode',
    label: '检测场景',
  },
  {
    component: 'InputTextArea',
    componentProps: { placeholder: '输入提示词或模型输出', rows: 4 },
    field: 'text',
    label: '待检测文案',
    required: true,
  },
];

const columns = computed<DataColumn[]>(() => [
  { key: 'key', title: '策略键', width: '180px' },
  { key: 'name', title: '策略名称', width: '160px' },
  { key: 'description', title: '说明', width: '280px' },
  { key: 'threshold', title: '触发阈值', width: '110px' },
  { key: 'actionLabel', title: '处置动作', width: '120px' },
  { key: 'enabledText', title: '启用状态', width: '110px' },
  { key: 'updatedAt', title: '更新时间', width: '170px' },
]);

const statsCards = computed<DataStat[]>(() => [
  {
    icon: 'carbon:api',
    label: '安全策略',
    tone: 'blue',
    value: String(policies.value.length),
  },
  {
    icon: 'carbon:checkmark',
    label: '已启用',
    tone: 'green',
    value: String(policies.value.filter((row) => row.enabled).length),
  },
  {
    icon: 'carbon:stop',
    label: '阻断型规则',
    tone: 'red',
    value: String(
      policies.value.filter((row) => row.action === 'block').length,
    ),
  },
  {
    icon: 'carbon:erase',
    label: '脱敏型规则',
    tone: 'amber',
    value: String(policies.value.filter((row) => row.action === 'mask').length),
  },
]);

const createSchemas = computed<FormSchema[]>(() => [
  { component: 'Input', field: 'key', label: '策略键', required: true },
  { component: 'Input', field: 'name', label: '策略名称', required: true },
  { component: 'InputTextArea', field: 'description', label: '规则说明' },
  { component: 'InputNumber', field: 'threshold', label: '触发阈值' },
  {
    component: 'Select',
    componentProps: {
      options: Object.entries(ACTION_LABELS).map(([value, label]) => ({
        label,
        value,
      })),
    },
    field: 'action',
    label: '处置动作',
    required: true,
  },
  { component: 'Switch', field: 'enabled', label: '启用策略' },
]);

function listApi(params: Record<string, any>) {
  return getAiPolicyList().then((rows) => {
    const keyword = String(params.keyword ?? '')
      .trim()
      .toLowerCase();
    const filtered = rows.filter((row) =>
      [row.key, row.name, row.description]
        .join(' ')
        .toLowerCase()
        .includes(keyword),
    );
    const pageNum = Number(params.pageNum ?? 1);
    const pageSize = Number(params.pageSize ?? 8);
    return {
      list: filtered
        .slice((pageNum - 1) * pageSize, pageNum * pageSize)
        .map((row) => ({
          ...row,
          actionLabel: ACTION_LABELS[row.action] ?? row.action,
          enabledText: row.enabled ? '已启用' : '已停用',
        })),
      total: filtered.length,
    };
  });
}

async function loadPolicies() {
  try {
    policies.value = await getAiPolicyList();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '策略加载失败');
  }
}

async function onSubmit(
  values: Record<string, any>,
  editingKey: null | string,
) {
  try {
    await saveAiPolicy(
      editingKey ? { ...values, id: Number(editingKey) } : values,
    );
    message.success(editingKey ? '策略已更新' : '策略已创建');
    await loadPolicies();
    return true;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '保存失败');
    return false;
  }
}

async function onRemove(row: DataRow) {
  try {
    await deleteAiPolicy(Number(row.id));
    message.success('策略已删除');
    await loadPolicies();
    return true;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '删除失败');
    return false;
  }
}

function openPreview() {
  previewFormMethods.setFieldsValue({ mode: 'prompt', text: '' });
  previewModalMethods.openModal();
}

async function onPreviewSubmit() {
  try {
    const values = await previewFormMethods.validate();
    const result = await previewSecurityGuard(
      String(values.text ?? ''),
      values.mode === 'output' ? 'output' : 'prompt',
    );
    const summary = result.reasons?.length
      ? result.reasons.join('；')
      : result.categories?.length
        ? result.categories.join('、')
        : '未命中风险规则';
    message.info(`判定：${result.action}；风险：${result.level}；${summary}`);
    return true;
  } catch (error) {
    message.error(error instanceof Error ? error.message : '演练失败');
    return false;
  }
}

const config = computed<DataPageProps>(() => ({
  actionWidth: 180,
  api: listApi,
  columns: columns.value,
  createLabel: '新增策略',
  createSchemas: createSchemas.value,
  description:
    '提示词注入检测、敏感信息脱敏、输出审核、调用留痕与限流阈值集中配置；修改后立即作用于 AI 助手。',
  icon: 'carbon:api',
  onSubmit,
  onRemove,
  primaryKey: 'id',
  stats: statsCards.value,
  title: 'AI 安全策略',
}));

onMounted(() => {
  void loadPolicies();
});
</script>

<template>
  <DataPage v-bind="config">
    <template #toolbar-extra>
      <Button size="sm" variant="outline" @click="openPreview">
        <Icon icon="carbon:api" />
        策略演练
      </Button>
    </template>
  </DataPage>

  <BasicModal
    title="AI 安全策略演练"
    :width="560"
    @register="previewModalRegister"
    @ok="() => void onPreviewSubmit()"
  >
    <BasicForm
      :schemas="previewSchemas"
      :grid="{ cols: 1, gutter: 16 }"
      :label-width="90"
      :show-action-button-group="false"
      @register="previewFormRegister"
    />
  </BasicModal>
</template>
