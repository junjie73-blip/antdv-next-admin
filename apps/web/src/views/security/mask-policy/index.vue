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
  deleteMaskPolicy,
  getMaskPolicyList,
  previewSecurityGuard,
  saveMaskPolicy,
} from '~/api/security';

defineOptions({ name: 'SecurityMaskPolicy' });

const policies = ref<DataRow[]>([]);
const [previewModalRegister, previewModalMethods] = useModal();
const [previewFormRegister, previewFormMethods] = useForm();

const TYPE_LABELS: Record<string, string> = {
  apikey: '密钥',
  bankcard: '银行卡',
  email: '邮箱',
  generic: '通用字段',
  idcard: '身份证',
  name: '姓名',
  phone: '手机号',
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
    componentProps: { placeholder: '输入一段文案，验证当前策略会如何处理', rows: 4 },
    field: 'text',
    label: '待检测文案',
    required: true,
  },
];

const columns = computed<DataColumn[]>(() => [
  { key: 'field', title: '字段标识', width: '140px' },
  { key: 'typeLabel', title: '脱敏类型', width: '120px' },
  { key: 'scope', title: '适用范围', width: '180px' },
  { key: 'keepStart', title: '保留前几位', width: '110px' },
  { key: 'keepEnd', title: '保留后几位', width: '110px' },
  { key: 'enabledText', title: '启用状态', width: '110px' },
  { key: 'updatedAt', title: '更新时间', width: '170px' },
]);

const statsCards = computed<DataStat[]>(() => [
  {
    icon: 'carbon:password',
    label: '策略总数',
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
    icon: 'carbon:api',
    label: '密钥类规则',
    tone: 'violet',
    value: String(policies.value.filter((row) => row.type === 'apikey').length),
  },
  {
    icon: 'carbon:erase',
    label: '个人信息规则',
    tone: 'amber',
    value: String(
      policies.value.filter((row) =>
        ['phone', 'email', 'idcard', 'bankcard'].includes(String(row.type)),
      ).length,
    ),
  },
]);

const createSchemas = computed<FormSchema[]>(() => [
  { component: 'Input', field: 'field', label: '字段标识', required: true },
  {
    component: 'Select',
    componentProps: {
      options: Object.entries(TYPE_LABELS).map(([value, label]) => ({
        label,
        value,
      })),
    },
    field: 'type',
    label: '脱敏类型',
    required: true,
  },
  { component: 'Input', field: 'scope', label: '适用范围' },
  { component: 'InputNumber', field: 'keepStart', label: '保留前几位' },
  { component: 'InputNumber', field: 'keepEnd', label: '保留后几位' },
  { component: 'Switch', field: 'enabled', label: '启用策略' },
]);

function listApi(params: Record<string, any>) {
  return getMaskPolicyList().then((rows) => {
    const keyword = String(params.keyword ?? '').trim().toLowerCase();
    const filtered = rows.filter((row) =>
      [row.field, row.scope, TYPE_LABELS[row.type] ?? row.type]
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
          enabledText: row.enabled ? '已启用' : '已停用',
          typeLabel: TYPE_LABELS[row.type] ?? row.type,
        })),
      total: filtered.length,
    };
  });
}

async function loadPolicies() {
  try {
    policies.value = await getMaskPolicyList();
  } catch (error) {
    message.error(error instanceof Error ? error.message : '策略加载失败');
  }
}

async function onSubmit(values: Record<string, any>, editingKey: null | string) {
  try {
    await saveMaskPolicy(editingKey ? { ...values, id: Number(editingKey) } : values);
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
    await deleteMaskPolicy(Number(row.id));
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
    '按字段类型配置服务端脱敏规则；凭据字段始终强制打码，PII 规则可按范围启停。',
  icon: 'carbon:password',
  onSubmit,
  onRemove,
  primaryKey: 'id',
  stats: statsCards.value,
  title: '数据脱敏策略',
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
    title="脱敏策略演练"
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
