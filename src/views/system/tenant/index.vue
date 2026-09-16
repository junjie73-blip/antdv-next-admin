<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message, Modal } from "antdv-next";
import dayjs from "dayjs";
import { nextTick, shallowRef } from "vue";

import { batchDeleteTenant, createTenant, deleteTenant, getTenantList, updateTenant } from "@/api";
import { Description } from "@/components/business/Description";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, TableAction, useTable, type ActionItem } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";

// 抽离的模块
import { getTenantActions } from "./actions";
import {
  tenantActionColumn,
  tenantColumns,
  tenantPagination,
  tenantRowKey,
  tenantRowSelection,
  tenantScroll,
} from "./columns";
import {
  TENANT_STATUS_COLOR_MAP,
  TENANT_STATUS_LABEL_MAP,
  cardClassName,
  containerClassName,
} from "./constants";
import {
  TENANT_EMPTY_VALUES,
  tenantDetailSchemas,
  tenantFormSchemas,
  tenantSearchSchemas,
} from "./schemas";
import type { TenantRecord } from "./types";

defineOptions({ name: "SystemTenant" });

// ========== 详情 ==========
const viewingRecord = shallowRef<TenantRecord | null>(null);
const [drawerRegister, drawerMethods] = useDrawer();

function handleView(record: TenantRecord) {
  viewingRecord.value = null;
  drawerMethods.openDrawer();
  nextTick(() => {
    viewingRecord.value = record;
  });
}

// ========== 表格 & 表单实例 ==========
const [tableRegister, tableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();

// ========== useCRUD ==========
// 说明：单条删除确认由操作项 popConfirm 负责，关闭 useCRUD 内置 Modal.confirm；
// 批量删除的确认由组件内 handleBatchDelete 自行弹 Modal。
const {
  isEditing,
  handleAdd,
  handleEdit,
  handleDelete,
  handleSave,
  handleBatchDelete: crudBatchDelete,
} = useCRUD<TenantRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "tenantId",
  getEmptyValues: () => ({ ...TENANT_EMPTY_VALUES }),
  getFormValues: (record) => ({
    tenantCode: record.tenantCode,
    tenantName: record.tenantName,
    contactName: record.contactName || "",
    contactPhone: record.contactPhone || "",
    contactEmail: record.contactEmail || "",
    status: record.status,
    expireTime: record.expireTime ? dayjs(record.expireTime) : null,
  }),
  onCreate: async (values: any) => {
    const payload = {
      ...values,
      expireTime: values.expireTime ? dayjs(values.expireTime).format("YYYY-MM-DD HH:mm:ss") : null,
    };
    await createTenant(payload);
  },
  onUpdate: async (id, values: any) => {
    const payload = {
      ...values,
      expireTime: values.expireTime ? dayjs(values.expireTime).format("YYYY-MM-DD HH:mm:ss") : null,
    };
    await updateTenant(id, payload);
  },
  onDelete: async (record) => {
    await deleteTenant(record.tenantId);
  },
  onBatchDelete: async (records) => {
    await batchDeleteTenant(records.map((r) => r.tenantId));
  },
  messages: {
    createSuccess: "租户创建成功",
    updateSuccess: "租户更新成功",
    deleteSuccess: "租户删除成功",
    batchDeleteSuccess: "批量删除成功",
  },
});

// ========== 批量删除（先弹确认） ==========
async function handleBatchDelete() {
  const selected = (tableMethods.value?.getSelectRows?.() || []) as TenantRecord[];
  if (selected.length === 0) {
    message.warning("请先选择要删除的租户");
    return;
  }
  Modal.confirm({
    title: "批量删除",
    content: `确定要删除选中的 ${selected.length} 个租户吗？该操作不可恢复`,
    okType: "danger",
    async onOk() {
      await crudBatchDelete(selected);
    },
  });
}

// ========== 操作项 ==========
function getActions(record: TenantRecord): ActionItem[] {
  return getTenantActions(record, {
    onEdit: handleEdit,
    onView: handleView,
    onDelete: handleDelete,
  });
}
</script>

<template>
  <div :class="containerClassName">
    <a-card title="租户管理" :class="cardClassName">
      <BasicTable
        :columns="tenantColumns"
        :api="getTenantList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: tenantSearchSchemas, labelWidth: 80 }"
        :scroll="tenantScroll"
        :row-selection="tenantRowSelection"
        :action-column="tenantActionColumn"
        :pagination="tenantPagination"
        :row-key="tenantRowKey"
        table-layout="fixed"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="handleAdd()">
            <template #icon><Icon icon="ant-design:plus-outlined" /></template>
            新增租户
          </a-button>
          <a-button danger @click="handleBatchDelete()">
            <template #icon><Icon icon="ant-design:delete-outlined" /></template>
            批量删除
          </a-button>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="TENANT_STATUS_COLOR_MAP[record.status] || 'default'">
            {{ TENANT_STATUS_LABEL_MAP[record.status] || "未知" }}
          </a-tag>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getActions(record as TenantRecord)" />
        </template>
      </BasicTable>
    </a-card>

    <BasicModal
      :title="isEditing ? '编辑租户' : '新增租户'"
      :width="640"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="tenantFormSchemas"
        :label-width="90"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>

    <BasicDrawer
      :title="`租户详情 - ${viewingRecord?.tenantName || ''}`"
      :width="620"
      :show-footer="false"
      @register="drawerRegister"
      @close="viewingRecord = null"
    >
      <Description
        v-if="viewingRecord"
        :key="viewingRecord.tenantId"
        :data="viewingRecord"
        :schema="tenantDetailSchemas"
        :column="2"
      />
    </BasicDrawer>
  </div>
</template>
