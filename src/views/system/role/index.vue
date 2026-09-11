<script setup lang="ts">
import type { FormSchema } from "@/components/business/Form";
import type { ActionItem, BasicColumn, TableAction } from "@/components/business/Table";
import { Icon } from "@iconify/vue";
import { computed, onMounted, ref } from "vue";
import { addRole, deleteRole, getRoleList, updateRole } from "@/api/system";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicTable, useTable } from "@/components/business/Table";
import { DictType } from "@/enums/dict";
import { useDictStore } from "@/stores";
import { cn } from "@/utils/cn";
import { exportToExcel } from "@/utils/excel";
import { message } from "antdv-next";
import { http } from "@/utils";
import { useCRUD } from "@/composables/useCRUD";

defineOptions({ name: "SystemRole" });

interface RoleRecord {
  roleId: string;
  roleName: string;
  roleCode: string;
  description: string;
  sortOrder: number;
  status: string;
  menuIds: string[];
  createdAt: string;
}

const containerClassName = cn("space-y-4");
const cardClassName = cn("shadow-sm");
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

const permissionTreeData = ref<any[]>([]);

const [drawerRegister, drawerMethods] = useDrawer();
const [permDrawerRegister, permDrawerMethods] = useDrawer();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

const searchFormSchemas: FormSchema[] = [
  {
    field: "keyword",
    label: "关键词",
    component: "Input",
    colProps: { span: 6 },
    componentProps: {
      placeholder: "搜索角色名称/编码...",
      allowClear: true,
    },
  },
  {
    field: "status",
    label: "状态",
    component: "Select",
    defaultValue: "1",
    colProps: { span: 6 },
    componentProps: {
      placeholder: "选择状态",
      allowClear: true,
      options: statusOptions.value,
    },
  },
];

const drawerFormSchemas: FormSchema[] = [
  {
    field: "roleName",
    label: "角色名称",
    component: "Input",
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入角色名称" },
  },
  {
    field: "roleCode",
    label: "角色编码",
    component: "Input",
    required: true,
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入角色编码，如 admin" },
  },
  {
    field: "sortOrder",
    label: "排序",
    component: "InputNumber",
    colProps: { span: 12 },
    defaultValue: 0,
    componentProps: { min: 0, placeholder: "数字越小越靠前", style: { width: "100%" } },
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
    label: "描述",
    component: "InputTextArea",
    colProps: { span: 24 },
    componentProps: { placeholder: "请输入角色描述...", rows: 3 },
  },
];
const roleMenuTree = ref<any[]>([]);
// ========== 使用 useCRUD ==========
const { isEditing, currentRecord, handleAdd, handleEdit, handleDelete, handleSave } =
  useCRUD<RoleRecord>({
    containerType: "drawer",
    drawerMethods,
    formMethods,
    tableMethods,
    idKey: "roleId",
    getEmptyValues: () => ({
      roleName: "",
      roleCode: "",
      description: "",
      sortOrder: 0,
      status: "1",
    }),
    getFormValues: (record) => ({
      roleName: record.roleName,
      roleCode: record.roleCode,
      description: record.description,
      sortOrder: record.sortOrder,
      status: record.status,
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
      deleteConfirm: "确定要删除该角色吗？",
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
const permDrawerLoading = ref(false);
// ========== 权限分配 ==========
async function handlePermission(record: RoleRecord) {
  currentRecord.value = record;
  permDrawerLoading.value = true;
  try {
    await permDrawerMethods.openDrawer();
    // 调用接口获取该角色的菜单树（带 checked）
    const { data } = await http.Get(`/role/${record.roleId}/menus/tree`).send(true);
    currentRecord.value.menuIds = data as string[];
  } catch (e: any) {
    message.error(e?.message || "加载权限数据失败");
  } finally {
    permDrawerLoading.value = false;
  }
}

async function handleSavePermissions() {
  if (!currentRecord.value) return;
  try {
    await http.Put(`/role/${currentRecord.value.roleId}/menus`, {
      menuIds: currentRecord.value.menuIds,
    });
    message.success("权限更新成功");
    permDrawerMethods.closeDrawer();
    tableMethods.value?.reload();
  } catch (e: any) {
    message.error(e?.message || "权限更新失败");
  }
}

// ========== 导出 ==========
function handleExport() {
  const selectedRows = (tableMethods.value?.getSelectRows?.() || []) as any[];
  const dataToExport = selectedRows.length > 0 ? selectedRows : [];
  exportToExcel({
    filename: "角色列表",
    sheetName: "角色管理",
    columns: [
      { header: "ID", key: "roleId", width: 8 },
      { header: "角色名称", key: "roleName", width: 15 },
      { header: "角色编码", key: "roleCode", width: 18 },
      { header: "描述", key: "description", width: 30 },
      { header: "排序", key: "sortOrder", width: 8 },
      { header: "状态", key: "status", width: 8 },
      { header: "创建时间", key: "createdAt", width: 20 },
    ],
    data: dataToExport.map((i) => ({ ...i, status: i.status === "1" ? "正常" : "停用" })),
  });
}

// ========== 加载菜单树 ==========
onMounted(async () => {
  try {
    const res = await http.Get("/menu/tree").send(true);
    permissionTreeData.value = res.data;
  } catch (e) {
    console.error("加载菜单树失败", e);
  }
});

const columns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "角色名称", dataIndex: "roleName", key: "roleName", width: 140 },
  { title: "角色编码", dataIndex: "roleCode", key: "roleCode", width: 150 },
  { title: "描述", dataIndex: "description", key: "description", ellipsis: true, width: 300 },
  { title: "排序", dataIndex: "sortOrder", key: "sortOrder", width: 70, align: "center" },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 170 },
];
const getActions = (record: any): ActionItem[] => {
  return [
    {
      label: "编辑",
      onClick: () => handleEdit(record),
    },
    {
      label: "删除",
      danger: true,
      popConfirm: {
        title: "确定要删除该角色吗？",
        confirm: () => handleDelete(record),
      },
    },
  ];
};
</script>

<template>
  <div :class="containerClassName">
    <a-card title="角色管理" :class="cardClassName">
      <BasicTable
        :columns="columns"
        :api="getRoleList"
        :immediate="true"
        :use-search-form="true"
        :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
        :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
        :action-column="{ width: 280, title: '操作', fixed: 'right' }"
        :row-key="(record) => record.roleId"
        :row-selection="{ type: 'checkbox' }"
        @register="tableRegister"
      >
        <template #toolbar>
          <a-button @click="handleExport">
            <template #icon><Icon icon="carbon:export" /></template>
            导出
          </a-button>
          <a-button type="primary" @click="() => handleAdd()">
            <template #icon><Icon icon="ant-design:plus-outlined" /></template>
            新增角色
          </a-button>
        </template>

        <template #cell-status="{ record }">
          <a-switch
            :checked="record.status"
            checked-value="1"
            un-checked-value="0"
            @change="handleToggleStatus(record)"
          />
        </template>

        <template #action="{ record }">
          <TableAction :actions="getActions(record)"></TableAction>
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
    <BasicDrawer
      :title="`权限分配 - ${currentRecord?.roleName || ''}`"
      :width="480"
      :loading="permDrawerLoading"
      @register="permDrawerRegister"
      @ok="handleSavePermissions"
    >
      <div class="space-y-4">
        <a-alert message="选择该角色可以访问的菜单和按钮权限" type="info" show-icon />
        <div class="text-sm text-gray-500 dark:text-gray-400">
          角色编码：<a-tag color="blue">{{ currentRecord?.roleCode }}</a-tag>
        </div>
        <div class="text-sm text-gray-500 dark:text-gray-400">
          角色描述：<span class="text-gray-700 dark:text-gray-300">{{
            currentRecord?.description
          }}</span>
        </div>

        <a-tree
          checkable
          default-expand-all
          :tree-data="permissionTreeData"
          :checked-keys="currentRecord?.menuIds || []"
          :field-names="{ title: 'menuName', key: 'menuId' }"
          @check="
            (checkedKeys: any) => {
              if (currentRecord) {
                currentRecord.menuIds = checkedKeys;
              }
            }
          "
        />
      </div>
    </BasicDrawer>
  </div>
</template>
