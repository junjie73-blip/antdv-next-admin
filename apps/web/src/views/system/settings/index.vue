<script setup lang="tsx">
import type { FormSchema } from '@antdv/form-ui';
import type { BasicColumn } from '@antdv/table-ui';
import type { DescriptionItem } from '@antdv/common-ui';

import { computed, ref } from 'vue';

import { Card, Divider, Tag, Tooltip } from '@antdv/common-ui';
import { BasicForm, useForm } from '@antdv/form-ui';
import { BasicDrawer, message, useDrawer } from '@antdv/popup-ui';
import { BasicModal, useModal } from '@antdv/popup-ui';
import { Button, Switch } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { BasicTable, useTable } from '@antdv/table-ui';
import { Icon } from '@iconify/vue';
import {
  addSetting,
  deleteSetting,
  getSettingsList,
  updateSetting,
} from '~/api/system';
import { Description as DetailDescription } from '@antdv/common-ui';
import { DictType } from '@antdv/enums';
import { useDictStore } from '~/stores';

defineOptions({ name: 'SystemSettings' });

interface SystemConfig {
  id: number;
  key: string;
  name: string;
  value: string;
  type: 'boolean' | 'json' | 'number' | 'text';
  group: string;
  description: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

const dictStore = useDictStore();

const statusOptions = computed(() =>
  dictStore.getOptions(DictType.NORMAL_DISABLE),
);

const containerClassName = cn('space-y-4');
const cardClassName = cn('shadow-sm');
const valueCellClassName = cn('truncate', 'block', 'max-w-[180px]');
const actionClassName = cn('flex', 'items-center', 'justify-center');
const btnClassName = cn('px-0.5!');
const linkBtnClassName = cn('h-auto px-0', btnClassName);
const dangerLinkBtnClassName = cn(linkBtnClassName, 'text-destructive');
const dividerClassName = cn('mx-0');

const groupColorMap: Record<string, string> = {
  通用设置: 'blue',
  功能开关: 'green',
  安全设置: 'red',
  上传设置: 'cyan',
  通知设置: 'orange',
  缓存设置: 'purple',
  主题设置: 'magenta',
};

const groupIconMap: Record<string, string> = {
  通用设置: 'ant-design:setting-outlined',
  功能开关: 'ant-design:switcher-outlined',
  安全设置: 'ant-design:safety-outlined',
  上传设置: 'ant-design:cloud-upload-outlined',
  通知设置: 'ant-design:bell-outlined',
  缓存设置: 'ant-design:database-outlined',
  主题设置: 'ant-design:bg-colors-outlined',
};

const typeColorMap: Record<string, string> = {
  text: 'blue',
  number: 'green',
  boolean: 'orange',
  json: 'purple',
};

const typeLabelMap: Record<string, string> = {
  text: '文本',
  number: '数字',
  boolean: '布尔值',
  json: 'JSON',
};

const detailSchemas: DescriptionItem[] = [
  {
    field: 'key',
    label: '配置键',
    render: (value: string) => <Tag color="blue">{value}</Tag>,
  },
  { field: 'name', label: '配置名称' },
  { field: 'value', label: '配置值' },
  {
    field: 'type',
    label: '配置类型',
    render: (_: string, record: any) => (
      <Tag color={typeColorMap[record.type] || 'default'}>
        {typeLabelMap[record.type] || record.type}
      </Tag>
    ),
  },
  {
    field: 'group',
    label: '所属分组',
    render: (_: string, record: any) => (
      <Tag color={groupColorMap[record.group] || 'default'}>{record.group}</Tag>
    ),
  },
  { field: 'description', label: '描述信息' },
  {
    field: 'enabled',
    label: '启用状态',
    render: (_: any, record: any) => (
      <Tag color={record.enabled ? 'green' : 'red'}>
        {record.enabled ? '已启用' : '已禁用'}
      </Tag>
    ),
  },
  { field: 'createdAt', label: '创建时间' },
  { field: 'updatedAt', label: '更新时间' },
];

const isEditing = ref(false);
const currentRecord = ref<null | SystemConfig>(null);
const viewingRecord = ref<null | SystemConfig>(null);

const [modalRegister, modalMethods] = useModal();
const [drawerRegister, drawerMethods] = useDrawer();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

const searchFormSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '搜索配置键/名称/分组...',
      allowClear: true,
    },
  },
  {
    field: 'type',
    label: '配置类型',
    component: 'Select',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '选择类型',
      allowClear: true,
      options: [
        { label: '文本', value: 'text' },
        { label: '数字', value: 'number' },
        { label: '布尔值', value: 'boolean' },
        { label: 'JSON', value: 'json' },
      ],
    },
  },
  {
    field: 'enabled',
    label: '状态',
    component: 'Select',
    colProps: { span: 6 },
    componentProps: () => ({
      placeholder: '选择状态',
      allowClear: true,
      options: statusOptions.value,
    }),
  },
];

const modalFormSchemas: FormSchema[] = [
  {
    field: 'key',
    label: '配置键',
    colProps: { span: 12 },
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：site.name' },
  },
  {
    field: 'name',
    label: '配置名称',
    colProps: { span: 12 },
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：站点名称' },
  },
  {
    field: 'type',
    label: '配置类型',
    component: 'Select',
    colProps: { span: 12 },
    componentProps: {
      options: [
        { label: '文本', value: 'text' },
        { label: '数字', value: 'number' },
        { label: '布尔值', value: 'boolean' },
        { label: 'JSON', value: 'json' },
      ],
    },
  },
  {
    field: 'group',
    label: '所属分组',
    component: 'Select',
    colProps: { span: 12 },
    componentProps: {
      options: Object.keys(groupColorMap).map((g) => ({ label: g, value: g })),
    },
  },
  {
    field: 'value',
    label: '配置值',
    component: 'Input',
    componentProps: { placeholder: '请输入配置值' },
    colProps: { span: 24 },
  },
  {
    field: 'sortOrder',
    label: '排序号',
    component: 'InputNumber',
    colProps: { span: 12 },
    defaultValue: 0,
    componentProps: {
      min: 0,
      placeholder: '数字越小越靠前',
      style: { width: '100%' },
    },
  },
  {
    field: 'enabled',
    label: '启用状态',
    component: 'RadioGroup',
    defaultValue: '0',
    colProps: { span: 12 },
    componentProps: () => ({
      optionType: 'button',
      buttonStyle: 'solid',
      options: statusOptions.value,
    }),
  },
  {
    field: 'description',
    label: '描述信息',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入配置描述...', rows: 3 },
  },
];

async function mockApi(params: Record<string, any>) {
  const res = await getSettingsList(params);
  const data = res?.data ?? res;
  return { items: data?.list || [], total: data?.total || 0 };
}

function handleAdd() {
  isEditing.value = false;
  currentRecord.value = null;
  formMethods.setFieldsValue({
    key: '',
    name: '',
    value: '',
    type: 'text',
    group: '通用设置',
    description: '',
    sortOrder: 0,
    enabled: true,
  });
  formMethods.clearValidate();
  modalMethods.openModal();
}

function handleEdit(record: SystemConfig) {
  isEditing.value = true;
  currentRecord.value = record;
  formMethods.setFieldsValue({
    key: record.key,
    name: record.name,
    value: record.value,
    type: record.type,
    group: record.group,
    description: record.description,
    sortOrder: (record as any).sortOrder ?? 0,
    enabled: record.enabled,
  });
  formMethods.clearValidate();
  modalMethods.openModal();
}

function handleView(record: SystemConfig) {
  viewingRecord.value = record;
  drawerMethods.openDrawer();
}

async function handleDelete(record: SystemConfig) {
  try {
    await deleteSetting(record.id);
    message.success(`已删除配置：${record.name}`);
    tableMethods.value?.reload();
  } catch {
    message.error('删除失败');
  }
}

async function handleSave() {
  const values = await formMethods.validate();
  if (!values) {
    return;
  }

  try {
    if (isEditing.value && currentRecord.value) {
      await updateSetting(currentRecord.value.id, values);
      message.success(`已更新配置：${values.name}`);
    } else {
      await addSetting(values);
      message.success(`已新增配置：${values.name}`);
    }

    modalMethods.closeModal();
    tableMethods.value?.reload();
  } catch {
    message.error('保存失败');
  }
}

async function handleToggleEnabled(record: SystemConfig, enabled: boolean) {
  try {
    await updateSetting(record.id, { enabled });
    message.success(`${enabled ? '已启用' : '已禁用'}：${record.name}`);
    tableMethods.value?.reload();
  } catch {
    message.error('操作失败');
  }
}

function handleApply(record: SystemConfig) {
  message.success(`已将「${record.name}」应用到系统`);
}

const columns: BasicColumn[] = [
  {
    title: '#',
    key: 'index',
    width: 60,
    align: 'center',
    customRender: ({ index }) => index + 1,
  },
  { title: '配置键', dataIndex: 'key', key: 'key', width: 180, ellipsis: true },
  { title: '名称', dataIndex: 'name', key: 'name', width: 160 },
  {
    title: '配置值',
    dataIndex: 'value',
    key: 'value',
    width: 200,
    ellipsis: true,
  },
  { title: '类型', dataIndex: 'type', key: 'type', width: 80, align: 'center' },
  {
    title: '分组',
    dataIndex: 'group',
    key: 'group',
    width: 110,
    align: 'center',
  },
  {
    title: '状态',
    dataIndex: 'enabled',
    key: 'enabled',
    width: 70,
    align: 'center',
  },
  {
    title: '描述',
    dataIndex: 'description',
    key: 'description',
    ellipsis: true,
  },
  { title: '更新时间', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
];
</script>

<template>
  <div :class="containerClassName">
    <Card title="系统设置" :class="cardClassName">
      <BasicTable
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :scroll="{ x: 1400 }"
        :action-column="{ width: 280, title: '操作', fixed: 'right' }"
        @register="tableRegister"
      >
        <template #toolbar>
          <Button @click="handleAdd">
            <Icon icon="ant-design:plus-outlined" />
            新增设置
          </Button>
        </template>
        <template #cell-type="{ record }">
          <Tag :color="typeColorMap[record.type] || 'default'">
            {{ typeLabelMap[record.type] || record.type }}
          </Tag>
        </template>
        <template #cell-group="{ record }">
          <Tag
            :color="groupColorMap[record.group] || 'default'"
            class="flex! w-full items-center justify-between whitespace-nowrap"
          >
            <Icon
              v-if="groupIconMap[record.group]"
              :icon="groupIconMap[record.group]!"
            />
            {{ record.group }}
          </Tag>
        </template>
        <template #cell-enabled="{ record }">
          <Switch
            :model-value="record.enabled"
            @update:model-value="(v: any) => handleToggleEnabled(record as SystemConfig, v === true)"
          />
        </template>
        <template #cell-value="{ text }">
          <Tooltip :title="text">
            <span :class="valueCellClassName">{{ text }}</span>
          </Tooltip>
        </template>

        <template #action="{ record }">
          <div :class="actionClassName">
            <Button
              variant="link"
              :class="linkBtnClassName"
              @click="() => handleApply(record)"
            >
              <Icon icon="carbon:restart" />
              应用
            </Button>
            <Divider type="vertical" :class="dividerClassName" />
            <Button
              variant="link"
              :class="linkBtnClassName"
              @click="() => handleView(record)"
            >
              <Icon icon="ant-design:eye-outlined" />
              查看
            </Button>
            <Divider type="vertical" :class="dividerClassName" />
            <Button
              variant="link"
              :class="linkBtnClassName"
              @click="() => handleEdit(record)"
            >
              <Icon icon="ant-design:edit-outlined" />
              编辑
            </Button>
            <Divider type="vertical" :class="dividerClassName" />
            <Button
              variant="link"
              :class="dangerLinkBtnClassName"
              @click="() => handleDelete(record)"
            >
              <Icon icon="ant-design:delete-outlined" />
              删除
            </Button>
          </div>
        </template>
      </BasicTable>
    </Card>

    <BasicModal
      :title="isEditing ? '编辑设置' : '新增设置'"
      :width="640"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="modalFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>

    <BasicDrawer
      :title="`详情设置 - ${viewingRecord?.name || ''}`"
      :size="520"
      @register="drawerRegister"
    >
      <DetailDescription
        v-if="viewingRecord"
        :data="viewingRecord"
        :schema="detailSchemas"
        :column="1"
        bordered
      />
    </BasicDrawer>
  </div>
</template>
