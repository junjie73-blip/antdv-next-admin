<script setup lang="ts">
/**
 * Control Plane 通用页：FormSchema 声明式配置渲染四个配置页。
 * 表单控件全部来自 form-ui / common-ui，无原生 form/input/select。
 */
import type { FormSchema } from '@antdv/form-ui';

import { computed, ref } from 'vue';

import { Card, PageHeader } from '@antdv/common-ui';
import { BasicForm, useForm } from '@antdv/form-ui';
import { BasicDrawer, message, useDrawer } from '@antdv/popup-ui';
import { Button, Input } from '@antdv/shadcn-ui';
import { BasicTable, useTable } from '@antdv/table-ui';

import {
  deleteControlPlane,
  listControlPlane,
  saveControlPlane,
} from '~/api/ai-control-plane';
import { useTimeFormat } from '~/composables/use-time-format';

defineOptions({ name: 'ControlPlanePage' });

type Kind = 'context' | 'provider' | 'prompt' | 'trace';
type EditableKind = Exclude<Kind, 'trace'>;

const props = defineProps<{
  description: string;
  icon: string;
  kind: Kind;
  title: string;
}>();

const { format: formatTime } = useTimeFormat();
const rows = ref<Record<string, unknown>[]>([]);
const editing = ref<null | Record<string, unknown>>(null);
const keyword = ref('');
const saving = ref(false);
const [drawerRegister, drawerMethods] = useDrawer();
const [formRegister, formMethods] = useForm();
const [tableRegister] = useTable();
const reloadKey = ref(0);

const isTrace = computed(() => props.kind === 'trace');

const COLUMN_MAP: Record<Kind, Array<{ dataIndex: string; title: string; width?: number; format?: (text: unknown) => string }>> = {
  context: [
    { dataIndex: 'name', title: '策略名称' },
    { dataIndex: 'maxTokens', title: 'Token 预算', width: 110 },
    { dataIndex: 'maxHistory', title: '历史轮数', width: 100 },
    { dataIndex: 'strategy', title: '压缩策略', width: 130 },
    { dataIndex: 'maskPii', title: 'PII 脱敏', width: 100 },
    { dataIndex: 'updatedAt', title: '更新时间', width: 180, format: formatTime },
  ],
  provider: [
    { dataIndex: 'name', title: '供应商' },
    { dataIndex: 'protocol', title: '协议', width: 150 },
    { dataIndex: 'endpoint', title: '接口地址' },
    { dataIndex: 'keyRef', title: 'Key 引用', width: 170 },
    { dataIndex: 'keyTail', title: '末四位', width: 90 },
    { dataIndex: 'enabled', title: '启用', width: 80 },
  ],
  prompt: [
    { dataIndex: 'name', title: '模板名称' },
    { dataIndex: 'route', title: '路由' },
    { dataIndex: 'version', title: '版本', width: 80 },
    { dataIndex: 'variables', title: '变量', width: 180 },
    { dataIndex: 'enabled', title: '启用', width: 80 },
    { dataIndex: 'updatedAt', title: '更新时间', width: 180, format: formatTime },
  ],
  trace: [
    { dataIndex: 'traceId', title: 'Trace ID', width: 150 },
    { dataIndex: 'tool', title: '工具', width: 150 },
    { dataIndex: 'route', title: '路由' },
    { dataIndex: 'result', title: '结果', width: 100 },
    { dataIndex: 'ms', title: '耗时(ms)', width: 100 },
    { dataIndex: 'tokens', title: 'Token', width: 90 },
    { dataIndex: 'createdAt', title: '时间', width: 180, format: formatTime },
  ],
};

/** 表单必填 + 业务规则：Prompt 的路由与 System Prompt 最容易写出无效配置 */
const SCHEMAS: Record<EditableKind, FormSchema[]> = {
  context: [
    { field: 'name', label: '策略名称', component: 'Input', required: true, componentProps: { placeholder: '如：默认上下文策略' } },
    {
      field: 'maxTokens',
      label: 'Token 预算',
      component: 'InputNumber',
      componentProps: { min: 256, max: 200000, class: 'w-full' },
      required: true,
    },
    {
      field: 'maxHistory',
      label: '历史轮数',
      component: 'InputNumber',
      componentProps: { min: 1, max: 100, class: 'w-full' },
      required: true,
    },
    {
      field: 'strategy',
      label: '压缩策略',
      component: 'Select',
      componentProps: {
        options: [
          { label: '不压缩', value: 'none' },
          { label: '丢弃最早轮次', value: 'drop-oldest' },
          { label: '摘要压缩', value: 'summarize' },
        ],
      },
      rules: [{ required: true, message: '请选择压缩策略' }],
    },
    { field: 'maskPii', label: 'PII 脱敏', component: 'Switch' },
  ],
  provider: [
    { field: 'name', label: '供应商名称', component: 'Input', required: true },
    {
      field: 'protocol',
      label: '协议',
      component: 'Select',
      componentProps: {
        options: [
          { label: 'OpenAI 兼容', value: 'openai-compatible' },
          { label: '灵积 DashScope', value: 'dashscope' },
          { label: 'HTTP', value: 'http' },
        ],
      },
      rules: [{ required: true, message: '请选择协议' }],
    },
    {
      field: 'endpoint',
      label: '接口地址',
      component: 'Input',
      required: true,
      componentProps: { placeholder: 'https://api.example.com/v1' },
      rules: [{ type: 'url', message: '接口地址必须是合法的 URL' }],
    },
    {
      field: 'keyRef',
      label: 'Key 引用',
      component: 'Input',
      required: true,
      componentProps: { placeholder: 'DASHSCOPE_API_KEY（只填环境变量名，不填明文）' },
      rules: [
        {
          validator: (_rule, value, callback) => {
            const text = String(value ?? '').trim();
            if (/(sk-|Bearer\s)/iu.test(text))
              callback?.('只能填环境变量名或 KMS key id，禁止粘贴明文密钥');
          },
        },
      ],
    },
    {
      field: 'models',
      label: '模型列表',
      component: 'Input',
      componentProps: { placeholder: '逗号分隔，如 qwen-plus,qwen-max' },
    },
    { field: 'enabled', label: '启用', component: 'Switch' },
  ],
  prompt: [
    { field: 'name', label: '模板名称', component: 'Input', required: true },
    {
      field: 'route',
      label: '路由（* 表示全局）',
      component: 'Input',
      required: true,
      componentProps: { placeholder: '/approval/mine 或 *' },
      rules: [
        {
          validator: (_rule, value, callback) => {
            const text = String(value ?? '').trim();
            if (text !== '*' && !text.startsWith('/'))
              callback?.('路由需以 / 开头，全局模板填 *');
          },
        },
      ],
    },
    {
      field: 'system',
      label: 'System Prompt',
      component: 'InputTextArea',
      componentProps: { rows: 6, placeholder: '描述这个页面里 Copilot 的角色、可用字段与边界' },
      required: true,
      rules: [
        { min: 10, message: 'System Prompt 至少 10 个字符，请写清角色与边界' },
        { max: 4000, message: 'System Prompt 不能超过 4000 个字符' },
      ],
    },
    {
      field: 'variables',
      label: '变量',
      component: 'Input',
      componentProps: { placeholder: '逗号分隔，如 entity,selectedRows' },
      rules: [
        {
          validator: (_rule, value, callback) => {
            const text = String(value ?? '').trim();
            if (text && !/^[\w,，\s]+$/u.test(text))
              callback?.('变量名只能用字母、数字、下划线，多个用逗号分隔');
          },
        },
      ],
    },
    { field: 'enabled', label: '启用', component: 'Switch' },
  ],
};

const schemas = computed<FormSchema[]>(() =>
  isTrace.value ? [] : SCHEMAS[props.kind as EditableKind] ?? [],
);
const columns = computed(() =>
  isTrace.value
    ? COLUMN_MAP[props.kind]
    : [...COLUMN_MAP[props.kind], { title: '操作', key: 'actions', dataIndex: 'actions', width: 130 }],
);

async function listApi() {
  const data = await listControlPlane<Record<string, unknown>>(props.kind);
  const all = data ?? [];
  const term = keyword.value.trim().toLowerCase();
  rows.value = term
    ? all.filter((row) =>
        Object.values(row).some((value) =>
          String(value ?? '').toLowerCase().includes(term),
        ),
      )
    : all;
  return { items: rows.value, total: rows.value.length };
}

function defaults(): Record<string, unknown> {
  if (props.kind === 'prompt')
    return { enabled: true, route: '', system: '', variables: '' };
  if (props.kind === 'provider')
    return { enabled: true, protocol: 'openai-compatible', models: '' };
  return { enabled: true, strategy: 'none', maskPii: true };
}

async function openCreate() {
  editing.value = null;
  // 先写值再开抽屉：useForm 在未挂载时会暂存，注册那一刻补写
  await formMethods.resetFields();
  await formMethods.setFieldsValue(defaults());
  drawerMethods.openDrawer();
}

async function openEdit(record: Record<string, unknown>) {
  editing.value = { ...record };
  await formMethods.resetFields();
  await formMethods.setFieldsValue({
    ...defaults(),
    ...record,
    models: Array.isArray(record.models) ? record.models.join(', ') : record.models ?? '',
    variables: Array.isArray(record.variables) ? record.variables.join(', ') : record.variables ?? '',
  });
  drawerMethods.openDrawer();
}

async function remove(record: Record<string, unknown>) {
  // Trace 是只读日志，按钮不会对它显示；这里再挡一层，避免误调用不存在的接口
  if (isTrace.value || !record.id) return;
  try {
    await deleteControlPlane(props.kind as EditableKind, Number(record.id));
    message.success('已删除');
    reloadKey.value += 1;
  } catch {
    message.error('删除失败，请稍后重试');
  }
}

async function submit() {
  if (isTrace.value || saving.value) return;
  try {
    // required / 自定义规则都在这里真正生效，校验失败保持抽屉打开
    const values = (await formMethods.validate()) as Record<string, unknown>;
    const payload = { ...values };
    if (editing.value?.id) payload.id = editing.value.id;
    for (const key of ['models', 'variables']) {
      if (typeof payload[key] === 'string')
        payload[key] = String(payload[key])
          .split(/[,，]/u)
          .map((item) => item.trim())
          .filter(Boolean);
    }
    saving.value = true;
    await saveControlPlane(props.kind as EditableKind, payload);
    drawerMethods.closeDrawer();
    message.success(editing.value?.id ? '已保存修改' : '已创建');
    reloadKey.value += 1;
  } catch (error) {
    const reason = error instanceof Error ? error.message : '';
    if (reason) message.error(`保存失败：${reason}`);
  } finally {
    saving.value = false;
  }
}

function onKeywordChange() {
  reloadKey.value += 1;
}
</script>

<template>
  <div data-page-view class="space-y-4">
    <PageHeader :title="title" :description="description" :icon="icon" />
    <Card>
      <BasicTable
        :key="reloadKey"
        :columns="columns"
        :api="listApi"
        :immediate="true"
        @register="tableRegister"
      >
        <template #toolbar-actions>
          <div class="flex items-center gap-2">
            <Input
              v-model="keyword"
              class="h-8 w-44"
              placeholder="搜索名称 / 路由"
              @keyup.enter="onKeywordChange"
              @update:model-value="onKeywordChange"
            />
            <Button v-if="!isTrace" size="sm" @click="openCreate">新建</Button>
          </div>
        </template>
        <template v-if="!isTrace" #cell-actions="{ record }">
          <div class="flex gap-1">
            <Button variant="link" size="sm" @click="openEdit(record)">编辑</Button>
            <Button variant="link" size="sm" @click="remove(record)">删除</Button>
          </div>
        </template>
      </BasicTable>
    </Card>

    <BasicDrawer
      v-if="!isTrace"
      :title="editing ? `编辑${title}` : `新建${title}`"
      :width="520"
      ok-text="保存"
      @register="drawerRegister"
      @ok="submit"
    >
      <!-- 抽屉是单列：默认响应式 4 列会把字段挤成 100px 一行；内置查询/重置按钮也与业务保存按钮重复 -->
      <BasicForm
        :schemas="schemas"
        :grid="{ cols: 1, gutter: 16 }"
        :label-width="120"
        label-align="left"
        :show-action-button-group="false"
        @register="formRegister"
      />
    </BasicDrawer>
  </div>
</template>
