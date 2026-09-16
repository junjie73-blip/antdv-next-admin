<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onMounted, ref } from "vue";
import { message } from "antdv-next";

import { addRole, deleteRole, getDeptTree, getRoleDetail, getRoleList, updateRole } from "@/api";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicTable, TableAction, useTable, type ActionItem } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";
import { DictType } from "@/enums/dict";
import { useDictStore } from "@/stores";
import { exportToExcel } from "@/utils/excel";
import PermissionDrawer from "./components/PermissionDrawer.vue";
// 抽离的模块
import { getRoleActions } from "./actions";
import {
  roleActionColumn,
  roleColumns,
  rolePagination,
  roleRowKey,
  roleRowSelection,
} from "./columns";
import {
  ROLE_EMPTY_VALUES,
  ROLE_EXPORT_COLUMNS,
  ROLE_EXPORT_FILE_NAME,
  ROLE_EXPORT_SHEET_NAME,
  cardClassName,
  containerClassName,
} from "./constants";
import { useRoleFormSchemas, useRoleSearchSchemas } from "./schemas";
import type { RoleRecord } from "./types";
import { mapRoleForExport } from "./utils";

defineOptions({ name: "SystemRole" });

// ========== 字典 ==========
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));
const deptTreeData = ref<any[]>([]);
const permDrawerOpen = ref(false);
const permDrawerRole = ref<RoleRecord | null>(null);

// ========== 实例 ==========
const [drawerRegister, drawerMethods] = useDrawer();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

// ========== Schema（工厂函数，保证字典响应性） ==========
const searchFormSchemas = useRoleSearchSchemas(statusOptions);
const drawerFormSchemas = useRoleFormSchemas(statusOptions);

// ========== useCRUD ==========
// 说明：删除确认由操作项 popConfirm 负责，关闭 useCRUD 内置 Modal.confirm。
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<RoleRecord>({
  containerType: "drawer",
  drawerMethods,
  formMethods,
  tableMethods,
  idKey: "roleId",
  onFetchDetail: async (id) => await getRoleDetail(id),
  getEmptyValues: () => ({ ...ROLE_EMPTY_VALUES }),
  getFormValues: (record) => ({
    roleName: record.roleName,
    roleCode: record.roleCode,
    description: record.description,
    sortOrder: record.sortOrder,
    status: record.status,
    dataScope: record.dataScope ?? "1",
  }),
  onCreate: async (values) => {
    await addRole(values);
  },
  onUpdate: async (id, values) => {
    await updateRole(id, values);
  },
  onDelete: async (record) => {
    await deleteRole(record.roleId);
  },
  messages: {
    createSuccess: "角色创建成功",
    updateSuccess: "角色更新成功",
    deleteSuccess: "角色删除成功",
  },
});

// ========== 状态切换 ==========
async function handleToggleStatus(record: RoleRecord) {
  try {
    const newStatus = record.status === "1" ? "0" : "1";
    await updateRole(record.roleId, { status: newStatus });
    message.success(`已${newStatus === "0" ? "停用" : "启用"}：${record.roleName}`);
    tableMethods.value?.reload();
  } catch (e: any) {
    message.error(e?.message || "操作失败");
  }
}

// ========== 导出 ==========
function handleExport() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as RoleRecord[];
  const dataToExport = selectedRows.length > 0 ? selectedRows : [];

  exportToExcel({
    filename: ROLE_EXPORT_FILE_NAME,
    sheetName: ROLE_EXPORT_SHEET_NAME,
    columns: ROLE_EXPORT_COLUMNS,
    data: dataToExport.map(mapRoleForExport),
  });
}

// ========== 操作项 ==========
function getActions(record: RoleRecord): ActionItem[] {
  return getRoleActions(record, {
    onEdit: handleEdit,
    onDelete: handleDelete,
    onPermission: handleOpenPermission,
  });
}

async function loadDeptTree() {
  deptTreeData.value = await getDeptTree();
}

function handleOpenPermission(record: RoleRecord) {
  permDrawerRole.value = record;
  permDrawerOpen.value = true;
}

function handlePermissionSaved() {
  tableMethods.value?.reload();
}
// ========== 初始化 ==========
onMounted(() => {
  loadDeptTree();
});
</script>

<template>
  <div :class="containerClassName">
    <a-card title="角色管理" :class="cardClassName">
      <BasicTable
        :columns="roleColumns"
        :api="getRoleList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :pagination="rolePagination"
        :action-column="roleActionColumn"
        :row-key="roleRowKey"
        :row-selection="roleRowSelection"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button @click="handleExport">
            <template #icon><Icon icon="carbon:export" /></template>
            导出
          </a-button>
          <a-button type="primary" @click="handleAdd()">
            <template #icon><Icon icon="ant-design:plus-outlined" /></template>
            新增角色
          </a-button>
        </template>

        <template #cell-status="{ record }">
          <a-switch
            :checked="record.status"
            checked-value="1"
            un-checked-value="0"
            @change="handleToggleStatus(record as RoleRecord)"
          />
        </template>

        <template #action="{ record }">
          <TableAction :actions="getActions(record as RoleRecord)" />
        </template>
      </BasicTable>
    </a-card>

    <!-- 新增/编辑抽屉 -->
    <BasicDrawer
      :title="isEditing ? '编辑角色' : '新增角色'"
      :width="520"
      @register="drawerRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="drawerFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicDrawer>

    <!-- 权限分配抽屉 -->
    <PermissionDrawer
      v-model:open="permDrawerOpen"
      :role="permDrawerRole"
      @saved="handlePermissionSaved"
    />
  </div>
</template>
