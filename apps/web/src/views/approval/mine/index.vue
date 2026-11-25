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
  ApprovalContext,
  ApprovalGroup,
  ApprovalLevelRule,
  ApprovalStats,
} from '~/api/approval';

import { computed, onMounted, ref } from 'vue';

import { DataPage } from '@antdv/common-ui';
import { BasicForm, useForm } from '@antdv/form-ui';
import { usePermission } from '@antdv/hooks';
import {
  BasicDrawer,
  BasicModal,
  message,
  useDrawer,
  useModal,
} from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import {
  deleteApprovalLevel,
  deleteApprovalRecord,
  extendApprovalNodes,
  getApprovalGroupList,
  getApprovalLevelList,
  getApprovalMineList,
  resubmitApproval,
  saveApprovalGroup,
  saveApprovalLevel,
  saveApprovalRecord,
  scanApprovalTimeouts,
  submitApprovalAction,
} from '~/api/approval';
import ApprovalFlowChart from '~/components/approval/ApprovalFlowChart.vue';

defineOptions({ name: 'ApprovalMine' });

const { isAdmin } = usePermission();
const pageRef = ref<{ reload: () => Promise<void> | void }>();
const stats = ref<ApprovalStats | null>(null);
const context = ref<ApprovalContext | null>(null);
const groupOptions = ref<ApprovalGroup[]>([]);
const levelRules = ref<ApprovalLevelRule[]>([]);

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
const ENABLE_OPTIONS = [
  { label: '启用', value: 'enabled' },
  { label: '停用', value: 'disabled' },
];
const AUTO_ACTION_OPTIONS = [
  { label: '自动通过', value: 'approve' },
  { label: '自动驳回', value: 'reject' },
];

const columns = computed<DataColumn[]>(() => [
  { key: 'code', title: '单号', width: '110px' },
  { key: 'title', title: '标题', width: '200px' },
  { key: 'type', title: '流程类型', width: '110px' },
  { key: 'applicant', title: '申请人', width: '90px' },
  { key: 'approver', title: '当前审批人', width: '100px' },
  { key: 'currentNode', title: '当前步骤', width: '190px' },
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
  { component: 'Input', field: 'title', label: '审批标题', required: true },
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
  {
    component: 'Input',
    componentProps: { placeholder: '留空则按层级规则自动指派直接上级' },
    field: 'approver',
    label: '指定审批人',
  },
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
      placeholder: '请选择所属流程',
    },
    field: 'groupId',
    label: '所属流程',
  },
]);

const flowSchemas: FormSchema[] = [
  { component: 'Input', field: 'name', label: '流程名称', required: true },
  { component: 'Input', field: 'owner', label: '维护人', required: true },
  {
    component: 'InputTextArea',
    componentProps: { rows: 2 },
    field: 'description',
    label: '流程说明',
  },
  {
    component: 'Select',
    componentProps: { options: ENABLE_OPTIONS },
    field: 'status',
    label: '状态',
  },
];

const ruleSchemas: FormSchema[] = [
  { component: 'Input', field: 'employee', label: '员工', required: true },
  { component: 'Input', field: 'leader', label: '直接上级', required: true },
  {
    component: 'InputNumber',
    componentProps: { min: 1, max: 9 },
    field: 'level',
    label: '审批层级',
  },
  {
    component: 'InputNumber',
    componentProps: { min: 1, max: 720, addonAfter: '小时' },
    field: 'timeoutHours',
    label: '处理时限',
  },
  {
    component: 'Select',
    componentProps: { options: AUTO_ACTION_OPTIONS },
    field: 'autoAction',
    label: '超时动作',
  },
  {
    component: 'InputNumber',
    componentProps: { min: 0, max: 1_000_000, addonAfter: '元' },
    field: 'autoMaxAmount',
    label: '自动上限',
  },
  {
    component: 'Select',
    componentProps: { options: ENABLE_OPTIONS },
    field: 'enabled',
    label: '状态',
  },
];

async function listApi(params: Record<string, any>) {
  const result = await getApprovalMineList(params);
  context.value = result.context;
  return { list: result.list, total: result.total };
}

function handleError(error: unknown): void {
  message.error(error instanceof Error ? error.message : '操作失败');
}

async function reloadAll() {
  await pageRef.value?.reload();
  await loadStats();
}

async function loadStats() {
  try {
    const result = await getApprovalMineList({ pageNum: 1, pageSize: 1 });
    stats.value = result.stats;
    context.value = result.context;
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

async function loadRules() {
  try {
    const result = await getApprovalLevelList({ pageNum: 1, pageSize: 200 });
    levelRules.value = result.list;
  } catch (error) {
    handleError(error);
  }
}

async function onRemove(row: DataRow) {
  try {
    await deleteApprovalRecord(Number(row.id));
    message.success('删除成功');
    await reloadAll();
    return true;
  } catch (error) {
    handleError(error);
    return false;
  }
}

/* --------------------------- 发起审批（显式入口） --------------------------- */

const [createModalRegister, createModalMethods] = useModal();
const [createFormRegister, createFormMethods] = useForm();

function openCreateApproval() {
  void createFormMethods.resetFields();
  void createFormMethods.setFieldsValue({
    applicant: context.value?.applicant ?? '',
    groupId: groupOptions.value[0]?.id ?? undefined,
  });
  createFormMethods.clearValidate();
  createModalMethods.openModal();
}

async function submitCreateApproval() {
  const values = await createFormMethods.validate();
  if (!values) return;
  try {
    await saveApprovalRecord(values);
    message.success('发起成功');
    createModalMethods.closeModal();
    await reloadAll();
  } catch (error) {
    handleError(error);
  }
}

/* --------------------------- 新增审批流程配置 --------------------------- */

const [flowModalRegister, flowModalMethods] = useModal();
const [flowFormRegister, flowFormMethods] = useForm();

function openCreateFlow() {
  void flowFormMethods.resetFields();
  void flowFormMethods.setFieldsValue({ status: 'enabled' });
  flowFormMethods.clearValidate();
  flowModalMethods.openModal();
}

async function submitCreateFlow() {
  const values = await flowFormMethods.validate();
  if (!values) return;
  try {
    await saveApprovalGroup(values);
    message.success('审批流程已创建');
    flowModalMethods.closeModal();
    await loadGroups();
  } catch (error) {
    handleError(error);
  }
}

/* ------------------------------ 层级规则 ------------------------------ */

const [rulesDrawerRegister, rulesDrawerMethods] = useDrawer();
const [ruleFormRegister, ruleFormMethods] = useForm();
const editingRuleId = ref<null | number>(null);

async function openRules() {
  editingRuleId.value = null;
  void ruleFormMethods.resetFields();
  void ruleFormMethods.setFieldsValue({
    autoAction: 'approve',
    autoMaxAmount: 10_000,
    enabled: 'enabled',
    level: 1,
    timeoutHours: 24,
  });
  await loadRules();
  rulesDrawerMethods.openDrawer();
}

function editRule(rule: ApprovalLevelRule) {
  editingRuleId.value = rule.id;
  void ruleFormMethods.setFieldsValue({ ...rule });
}

async function removeRule(rule: ApprovalLevelRule) {
  try {
    await deleteApprovalLevel(rule.id);
    message.success('层级规则已删除');
    await loadRules();
  } catch (error) {
    handleError(error);
  }
}

async function submitRule() {
  const values = await ruleFormMethods.validate();
  if (!values) return;
  try {
    await saveApprovalLevel(
      editingRuleId.value ? { ...values, id: editingRuleId.value } : values,
    );
    message.success(editingRuleId.value ? '层级规则已更新' : '层级规则已创建');
    editingRuleId.value = null;
    void ruleFormMethods.resetFields();
    await loadRules();
  } catch (error) {
    handleError(error);
  }
}

async function runTimeoutScan() {
  try {
    const result = await scanApprovalTimeouts();
    message.success(
      result.count ? `已自动处理 ${result.count} 个超时节点` : '暂无超时节点',
    );
    await reloadAll();
  } catch (error) {
    handleError(error);
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
  {
    component: 'Input',
    componentProps: { placeholder: '多个人员用逗号分隔，可留空' },
    field: 'ccPersons',
    label: '添加抄送',
  },
  {
    component: 'Input',
    componentProps: { placeholder: '多个人员用逗号分隔，可留空' },
    field: 'additionalApprovers',
    label: '追加审批人',
  },
  {
    component: 'Select',
    componentProps: {
      options: [
        { label: '顺序审批', value: 'sequential' },
        { label: '多人会签', value: 'countersign' },
      ],
    },
    field: 'signMode',
    label: '追加方式',
  },
];

function splitNames(value: unknown): string[] {
  return String(value ?? '')
    .split(/[,，、]/)
    .map((name) => name.trim())
    .filter(Boolean);
}

function openAction(row: DataRow, type: ApprovalAction) {
  actionRow.value = row;
  actionType.value = type;
  void actionFormMethods.resetFields();
  void actionFormMethods.setFieldsValue({ signMode: 'sequential' });
  actionFormMethods.clearValidate();
  actionModalMethods.openModal();
}

async function submitAction() {
  const values = await actionFormMethods.validate();
  if (!values || !actionRow.value) return;
  const id = Number(actionRow.value.id);
  try {
    const ccPersons = splitNames(values.ccPersons);
    const additionalApprovers = splitNames(values.additionalApprovers);
    if (ccPersons.length > 0 || additionalApprovers.length > 0) {
      await extendApprovalNodes({
        additionalApprovers,
        ccPersons,
        id,
        signMode:
          values.signMode === 'countersign' ? 'countersign' : 'sequential',
      });
    }
    const result = await submitApprovalAction({
      action: actionType.value,
      id,
      reason: String(values.reason ?? ''),
    });
    message.success(
      result.approval.status === 'pending'
        ? '已流转至下一节点'
        : actionType.value === 'approve'
          ? '已通过审批'
          : '已驳回审批',
    );
    actionModalMethods.closeModal();
    stats.value = result.stats;
    await pageRef.value?.reload();
  } catch (error) {
    handleError(error);
  }
}

/* ----------------------------- 驳回重提（底部操作） ----------------------------- */

const resubmitRow = ref<DataRow | null>(null);
const [resubmitModalRegister, resubmitModalMethods] = useModal();
const [resubmitFormRegister, resubmitFormMethods] = useForm();
const resubmitSchemas: FormSchema[] = [
  {
    component: 'InputTextArea',
    componentProps: {
      placeholder: '可补充本轮说明，留空则沿用原材料',
      rows: 3,
    },
    field: 'reason',
    label: '补充说明',
  },
];

function openResubmit(row: DataRow) {
  resubmitRow.value = row;
  void resubmitFormMethods.resetFields();
  resubmitFormMethods.clearValidate();
  resubmitModalMethods.openModal();
}

async function submitResubmit() {
  const values = await resubmitFormMethods.validate();
  if (!values || !resubmitRow.value) return;
  try {
    const result = await resubmitApproval({
      id: Number(resubmitRow.value.id),
      reason: String(values.reason ?? ''),
    });
    message.success('已重新发起新一轮审批');
    resubmitModalMethods.closeModal();
    resubmitRow.value = null;
    stats.value = result.stats;
    await reloadAll();
  } catch (error) {
    handleError(error);
  }
}

const config = computed<DataPageProps>(() => ({
  actionWidth: 380,
  api: listApi,
  extraActions: (row) =>
    row.status === 'pending' && row.canApprove
      ? [
          {
            icon: 'carbon:checkmark',
            label: '通过',
            onClick: () => openAction(row, 'approve'),
          },
          {
            danger: true,
            icon: 'carbon:close',
            label: '驳回',
            onClick: () => openAction(row, 'reject'),
          },
        ]
      : [],
  canDeleteRow: (row) => Boolean(row.canEdit),
  canEditRow: (row) => Boolean(row.canEdit),
  columns: columns.value,
  description:
    '我发起与待我审批的单据；进度、流转路径与超时自动审批结果可直接查看。',
  // 审批节点会随驳回重提持续追加，窄抽屉会把 vue-flow 缩到看不清
  detailWidth: 860,
  filters: filters.value,
  icon: 'carbon:checkmark',
  onRemove,
  primaryKey: 'id',
  showCreate: false,
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
    <template #toolbar-extra>
      <!-- 工具项统一靠页面右侧，按钮按从左到右的业务顺序排列 -->
      <div class="flex flex-wrap items-center justify-end gap-2">
        <Button size="sm" @click="openCreateApproval">发起审批</Button>
        <Button size="sm" variant="outline" @click="openCreateFlow">
          新增流程
        </Button>
        <Button v-if="isAdmin()" size="sm" variant="outline" @click="openRules">
          层级规则
        </Button>
        <Button
          v-if="isAdmin()"
          size="sm"
          variant="outline"
          @click="runTimeoutScan"
        >
          检查超时
        </Button>
      </div>
    </template>

    <template #detail-extra="{ record }">
      <ApprovalFlowChart
        v-if="record"
        class="mt-5"
        :cc-persons="record.ccPersons || []"
        :current-step="record.currentStep || 0"
        :nodes="record.flowNodes || []"
        :sign-mode="record.signMode"
      />
    </template>

    <!-- 详情内的操作统一固定在底部，从左到右排列 -->
    <template #detail-footer="{ record }">
      <Button
        v-if="record?.canResubmit"
        size="sm"
        @click="openResubmit(record)"
      >
        重新发起
      </Button>
    </template>
  </DataPage>

  <!-- 发起审批 -->
  <BasicModal
    title="发起审批"
    :width="560"
    @ok="submitCreateApproval"
    @register="createModalRegister"
  >
    <BasicForm
      :grid="{ cols: 2, gutter: 16 }"
      :label-width="90"
      :schemas="createSchemas"
      :show-action-button-group="false"
      @register="createFormRegister"
    />
  </BasicModal>

  <!-- 新增审批流程 -->
  <BasicModal
    title="新增审批流程"
    :width="520"
    @ok="submitCreateFlow"
    @register="flowModalRegister"
  >
    <BasicForm
      :grid="{ cols: 1, gutter: 16 }"
      :label-width="90"
      :schemas="flowSchemas"
      :show-action-button-group="false"
      @register="flowFormRegister"
    />
  </BasicModal>

  <!-- 层级规则配置 -->
  <BasicDrawer
    title="审批层级规则"
    :width="560"
    :show-ok-btn="isAdmin()"
    :ok-text="editingRuleId ? '更新规则' : '保存规则'"
    :show-cancel-btn="false"
    @ok="submitRule"
    @register="rulesDrawerRegister"
  >
    <div class="space-y-5">
      <div class="space-y-2">
        <div
          v-for="rule in levelRules"
          :key="rule.id"
          class="flex flex-wrap items-center justify-between gap-2 rounded border border-border px-3 py-2 text-xs"
        >
          <span>
            {{ rule.employee }} → {{ rule.leader }}
            <span class="text-muted-foreground">
              （L{{ rule.level }} · {{ rule.timeoutHours }}h ·
              {{ rule.autoAction === 'reject' ? '超时驳回' : '超时通过' }} ·
              上限 {{ rule.autoMaxAmount ?? 10000 }} 元 ·
              {{ rule.enabled === 'enabled' ? '启用' : '停用' }}）
            </span>
          </span>
          <span v-if="isAdmin()" class="flex gap-2">
            <Button
              variant="link"
              class="h-auto px-0.5!"
              @click="editRule(rule)"
            >
              编辑
            </Button>
            <Button
              variant="link"
              class="h-auto px-0.5!"
              @click="removeRule(rule)"
            >
              删除
            </Button>
          </span>
        </div>
        <p v-if="!levelRules.length" class="text-xs text-muted-foreground">
          暂无层级规则，普通员工发起的审批将无法被非超管账号处理。
        </p>
      </div>
      <div v-if="isAdmin()" class="border-t border-border pt-4">
        <h4 class="mb-2 text-sm font-medium">
          {{ editingRuleId ? '编辑规则' : '新增规则' }}
        </h4>
        <BasicForm
          :grid="{ cols: 2, gutter: 12 }"
          :label-width="80"
          :schemas="ruleSchemas"
          :show-action-button-group="false"
          @register="ruleFormRegister"
        />
      </div>
    </div>
  </BasicDrawer>

  <!-- 审批通过 / 驳回（含抄送与追加审批人） -->
  <BasicModal
    :title="actionType === 'approve' ? '审批通过' : '审批驳回'"
    :width="520"
    @ok="submitAction"
    @register="actionModalRegister"
  >
    <BasicForm
      :grid="{ cols: 1, gutter: 14 }"
      :label-width="90"
      :schemas="actionSchemas"
      :show-action-button-group="false"
      @register="actionFormRegister"
    />
  </BasicModal>

  <!-- 驳回重提：底部确认按钮由弹层 footer 承载 -->
  <BasicModal
    title="重新发起审批"
    :width="480"
    ok-text="重新发起"
    @ok="submitResubmit"
    @register="resubmitModalRegister"
  >
    <BasicForm
      :grid="{ cols: 1, gutter: 14 }"
      :label-width="90"
      :schemas="resubmitSchemas"
      :show-action-button-group="false"
      @register="resubmitFormRegister"
    />
  </BasicModal>
</template>
