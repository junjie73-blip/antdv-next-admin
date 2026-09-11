<script setup lang="ts">
import type { FormSchema } from "@/components/business/Form";
import type { ActionItem, BasicColumn } from "@/components/business/Table";
import { Icon } from "@iconify/vue";
import { computed, ref } from "vue";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicTable, useTable } from "@/components/business/Table";
import IconPicker from "@/components/common/Icon/IconPicker.vue";
import { DictType } from "@/enums/dict";
import { useDictStore } from "@/stores";
import { http } from "@/utils";
import { cn } from "@/utils/cn";
import { useCRUD } from "@/composables/useCRUD";
import { message } from "antdv-next";
import PermissionDrawer from "./PermissionDrawer.vue";
defineOptions({ name: "SystemMenu" });

interface MenuRecord {
  menuId: string;
  menuName: string;
  icon: string;
  path: string;
  component: string;
  menuType: number;
  parentId: string | null;
  status: string;
  permission: string;
  sortOrder: number;
  children?: MenuRecord[];
}

// ========== 样式工具 ==========
const containerClassName = cn("space-y-4 h-full");
const cardClassName = cn("shadow-sm");
const tagClassName = cn("inline-flex items-center gap-1");
const actionClassName = cn("flex", "items-center", "justify-center");
const btnClassName = cn("!px-0.5");
const dividerClassName = cn("mx-0");

// ========== 枚举映射 ==========
const menuTypeColorMap: Record<string, string> = {
  1: "blue",
  2: "green",
  3: "orange",
};
const menuTypeLabelMap: Record<string, string> = {
  1: "目录",
  2: "菜单",
  3: "按钮",
};
const statusColorMap: Record<string, string> = {
  "1": "green",
  "0": "red",
};
const statusLabelMap: Record<string, string> = {
  "1": "正常",
  "0": "停用",
};

// ========== 字典 ==========
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

// ========== 表单 Schema ==========
const drawerFormSchemas: FormSchema[] = [
  {
    field: "menuType",
    label: "菜单类型",
    component: "RadioGroup",
    defaultValue: 1,
    componentProps: {
      optionType: "button",
      buttonStyle: "solid",
      options: [
        { label: "目录", value: 1 },
        { label: "菜单", value: 2 },
        { label: "按钮", value: 3 },
      ],
    },
  },
  {
    field: "parentId",
    label: "上级菜单",
    component: "ATreeSelect",
    componentProps: {
      api: "/menu/tree",
      placeholder: "请选择上级菜单（留空为顶级）",
      allowClear: true,
      treeDefaultExpandAll: true,
      fieldNames: {
        label: "menuName",
        value: "menuId",
        children: "children",
      },
    },
  },
  {
    field: "menuName",
    label: "菜单名称",
    component: "Input",
    required: true,
    componentProps: { placeholder: "请输入菜单名称" },
  },
  {
    field: "icon",
    label: "图标",
    component: "Input",
    slot: "iconPicker",
    componentProps: { placeholder: "点击选择图标", readonly: true },
    dynamicDisabled: ({ model }) => (model as any).menuType === 3,
  },
  {
    field: "path",
    label: "路由地址",
    component: "Input",
    componentProps: { placeholder: "例如：/system/user" },
    dynamicDisabled: ({ model }) => (model as any).menuType !== 2,
  },
  {
    field: "component",
    label: "组件路径",
    component: "Input",
    componentProps: { placeholder: "例如：system/user/index" },
    dynamicDisabled: ({ model }) => (model as any).menuType !== 2,
  },
  {
    field: "permission",
    label: "权限标识",
    component: "Input",
    componentProps: { placeholder: "例如：system:user:list" },
  },
  {
    field: "sortOrder",
    label: "排序",
    component: "InputNumber",
    componentProps: { min: 0, placeholder: "请输入排序号", style: { width: "100%" } },
  },
  {
    field: "status",
    label: "状态",
    component: "RadioGroup",
    defaultValue: "1",
    componentProps: () => ({
      optionType: "button",
      buttonStyle: "solid",
      options: statusOptions.value,
    }),
  },
];

// ========== 表格列 ==========
const columns: BasicColumn[] = [
  { title: "菜单名称", dataIndex: "menuName", key: "menuName", width: 200 },
  { title: "图标", dataIndex: "icon", key: "icon", width: 70, align: "center" },
  { title: "排序", dataIndex: "sortOrder", key: "sortOrder", width: 70, align: "center" },
  { title: "权限标识", dataIndex: "permission", key: "permission", width: 180, ellipsis: true },
  { title: "路由地址", dataIndex: "path", key: "path", width: 160, ellipsis: true },
  { title: "组件路径", dataIndex: "component", key: "component", width: 180, ellipsis: true },
  { title: "类型", dataIndex: "menuType", key: "menuType", width: 80, align: "center" },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 180, align: "center" },
];

// ========== 表格 API ==========
async function mockApi() {
  return await http.Get("/menu/tree").send(true);
}

// ========== 抽屉和表格注册 ==========
const [drawerRegister, drawerMethods] = useDrawer();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

// ========== 使用 useCRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<MenuRecord>({
  containerType: "drawer",
  drawerMethods,
  formMethods,
  tableMethods,
  idKey: "menuId",
  confirmDelete: true,
  getEmptyValues: () => ({
    parentId: undefined,
    menuType: 1,
    menuName: "",
    icon: "",
    path: "",
    component: "",
    permission: "",
    sortOrder: 0,
    status: "1",
  }),
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
  beforeSave: (values) => {
    if (!values.menuName) {
      message.warning("请填写菜单名称");
      return false;
    }
    if (values.menuType === 2 && (!values.path || !values.component)) {
      message.warning("菜单类型必须填写路由地址和组件路径");
      return false;
    }
    return true;
  },
  messages: {
    createSuccess: "菜单创建成功",
    updateSuccess: "菜单更新成功",
    deleteSuccess: "菜单删除成功",
    deleteConfirm: "确定要删除该菜单吗？",
  },
});

// ========== 新增子菜单 ==========
async function handleAddChild(record: MenuRecord) {
  // 在新增时预填父级 ID
  await handleAdd({ parentId: record.menuId });
}

// ========== 图标选择 ==========
function handleIconSelect(icon: string) {
  formMethods.setFieldsValue({ icon });
}
// ========== 权限按钮 ==========
const currentPermissionRecord = ref<MenuRecord>();
const [permissionDrawerRegister, permissionDrawerMethods] = useDrawer();
const handleAddPermission = async (record: MenuRecord) => {
  currentPermissionRecord.value = record;
  await permissionDrawerMethods.openDrawer();
};
const getActions = (record: any): ActionItem[] => {
  return [
    {
      label: "新增子菜单",
      icon: "ant-design:plus-outlined",
      disabled: record.menuType !== 1,
      onClick: () => handleAddChild(record),
    },
    {
      label: "新增权限",
      icon: "ant-design:plus-outlined",
      disabled: record.menuType !== 2,
      onClick: () => handleAddPermission(record),
    },
    {
      label: "编辑",
      icon: "ant-design:edit-outlined",
      onClick: () => handleEdit(record),
    },
    {
      label: "删除",
      icon: "ant-design:delete-outlined",
      danger: true,
      popConfirm: {
        title: "删除菜单",
        confirm: () => handleDelete(record),
      },
    },
  ];
};
</script>

<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName">
      <BasicTable
        :show-index-column="false"
        :columns="columns"
        :api="mockApi"
        :immediate="true"
        :use-search-form="false"
        :is-tree="true"
        children-column-name="children"
        :pagination="false"
        :action-column="{ width: 400, title: '操作', fixed: 'right' }"
        :row-key="(record) => record.menuId"
        virtual
        :scroll="{ y: 9999999 }"
        default-expand-all-rows
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button type="primary" @click="() => handleAdd()">
            <template #icon>
              <Icon icon="ant-design:plus-outlined" />
            </template>
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
          <a-tag :color="menuTypeColorMap[record.menuType] || 'default'">
            <span :class="tagClassName">
              <Icon
                :icon="
                  record.menuType === 1
                    ? 'carbon:folder'
                    : record.menuType === 2
                      ? 'carbon:document'
                      : record.menuType === 3
                        ? 'carbon:cu3'
                        : 'carbon:link'
                "
              />
              {{ menuTypeLabelMap[record.menuType] || record.menuType }}
            </span>
          </a-tag>
        </template>

        <template #cell-status="{ record }">
          <a-tag :color="statusColorMap[record.status] || 'default'">
            <span :class="tagClassName">
              <Icon
                :icon="record.status === '1' ? 'carbon:checkmark-outline' : 'carbon:close-outline'"
              />
              {{ statusLabelMap[record.status] || "未知" }}
            </span>
          </a-tag>
        </template>

        <template #action="{ record }">
          <table-action :actions="getActions(record)"></table-action>
        </template>
      </BasicTable>
    </a-card>

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
            @update:modelValue="(val: string) => formMethods.setFieldsValue({ [field]: val })"
            @select="handleIconSelect"
          />
        </template>
      </BasicForm>
    </BasicDrawer>
    <BasicDrawer
      title="权限按钮"
      :width="640"
      @register="permissionDrawerRegister"
      @ok="
        () => {
          permissionDrawerMethods.closeDrawer();
          tableMethods?.reload();
        }
      "
    >
      <PermissionDrawer
        :menu="currentPermissionRecord"
        :visible="permissionDrawerMethods.getVisible()"
      />
    </BasicDrawer>
  </div>
</template>
