<script setup lang="ts">
import type { FormSchema } from "~/components/business/Form";
import type { BasicColumn } from "~/components/business/Table";
import { Icon } from "@iconify/vue";

import { computed, ref } from "vue";
import {
  addDict,
  addDictItem,
  deleteDict,
  deleteDictItem,
  getDictItems,
  getDictList,
  updateDict,
  updateDictItem,
} from "~/api/system";
import { BasicForm, useForm } from "~/components/business/Form";
import { BasicModal, useModal } from "~/components/business/Modal";
import { BasicTable, useTable } from "~/components/business/Table";
import { DictType } from "~/enums/dict";
import { useDictStore } from "~/stores";
import { cn } from "~/utils/cn";
import { exportToExcel } from "~/utils/excel";

defineOptions({ name: "SystemDict" });

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
  items: DictItemRecord[];
}

const containerClassName = cn("flex gap-4");
const leftPanelClassName = cn("w-[280px] shrink-0");
const rightPanelClassName = cn("flex-1 min-w-0");
const cardClassName = cn("shadow-sm");
const typeItemClassName = (active: boolean) =>
  cn(
    "flex items-center justify-between",
    "px-4 py-3 cursor-pointer",
    "border-b border-gray-100 dark:border-gray-800",
    "transition-colors duration-200",
    "hover:bg-gray-50 dark:hover:bg-gray-800",
    active && "bg-blue-50 dark:bg-blue-900/20 border-l-[3px] border-l-[var(--ant-color-primary)]",
  );
const typeItemNameClassName = cn("text-sm font-medium text-gray-800 dark:text-gray-200 truncate");
const typeItemCodeClassName = cn("text-xs text-gray-400 mt-0.5 truncate");
const typeItemActionsClassName = cn("flex items-center gap-1 flex-shrink-0 ml-2");
const typeItemBtnClassName = cn("!p-0.5 !min-w-0");
const emptyClassName = cn("flex flex-col items-center justify-center py-10 text-gray-400");
const emptyIconClassName = cn("text-4xl mb-3 opacity-30");
const emptyTitleClassName = cn("text-sm font-medium");
const emptyDescClassName = cn("text-xs mt-1");
const cardFooterClassName = cn(
  "flex justify-start px-4 py-3 border-t border-gray-100 dark:border-gray-800",
);
const cardHeaderClassName = cn(
  "flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-gray-800",
);
const cardTitleClassName = cn("text-sm font-semibold text-gray-800 dark:text-gray-200");
const actionClassName = cn("flex", "items-center", "justify-center");
const btnClassName = cn("!px-0.5");
const dividerClassName = cn("mx-0");
const tagClassName = cn("inline-flex items-center gap-1");

const statusColorMap: Record<number, string> = {
  1: "green",
  0: "red",
};

const statusLabelMap: Record<number, string> = {
  1: "正常",
  0: "停用",
};

const dictStore = useDictStore();

const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

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
    field: "typeName",
    label: "字典名称",
    component: "Input",
    required: true,
    componentProps: { placeholder: "例如：用户性别" },
  },
  {
    field: "typeCode",
    label: "字典编码",
    component: "Input",
    required: true,
    componentProps: { placeholder: "例如：sys_user_sex" },
  },
  {
    field: "sort",
    label: "排序",
    component: "InputNumber",
    colProps: { span: 12 },
    defaultValue: 0,
    componentProps: {
      min: 0,
      placeholder: "请输入排序号",
      style: { width: "100%" },
    },
  },
  {
    field: "status",
    label: "状态",
    component: "RadioGroup",
    defaultValue: 0,
    colProps: { span: 12 },
    componentProps: () => ({
      optionType: "button",
      buttonStyle: "solid",
      options: statusOptions.value,
    }),
  },
  {
    field: "remark",
    label: "备注",
    component: "InputTextArea",
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入备注信息...", rows: 3 },
  },
];

const itemFormSchemas: FormSchema[] = [
  {
    field: "dictLabel",
    label: "字典标签",
    component: "Input",
    required: true,
    componentProps: { placeholder: "例如：男" },
  },
  {
    field: "dictValue",
    label: "字典键值",
    component: "Input",
    required: true,
    componentProps: { placeholder: "例如：0" },
  },
  {
    field: "sort",
    label: "排序",
    component: "InputNumber",
    colProps: { span: 12 },
    componentProps: {
      min: 0,
      placeholder: "请输入排序号",
      style: { width: "100%" },
    },
  },
  {
    field: "status",
    label: "状态",
    component: "RadioGroup",
    defaultValue: 0,
    colProps: { span: 12 },
    componentProps: () => ({
      optionType: "button",
      buttonStyle: "solid",
      options: statusOptions.value,
    }),
  },
  {
    field: "remark",
    label: "备注",
    component: "InputTextArea",
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入备注...", rows: 3 },
  },
];

async function loadDictTypes() {
  try {
    const res = await getDictList({});
    const data = res?.data ?? res;
    dictTypes.value = data?.list || [];
  } catch {
    message.error("加载字典类型失败");
  }
}

async function loadDictItems(typeId: number) {
  try {
    const res = await getDictItems(typeId);
    const items = Array.isArray(res) ? res : (res?.data ?? res ?? []);
    dictItems.value = items;
  } catch {
    message.error("加载字典项失败");
  }
}

function selectType(type: DictTypeRecord) {
  selectedType.value = type;
  loadDictItems(type.id);
}

function handleAdd() {
  isEditing.value = false;
  currentRecord.value = null;
  formMethods.setFieldsValue({
    typeName: "",
    typeCode: "",
    sort: 0,
    status: 0,
    remark: "",
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
    message.error("删除失败");
  }
}

async function handleSave() {
  const values = await formMethods.validate();
  if (!values) return;

  if (!values.typeName || !values.typeCode) {
    message.warning("请填写字典名称和编码");
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
    if (
      selectedType.value &&
      isEditing.value &&
      currentRecord.value?.id === selectedType.value.id
    ) {
      const updated = dictTypes.value.find((t) => t.id === selectedType.value!.id);
      if (updated) {
        selectedType.value = updated;
      }
    }
  } catch {
    message.error("保存失败");
  }
}

function handleAddItem() {
  isEditingItem.value = false;
  currentItemRecord.value = null;
  itemFormMethods.setFieldsValue({
    dictLabel: "",
    dictValue: "",
    sort: 0,
    status: 0,
    remark: "",
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
    message.warning("请填写字典标签和键值");
    return;
  }

  try {
    if (isEditingItem.value && currentItemRecord.value) {
      await updateDictItem(currentItemRecord.value.id, values);
      message.success(`已更新字典项：${values.dictLabel}`);
    } else {
      await addDictItem({ ...values, dictTypeId: selectedType.value!.id });
      message.success(`已新增字典项：${values.dictLabel}`);
    }

    itemModalMethods.closeModal();
    if (selectedType.value) {
      loadDictItems(selectedType.value.id);
    }
  } catch {
    message.error("保存失败");
  }
}

async function handleDeleteItem(item: DictItemRecord) {
  try {
    await deleteDictItem(item.id);
    message.success(`已删除字典项：${item.dictLabel}`);
    if (selectedType.value) {
      loadDictItems(selectedType.value.id);
    }
  } catch {
    message.error("删除失败");
  }
}

function handleExport() {
  const dataToExport = selectedType.value ? dictItems.value : dictTypes.value;
  exportToExcel({
    filename: selectedType.value ? `字典项_${selectedType.value.typeName}` : "字典列表",
    sheetName: "数据字典",
    columns: selectedType.value
      ? [
          { header: "字典标签", key: "dictLabel", width: 16 },
          { header: "字典键值", key: "dictValue", width: 16 },
          { header: "排序", key: "sort", width: 10 },
          { header: "状态", key: "status", width: 8 },
          { header: "备注", key: "remark", width: 25 },
        ]
      : [
          { header: "ID", key: "id", width: 8 },
          { header: "字典名称", key: "typeName", width: 16 },
          { header: "字典编码", key: "typeCode", width: 20 },
          { header: "状态", key: "status", width: 8 },
          { header: "备注", key: "remark", width: 25 },
        ],
    data: dataToExport.map((i: any) => ({
      ...i,
      status: i.status === 1 ? "正常" : "停用",
    })),
  });
}

const itemColumns: BasicColumn[] = [
  { title: "字典标签", dataIndex: "dictLabel", key: "dictLabel", width: 130 },
  { title: "字典键值", dataIndex: "dictValue", key: "dictValue", width: 100, align: "center" },
  { title: "排序", dataIndex: "sort", key: "sort", width: 80, align: "center" },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "备注", dataIndex: "remark", key: "remark", ellipsis: true },
];

async function mockItemApi() {
  return { items: dictItems.value, total: dictItems.value.length };
}

loadDictTypes();
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧：字典类型列表 -->
    <div :class="leftPanelClassName">
      <div
        :class="
          cardClassName +
          ' rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
        "
      >
        <div :class="cardHeaderClassName">
          <span :class="cardTitleClassName">字典类型</span>
        </div>

        <!-- 类型列表 -->
        <div class="max-h-[500px] overflow-y-auto">
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
            @click="selectType(item)"
          >
            <div class="flex-1 min-w-0">
              <div :class="typeItemNameClassName">{{ item.typeName }}</div>
              <div :class="typeItemCodeClassName">{{ item.typeCode }}</div>
            </div>
            <div :class="typeItemActionsClassName">
              <a-tag
                :color="statusColorMap[item.status] || 'default'"
                class="!text-[10px] !px-1 !py-0 !leading-4"
              >
                {{ statusLabelMap[item.status] || "未知" }}
              </a-tag>
              <a-button
                type="text"
                size="small"
                :class="typeItemBtnClassName"
                @click.stop="handleEdit(item)"
              >
                <template #icon>
                  <Icon icon="ant-design:edit-outlined" class="text-xs" />
                </template>
              </a-button>
              <a-popconfirm
                :title="`确定要删除字典「${item.typeName}」吗？`"
                @confirm="handleDelete(item)"
              >
                <a-button type="text" danger size="small" :class="typeItemBtnClassName" @click.stop>
                  <template #icon>
                    <Icon icon="ant-design:delete-outlined" class="text-xs" />
                  </template>
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>

        <!-- 底部新增按钮 -->
        <div :class="cardFooterClassName">
          <a-button type="primary" size="small" @click="handleAdd">
            <template #icon>
              <Icon icon="ant-design:plus-outlined" />
            </template>
            新增类型
          </a-button>
        </div>
      </div>
    </div>

    <!-- 右侧：字典项 -->
    <div :class="rightPanelClassName">
      <div
        :class="
          cardClassName +
          ' rounded-lg border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900'
        "
      >
        <div :class="cardHeaderClassName">
          <span :class="cardTitleClassName">
            {{ selectedType ? `${selectedType.typeName} - 字典项` : "字典项" }}
          </span>
          <div class="flex items-center gap-2">
            <a-button size="small" @click="handleExport">
              <template #icon>
                <Icon icon="carbon:export" />
              </template>
              导出
            </a-button>
            <a-button type="primary" size="small" :disabled="!selectedType" @click="handleAddItem">
              <template #icon>
                <Icon icon="ant-design:plus-outlined" />
              </template>
              新增字典项
            </a-button>
          </div>
        </div>

        <!-- 字典项内容 -->
        <div class="p-4">
          <div v-if="!selectedType" :class="emptyClassName">
            <div :class="emptyIconClassName">
              <Icon icon="carbon:book" />
            </div>
            <div :class="emptyTitleClassName">请选择字典类型</div>
            <div :class="emptyDescClassName">从左侧列表中选择一个字典类型，查看其字典项</div>
          </div>

          <BasicTable
            v-else
            :columns="itemColumns"
            :api="mockItemApi"
            :immediate="true"
            :use-search-form="false"
            :show-table-setting="false"
            :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
            :action-column="{ width: 180, title: '操作', fixed: 'right' }"
            size="small"
            @register="itemTableRegister"
          >
            <template #cell-status="{ record }">
              <a-tag :color="statusColorMap[record.status] || 'default'">
                <span :class="tagClassName">
                  <Icon
                    :icon="
                      record.status === 1 ? 'carbon:checkmark-outline' : 'carbon:close-outline'
                    "
                  />
                  {{ statusLabelMap[record.status] || "未知" }}
                </span>
              </a-tag>
            </template>

            <template #action="{ record }">
              <div :class="actionClassName">
                <a-button
                  type="link"
                  :class="btnClassName"
                  size="small"
                  @click="() => handleEditItem(record)"
                >
                  编辑
                </a-button>
                <a-divider type="vertical" :class="dividerClassName" />
                <a-popconfirm
                  :title="`确定要删除字典项「${record.dictLabel}」吗？`"
                  @confirm="() => handleDeleteItem(record)"
                >
                  <a-button type="link" danger :class="btnClassName" size="small"> 删除 </a-button>
                </a-popconfirm>
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
