<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import { computed, ref } from "vue";

import { getMenuActions } from "./actions";
import { menuActionColumn, menuColumns, menuRowKey, menuScroll } from "./columns";
import PermissionDrawer from "./components/PermissionDrawer.vue";

import {
  cardClassName,
  containerClassName,
  MENU_EMPTY_VALUES,
  MENU_TYPE_COLOR_MAP,
  MENU_TYPE_ICON_MAP,
  MENU_TYPE_LABEL_MAP,
  tagClassName,
} from "./constants";

import { useMenuFormSchemas } from "./schemas";

import type { MenuRecord } from "./types";

import { changeMenuStatus } from "~/api";
import { BasicDrawer, useDrawer } from "~/components/business/Drawer";
import { BasicForm, useForm } from "~/components/business/Form";
import { type ActionItem, BasicTable, TableAction, useTable } from "~/components/business/Table";
import IconPicker from "~/components/common/Icon/IconPicker.vue";
import { useCRUD } from "~/composables/useCRUD";
import { DictType } from "~/enums/dict";
import { useDictStore } from "~/stores";
import { http } from "~/utils";

// 抽离的模块

defineOptions({ name: "SystemMenu" });

// ========== 字典 ==========
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

// ========== 注册实例 ==========
const [drawerRegister, drawerMethods] = useDrawer();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

// ========== 表单 schema ==========
const drawerFormSchemas = useMenuFormSchemas(statusOptions);

// ========== 表格 API ==========
async function fetchMenuTree() {
  return await http
    .Get("/menu/tree", {
      cacheFor: null,
    })
    .send(true);
}

// ========== useCRUD ==========
// 说明：删除确认由操作项 popConfirm 负责，关闭 useCRUD 内置 Modal.confirm。
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<MenuRecord>({
  containerType: "drawer",
  drawerMethods,
  formMethods,
  tableMethods,
  idKey: "menuId",
  getEmptyValues: () => ({ ...MENU_EMPTY_VALUES }),
  getFormValues: (record) => ({
    parentId: record.parentId,
    menuType: record.menuType,
    menuName: record.menuName,
    icon: record.icon,
    path: record.path,
    component: record.component,
    permission: record.permission,
    sortOrder: record.sortOrder,
    status: record.status,
  }),
  onCreate: async (values) => {
    await http.Post("/menu", values);
  },
  onUpdate: async (id, values) => {
    await http.Put(`/menu/${id}`, values);
  },
  onDelete: async (record) => {
    await http.Delete(`/menu/${record.menuId}`);
  },
  messages: {
    createSuccess: "菜单创建成功",
    updateSuccess: "菜单更新成功",
    deleteSuccess: "菜单删除成功",
  },
});

// ========== 新增子菜单 ==========
async function handleAddChild(record: MenuRecord) {
  await handleAdd({ parentId: record.menuId });
}

// ========== 图标选择 ==========
function handleIconSelect(icon: string) {
  formMethods.setFieldsValue({ icon });
}

// ========== 权限抽屉 ==========
const currentPermissionRecord = ref<MenuRecord>();
const [permissionDrawerRegister, permissionDrawerMethods] = useDrawer();

async function handleAddPermission(record: MenuRecord) {
  currentPermissionRecord.value = record;
  await permissionDrawerMethods.openDrawer();
}

async function handlePermissionOk() {
  permissionDrawerMethods.closeDrawer();
  tableMethods.value?.reload();
}
async function handleToggleStatus(record: MenuRecord) {
  try {
    const newStatus = record.status === "1" ? "0" : "1";
    await changeMenuStatus(record.menuId, newStatus);
    message.success(`已${newStatus === "0" ? "停用" : "启用"}：${record.menuName}`);
    tableMethods.value?.reload();
  } catch (e: any) {
    message.error(e?.message || "操作失败");
  }
}
// ========== 操作项 ==========
function getActions(record: MenuRecord): ActionItem[] {
  return getMenuActions(record, {
    onAddChild: handleAddChild,
    onAddPermission: handleAddPermission,
    onEdit: handleEdit,
    onDelete: handleDelete,
  });
}
</script>

<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName">
      <BasicTable
        :show-index-column="false"
        :columns="menuColumns"
        :api="fetchMenuTree"
        :immediate="true"
        :use-search-form="false"
        :is-tree="true"
        children-column-name="children"
        :pagination="false"
        :action-column="menuActionColumn"
        :row-key="menuRowKey"
        virtual
        :scroll="menuScroll"
        default-expand-all-rows
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="handleAdd()">
            <template #icon><Icon icon="ant-design:plus-outlined" /></template>
            新增菜单
          </a-button>
        </template>

        <template #cell-icon="{ record }">
          <div class="flex items-center justify-center">
            <Icon v-if="record.icon" :icon="record.icon" class="text-lg" />
            <span v-else>-</span>
          </div>
        </template>

        <template #cell-menuType="{ record }">
          <a-tag :color="MENU_TYPE_COLOR_MAP[record.menuType as 1 | 2 | 3] || 'default'">
            <span :class="tagClassName">
              <Icon :icon="MENU_TYPE_ICON_MAP[record.menuType as 1 | 2 | 3] || 'carbon:link'" />
              {{ MENU_TYPE_LABEL_MAP[record.menuType as 1 | 2 | 3] || record.menuType }}
            </span>
          </a-tag>
        </template>

        <template #cell-status="{ record }">
          <a-switch
            :checked="record.status"
            checked-value="1"
            un-checked-value="0"
            @change="handleToggleStatus(record as MenuRecord)"
          ></a-switch>
        </template>

        <template #action="{ record }">
          <TableAction :actions="getActions(record as MenuRecord)" />
        </template>
      </BasicTable>
    </a-card>

    <!-- 菜单编辑抽屉 -->
    <BasicDrawer
      :title="isEditing ? '编辑菜单' : '新增菜单'"
      :width="640"
      @register="drawerRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="drawerFormSchemas"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      >
        <template #iconPicker="{ model, field }">
          <IconPicker
            :model-value="model[field] || ''"
            @update:model-value="(val: string) => formMethods.setFieldsValue({ [field]: val })"
            @select="handleIconSelect"
          />
        </template>
      </BasicForm>
    </BasicDrawer>

    <!-- 权限按钮抽屉 -->
    <BasicDrawer
      title="权限按钮"
      :width="640"
      @register="permissionDrawerRegister"
      @ok="handlePermissionOk"
    >
      <PermissionDrawer
        :menu="currentPermissionRecord"
        :visible="permissionDrawerMethods.getVisible()"
      />
    </BasicDrawer>
  </div>
</template>
