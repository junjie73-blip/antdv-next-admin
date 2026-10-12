<script setup lang="ts">
import type {
  TaskFormValues,
  TaskOption,
  TaskPriority,
  TaskRecord,
  TaskStatus,
} from '~/api/demo';
import type { FormSchema } from '~/components/business/Form';
import type {
  ActionItem,
  BasicColumn,
  FetchParams,
  Recordable,
} from '~/components/business/Table';

import { computed, onMounted, ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';
import {
  addTask,
  deleteTask,
  getTaskDetail,
  getTaskList,
  getTaskOptions,
  updateTask,
} from '~/api/demo';
import { BasicForm, useForm } from '~/components/business/Form';
import { BasicModal, useModal } from '~/components/business/Modal';
import { BasicTable, useTable } from '~/components/business/Table';
import { useCRUD } from '~/composables/useCRUD';
import { usePermission } from '~/composables/web/permission';

/**
 * 增删改查示例：把「表格 + 搜索表单 + 编辑弹窗」这套后台最常见的组合，
 * 用 `useCRUD` 收敛成一次声明式配置。
 *
 * 为什么单独开这一页：`useCRUD` 此前在仓库里**没有任何调用方**，
 * 而同一套状态机在 `views/system/user` 是手写的（`isEditing` + `currentRecord` +
 * `handleAdd/Edit/Delete/Save` 约 120 行）。示例存在的意义就是给出那条更短的路，
 * 否则新人只会照着唯一的手写样本抄。
 *
 * 分工要说清楚，别把 composable 当成魔法：
 * - `useTable` 管数据源与分页（`api` 返回 `{ list, total }`，字段嗅探见 `useDataSource`）；
 * - `useModal` / `useForm` 管容器与表单实例；
 * - `useCRUD` 只接这三样，把"校验 → 落库 → 关窗 → 刷新"这条固定序列搬过去，
 *   顺带管住 `isEditing` 与当前行 —— 页面里不再有手写的编辑标志位。
 *
 * 权限是另一半主题：按钮用 `ActionItem.auth` 声明权限码，
 * 由 `TableAction` 内部问 `usePermission`。`custom` 账号故意没有 `demo:task:remove`，
 * 用它登录时删除按钮应当直接不出现（超管是 `['*']`，全通）。
 */

const containerClassName = cn('space-y-6');
const toolbarClassName = cn('flex', 'flex-wrap', 'items-center', 'gap-2');
const descriptionClassName = cn('text-sm', 'text-gray-500');
const tipClassName = cn('text-xs', 'text-gray-500', 'mt-2');

const STATUS_COLOR: Record<TaskStatus, string> = {
  blocked: 'red',
  done: 'green',
  pending: 'orange',
  running: 'blue',
};
const STATUS_LABEL: Record<TaskStatus, string> = {
  blocked: '被阻塞',
  done: '已完成',
  pending: '待处理',
  running: '进行中',
};
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: 'red',
  low: 'default',
  middle: 'blue',
};
const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: '高',
  low: '低',
  middle: '中',
};

const { hasPermission } = usePermission();

/** 选项来自接口，不在页面里抄第二份枚举（前后端各写一份，加状态时必然漏一边） */
const statusOptions = ref<TaskOption[]>([]);
const priorityOptions = ref<TaskOption<TaskPriority>[]>([]);

const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();
const [tableRegister, tableRef] = useTable();

/** 选中行：批量删除的按钮可用性看它，取行也交给它（`useCRUD` 缺省会自己从表格取） */
const selectedRows = ref<TaskRecord[]>([]);

onMounted(async () => {
  try {
    const options = await getTaskOptions();
    statusOptions.value = options.status;
    priorityOptions.value = options.priority;
  } catch (error) {
    console.error('[demo/task] 选项加载失败', error);
  }
});

// ========== 搜索表单 ==========

const searchSchemas = computed<FormSchema[]>(() => [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    componentProps: {
      placeholder: '标题 / 负责人 / 备注',
      allowClear: true,
    },
    colProps: { span: 8 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '全部状态',
      allowClear: true,
      options: statusOptions.value,
    },
    colProps: { span: 8 },
  },
  {
    field: 'priority',
    label: '优先级',
    component: 'Select',
    componentProps: {
      placeholder: '全部优先级',
      allowClear: true,
      options: priorityOptions.value,
    },
    colProps: { span: 8 },
  },
]);

// ========== 编辑表单 ==========

const editSchemas = computed<FormSchema[]>(() => [
  {
    field: 'title',
    label: '任务标题',
    component: 'Input',
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入任务标题', maxlength: 40 },
  },
  {
    field: 'owner',
    label: '负责人',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '请输入负责人' },
  },
  {
    field: 'dueDate',
    label: '截止日期',
    component: 'DatePicker',
    componentProps: {
      // 不写 `valueFormat`，表单值就是 dayjs 对象，提交后会被 `String()` 成
      // "Mon Oct 12 2026 …" 这种没法看的串；固定成字符串再交给后端
      valueFormat: 'YYYY-MM-DD',
      placeholder: '请选择截止日期',
      style: { width: '100%' },
    },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    defaultValue: 'pending',
    componentProps: { options: statusOptions.value, placeholder: '请选择状态' },
  },
  {
    field: 'priority',
    label: '优先级',
    component: 'RadioGroup',
    defaultValue: 'middle',
    componentProps: {
      optionType: 'button',
      buttonStyle: 'solid',
      options: priorityOptions.value,
    },
  },
  {
    field: 'progress',
    // 单位写进 label 而不是 `addonAfter`：后者在这版 antd 上已废弃（console.error 播报
    // deprecation 警告，端到端巡检会把它当真错误收进来）
    label: '进度（%）',
    component: 'InputNumber',
    defaultValue: 0,
    componentProps: { min: 0, max: 100, style: { width: '100%' } },
  },
  {
    field: 'remark',
    label: '备注',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '选填', rows: 3, maxlength: 120 },
  },
]);

// ========== CRUD 编排 ==========

const {
  isEditing,
  handleAdd,
  handleBatchDelete,
  handleDelete,
  handleEdit,
  handleSave,
  loading: submitting,
} = useCRUD<TaskRecord, TaskFormValues>({
  containerType: 'modal',
  modalMethods,
  formMethods,
  tableMethods: tableRef,
  idKey: 'id',
  // `~/api/request` 的 get/post/put/del 已经把信封剥过一层（`.then(res => res.data)`），
  // 这里拿到的就是记录本身 —— 再 `.data` 一次会取到 undefined，
  // 表现是"保存成功了但表格没新行 / 编辑弹窗回填全空"。
  onCreate: (values) => addTask(values),
  onUpdate: (id, values) => updateTask(Number(id), values),
  onDelete: (record) => deleteTask(record.id),
  /**
   * 编辑前先拉详情：列表接口为省流量裁过大字段时，
   * 直接拿行数据回填表单会把这些字段提交成空值（"改个状态，备注没了"）。
   */
  onFetchDetail: (id) => getTaskDetail(Number(id)),
  getEmptyValues: () => ({
    priority: 'middle',
    progress: 0,
    status: 'pending',
  }),
  messages: {
    batchDeleteConfirm: '确定删除选中的任务吗？',
    createSuccess: '任务已创建',
    deleteSuccess: '任务已删除',
    updateSuccess: '任务已更新',
  },
});

/**
 * `useCRUD` 把"删完刷新表格"做好了，但选中态是表格侧的：
 * 删掉的行不在表上了，还留着勾选就是"批量删除（3 条）"里数不对。
 */
function clearSelection() {
  selectedRows.value = [];
  tableRef.value?.clearSelectedRowKeys?.();
}

/**
 * 表格数据源：`useDataSource` 已经把 `searchInfo` 摊平到顶层（见其 fetch 实现），
 * 所以这里把参数原样转给接口即可 —— 分页是 `pageNum/pageSize`，筛选是
 * `keyword/status/priority`，正是 mock 的 `demo/task/list` 读的那几个键。
 */
async function fetchTaskList(params: FetchParams) {
  return getTaskList(params as unknown as Record<string, unknown>);
}

function handleSelectionChange(_keys: (number | string)[], rows: Recordable[]) {
  // 表格回调给的是 `Recordable[]`，行数据由 mock 的 task 接口来，形状就是 TaskRecord
  selectedRows.value = rows as unknown as TaskRecord[];
}

const columns = computed<BasicColumn[]>(() => [
  { title: '任务标题', dataIndex: 'title', key: 'title', ellipsis: true },
  { title: '负责人', dataIndex: 'owner', key: 'owner', width: 140 },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 100,
    align: 'center',
  },
  {
    title: '优先级',
    dataIndex: 'priority',
    key: 'priority',
    width: 90,
    align: 'center',
  },
  { title: '进度', dataIndex: 'progress', key: 'progress', width: 140 },
  {
    title: '截止日期',
    dataIndex: 'dueDate',
    key: 'dueDate',
    width: 120,
    align: 'center',
  },
  {
    title: '创建时间',
    dataIndex: 'createdAt',
    key: 'createdAt',
    width: 170,
    align: 'center',
  },
]);

/**
 * 操作列声明式给出：`auth` 是权限码，`TableAction` 自己问 `usePermission`，
 * 页面不再手写 `v-if="hasPermission(...)"` 包按钮。
 * 删除走 `popConfirm` —— 不可逆操作必须二次确认，而且确认框由操作项描述，
 * 不由模板拼（模板里一拼，权限判断和确认文案就开始各改各的）。
 */
const actions = (record: Recordable): ActionItem[] => {
  const row = record as unknown as TaskRecord;
  return [
    {
      label: '编辑',
      icon: 'ant-design:edit-outlined',
      auth: 'demo:task:edit',
      onClick: () => handleEdit(row),
    },
    {
      label: '删除',
      icon: 'ant-design:delete-outlined',
      danger: true,
      auth: 'demo:task:remove',
      popConfirm: {
        title: '确定删除这个任务吗？',
        content: `「${row.title}」删除后不可恢复`,
        confirm: () => {
          handleDelete(row);
          clearSelection();
        },
      },
    },
  ];
};

function handleBatch() {
  // 先取快照再清 UI 选中态：`handleBatchDelete` 弹的确认框是非阻塞的，
  // 传引用数组的话，取消或删完后这个数组和表格的选中状态就对不上了
  handleBatchDelete([...selectedRows.value]);
  clearSelection();
}

const canAdd = computed(() => hasPermission('demo:task:add'));
const canBatchDelete = computed(() => hasPermission('demo:task:remove'));
</script>

<template>
  <div :class="containerClassName">
    <a-card title="增删改查（useCRUD）" variant="borderless">
      <p :class="descriptionClassName">
        新增 / 编辑 / 删除 / 批量删除全部由
        <code class="font-mono">useCRUD</code>
        编排：校验表单 → 调接口 → 关闭弹窗 →
        刷新表格，页面里不再手写编辑标志位与
        <code class="font-mono">handleSave</code> 的分支。
      </p>

      <BasicTable
        :columns="columns"
        :api="fetchTaskList"
        :use-search-form="true"
        :form-config="{ schemas: searchSchemas, labelWidth: 72 }"
        :action-column="{ width: 180, title: '操作', fixed: 'right', actions }"
        :row-selection="{ type: 'checkbox', onChange: handleSelectionChange }"
        :pagination="{
          showSizeChanger: true,
          pageSizeOptions: ['10', '20', '50'],
        }"
        :scroll="{ x: 1100 }"
        row-key="id"
        @register="tableRegister"
      >
        <template #toolbar>
          <div :class="toolbarClassName">
            <a-button
              v-if="canAdd"
              type="primary"
              size="small"
              @click="handleAdd()"
            >
              <template #icon>
                <Icon icon="ant-design:plus-outlined" />
              </template>
              新增任务
            </a-button>
            <a-button
              v-if="canBatchDelete"
              size="small"
              danger
              :disabled="selectedRows.length === 0"
              @click="handleBatch"
            >
              <template #icon>
                <Icon icon="ant-design:delete-outlined" />
              </template>
              批量删除{{
                selectedRows.length ? `（${selectedRows.length}）` : ''
              }}
            </a-button>
          </div>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="STATUS_COLOR[record.status as TaskStatus]">
            {{ STATUS_LABEL[record.status as TaskStatus] ?? record.status }}
          </a-tag>
        </template>
        <template #cell-priority="{ record }">
          <a-tag
            :color="PRIORITY_COLOR[record.priority as TaskPriority]"
            :bordered="false"
          >
            {{
              PRIORITY_LABEL[record.priority as TaskPriority] ?? record.priority
            }}
          </a-tag>
        </template>
        <template #cell-progress="{ record }">
          <a-progress
            :percent="Number(record.progress) || 0"
            size="small"
            :status="Number(record.progress) >= 100 ? 'success' : 'normal'"
          />
        </template>
      </BasicTable>

      <p :class="tipClassName">
        按钮级权限同样在跑：当前账号的权限码若是
        <code class="font-mono">['*']</code>（超管）全部可见； 换成
        <code class="font-mono">custom</code> 登录，它没有
        <code class="font-mono">demo:task:remove</code>，删除与批量删除都会消失。
      </p>
    </a-card>

    <a-card title="这个示例省掉了什么" variant="borderless">
      <a-descriptions :column="1" bordered size="small">
        <a-descriptions-item label="容器与表单实例">
          <code class="font-mono">useModal()</code> +
          <code class="font-mono">useForm()</code> 的返回值直接交给
          <code class="font-mono">useCRUD</code>，页面不再自己
          <code class="font-mono">openModal → nextTick → setFieldsValue</code>
          地排顺序。
        </a-descriptions-item>
        <a-descriptions-item label="编辑态标志">
          <code class="font-mono">isEditing</code> 由 composable 持有（当前是
          {{
            isEditing ? '编辑' : '新增'
          }}），弹窗标题、提交分支都读它，不必页面再存一份
          <code class="font-mono">currentRecord</code>。
        </a-descriptions-item>
        <a-descriptions-item label="保存流程">
          <code class="font-mono">handleSave</code> 一处搞定：校验 →
          去掉空字符串字段 → 按 <code class="font-mono">isEditing</code> 选
          create/update → 提示 → 关窗 →
          <code class="font-mono">reload()</code>。
        </a-descriptions-item>
        <a-descriptions-item label="删除与批量删除">
          <code class="font-mono">onDelete</code> 单条、
          <code class="font-mono">onBatchDelete</code> 缺省逐条并发；
          批量前的确认框内置，未选中时给提示而不是静默返回。
        </a-descriptions-item>
        <a-descriptions-item label="留给你写的">
          确认交互（这里用操作列的
          <code class="font-mono">popConfirm</code>）、字段映射
          <code class="font-mono">getFormValues</code>、以及业务规则钩子
          <code class="font-mono">beforeCreate / beforeUpdate / beforeDelete</code>。
        </a-descriptions-item>
      </a-descriptions>
    </a-card>

    <BasicModal
      :title="isEditing ? '编辑任务' : '新增任务'"
      :width="640"
      :ok-button-props="{ loading: submitting }"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="editSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>
  </div>
</template>
