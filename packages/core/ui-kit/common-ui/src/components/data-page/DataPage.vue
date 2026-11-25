<script setup lang="ts">
import type { FormSchema } from '@antdv/form-ui';
import type { BasicColumn } from '@antdv/table-ui';

import type { DataPageProps, DataRow } from './types';

import { computed, ref } from 'vue';

import { BasicForm, useForm } from '@antdv/form-ui';
import {
  BasicDrawer,
  BasicModal,
  message,
  useDrawer,
  useModal,
} from '@antdv/popup-ui';
import { Button, Progress } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { BasicTable, useTable } from '@antdv/table-ui';
import { Icon } from '@iconify/vue';

import { Card } from '../card';
import { Descriptions, DescriptionsItem } from '../descriptions';
import { Divider } from '../divider';
import { PageHeader } from '../page-header';
import { Popconfirm } from '../popconfirm';
import { Tag } from '../tag';

/**
 * 数据工作台：把「模板中心 / AI 配置 / 审批流」这一批列表页
 * 收敛成同一套骨架。表格及交互全部走 BasicTable 生态，与 system/user 列表
 * 的实现方式保持一致：
 *
 *   1. 顶部统计卡（指标 + 图标）—— 数据由页面侧提供
 *   2. BasicTable：内置 BasicForm 查询区、行选择、分页 + 自定义操作列
 *   3. 新增/编辑统一走 BasicModal + BasicForm，详情走 BasicDrawer
 *
 * 数据本身是页面侧传入的静态 rows。为了复用 BasicTable 的查询表单与分页链路，
 * 这里用 `api` 适配层在内存里做「关键字/条件过滤 → 分页切片」，等价于后端的
 * `{ list, total }` 端点（配了 api 后 BasicTable 不再做客户端切片，必须自己切）。
 */
const props = withDefaults(defineProps<DataPageProps>(), {
  actionWidth: 200,
  api: undefined,
  createFields: undefined,
  createSchemas: undefined,
  createLabel: '新建',
  description: '',
  filters: () => [],
  icon: 'carbon:data-vis-4',
  onSubmit: undefined,
  onRemove: undefined,
  onRemoveSelected: undefined,
  primaryKey: 'id',
  readonly: false,
  rows: () => [],
  showCreate: true,
  showDelete: true,
  stats: () => [],
  statusColors: () => ({}),
  statusLabels: () => ({}),
  statusKey: '',
});

/** 本地数据源（仅在未提供服务端 api 时参与增删改） */
const rows = ref<DataRow[]>([...props.rows]);

const keywordField = 'keyword';

/** 查询区：关键字 + 页面侧声明的每个筛选项，转成 BasicForm 的 schema */
const searchFormSchemas = computed<FormSchema[]>(() => [
  {
    field: keywordField,
    label: '关键词',
    component: 'Input',
    componentProps: {
      placeholder: '输入关键字查询',
      allowClear: true,
    },
    colProps: { span: 6 },
  },
  ...props.filters.map((filter) => ({
    field: filter.key,
    label: filter.label,
    component: 'Select' as const,
    componentProps: {
      placeholder: filter.placeholder ?? `请选择${filter.label}`,
      allowClear: true,
      options: (filter.options ?? []).map((option) => ({
        label: option.label,
        value: option.value,
      })),
    },
    colProps: { span: 6 },
  })),
]);

/** 状态列的动态插槽名（BasicTable 按 cell-<key> 找插槽） */
const statusCellSlot = computed(() => `cell-${props.statusKey}`);

/** 列定义：DataColumn → BasicColumn（状态/进度列用同名 cell 插槽定制渲染） */
const tableColumns = computed<BasicColumn[]>(() =>
  props.columns.map((column) => ({
    title: column.title,
    dataIndex: column.key,
    key: column.key,
    width: column.width,
    align: 'center',
    ellipsis: true,
  })),
);

/**
 * api 适配层：BasicTable 会把查询表单的值展开进 params，并附上 pageNum/pageSize。
 * 这里在内存里对 rows 做过滤 + 切片，返回 { list, total }。
 */
async function listApi(params: Record<string, any>) {
  if (props.api) return props.api(params);
  const pageNum = Number(params.pageNum ?? 1);
  const pageSize = Number(params.pageSize ?? 8);
  const kw = String(params[keywordField] ?? '')
    .trim()
    .toLowerCase();

  const list = rows.value.filter((row) => {
    const matchKeyword =
      !kw ||
      Object.values(row).some((value) =>
        String(value).toLowerCase().includes(kw),
      );
    const matchFilter = props.filters.every((filter) => {
      const value = params[filter.key];
      return (
        value === undefined ||
        value === null ||
        value === '' ||
        row[filter.key] === String(value)
      );
    });
    return matchKeyword && matchFilter;
  });

  const total = list.length;
  const start = (pageNum - 1) * pageSize;
  return { list: list.slice(start, start + pageSize), total };
}

/** 新增/编辑表单字段（默认取 columns 前三项，去掉状态列） */
const createColumns = computed(() => {
  const keys =
    props.createFields ?? props.columns.slice(0, 3).map((c) => c.key);
  return props.columns.filter(
    (c) => keys.includes(c.key) && c.key !== props.statusKey,
  );
});

const modalFormSchemas = computed<FormSchema[]>(
  () =>
    props.createSchemas ??
    createColumns.value.map((column) => ({
      field: column.key,
      label: column.title,
      component: 'Input',
      required: true,
      componentProps: { placeholder: `请输入${column.title}` },
    })),
);

const [tableRegister, tableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [detailRegister, detailMethods] = useDrawer();
const [formRegister, formMethods] = useForm();

/** 编辑态：非空表示编辑现有行 */
const editingKey = ref<null | string>(null);
const editingRow = ref<DataRow | null>(null);
const detailRow = ref<DataRow | null>(null);
const selectedCount = ref(0);

function handleSelectionChange(keys: (number | string)[]) {
  selectedCount.value = keys.length;
}

/** 操作列按钮样式，与参考页 system/user 的 link 按钮保持一致 */
const actionClassName = cn('flex items-center justify-center');
const btnClassName = cn('h-auto px-0.5!');
const dividerClassName = cn('mx-0');

const toneClass: Record<string, string> = {
  amber: 'text-amber-600 bg-amber-500/10',
  blue: 'text-blue-600 bg-blue-500/10',
  green: 'text-emerald-600 bg-emerald-500/10',
  red: 'text-rose-600 bg-rose-500/10',
  violet: 'text-violet-600 bg-violet-500/10',
};

function openCreate() {
  editingKey.value = null;
  editingRow.value = null;
  void formMethods.resetFields();
  formMethods.clearValidate();
  modalMethods.openModal();
}

function openEdit(row: DataRow) {
  editingKey.value = String(row[props.primaryKey]);
  editingRow.value = row;
  void formMethods.setFieldsValue(
    Object.fromEntries(
      createColumns.value.map((c) => [c.key, row[c.key] ?? '']),
    ),
  );
  formMethods.clearValidate();
  modalMethods.openModal();
}

async function submitCreate() {
  const values = await formMethods.validate();
  if (!values) return;

  // 服务端模式：写入成功后由外部钩子负责提示与刷新，这里只管弹层生命周期
  if (props.onSubmit) {
    const ok = await props.onSubmit(
      values,
      editingKey.value,
      editingRow.value ?? undefined,
    );
    if (ok === false) return;
    modalMethods.closeModal();
    editingKey.value = null;
    editingRow.value = null;
    await tableMethods.value?.reload();
    return;
  }

  if (editingKey.value === null) {
    const next: DataRow = { ...values };
    next[props.primaryKey] = `N${Date.now().toString().slice(-6)}`;
    if (props.statusKey) next[props.statusKey] = '进行中';
    rows.value.unshift(next);
    message.success('新建成功');
  } else {
    const index = rows.value.findIndex(
      (r) => String(r[props.primaryKey]) === editingKey.value,
    );
    if (index !== -1) {
      rows.value[index] = { ...rows.value[index], ...values };
    }
    message.success('保存成功');
  }
  modalMethods.closeModal();
  editingKey.value = null;
  editingRow.value = null;
  await tableMethods.value?.reload();
}

function openDetail(row: DataRow) {
  detailRow.value = row;
  detailMethods.openDrawer();
}

async function removeRow(row: DataRow) {
  if (props.onRemove) {
    const ok = await props.onRemove(row);
    if (ok === false) return;
    await tableMethods.value?.reload();
    return;
  }
  const key = String(row[props.primaryKey]);
  rows.value = rows.value.filter((r) => String(r[props.primaryKey]) !== key);
  message.success('删除成功');
  void tableMethods.value?.reload();
}

async function removeSelected() {
  if (!selectedCount.value) return;
  const selectedRows = tableMethods.value?.getSelectRows?.() ?? [];
  if (props.onRemoveSelected) {
    const ok = await props.onRemoveSelected(selectedRows);
    if (ok === false) return;
    tableMethods.value?.clearSelectedRowKeys?.();
    selectedCount.value = 0;
    await tableMethods.value?.reload();
    return;
  }
  const keys = new Set(selectedRows.map((r) => String(r[props.primaryKey])));
  rows.value = rows.value.filter((r) => !keys.has(String(r[props.primaryKey])));
  tableMethods.value?.clearSelectedRowKeys?.();
  selectedCount.value = 0;
  message.success(`已删除 ${keys.size} 条记录`);
  void tableMethods.value?.reload();
}

function cellColor(value: string): string {
  return props.statusColors[value] ?? 'default';
}
function progressOf(row: DataRow): number | undefined {
  const raw = row.progress;
  if (!raw) return undefined;
  const num = Number.parseInt(String(raw).replace('%', ''), 10);
  return Number.isNaN(num) ? undefined : num;
}

/** 外部在写接口成功后强制刷新表格（服务端数据源模式下 props.rows 不会变） */
defineExpose({
  reload: () => tableMethods.value?.reload(),
});
</script>

<template>
  <div class="space-y-4" data-page-view>
    <PageHeader :description="description" :icon="icon" :title="title">
      <template #extra>
        <Button v-if="showCreate && !readonly" @click="openCreate">
          <Icon icon="carbon:add" /> {{ createLabel }}
        </Button>
      </template>
    </PageHeader>

    <!-- 1. 统计卡 -->
    <div
      v-if="stats.length"
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
    >
      <Card v-for="stat in stats" :key="stat.label" class="shadow-sm">
        <div class="flex items-center justify-between gap-3">
          <div class="min-w-0">
            <p class="truncate text-xs text-muted-foreground">
              {{ stat.label }}
            </p>
            <p class="mt-1 text-2xl font-semibold tabular-nums">
              {{ stat.value }}
            </p>
          </div>
          <div
            :class="
              cn(
                'flex size-10 shrink-0 items-center justify-center rounded-lg',
                toneClass[stat.tone ?? 'blue'],
              )
            "
          >
            <Icon :icon="stat.icon || 'carbon:data-vis-4'" class="size-5" />
          </div>
        </div>
      </Card>
    </div>

    <!-- 2. 查询 / 工具栏 / 表格 / 分页，全部由 BasicTable 承载 -->
    <Card class="shadow-sm">
      <template #title>{{ title }}列表</template>
      <BasicTable
        :action-column="{ width: actionWidth, title: '操作', fixed: 'right' }"
        :api="listApi"
        :columns="tableColumns"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :immediate="true"
        :pagination="{
          pageSize: 8,
          pageSizeOptions: ['8', '10', '20', '50'],
          showSizeChanger: true,
        }"
        :row-key="primaryKey"
        :row-selection="readonly ? undefined : {
          type: 'checkbox',
          onChange: handleSelectionChange,
        }"
        :scroll="{ x: 1000 }"
        :use-search-form="true"
        @register="tableRegister"
      >
        <template #toolbar-actions>
          <Button
            v-if="showDelete && (!api || onRemoveSelected)"
            size="sm"
            variant="outline"
            :disabled="!selectedCount"
            @click="removeSelected"
          >
            <Icon icon="carbon:trash-can" /> 批量删除
          </Button>
          <span class="text-xs text-muted-foreground">已选 {{ selectedCount }} 项</span>
          <!-- 宿主补充的工具栏动作（例如模型列表里就地配置供应商） -->
          <slot name="toolbar-extra"></slot>
        </template>

        <!-- 状态列（statusKey 由页面侧声明，动态插槽名） -->
        <template #[statusCellSlot]="{ record }">
          <Tag :color="cellColor(record[statusKey] || '')">
            {{ props.statusLabels[record[statusKey]] ?? record[statusKey] }}
          </Tag>
        </template>

        <!-- 进度列 -->
        <template #cell-progress="{ record }">
          <div
            v-if="progressOf(record) !== undefined"
            class="flex items-center gap-2"
          >
            <Progress :model-value="progressOf(record)" class="h-1.5 w-20" />
            <span class="text-xs tabular-nums text-muted-foreground">
              {{ record.progress }}
            </span>
          </div>
          <span v-else>{{ record.progress || '-' }}</span>
        </template>

        <!-- 操作列：详情 / 编辑 / 删除，样式参考 system/user 列表 -->
        <template #action="{ record }">
          <div :class="actionClassName">
            <slot name="action-extra" :record="record"></slot>
            <Button
              variant="link"
              :class="btnClassName"
              @click="openDetail(record)"
            >
              <Icon icon="ant-design:eye-outlined" /> 详情
            </Button>
            <template v-if="!readonly">
              <Divider type="vertical" :class="dividerClassName" />
              <Button
                variant="link"
                :class="btnClassName"
                @click="openEdit(record)"
              >
                <Icon icon="ant-design:edit-outlined" /> 编辑
              </Button>
            </template>
            <template v-if="showDelete && !readonly">
              <Divider type="vertical" :class="dividerClassName" />
              <Popconfirm
                title="确定删除该记录吗？"
                danger
                @confirm="removeRow(record)"
              >
                <Button
                  variant="link"
                  class="text-destructive hover:text-destructive"
                  :class="btnClassName"
                >
                  <Icon icon="ant-design:delete-outlined" /> 删除
                </Button>
              </Popconfirm>
            </template>
          </div>
        </template>
      </BasicTable>
    </Card>

    <!-- 新增 / 编辑统一走 Modal + BasicForm，不在页面里直接渲染表单 -->
    <BasicModal
      :title="editingKey !== null ? `编辑${title}` : createLabel"
      :width="560"
      @ok="submitCreate"
      @register="modalRegister"
    >
      <BasicForm
        :grid="{ cols: 2, gutter: 16 }"
        :label-width="80"
        :schemas="modalFormSchemas"
        :show-action-button-group="false"
        @register="formRegister"
      />
    </BasicModal>

    <!-- 详情走抽屉：只读展示整行字段，不跳出当前页 -->
    <BasicDrawer
      :show-footer="false"
      :title="`${title}详情`"
      :width="480"
      @register="detailRegister"
    >
      <Descriptions v-if="detailRow" :column="1" bordered size="middle">
        <DescriptionsItem
          v-for="column in columns"
          :key="column.key"
          :label="column.title"
        >
          {{ detailRow[column.key] || '-' }}
        </DescriptionsItem>
      </Descriptions>
      <slot name="detail-extra" :record="detailRow"></slot>
    </BasicDrawer>
  </div>
</template>
