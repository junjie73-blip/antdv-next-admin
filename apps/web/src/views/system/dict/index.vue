<script setup lang="ts">
import type { FormSchema } from '@antdv/form-ui';
import type { BasicColumn } from '@antdv/table-ui';

import { computed, nextTick, ref } from 'vue';

import {
  Divider,
  PageHeader,
  Popconfirm,
  Scrollbar,
  Tag,
} from '@antdv/common-ui';
import { DictType } from '@antdv/enums';
import { BasicForm, useForm } from '@antdv/form-ui';
import { BasicModal, message, useModal } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { BasicTable, useTable } from '@antdv/table-ui';
import { Icon } from '@iconify/vue';
import {
  addDict,
  addDictItem,
  deleteDict,
  deleteDictItem,
  getDictItems,
  getDictList,
  updateDict,
  updateDictItem,
} from '~/api/system';
import { useDictStore } from '~/stores';
import { exportToExcel } from '~/utils/excel';

defineOptions({ name: 'SystemDict' });

interface DictItemRecord {
  id: number;
  dictType: string;
  dictLabel: string;
  dictValue: string;
  cssClass: string;
  sort: number;
  status: number;
  remark: string;
}

interface DictTypeRecord {
  id: number;
  typeName: string;
  typeCode: string;
  status: number;
  remark: string;
  sort?: number;
  items: DictItemRecord[];
}

/* 页头独占一行，下面左类型右字典项（grid 口径同用户管理） */
const containerClassName = cn('grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]');
const headerRowClassName = cn('lg:col-span-2');
const leftPanelClassName = cn('min-w-0');
const rightPanelClassName = cn('min-w-0');
const cardClassName = cn('shadow-sm');
/**
 * 这一页的两块面板是手写的 div，不是 `Card` 组件。
 * 底色一律走 `bg-card` + `border-border`：写死 `bg-white dark:bg-gray-900`
 * 的面板不跟 14 套预设走，换一档主题就露出一块"不属于本主题的白"。
 */
const panelClassName = cn(
  cardClassName,
  'bg-card border-border rounded-lg border',
);
/**
 * 选中态用「淡色底 + 圆角竖条」而不是加粗左边框：
 * - `border-l-(--primary)` 里的 `--primary` 是 HSL 三元组（`258 89% 66%`），
 *   直接当颜色用是非法值，浏览器退回默认边框色 → 截图里那根黑色竖条；
 *   主题里真正能用的是 `--color-primary`（`hsl(var(--primary))`），对应
 *   `bg-primary` / `border-l-primary` 这一族工具类。
 * - 3px 边框会把选中行的文字往右推 3px，和上下行对不齐；竖条改成绝对定位
 *   的独立元素，不占布局。
 */
const typeItemClassName = (active: boolean) =>
  cn(
    'relative flex items-center justify-between',
    'cursor-pointer px-4 py-3',
    'border-border border-b',
    'transition-colors duration-200',
    'hover:bg-accent',
    active && 'bg-primary/10',
  );
const typeItemActiveBarClassName = cn(
  'bg-primary absolute inset-y-2 left-0 w-[3px] rounded-r-full',
);
const typeItemNameClassName = (active: boolean) =>
  cn(
    'truncate text-sm font-medium',
    active ? 'text-primary' : 'text-foreground',
  );
const typeItemCodeClassName = cn(
  'text-muted-foreground mt-0.5 truncate text-xs',
);
const typeItemActionsClassName = cn('ml-2 flex shrink-0 items-center gap-1');
const typeItemBtnClassName = cn('min-w-0! p-0.5!');
const emptyClassName = cn(
  'text-muted-foreground flex flex-col items-center justify-center py-10',
);
const emptyIconClassName = cn('mb-3 text-4xl opacity-30');
const emptyTitleClassName = cn('text-sm font-medium');
const emptyDescClassName = cn('mt-1 text-xs');
const cardFooterClassName = cn(
  'border-border flex justify-start border-t px-4 py-3',
);
const cardHeaderClassName = cn(
  'border-border flex items-center justify-between border-b px-4 py-3',
);
const cardTitleClassName = cn('text-foreground text-sm font-semibold');
const actionClassName = cn('flex', 'items-center', 'justify-center');
const btnClassName = cn('h-auto', 'px-0.5!');
const dividerClassName = cn('mx-0');
const tagClassName = cn('inline-flex items-center gap-1');

const statusColorMap: Record<number, string> = {
  1: 'green',
  0: 'red',
};

const statusLabelMap: Record<number, string> = {
  1: '正常',
  0: '停用',
};

const dictStore = useDictStore();

const statusOptions = computed(() =>
  dictStore.getOptions(DictType.NORMAL_DISABLE),
);

const isEditing = ref(false);
const isEditingItem = ref(false);
const currentRecord = ref<DictTypeRecord | null>(null);
const currentItemRecord = ref<DictItemRecord | null>(null);
const selectedType = ref<DictTypeRecord | null>(null);
const dictTypes = ref<DictTypeRecord[]>([]);
const dictItems = ref<DictItemRecord[]>([]);

const [modalRegister, modalMethods] = useModal();
const [itemModalRegister, itemModalMethods] = useModal();
const [formRegister, formMethods] = useForm();
const [itemFormRegister, itemFormMethods] = useForm();
const [itemTableRegister, itemTableMethods] = useTable();

const modalFormSchemas: FormSchema[] = [
  {
    field: 'typeName',
    label: '字典名称',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：用户性别' },
  },
  {
    field: 'typeCode',
    label: '字典编码',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：sys_user_sex' },
  },
  {
    field: 'sort',
    label: '排序',
    component: 'InputNumber',
    colProps: { span: 12 },
    defaultValue: 0,
    componentProps: {
      min: 0,
      placeholder: '请输入排序号',
      style: { width: '100%' },
    },
  },
  {
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    defaultValue: 0,
    colProps: { span: 12 },
    componentProps: () => ({
      optionType: 'button',
      buttonStyle: 'solid',
      options: statusOptions.value,
    }),
  },
  {
    field: 'remark',
    label: '备注',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入备注信息...', rows: 3 },
  },
];

const itemFormSchemas: FormSchema[] = [
  {
    field: 'dictLabel',
    label: '字典标签',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：男' },
  },
  {
    field: 'dictValue',
    label: '字典键值',
    component: 'Input',
    required: true,
    componentProps: { placeholder: '例如：0' },
  },
  {
    field: 'sort',
    label: '排序',
    component: 'InputNumber',
    colProps: { span: 12 },
    componentProps: {
      min: 0,
      placeholder: '请输入排序号',
      style: { width: '100%' },
    },
  },
  {
    field: 'status',
    label: '状态',
    component: 'RadioGroup',
    defaultValue: 0,
    colProps: { span: 12 },
    componentProps: () => ({
      optionType: 'button',
      buttonStyle: 'solid',
      options: statusOptions.value,
    }),
  },
  {
    field: 'remark',
    label: '备注',
    component: 'InputTextArea',
    colProps: { span: 24 },
    componentProps: { placeholder: '请输入备注...', rows: 3 },
  },
];

async function loadDictTypes() {
  try {
    // request.ts 的 get() 已经剥过一层 `{ code, data, message }`，
    // 这里拿到的就是 `{ list, total }`，不要再访问 `.data`
    const res = await getDictList({});
    dictTypes.value = res?.list ?? [];
  } catch {
    message.error('加载字典类型失败');
  }
}

/**
 * 字典项只从这一个入口取数，并同步给导出用的 `dictItems` 快照。
 *
 * 原来 `mockItemApi()` 只是读 `dictItems.value`：右侧表格 `v-else` 首次挂载时
 * `loadDictItems()` 还没回来，表格拿到空数组就再也不会自己刷新（切换类型、
 * 增删改字典项也都没调 `itemTableMethods.reload()`）→ 截图里的「共 0 条」。
 * 现在表格的 api 直接负责取数，`immediate` 首屏就能拿到当前选中类型的数据。
 */
async function fetchDictItems(typeId?: number): Promise<DictItemRecord[]> {
  if (!typeId) {
    dictItems.value = [];
    return [];
  }
  try {
    const res = await getDictItems(typeId);
    const raw = Array.isArray(res) ? res : ((res as any)?.data ?? []);
    dictItems.value = Array.isArray(raw) ? raw : [];
  } catch {
    dictItems.value = [];
    message.error('加载字典项失败');
  }
  return dictItems.value;
}

/**
 * 字典项接口本身返回全量，表格又配了 :api（不做客户端切片），
 * 所以这一层必须自己按 pageNum/pageSize 切，否则「10 条/页」会显示整组字典项。
 */
async function mockItemApi(params: Record<string, any> = {}) {
  const all = await fetchDictItems(selectedType.value?.id);
  const page = Number(params.pageNum ?? params.page ?? 1) || 1;
  const pageSize = Number(params.pageSize ?? 10) || 10;
  const start = (page - 1) * pageSize;
  return { items: all.slice(start, start + pageSize), total: all.length };
}

async function reloadItems() {
  await itemTableMethods.value?.reload();
}

async function selectType(type: DictTypeRecord) {
  selectedType.value = type;
  // 首次选中：表格刚挂载，`:immediate` 会自己取数；这里再 reload 一次是幂等的，
  // 主要覆盖「表格已挂载、只是换了类型」的情况。
  await nextTick();
  await reloadItems();
}

function handleAdd() {
  isEditing.value = false;
  currentRecord.value = null;
  formMethods.setFieldsValue({
    typeName: '',
    typeCode: '',
    sort: 0,
    status: 0,
    remark: '',
  });
  formMethods.clearValidate();
  modalMethods.openModal();
}

function handleEdit(record: DictTypeRecord) {
  isEditing.value = true;
  currentRecord.value = record;
  formMethods.setFieldsValue({
    typeName: record.typeName,
    typeCode: record.typeCode,
    sort: record.sort ?? 0,
    status: record.status,
    remark: record.remark,
  });
  formMethods.clearValidate();
  modalMethods.openModal();
}

async function handleDelete(record: DictTypeRecord) {
  try {
    await deleteDict(record.id);
    message.success(`已删除字典：${record.typeName}`);
    if (selectedType.value?.id === record.id) {
      selectedType.value = null;
      dictItems.value = [];
    }
    await loadDictTypes();
  } catch {
    message.error('删除失败');
  }
}

async function handleSave() {
  const values = await formMethods.validate();
  if (!values) return;

  if (!values.typeName || !values.typeCode) {
    message.warning('请填写字典名称和编码');
    return;
  }

  try {
    if (isEditing.value && currentRecord.value) {
      await updateDict(currentRecord.value.id, values);
      message.success(`已更新字典：${values.typeName}`);
    } else {
      await addDict(values);
      message.success(`已新增字典：${values.typeName}`);
    }

    modalMethods.closeModal();
    await loadDictTypes();
    const selectedId = selectedType.value?.id;
    if (
      selectedId !== undefined &&
      isEditing.value &&
      currentRecord.value?.id === selectedId
    ) {
      const updated = dictTypes.value.find((t) => t.id === selectedId);
      if (updated) {
        selectedType.value = updated;
      }
    }
  } catch {
    message.error('保存失败');
  }
}

function handleAddItem() {
  isEditingItem.value = false;
  currentItemRecord.value = null;
  itemFormMethods.setFieldsValue({
    dictLabel: '',
    dictValue: '',
    sort: 0,
    status: 0,
    remark: '',
  });
  itemFormMethods.clearValidate();
  itemModalMethods.openModal();
}

function handleEditItem(item: DictItemRecord) {
  isEditingItem.value = true;
  currentItemRecord.value = item;
  itemFormMethods.setFieldsValue({
    dictLabel: item.dictLabel,
    dictValue: item.dictValue,
    sort: item.sort,
    status: item.status,
    remark: item.remark,
  });
  itemFormMethods.clearValidate();
  itemModalMethods.openModal();
}

async function handleSaveItem() {
  const values = await itemFormMethods.validate();
  if (!values) return;

  if (!values.dictLabel || !values.dictValue) {
    message.warning('请填写字典标签和键值');
    return;
  }

  const typeId = selectedType.value?.id;
  if (!typeId) {
    message.warning('请先选择字典类型');
    return;
  }

  try {
    if (isEditingItem.value && currentItemRecord.value) {
      await updateDictItem(currentItemRecord.value.id, values);
      message.success(`已更新字典项：${values.dictLabel}`);
    } else {
      await addDictItem({ ...values, dictTypeId: typeId });
      message.success(`已新增字典项：${values.dictLabel}`);
    }

    itemModalMethods.closeModal();
    await reloadItems();
  } catch {
    message.error('保存失败');
  }
}

async function handleDeleteItem(item: DictItemRecord) {
  try {
    await deleteDictItem(item.id);
    message.success(`已删除字典项：${item.dictLabel}`);
    await reloadItems();
  } catch {
    message.error('删除失败');
  }
}

function handleExport() {
  const dataToExport = selectedType.value ? dictItems.value : dictTypes.value;
  exportToExcel({
    filename: selectedType.value
      ? `字典项_${selectedType.value.typeName}`
      : '字典列表',
    sheetName: '数据字典',
    columns: selectedType.value
      ? [
          { header: '字典标签', key: 'dictLabel', width: 16 },
          { header: '字典键值', key: 'dictValue', width: 16 },
          { header: '排序', key: 'sort', width: 10 },
          { header: '状态', key: 'status', width: 8 },
          { header: '备注', key: 'remark', width: 25 },
        ]
      : [
          { header: 'ID', key: 'id', width: 8 },
          { header: '字典名称', key: 'typeName', width: 16 },
          { header: '字典编码', key: 'typeCode', width: 20 },
          { header: '状态', key: 'status', width: 8 },
          { header: '备注', key: 'remark', width: 25 },
        ],
    data: dataToExport.map((i: any) => ({
      ...i,
      status: i.status === 1 ? '正常' : '停用',
    })),
  });
}

const itemColumns: BasicColumn[] = [
  { title: '字典标签', dataIndex: 'dictLabel', key: 'dictLabel', width: 130 },
  {
    title: '字典键值',
    dataIndex: 'dictValue',
    key: 'dictValue',
    width: 100,
    align: 'center',
  },
  { title: '排序', dataIndex: 'sort', key: 'sort', width: 80, align: 'center' },
  {
    title: '状态',
    dataIndex: 'status',
    key: 'status',
    width: 80,
    align: 'center',
  },
  { title: '备注', dataIndex: 'remark', key: 'remark', ellipsis: true },
];

loadDictTypes();
</script>

<template>
  <div data-page-view :class="containerClassName">
    <PageHeader
      :class="headerRowClassName"
      title="字典管理"
      description="维护字典类型与字典项，下拉选项统一从这里取"
      icon="carbon:book"
    />

    <!-- 左侧：字典类型列表 -->
    <div :class="leftPanelClassName">
      <div :class="panelClassName">
        <div :class="cardHeaderClassName">
          <span :class="cardTitleClassName">字典类型</span>
        </div>

        <!-- 类型列表：滚动交给 Scrollbar，max-h 挪到 root-class，滚动条由组件内部 wrap 提供 -->
        <Scrollbar root-class="max-h-[500px]">
          <div v-if="dictTypes.length === 0" :class="emptyClassName">
            <div :class="emptyIconClassName">
              <Icon icon="carbon:book" />
            </div>
            <div :class="emptyTitleClassName">暂无字典类型</div>
            <div :class="emptyDescClassName">点击下方按钮新增字典类型</div>
          </div>

          <div
            v-for="item in dictTypes"
            :key="item.id"
            :class="typeItemClassName(selectedType?.id === item.id)"
            :aria-selected="selectedType?.id === item.id"
            @click="selectType(item)"
          >
            <span
              v-if="selectedType?.id === item.id"
              :class="typeItemActiveBarClassName"
            ></span>
            <div class="min-w-0 flex-1">
              <div :class="typeItemNameClassName(selectedType?.id === item.id)">
                {{ item.typeName }}
              </div>
              <div :class="typeItemCodeClassName">{{ item.typeCode }}</div>
            </div>
            <div :class="typeItemActionsClassName">
              <Tag
                :color="statusColorMap[item.status] || 'default'"
                class="!px-1 !py-0 !text-[10px] !leading-4"
              >
                {{ statusLabelMap[item.status] || '未知' }}
              </Tag>
              <Button
                variant="ghost"
                size="icon-sm"
                :class="typeItemBtnClassName"
                @click.stop="handleEdit(item)"
              >
                <Icon icon="ant-design:edit-outlined" class="text-xs" />
              </Button>
              <Popconfirm
                :title="`确定要删除字典「${item.typeName}」吗？`"
                danger
                @confirm="handleDelete(item)"
              >
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="text-destructive hover:text-destructive"
                  :class="typeItemBtnClassName"
                  @click.stop
                >
                  <Icon icon="ant-design:delete-outlined" class="text-xs" />
                </Button>
              </Popconfirm>
            </div>
          </div>
        </Scrollbar>

        <!-- 底部新增按钮 -->
        <div :class="cardFooterClassName">
          <Button size="sm" @click="handleAdd">
            <Icon icon="ant-design:plus-outlined" />
            新增类型
          </Button>
        </div>
      </div>
    </div>

    <!-- 右侧：字典项 -->
    <div :class="rightPanelClassName">
      <div :class="panelClassName">
        <div :class="cardHeaderClassName">
          <span :class="cardTitleClassName">
            {{ selectedType ? `${selectedType.typeName} - 字典项` : '字典项' }}
          </span>
          <div class="flex items-center gap-2">
            <Button variant="outline" size="sm" @click="handleExport">
              <Icon icon="carbon:export" />
              导出
            </Button>
            <Button size="sm" :disabled="!selectedType" @click="handleAddItem">
              <Icon icon="ant-design:plus-outlined" />
              新增字典项
            </Button>
          </div>
        </div>

        <!-- 字典项内容 -->
        <div class="p-4">
          <div v-if="!selectedType" :class="emptyClassName">
            <div :class="emptyIconClassName">
              <Icon icon="carbon:book" />
            </div>
            <div :class="emptyTitleClassName">请选择字典类型</div>
            <div :class="emptyDescClassName">
              从左侧列表中选择一个字典类型，查看其字典项
            </div>
          </div>

          <BasicTable
            v-else
            :columns="itemColumns"
            :api="mockItemApi"
            :immediate="true"
            :use-search-form="false"
            :pagination="{
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50'],
            }"
            :action-column="{ width: 180, title: '操作', fixed: 'right' }"
            size="small"
            @register="itemTableRegister"
          >
            <template #cell-status="{ record }">
              <Tag :color="statusColorMap[record.status] || 'default'">
                <span :class="tagClassName">
                  <Icon
                    :icon="
                      record.status === 1
                        ? 'carbon:checkmark-outline'
                        : 'carbon:close-outline'
                    "
                  />
                  {{ statusLabelMap[record.status] || '未知' }}
                </span>
              </Tag>
            </template>

            <template #action="{ record }">
              <div :class="actionClassName">
                <Button
                  variant="link"
                  :class="btnClassName"
                  @click="() => handleEditItem(record as DictItemRecord)"
                >
                  编辑
                </Button>
                <Divider type="vertical" :class="dividerClassName" />
                <Popconfirm
                  :title="`确定要删除字典项「${record.dictLabel}」吗？`"
                  danger
                  @confirm="() => handleDeleteItem(record as DictItemRecord)"
                >
                  <Button
                    variant="link"
                    class="text-destructive hover:text-destructive"
                    :class="btnClassName"
                  >
                    删除
                  </Button>
                </Popconfirm>
              </div>
            </template>
          </BasicTable>
        </div>
      </div>
    </div>

    <!-- 新增/编辑字典类型弹窗 -->
    <BasicModal
      :title="isEditing ? '编辑字典类型' : '新增字典类型'"
      :width="560"
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

    <!-- 新增/编辑字典项弹窗 -->
    <BasicModal
      :title="isEditingItem ? '编辑字典项' : '新增字典项'"
      :width="600"
      @register="itemModalRegister"
      @ok="handleSaveItem"
    >
      <BasicForm
        :schemas="itemFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="itemFormRegister"
      />
    </BasicModal>
  </div>
</template>
