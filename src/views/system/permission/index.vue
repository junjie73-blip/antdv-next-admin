<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, nextTick, ref } from "vue";
import dayjs from "dayjs";

import { createPermission, deletePermission, getPermissionList, updatePermission } from "@/api";
import { Description } from "@/components/business/Description";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, TableAction, useTable, type ActionItem } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";
import { useUserStore } from "@/stores/modules/user";

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
import type { PermissionRecord, RawPermissionRecord } from "./types";
import { buildPermissionPayload, filterByPlatformAdmin, mapPermissionRecord } from "./utils";

defineOptions({ name: "SystemPermission" });

// ========== 用户 store ==========
const userStore = useUserStore();
const isPlatformAdmin = computed(() => {
  return userStore.permissions?.some((p: string) => p.startsWith("platform:")) ?? false;
});

// ========== 详情 ==========
const viewingRecord = ref<PermissionRecord | null>(null);
const [drawerRegister, drawerMethods] = useDrawer();

function handleView(record: PermissionRecord) {
  viewingRecord.value = null;
  nextTick(() => {
    viewingRecord.value = record;
    drawerMethods.openDrawer();
  });
}

// ========== 表格 & 表单 ==========
const [tableRegister, tableMethods] = useTable();
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();

// ========== useCRUD ==========
// 说明：删除确认由操作项 popConfirm 负责，关闭 useCRUD 内置 Modal.confirm。
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<PermissionRecord>({
  containerType: "modal",
  modalMethods,
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
    await createPermission(buildPermissionPayload(values));
  },
  onUpdate: async (id, values: any) => {
    await updatePermission(id, buildPermissionPayload(values));
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

// ========== 数据加载 ==========
async function fetchPermissionList(params: Record<string, any>) {
  const res = await getPermissionList(params);
  const data = res?.data ?? res;

  const mapped = (data?.list || []).map((item: RawPermissionRecord) => mapPermissionRecord(item));
  // 前端兜底：非平台超管过滤掉平台级权限（后端最好也做）
  const list = filterByPlatformAdmin(mapped, isPlatformAdmin.value);

  return { list, total: list.length };
}

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
        :api="fetchPermissionList"
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

        <template #cell-action="{ record }">
          <a-tag v-if="record.action" :color="ACTION_COLOR_MAP[record.action] || 'default'">
            {{ record.action }}
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

    <!-- 新增/编辑弹窗 -->
    <BasicModal
      :title="isEditing ? '编辑权限' : '新增权限'"
      :width="620"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="permissionFormSchemas"
        :label-width="100"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>

    <!-- 详情抽屉 -->
    <BasicDrawer
      :title="`权限详情 - ${viewingRecord?.permName || ''}`"
      :width="620"
      :show-footer="false"
      @register="drawerRegister"
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
