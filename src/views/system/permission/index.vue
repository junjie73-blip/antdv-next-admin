<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { nextTick, ref } from "vue";

import { createPermission, deletePermission, getPermissionList, updatePermission } from "@/api";
import { Description } from "@/components/business/Description";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicTable, TableAction, useTable, type ActionItem } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";

// 抽离的模块
import { getPermissionActions } from "./actions";
import {
  permissionActionColumn,
  permissionColumns,
  permissionPagination,
  permissionRowKey,
  permissionScroll,
} from "./columns";
import {
  ACTION_COLOR_MAP,
  PERM_STATUS_COLOR_MAP,
  PERM_STATUS_LABEL_MAP,
  PERMISSION_EMPTY_VALUES,
  RESOURCE_TYPE_COLOR_MAP,
  RESOURCE_TYPE_LABEL_MAP,
  SCOPE_COLOR_MAP,
  SCOPE_LABEL_MAP,
  cardClassName,
  containerClassName,
} from "./constants";
import { permissionDetailSchemas, permissionFormSchemas, permissionSearchSchemas } from "./schemas";
import type { PermissionRecord } from "./types";

defineOptions({ name: "SystemPermission" });

// ========== 详情抽屉 ==========
const viewingRecord = ref<PermissionRecord | null>(null);
const [detailDrawerRegister, detailDrawerMethods] = useDrawer();

function handleView(record: PermissionRecord) {
  viewingRecord.value = null;
  nextTick(() => {
    viewingRecord.value = record;
    detailDrawerMethods.openDrawer();
  });
}

// ========== 表格 & 表单 ==========
const [tableRegister, tableMethods] = useTable();

// ⭐ 新增/编辑改用 Drawer
const [formDrawerRegister, formDrawerMethods] = useDrawer();
const [formRegister, formMethods] = useForm();

// ========== useCRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<PermissionRecord>({
  containerType: "drawer",
  drawerMethods: formDrawerMethods,
  formMethods,
  tableMethods,
  idKey: "permId",
  getEmptyValues: () => ({ ...PERMISSION_EMPTY_VALUES }),
  getFormValues: (record) => ({
    permCode: record.permCode,
    permName: record.permName,
    resourceType: record.resourceType,
    action: record.action || "",
    status: record.status,
    description: record.description || "",
  }),
  onCreate: async (values: any) => {
    await createPermission(values);
  },
  onUpdate: async (id, values: any) => {
    await updatePermission(id, values);
  },
  onDelete: async (record) => {
    await deletePermission(record.permId);
  },
  messages: {
    createSuccess: "权限创建成功",
    updateSuccess: "权限更新成功",
    deleteSuccess: "权限删除成功",
  },
});

// ========== 操作项 ==========
function getActions(record: PermissionRecord): ActionItem[] {
  return getPermissionActions(record, {
    onView: handleView,
    onEdit: handleEdit,
    onDelete: handleDelete,
  });
}
</script>

<template>
  <div :class="containerClassName">
    <a-card title="权限管理" :class="cardClassName">
      <BasicTable
        :columns="permissionColumns"
        :api="getPermissionList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: permissionSearchSchemas, labelWidth: 80 }"
        :scroll="permissionScroll"
        :action-column="permissionActionColumn"
        :pagination="permissionPagination"
        :row-key="permissionRowKey"
        table-layout="fixed"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="handleAdd()">
            <template #icon><Icon icon="ant-design:plus-outlined" /></template>
            新增权限
          </a-button>
        </template>

        <template #cell-scope="{ record }">
          <a-tag :color="SCOPE_COLOR_MAP[record.scope] || 'default'">
            {{ SCOPE_LABEL_MAP[record.scope] || record.scope }}
          </a-tag>
        </template>

        <template #cell-resourceType="{ record }">
          <a-tag :color="RESOURCE_TYPE_COLOR_MAP[record.resourceType] || 'default'">
            {{ RESOURCE_TYPE_LABEL_MAP[record.resourceType] || record.resourceType }}
          </a-tag>
        </template>

        <template #cell-permAction="{ record }">
          <a-tag v-if="record.permAction" :color="ACTION_COLOR_MAP[record.permAction] || 'default'">
            {{ record.permAction }}
          </a-tag>
          <span v-else class="text-gray-400">-</span>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="PERM_STATUS_COLOR_MAP[record.status] || 'default'">
            {{ PERM_STATUS_LABEL_MAP[record.status] || "未知" }}
          </a-tag>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getActions(record as PermissionRecord)" />
        </template>
      </BasicTable>
    </a-card>

    <!-- ⭐ 新增/编辑抽屉 -->
    <BasicDrawer
      :title="isEditing ? '编辑权限' : '新增权限'"
      :width="620"
      @register="formDrawerRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="permissionFormSchemas"
        :label-width="100"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicDrawer>

    <!-- 详情抽屉 -->
    <BasicDrawer
      :title="`权限详情 - ${viewingRecord?.permName || ''}`"
      :width="620"
      :show-footer="false"
      @register="detailDrawerRegister"
      @close="viewingRecord = null"
    >
      <Description
        v-if="viewingRecord"
        :key="viewingRecord.permId"
        :data="viewingRecord"
        :schema="permissionDetailSchemas"
        :column="2"
      />
    </BasicDrawer>
  </div>
</template>
