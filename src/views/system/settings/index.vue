<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { nextTick, ref } from "vue";
import { message } from "antdv-next";

import {
  addSetting,
  batchDeleteSetting,
  deleteSetting,
  getSettingsList,
  updateSetting,
} from "@/api/system";
import { Description as DetailDescription } from "@/components/business/Description";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, TableAction, useTable, type ActionItem } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";

// 抽离的模块
import { getConfigActions } from "./actions";
import {
  configActionColumn,
  configColumns,
  configPagination,
  configRowKey,
  configRowSelection,
  configScroll,
} from "./columns";
import { cardClassName, containerClassName, valueCellClassName } from "./constants";
import {
  CONFIG_EMPTY_VALUES,
  configDetailSchemas,
  configFormSchemas,
  configSearchSchemas,
} from "./schemas";
import type { ConfigRecord } from "./types";

defineOptions({ name: "SystemSettings" });

// ========== 详情 ==========
const viewingRecord = ref<ConfigRecord | null>(null);
const [drawerRegister, drawerMethods] = useDrawer();

function handleView(record: ConfigRecord) {
  viewingRecord.value = null;
  nextTick(() => {
    viewingRecord.value = record;
    drawerMethods.openDrawer();
  });
}

// ========== 表格 & 表单实例 ==========
const [tableRegister, tableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();

// ========== useCRUD ==========
const {
  isEditing,
  handleAdd,
  handleEdit,
  handleDelete,
  handleSave,
  handleBatchDelete: crudBatchDelete,
} = useCRUD<ConfigRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "configId",
  getEmptyValues: () => ({ ...CONFIG_EMPTY_VALUES }),
  getFormValues: (record) => ({
    configKey: record.configKey,
    configValue: record.configValue || "",
    description: record.description || "",
  }),
  onCreate: async (values) => {
    await addSetting(values);
  },
  onUpdate: async (id, values) => {
    await updateSetting(id, values);
  },
  onDelete: async (record) => {
    await deleteSetting(record.configId);
  },
  onBatchDelete: async (records) => {
    await batchDeleteSetting(records.map((r) => r.configId));
  },
  messages: {
    createSuccess: "配置创建成功",
    updateSuccess: "配置更新成功",
    deleteSuccess: "配置删除成功",
    batchDeleteSuccess: "批量删除成功",
  },
});

// ========== 批量删除（先弹确认） ==========
async function handleBatchDelete() {
  const selected = (tableMethods.value?.getSelectRows?.() || []) as ConfigRecord[];
  if (selected.length === 0) {
    message.warning("请先选择要删除的配置");
    return;
  }
  await crudBatchDelete(selected);
}

// ========== 操作项 ==========
function getActions(record: ConfigRecord): ActionItem[] {
  return getConfigActions(record, {
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
  });
}
</script>

<template>
  <div :class="containerClassName">
    <a-card title="系统设置" :class="cardClassName">
      <BasicTable
        :columns="configColumns"
        :api="getSettingsList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: configSearchSchemas, labelWidth: 80 }"
        :scroll="configScroll"
        :row-selection="configRowSelection"
        :action-column="configActionColumn"
        :pagination="configPagination"
        :row-key="configRowKey"
        table-layout="fixed"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="handleAdd()">
            <template #icon>
              <Icon icon="ant-design:plus-outlined" />
            </template>
            新增设置
          </a-button>
          <a-button danger @click="handleBatchDelete()">
            <template #icon>
              <Icon icon="ant-design:delete-outlined" />
            </template>
            批量删除
          </a-button>
        </template>

        <template #cell-configValue="{ text }">
          <a-tooltip :title="text">
            <span :class="valueCellClassName">{{ text || "-" }}</span>
          </a-tooltip>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getActions(record as ConfigRecord)" />
        </template>
      </BasicTable>
    </a-card>

    <!-- 新增/编辑弹窗 -->
    <BasicModal
      :title="isEditing ? '编辑设置' : '新增设置'"
      :width="560"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="configFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>

    <!-- 详情抽屉 -->
    <BasicDrawer
      :title="`配置详情 - ${viewingRecord?.configKey || ''}`"
      :width="560"
      :show-footer="false"
      @register="drawerRegister"
      @close="viewingRecord = null"
    >
      <DetailDescription
        v-if="viewingRecord"
        :key="viewingRecord.configId"
        :data="viewingRecord"
        :schema="configDetailSchemas"
        :column="2"
        bordered
      />
    </BasicDrawer>
  </div>
</template>
