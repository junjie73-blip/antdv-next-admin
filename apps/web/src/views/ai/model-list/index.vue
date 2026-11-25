<script setup lang="ts">
import type {
  DataColumn,
  DataFilter,
  DataPageProps,
  DataRow,
  DataStat,
} from '@antdv/common-ui';
import type { FormSchema } from '@antdv/form-ui';
import type { AiOverview, AiProvider } from '~/api/ai';

import { computed, onMounted, ref } from 'vue';

import { DataPage, Popconfirm } from '@antdv/common-ui';
import { BasicForm, useForm } from '@antdv/form-ui';
import { BasicModal, message, useModal } from '@antdv/popup-ui';
import {
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@antdv/shadcn-ui';
import { Icon } from '@iconify/vue';
import {
  deleteAiModel,
  deleteAiProvider,
  getAiModelList,
  getAiOverview,
  getAiProviderList,
  saveAiModel,
  saveAiProvider,
} from '~/api/ai';

defineOptions({ name: 'AiModelList' });

const overview = ref<AiOverview | null>(null);
/** 供应商下拉选项：从 /ai/provider/list 拉取，模型只能挂到真实存在的供应商上 */
const providerOptions = ref<Array<{ label: string; value: number }>>([]);
/** 完整供应商记录：供「配置供应商」弹窗回填，避免二次请求 */
const providers = ref<AiProvider[]>([]);
const providerSelectId = ref(0);

const [providerModalRegister, providerModalMethods] = useModal();
const [providerFormRegister, providerFormMethods] = useForm();

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

/** 供应商就地配置表单：字段与 /ai/provider/save 的白名单一一对应 */
const providerSchemas: FormSchema[] = [
  { component: 'Input', field: 'name', label: '供应商名称', required: true },
  { component: 'Input', field: 'code', label: '供应商编码', required: true },
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
    required: true,
  },
  {
    component: 'Input',
    field: 'endpoint',
    label: '接口地址',
    required: true,
    componentProps: { placeholder: 'https://api.example.com/v1' },
  },
  {
    component: 'Input',
    field: 'key',
    helpMessage: '写入后服务端立即脱敏，仅回传末四位掩码',
    label: 'API Key',
    componentProps: { placeholder: '请输入 API Key（可选）' },
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
];

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
    providers.value = result.list;
    providerOptions.value = result.list.map((item) => ({
      label: item.name,
      value: item.id,
    }));
  } catch (error) {
    handleError(error);
  }
}

/** 模型页就地配置供应商：新建或编辑当前选中的供应商 */
function onProviderSelect(value: unknown) {
  const id = Number(value) || 0;
  providerSelectId.value = id;
  const provider = providers.value.find((item) => item.id === id);
  providerFormMethods.setFieldsValue({
    name: provider?.name ?? '',
    code: provider?.code ?? '',
    protocol: provider?.protocol ?? 'openai-compatible',
    endpoint: provider?.endpoint ?? '',
    key: provider?.keyMasked ?? '',
    status: provider?.status ?? 'enabled',
  });
  providerFormMethods.clearValidate();
}

function openProviderConfig() {
  providerSelectId.value = 0;
  onProviderSelect(0);
  providerModalMethods.openModal();
}

async function onProviderSubmit() {
  const values = await providerFormMethods.validate();
  if (!values) return;
  try {
    await saveAiProvider(
      providerSelectId.value
        ? { ...values, id: providerSelectId.value }
        : values,
    );
    message.success(providerSelectId.value ? '供应商已更新' : '供应商已创建');
    await loadProviders();
    providerModalMethods.closeModal();
  } catch (error) {
    handleError(error);
  }
}

async function onProviderRemove() {
  if (!providerSelectId.value) {
    message.warning('请先选择要删除的供应商');
    return;
  }
  try {
    await deleteAiProvider(providerSelectId.value);
    message.success('供应商已删除');
    await loadProviders();
    onProviderSelect(0);
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
  <DataPage v-bind="config">
    <template #toolbar-extra>
      <Button size="sm" variant="outline" @click="openProviderConfig">
        <Icon icon="carbon:api" />
        配置供应商
      </Button>
    </template>
  </DataPage>

  <BasicModal
    title="配置模型供应商"
    :width="760"
    @register="providerModalRegister"
    @ok="onProviderSubmit"
  >
    <div class="space-y-4">
      <section class="rounded-lg border border-border bg-muted/30 p-4">
        <div
          class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div>
            <p class="text-sm font-medium">配置对象</p>
            <p class="mt-0.5 text-xs text-muted-foreground">
              选择已有供应商进行编辑，或新增一个供应商
            </p>
          </div>
          <Select
            :model-value="providerSelectId"
            @update:model-value="onProviderSelect"
          >
            <SelectTrigger class="w-full sm:w-64">
              <SelectValue placeholder="选择供应商" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem :value="0">＋ 新增供应商</SelectItem>
              <SelectItem
                v-for="item in providers"
                :key="item.id"
                :value="item.id"
              >
                {{ item.name }}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <p class="mt-2 text-xs text-muted-foreground">
          {{ providerSelectId ? '正在编辑已有供应商' : '将创建新供应商' }}
        </p>
      </section>

      <section class="rounded-lg border border-border p-4">
        <p class="mb-3 text-sm font-medium">连接信息</p>
        <BasicForm
          :schemas="providerSchemas"
          :label-width="112"
          :show-action-button-group="false"
          :grid="{ cols: 2, gutter: [20, 18] }"
          @register="providerFormRegister"
        />
      </section>
    </div>
    <template #appendFooter>
      <Popconfirm
        title="删除后关联模型将无法调用该供应商，确定删除吗？"
        danger
        @confirm="onProviderRemove"
      >
        <Button
          variant="destructive"
          size="sm"
          :disabled="!providerSelectId"
          type="button"
        >
          删除当前供应商
        </Button>
      </Popconfirm>
    </template>
  </BasicModal>
</template>
