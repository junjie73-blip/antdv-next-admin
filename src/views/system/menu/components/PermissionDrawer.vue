<script setup lang="ts">

import { Icon } from "@iconify/vue";
import { computed, ref, watch } from "vue";

import { getPermissionActions } from "./actions";

import {
  permissionActionColumn,
  permissionColumns,
  permissionPagination,
  permissionRowKey,
  permissionScroll,
} from "./columns";

import {
  COMMON_BUTTONS,
  containerClassName,
  PERMISSION_STATUS_COLOR_MAP,
  PERMISSION_STATUS_ICON_MAP,
  PERMISSION_STATUS_LABEL_MAP,
  tagClassName,
} from "./constants";

import { usePermissionFormSchemas } from "./schemas";

import type { PermissionRecord } from "./types";

import { getMenuButtons } from "@/api";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicForm, useForm } from "@/components/business/Form";
import { type ActionItem, BasicTable, TableAction, useTable } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";
import { DictType } from "@/enums/dict";
import { useDictStore } from "@/stores";
import { http } from "@/utils";

// 抽离的模块





defineOptions({ name: "SystemPermissionButton" });

// ========== Props ==========
const props = defineProps<{
  menu: any;
  /** 外层抽屉是否可见（用于刷新表格） */
  visible?: boolean;
}>();

// ========== 字典 ==========
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

// ========== 注册实例 ==========
const [drawerRegister, drawerMethods] = useDrawer();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

// ========== 表单 schema ==========
const formSchemas = usePermissionFormSchemas(statusOptions);

// ========== 表格 API ==========
async function loadPermissions() {
  if (!props.menu?.menuId) return { list: [], total: 0 };
  return await getMenuButtons(props.menu.menuId);
}

// ========== useCRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<PermissionRecord>({
  containerType: "drawer",
  drawerMethods,
  formMethods,
  tableMethods,
  idKey: "menuId",
  getEmptyValues: () => ({
    menuName: "",
    permission: props.menu?.permission ? `${props.menu.permission}:` : "",
    sortOrder: 0,
    status: "1",
  }),
  getFormValues: (record) => ({
    menuName: record.menuName,
    permission: record.permission,
    sortOrder: record.sortOrder,
    status: record.status,
  }),
  onCreate: async (values) => {
    await http.Post("/menu", { ...values, parentId: props.menu.menuId, menuType: 3 });
  },
  onUpdate: async (id, values) => {
    await http.Put(`/menu/${id}`, { ...values, parentId: props.menu.menuId, menuType: 3 });
  },
  onDelete: async (record) => {
    await http.Delete(`/menu/${record.menuId}`);
  },
  messages: {
    createSuccess: "按钮创建成功",
    updateSuccess: "按钮更新成功",
    deleteSuccess: "按钮删除成功",
  },
});

// ========== 常见按钮快速新增 ==========
const commonSelectValue = ref<string | undefined>(undefined);

async function handleCommonSelect(info: { key: string }) {
  const common = COMMON_BUTTONS.find((item) => item.key === info.key);
  if (!common) return;
  await handleAdd({
    menuName: common.label,
    permission: `${props.menu.permission}:${common.permCode}`,
    sortOrder: 0,
    status: "1",
  });
  commonSelectValue.value = undefined;
}

// ========== 操作项 ==========
function getActions(record: PermissionRecord): ActionItem[] {
  return getPermissionActions(record, {
    onEdit: handleEdit,
    onDelete: handleDelete,
  });
}

// ========== 抽屉可见或菜单切换时刷新 ==========
watch(
  () => [props.visible, props.menu?.menuId],
  ([visible, menuId]) => {
    if (visible === true && menuId) {
      tableMethods.value?.reload();
    }
  },
);
</script>

<template>
  <div :class="containerClassName">
    <!-- 顶部工具栏 -->
    <div class="flex items-center gap-4 mb-4">
      <a-button type="primary"
@click="handleAdd()">
        <template #icon><Icon icon="ant-design:plus-outlined" /></template>
        新增按钮
      </a-button>

      <a-dropdown
        :menu="{ items: COMMON_BUTTONS }"
        :trigger="['click']"
        arrow
        @menu-click="handleCommonSelect"
      >
        <a-button>
          常见按钮
          <Icon icon="ant-design:down-outlined" />
        </a-button>
      </a-dropdown>
    </div>

    <!-- 表格 -->
    <BasicTable
      :columns="permissionColumns"
      :api="loadPermissions"
      :immediate="true"
      :use-search-form="false"
      :show-table-setting="false"
      :pagination="permissionPagination"
      :action-column="permissionActionColumn"
      :row-key="permissionRowKey"
      :scroll="permissionScroll"
      @register="tableRegister"
    >
      <template #cell-status="{ record }">
        <a-tag :color="PERMISSION_STATUS_COLOR_MAP[record.status] || 'default'">
          <span :class="tagClassName">
            <Icon :icon="PERMISSION_STATUS_ICON_MAP[record.status] || 'carbon:help'" />
            {{ PERMISSION_STATUS_LABEL_MAP[record.status] || "未知" }}
          </span>
        </a-tag>
      </template>

      <template #action="{ record }">
        <TableAction :actions="getActions(record as PermissionRecord)" />
      </template>
    </BasicTable>

    <!-- 新增/编辑抽屉 -->
    <BasicDrawer
      :title="isEditing ? '编辑按钮' : '新增按钮'"
      :width="520"
      @register="drawerRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="formSchemas"
        :label-width="100"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      />
    </BasicDrawer>
  </div>
</template>
