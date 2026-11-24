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
  ApprovalAction,
  ApprovalGroup,
  ApprovalStats,
} from '~/api/approval';

import { computed, onMounted, ref } from 'vue';

import { DataPage } from '@antdv/common-ui';
import { BasicForm, useForm } from '@antdv/form-ui';
import { BasicModal, message, useModal } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import {
  deleteApprovalRecord,
  getApprovalGroupList,
  getApprovalMineList,
  saveApprovalRecord,
  submitApprovalAction,
} from '~/api/approval';

defineOptions({ name: 'ApprovalMine' });

const pageRef = ref<{ reload: () => Promise<void> | void }>();
const stats = ref<ApprovalStats | null>(null);
const groupOptions = ref<ApprovalGroup[]>([]);

const STATUS_LABELS: Record<string, string> = {
  approved: '已通过',
  pending: '待审批',
  rejected: '已驳回',
};
const STATUS_COLORS: Record<string, string> = {
  approved: 'green',
  pending: 'gold',
  rejected: 'red',
};
const TYPE_OPTIONS = ['费用报销', '请假', '采购', '权限申请'].map((value) => ({
  label: value,
  value,
}));

const columns = computed<DataColumn[]>(() => [
  { key: 'code', title: '单号', width: '110px' },
  { key: 'title', title: '标题', width: '200px' },
  { key: 'type', title: '流程类型', width: '110px' },
  { key: 'applicant', title: '申请人', width: '90px' },
  { key: 'approver', title: '审批人', width: '90px' },
  { key: 'amount', title: '金额/天数', width: '110px' },
  { key: 'status', title: '状态', width: '100px' },
  { key: 'date', title: '提交时间', width: '150px' },
]);

const filters = computed<DataFilter[]>(() => [
  {
    key: 'status',
    label: '审批状态',
    options: [
      { label: '待审批', value: 'pending' },
      { label: '已通过', value: 'approved' },
      { label: '已驳回', value: 'rejected' },
    ],
  },
  {
    key: 'mine',
    label: '审批视角',
    options: [
      { label: '待我审批', value: 'pending' },
      { label: '我发起的', value: 'initiated' },
    ],
  },
]);

const statsCards = computed<DataStat[]>(() => [
  {
    icon: 'carbon:time',
    label: '待我审批',
    tone: 'amber',
    value: String(stats.value?.minePending ?? 0),
  },
  {
    icon: 'carbon:document',
    label: '我发起的',
    tone: 'blue',
    value: String(stats.value?.mineInitiated ?? 0),
  },
  {
    icon: 'carbon:checkmark',
    label: '本月通过',
    tone: 'green',
    value: String(stats.value?.approved ?? 0),
  },
  {
    icon: 'carbon:warning-alt',
    label: '已驳回',
    tone: 'red',
    value: String(stats.value?.rejected ?? 0),
  },
]);

const createSchemas = computed<FormSchema[]>(() => [
  {
    component: 'Input',
    field: 'title',
    label: '审批标题',
    required: true,
  },
  {
    component: 'Select',
    componentProps: { options: TYPE_OPTIONS, placeholder: '请选择流程类型' },
    field: 'type',
    label: '流程类型',
    required: true,
  },
  {
    component: 'Input',
    field: 'applicant',
    label: '申请人',
    required: true,
  },
  { component: 'Input', field: 'approver', label: '审批人' },
  {
    component: 'Input',
    componentProps: { placeholder: '如 ¥ 2,480 / 3 天' },
    field: 'amount',
    label: '金额/天数',
  },
  {
    component: 'Select',
    componentProps: {
      options: groupOptions.value.map((group) => ({
        label: group.name,
        value: group.id,
      })),
      placeholder: '请选择所属分组',
    },
    field: 'groupId',
    label: '所属分组',
  },
]);

async function listApi(params: Record<string, any>) {
  const result = await getApprovalMineList(params);
  return { list: result.list, total: result.total };
}

function handleError(error: unknown): void {
  message.error(error instanceof Error ? error.message : '操作失败');
}

async function loadStats() {
  try {
    const result = await getApprovalMineList({ pageNum: 1, pageSize: 1 });
    stats.value = result.stats;
  } catch (error) {
    handleError(error);
  }
}

async function loadGroups() {
  try {
    const result = await getApprovalGroupList({ pageNum: 1, pageSize: 200 });
    groupOptions.value = result.list;
  } catch (error) {
    handleError(error);
  }
}

async function onSubmit(
  values: Record<string, any>,
  editingKey: null | string,
) {
  try {
    await saveApprovalRecord(
      editingKey ? { ...values, id: Number(editingKey) } : values,
    );
    message.success(editingKey ? '保存成功' : '发起成功');
    await loadStats();
    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

async function onRemove(row: DataRow) {
  try {
    await deleteApprovalRecord(Number(row.id));
    message.success('删除成功');
    await loadStats();
    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

/* --------------------------- 审批通过 / 驳回弹层 --------------------------- */

const actionRow = ref<DataRow | null>(null);
const actionType = ref<ApprovalAction>('approve');
const [actionModalRegister, actionModalMethods] = useModal();
const [actionFormRegister, actionFormMethods] = useForm();

const actionSchemas: FormSchema[] = [
  {
    component: 'InputTextArea',
    componentProps: { placeholder: '请填写审批意见', rows: 3 },
    field: 'reason',
    label: '审批意见',
    required: true,
  },
];

function openAction(row: DataRow, type: ApprovalAction) {
  actionRow.value = row;
  actionType.value = type;
  void actionFormMethods.resetFields();
  actionFormMethods.clearValidate();
  actionModalMethods.openModal();
}

async function submitAction() {
  const values = await actionFormMethods.validate();
  if (!values || !actionRow.value) return;
  try {
    const result = await submitApprovalAction({
      action: actionType.value,
      id: Number(actionRow.value.id),
      reason: String(values.reason ?? ''),
    });
    message.success(
      actionType.value === 'approve' ? '已通过审批' : '已驳回审批',
    );
    actionModalMethods.closeModal();
    stats.value = result.stats;
    await pageRef.value?.reload();
  } catch (error) {
    handleError(error);
  }
}

const config = computed<DataPageProps>(() => ({
  actionWidth: 320,
  api: listApi,
  columns: columns.value,
  createLabel: '发起审批',
  createSchemas: createSchemas.value,
  description: '我发起与待我审批的单据，按审批状态跟踪。',
  filters: filters.value,
  icon: 'carbon:checkmark',
  onSubmit,
  onRemove,
  primaryKey: 'id',
  showDelete: true,
  stats: statsCards.value,
  statusColors: STATUS_COLORS,
  statusLabels: STATUS_LABELS,
  statusKey: 'status',
  title: '我的审批',
}));

onMounted(() => {
  void loadStats();
  void loadGroups();
});
</script>

<template>
  <DataPage v-bind="config" ref="pageRef">
    <template #action-extra="{ record }">
      <template v-if="record.status === 'pending'">
        <Button
          variant="link"
          class="h-auto px-0.5!"
          @click="openAction(record, 'approve')"
        >
          <Icon icon="carbon:checkmark" /> 通过
        </Button>
        <Button
          variant="link"
          class="h-auto px-0.5!"
          @click="openAction(record, 'reject')"
        >
          <Icon icon="carbon:warning-alt" /> 驳回
        </Button>
      </template>
    </template>
  </DataPage>

  <BasicModal
    :title="actionType === 'approve' ? '审批通过' : '审批驳回'"
    :width="480"
    @ok="submitAction"
    @register="actionModalRegister"
  >
    <BasicForm
      :grid="{ cols: 1, gutter: 16 }"
      :label-width="90"
      :schemas="actionSchemas"
      :show-action-button-group="false"
      @register="actionFormRegister"
    />
  </BasicModal>
</template>
