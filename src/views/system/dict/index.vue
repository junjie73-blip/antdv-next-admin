<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, ref } from "vue";
import { message } from "antdv-next";

import {
  addDict,
  addDictItem,
  batchRemoveDictData,
  deleteDict,
  deleteDictItem,
  getDictItems,
  getDictList,
  updateDict,
  updateDictItem,
} from "@/api";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, TableAction, useTable } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";
import { DictType } from "@/enums/dict";
import { useDictStore } from "@/stores";

// 抽离的模块
import { getDictItemActions } from "./actions";
import {
  dictItemActionColumn,
  dictItemColumns,
  dictItemPagination,
  dictTypeRowKey,
  dictTypeRowSelection,
} from "./columns";
import {
  DICT_STATUS_COLOR_MAP,
  DICT_STATUS_ICON_MAP,
  DICT_STATUS_LABEL_MAP,
  cardClassName,
  cardFooterClassName,
  cardHeaderClassName,
  cardTitleClassName,
  containerClassName,
  emptyClassName,
  emptyDescClassName,
  emptyIconClassName,
  emptyTitleClassName,
  leftPanelClassName,
  rightPanelClassName,
  tagClassName,
  typeItemActionsClassName,
  typeItemBtnClassName,
  typeItemClassName,
  typeItemCodeClassName,
  typeItemNameClassName,
} from "./constants";
import { useDictItemFormSchemas, useDictTypeFormSchemas } from "./schemas";
import type { DictItemRecord, DictTypeRecord } from "./types";

defineOptions({ name: "SystemDict" });

// ========== 字典 store ==========
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

// ========== 字典类型：状态 + 实例 ==========
const dictTypes = ref<DictTypeRecord[]>([]);
const selectedType = ref<DictTypeRecord | null>(null);
const typeLoading = ref(false);

const [typeModalRegister, typeModalMethods] = useModal();
const [typeFormRegister, typeFormMethods] = useForm();

// 类型 schema（依赖 statusOptions）
const typeFormSchemas = useDictTypeFormSchemas(statusOptions);

// ========== 字典项：实例 ==========
const [itemModalRegister, itemModalMethods] = useModal();
const [itemFormRegister, itemFormMethods] = useForm();
const [itemTableRegister, itemTableMethods] = useTable();

// 字典项 schema
const itemFormSchemas = useDictItemFormSchemas(statusOptions);

// ========== 加载字典类型列表 ==========
async function loadDictTypes() {
  typeLoading.value = true;
  try {
    const res = await getDictList();
    dictTypes.value = res?.list || res || [];
  } catch (e) {
    message.error("加载字典类型失败" + e);
  } finally {
    typeLoading.value = false;
  }
}

function selectType(type: DictTypeRecord) {
  selectedType.value = type;
  itemTableMethods.value?.reload();
}

// ========== 字典类型 CRUD ==========
const typeCrud = useCRUD<DictTypeRecord>({
  containerType: "modal",
  modalMethods: typeModalMethods,
  formMethods: typeFormMethods,
  tableMethods: { value: null }, // 类型没有表格
  idKey: "dictTypeId",
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

// ========== 字典项 CRUD ==========
const itemCrud = useCRUD<DictItemRecord>({
  containerType: "modal",
  modalMethods: itemModalMethods,
  formMethods: itemFormMethods,
  tableMethods: itemTableMethods,
  idKey: "dictDataId",
  getEmptyValues: () => ({
    dictLabel: "",
    dictValue: "",
    sortOrder: 0,
    status: "1",
    remark: "",
  }),
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
  onBatchDelete: async (records) => {
    await batchRemoveDictData(records.map((r) => r.dictDataId));
  },
  messages: {
    createSuccess: "字典项创建成功",
    updateSuccess: "字典项更新成功",
    deleteSuccess: "字典项删除成功",
  },
});

// ========== 字典项表格 API ==========
async function fetchDictItems(params: Record<string, any>) {
  return await getDictItems({ ...params, dictTypeId: selectedType.value?.dictTypeId });
}

// ========== 导出 ==========
function handleExport() {
  const dataToExport = selectedType.value
    ? itemTableMethods.value?.getSelectRows?.() || []
    : dictTypes.value;
  // TODO: 实际导出逻辑
  console.log("export:", dataToExport);
}

// ========== 字典项操作项 ==========
function getItemActions(record: DictItemRecord) {
  return getDictItemActions(record, {
    onEdit: itemCrud.handleEdit,
    onDelete: itemCrud.handleDelete,
  });
}

// ========== 初始化 ==========
loadDictTypes();
</script>

<template>
  <div :class="containerClassName">
    <!-- ==================== 左侧字典类型 ==================== -->
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
                  :color="DICT_STATUS_COLOR_MAP[item.status] || 'default'"
                  class="text-[10px]! px-1! py-0! leading-4!"
                >
                  {{ DICT_STATUS_LABEL_MAP[item.status] || "未知" }}
                </a-tag>
                <a-button
                  type="text"
                  size="small"
                  :class="typeItemBtnClassName"
                  @click.stop="typeCrud.handleEdit(item)"
                >
                  <Icon icon="ant-design:edit-outlined" class="text-xs" />
                </a-button>
                <a-button
                  type="text"
                  danger
                  size="small"
                  :class="typeItemBtnClassName"
                  @click.stop="typeCrud.handleDelete(item)"
                >
                  <Icon icon="ant-design:delete-outlined" class="text-xs" />
                </a-button>
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

    <!-- ==================== 右侧字典项 ==================== -->
    <div :class="rightPanelClassName">
      <div :class="cardClassName">
        <div :class="cardHeaderClassName">
          <span :class="cardTitleClassName">
            {{ selectedType ? `${selectedType.dictName} - 字典项` : "字典项" }}
          </span>
        </div>

        <div class="p-4">
          <BasicTable
            :columns="dictItemColumns"
            :api="fetchDictItems"
            :immediate="true"
            :use-search-form="false"
            :show-table-setting="false"
            :pagination="dictItemPagination"
            :action-column="dictItemActionColumn"
            size="small"
            :row-selection="dictTypeRowSelection"
            :row-key="dictTypeRowKey"
            @register="itemTableRegister"
          >
            <template #toolbar>
              <a-button size="small" @click="handleExport">
                <Icon icon="carbon:export" /> 导出
              </a-button>
              <a-button
                type="primary"
                size="small"
                :disabled="!selectedType"
                @click="itemCrud.handleAdd()"
              >
                <Icon icon="ant-design:plus-outlined" /> 新增字典项
              </a-button>
              <a-button danger @click="itemCrud.handleBatchDelete">批量删除</a-button>
            </template>
            <template #cell-status="{ record }">
              <a-tag :color="DICT_STATUS_COLOR_MAP[record.status] || 'default'">
                <span :class="tagClassName">
                  <Icon :icon="DICT_STATUS_ICON_MAP[record.status] || 'carbon:help'" />
                  {{ DICT_STATUS_LABEL_MAP[record.status] || "未知" }}
                </span>
              </a-tag>
            </template>

            <template #action="{ record }">
              <TableAction :actions="getItemActions(record as DictItemRecord)" />
            </template>
          </BasicTable>
        </div>
      </div>
    </div>

    <!-- ==================== 类型弹窗 ==================== -->
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

    <!-- ==================== 字典项弹窗 ==================== -->
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
