<script setup lang="ts">
import type { FormSchema } from "@/components/business/Form";
import type { ActionItem, BasicColumn } from "@/components/business/Table";
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
} from "@/api/system";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, useTable } from "@/components/business/Table";
import { DictType } from "@/enums/dict";
import { useDictStore } from "@/stores";
import { cn } from "@/utils/cn";
import { useCRUD } from "@/composables/useCRUD";
import { message } from "antdv-next";

defineOptions({ name: "SystemDict" });

interface DictItemRecord {
  dictDataId: string;
  dictLabel: string;
  dictValue: string;
  sortOrder: number;
  status: string;
  remark?: string;
}

interface DictTypeRecord {
  dictTypeId: string;
  dictName: string;
  dictCode: string;
  status: string;
  description?: string;
}

// ========== 样式 ==========
const containerClassName = cn("flex gap-4");
const leftPanelClassName = cn("w-[300px] shrink-0");
const rightPanelClassName = cn("flex-1 min-w-0");
const cardClassName = cn(
  "shadow-sm rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden",
);
const typeItemClassName = (active: boolean) =>
  cn(
    "flex items-center justify-between px-4 py-3 cursor-pointer",
    "border-b border-gray-100 dark:border-gray-800 transition-colors duration-200",
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

// ========== 状态映射 ==========
const statusColorMap: Record<string, string> = { "1": "green", "0": "red" };
const statusLabelMap: Record<string, string> = { "1": "正常", "0": "停用" };

const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

// ========== 数据 ==========
const dictTypes = ref<DictTypeRecord[]>([]);
const selectedType = ref<DictTypeRecord | null>(null);
const typeLoading = ref(false);

// ========== 类型模态框和表单 ==========
const [typeModalRegister, typeModalMethods] = useModal();
const [typeFormRegister, typeFormMethods] = useForm();

const typeFormSchemas: FormSchema[] = [
  {
    field: "dictName",
    label: "字典名称",
    component: "Input",
    required: true,
    componentProps: { placeholder: "例如：用户性别" },
  },
  {
    field: "dictCode",
    label: "字典编码",
    component: "Input",
    required: true,
    componentProps: { placeholder: "例如：sys_user_sex" },
  },
  {
    field: "status",
    label: "状态",
    component: "RadioGroup",
    defaultValue: "1",
    colProps: { span: 12 },
    componentProps: () => ({
      optionType: "button",
      buttonStyle: "solid",
      options: statusOptions.value,
    }),
  },
  {
    field: "description",
    label: "备注",
    component: "InputTextArea",
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入备注信息...", rows: 3 },
  },
];

// ========== 字典项模态框和表格 ==========
const [itemModalRegister, itemModalMethods] = useModal();
const [itemFormRegister, itemFormMethods] = useForm();
const [itemTableRegister, itemTableMethods] = useTable();

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
    label: "字典编码",
    component: "Input",
    required: true,
    componentProps: { placeholder: "例如：0" },
  },
  {
    field: "sortOrder",
    label: "排序",
    component: "InputNumber",
    colProps: { span: 12 },
    componentProps: { min: 0, placeholder: "请输入排序号", style: { width: "100%" } },
  },
  {
    field: "status",
    label: "状态",
    component: "RadioGroup",
    defaultValue: "1",
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
const itemColumns = [
  {
    title: "字典标签",
    dataIndex: "dictLabel",
    key: "dictLabel",
    width: 120,
    align: "center",
  },
  {
    title: "字典编码",
    dataIndex: "dictValue",
    key: "dictValue",
    width: 120,
    align: "center",
  },
  {
    title: "排序",
    dataIndex: "sortOrder",
    key: "sortOrder",
    width: 80,
    align: "center",
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 80,
    align: "center",
  },
  {
    title: "备注",
    dataIndex: "remark",
    key: "remark",
    width: 200,
    align: "center",
  },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 180,
    align: "center",
  },
];
// ========== 加载字典类型列表 ==========
async function loadDictTypes() {
  typeLoading.value = true;
  try {
    const res = await getDictList();
    dictTypes.value = res?.list || res || [];
  } catch (e) {
    message.error("加载字典类型失败");
  } finally {
    typeLoading.value = false;
  }
}

// 选择类型
function selectType(type: DictTypeRecord) {
  selectedType.value = type;
  itemTableMethods.value?.reload();
}

// ========== 使用 useCRUD 管理字典类型 ==========
const typeCrud = useCRUD<DictTypeRecord>({
  containerType: "modal",
  modalMethods: typeModalMethods,
  formMethods: typeFormMethods,
  tableMethods: { value: null }, // 类型没有表格，但 useCRUD 要求有 tableMethods，传入 null 即可
  idKey: "dictTypeId",
  confirmDelete: true,
  getEmptyValues: () => ({ dictName: "", dictCode: "", status: "1", description: "" }),
  getFormValues: (record) => ({
    dictName: record.dictName,
    dictCode: record.dictCode,
    status: record.status,
    description: record.description,
  }),
  onCreate: async (values) => await addDict(values),
  onUpdate: async (id, values) => await updateDict(id, values),
  onDelete: async (record) => await deleteDict(record.dictTypeId),
  onSaved: async () => {
    await loadDictTypes();
  },
  onDeleted: async () => {
    if (
      selectedType.value &&
      !dictTypes.value.some((t) => t.dictTypeId === selectedType.value!.dictTypeId)
    ) {
      selectedType.value = null;
    }
    await loadDictTypes();
  },
  messages: {
    createSuccess: "字典类型创建成功",
    updateSuccess: "字典类型更新成功",
    deleteSuccess: "字典类型删除成功",
    deleteConfirm: "确定要删除该字典类型吗？",
  },
});

// ========== 使用 useCRUD 管理字典项 ==========
const itemCrud = useCRUD<DictItemRecord>({
  containerType: "modal",
  modalMethods: itemModalMethods,
  formMethods: itemFormMethods,
  tableMethods: itemTableMethods,
  idKey: "dictDataId",
  confirmDelete: true,
  getEmptyValues: () => ({ dictLabel: "", dictValue: "", sortOrder: 0, status: "1", remark: "" }),
  getFormValues: (record) => ({
    dictLabel: record.dictLabel,
    dictValue: record.dictValue,
    sortOrder: record.sortOrder,
    status: record.status,
    remark: record.remark,
  }),
  onCreate: async (values) => {
    if (!selectedType.value) throw new Error("请先选择字典类型");
    await addDictItem({ ...values, dictTypeId: selectedType.value.dictTypeId });
  },
  onUpdate: async (id, values) => await updateDictItem(id, values),
  onDelete: async (record) => await deleteDictItem(record.dictDataId),
  onSaved: async () => itemTableMethods.value?.reload(),
  onDeleted: async () => itemTableMethods.value?.reload(),
  messages: {
    createSuccess: "字典项创建成功",
    updateSuccess: "字典项更新成功",
    deleteSuccess: "字典项删除成功",
    deleteConfirm: "确定要删除该字典项吗？",
  },
});

// ========== 字典项表格 API ==========
async function mockItemApi(params: Record<string, any>) {
  return await getDictItems({ ...params, dictTypeId: selectedType.value?.dictTypeId });
}

// 导出
function handleExport() {
  const dataToExport = selectedType.value
    ? itemTableMethods.value?.getSelectRows?.() || []
    : dictTypes.value;
  // 这里简化，实际可复用之前的导出逻辑
}

// 初始化加载
loadDictTypes();
const getActions = (record: any): ActionItem[] => {
  return [
    {
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => itemCrud.handleEdit(record),
    },
    {
      label: "删除",
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: "删除字典项",
        confirm: () => itemCrud.handleDelete(record),
      },
    },
  ];
};
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧字典类型 -->
    <div :class="leftPanelClassName">
      <div :class="cardClassName">
        <div :class="cardHeaderClassName">
          <span :class="cardTitleClassName">字典类型</span>
        </div>
        <a-spin :spinning="typeLoading">
          <div class="max-h-125 overflow-y-auto">
            <div v-if="dictTypes.length === 0" :class="emptyClassName">
              <div :class="emptyIconClassName"><Icon icon="carbon:book" /></div>
              <div :class="emptyTitleClassName">暂无字典类型</div>
              <div :class="emptyDescClassName">点击下方按钮新增字典类型</div>
            </div>
            <div
              v-for="item in dictTypes"
              :key="item.dictTypeId"
              :class="typeItemClassName(selectedType?.dictTypeId === item.dictTypeId)"
              @click="selectType(item)"
            >
              <div class="flex-1 min-w-0">
                <div :class="typeItemNameClassName">{{ item.dictName }}</div>
                <div :class="typeItemCodeClassName">{{ item.dictCode }}</div>
              </div>
              <div :class="typeItemActionsClassName">
                <a-tag
                  :color="statusColorMap[item.status] || 'default'"
                  class="text-[10px]! px-1! py-0! leading-4!"
                  >{{ statusLabelMap[item.status] || "未知" }}</a-tag
                >
                <a-button
                  type="text"
                  size="small"
                  :class="typeItemBtnClassName"
                  @click.stop="typeCrud.handleEdit(item)"
                  ><Icon icon="ant-design:edit-outlined" class="text-xs"
                /></a-button>
                <a-button
                  type="text"
                  danger
                  size="small"
                  :class="typeItemBtnClassName"
                  @click="typeCrud.handleDelete(item)"
                  ><Icon icon="ant-design:delete-outlined" class="text-xs"
                /></a-button>
              </div>
            </div>
          </div>
        </a-spin>
        <div :class="cardFooterClassName">
          <a-button type="primary" size="small" @click="typeCrud.handleAdd()">
            <template #icon><Icon icon="ant-design:plus-outlined" /></template>
            新增类型
          </a-button>
        </div>
      </div>
    </div>

    <!-- 右侧字典项 -->
    <div :class="rightPanelClassName">
      <div :class="cardClassName">
        <div :class="cardHeaderClassName">
          <span :class="cardTitleClassName">{{
            selectedType ? `${selectedType.dictName} - 字典项` : "字典项"
          }}</span>
          <div class="flex items-center gap-2">
            <a-button size="small" @click="handleExport"
              ><Icon icon="carbon:export" /> 导出</a-button
            >
            <a-button
              type="primary"
              size="small"
              :disabled="!selectedType"
              @click="itemCrud.handleAdd()"
              ><Icon icon="ant-design:plus-outlined" /> 新增字典项</a-button
            >
          </div>
        </div>
        <div class="p-4">
          <BasicTable
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
                <span :class="tagClassName"
                  ><Icon
                    :icon="
                      record.status === '1' ? 'carbon:checkmark-outline' : 'carbon:close-outline'
                    "
                  />{{ statusLabelMap[record.status] || "未知" }}</span
                >
              </a-tag>
            </template>
            <template #action="{ record }">
              <table-action :actions="getActions(record)" />
            </template>
          </BasicTable>
        </div>
      </div>
    </div>

    <!-- 类型弹窗 -->
    <BasicModal
      :title="typeCrud.isEditing.value ? '编辑字典类型' : '新增字典类型'"
      :width="560"
      @register="typeModalRegister"
      @ok="typeCrud.handleSave"
    >
      <BasicForm
        :schemas="typeFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="typeFormRegister"
      />
    </BasicModal>

    <!-- 字典项弹窗 -->
    <BasicModal
      :title="itemCrud.isEditing.value ? '编辑字典项' : '新增字典项'"
      :width="600"
      @register="itemModalRegister"
      @ok="itemCrud.handleSave"
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
