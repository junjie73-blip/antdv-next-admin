<script setup lang="ts">
import type { FormSchema } from "@/components/business/Form";
import type { ActionItem, BasicColumn } from "@/components/business/Table";
import { Icon } from "@iconify/vue";
import { computed, onMounted, ref } from "vue";
import * as XLSX from "xlsx";
import {
  addUser,
  deleteUser,
  batchDeleteUser,
  getDeptTree,
  getUserList,
  getUserOptions,
  updateUser,
} from "@/api/system";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, useTable, TableAction } from "@/components/business/Table";
import { DictType } from "@/enums/dict";
import { useDictStore } from "@/stores";
import { cn } from "@/utils/cn";
import { usePrint } from "@/utils/print";
import { useCRUD } from "@/composables/useCRUD";
import { message } from "antdv-next";

defineOptions({ name: "SystemUser" });

// ========== 类型定义（与后端返回字段一致） ==========
interface UserRecord {
  userId: string;
  username: string;
  realName: string;
  email: string;
  phone: string;
  deptId?: string;
  deptName?: string;
  roleIds?: string[];
  roles?: any[];
  status: string;
  sortOrder?: number;
  createdAt: string;
}

interface DeptTreeNode {
  deptId: string;
  deptName: string;
  children?: DeptTreeNode[];
}

// ========== 样式 ==========
const containerClassName = cn("flex gap-4");
const leftPanelClassName = cn("w-[240px] shrink-0");
const rightPanelClassName = cn("flex-1 min-w-0");
const cardClassName = cn("shadow-sm");
const treeCardClassName = cn("shadow-sm h-full");
const statusTagClassName = cn("inline-flex items-center gap-1");
const actionClassName = cn("flex", "items-center", "justify-center");
const btnClassName = cn("!px-0.5");
const dividerClassName = cn("mx-0");

// ========== 状态映射 ==========
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));
const statusColorMap: Record<string, string> = { "1": "green", "0": "red" };
const statusLabelMap: Record<string, string> = { "1": "正常", "0": "禁用" };

// ========== 基础数据 ==========
const deptTreeData = ref<DeptTreeNode[]>([]);
const roleOptions = ref<{ label: string; value: string }[]>([]);
const allDeptNodes = ref<{ deptId: string; deptName: string }[]>([]);

// 转换部门树节点
function convertDeptTree(nodes: any[]): DeptTreeNode[] {
  return nodes.map((node) => {
    const item: DeptTreeNode = {
      deptId: node.deptId,
      deptName: node.deptName,
    };
    if (node.children?.length) {
      item.children = convertDeptTree(node.children);
    }
    return item;
  });
}

// 扁平化部门树
function flattenDeptTree(nodes: DeptTreeNode[]): { deptId: string; deptName: string }[] {
  const result: { deptId: string; deptName: string }[] = [];
  function walk(items: DeptTreeNode[]) {
    for (const item of items) {
      result.push({ deptId: item.deptId, deptName: item.deptName });
      if (item.children?.length) walk(item.children);
    }
  }
  walk(nodes);
  return result;
}

// 加载部门树和角色选项
async function loadBaseData() {
  try {
    const [deptRes, optionRes] = await Promise.all([getDeptTree(), getUserOptions()]);
    const deptData = Array.isArray(deptRes) ? deptRes : (deptRes?.data ?? deptRes ?? []);
    const optData = Array.isArray(optionRes) ? optionRes : (optionRes?.data ?? optionRes ?? []);
    deptTreeData.value = convertDeptTree(deptData);
    allDeptNodes.value = flattenDeptTree(deptTreeData.value);
    roleOptions.value = optData.map((item: any) => ({
      label: item.label,
      value: item.value,
    }));
  } catch (e) {
    console.error("加载基础数据失败", e);
    message.error("加载部门/角色选项失败");
  }
}

onMounted(() => {
  loadBaseData();
});

// ========== 选中部门 ==========
const selectedDeptId = ref<string>("");
const treeExpandedKeys = ref<string[]>([]);

function handleDeptSelect(_selectedKeys: (string | number)[], info: { node: { deptId: string } }) {
  const clickedId = info.node.deptId;
  if (selectedDeptId.value === clickedId) {
    // 再次点击已选中的节点，取消选中
    selectedDeptId.value = "";
  } else {
    selectedDeptId.value = clickedId;
  }
  // 刷新用户列表
  tableMethods.value?.reload();
}

// ========== 表格/表单/弹窗注册 ==========
const [modalRegister, modalMethods] = useModal();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

// ========== 搜索表单 ==========
const searchFormSchemas: FormSchema[] = [
  {
    field: "keyword",
    label: "关键词",
    component: "Input",
    componentProps: { placeholder: "搜索用户名/真实姓名/邮箱/手机号...", allowClear: true },
    colProps: { span: 6 },
  },
  {
    field: "status",
    label: "状态",
    component: "Select",
    defaultValue: "1",
    componentProps: { placeholder: "选择状态", allowClear: true, options: statusOptions.value },
    colProps: { span: 6 },
  },
];

// ========== 编辑表单 ==========
const modalFormSchemas = computed<FormSchema[]>(() => [
  {
    field: "username",
    label: "用户名",
    component: "Input",
    required: true,
    componentProps: { placeholder: "请输入用户名" },
  },
  {
    field: "realName",
    label: "真实姓名",
    component: "Input",
    required: true,
    componentProps: { placeholder: "请输入真实姓名" },
  },
  {
    field: "password",
    label: "密码",
    component: "InputPassword",
    ifShow: () => !isEditing.value,
    componentProps: { placeholder: "留空则不修改密码" },
  },
  {
    field: "phone",
    label: "手机号",
    component: "Input",
    componentProps: { placeholder: "请输入手机号" },
  },
  {
    field: "email",
    label: "邮箱",
    component: "Input",
    componentProps: { placeholder: "请输入邮箱地址" },
  },
  {
    field: "deptIds",
    label: "部门",
    component: "ATreeSelect",
    componentProps: {
      fieldNames: { children: "children", label: "deptName", value: "deptId" },
      placeholder: "请选择部门",
      treeDefaultExpandAll: true,
      api: "/dept/tree",
    },
  },
  {
    field: "roleIds",
    label: "角色",
    component: "ASelect",
    componentProps: {
      api: "/user/options",
      placeholder: "请选择角色",
      mode: "multiple", // 支持多角色
    },
  },
  {
    field: "sortOrder",
    label: "排序号",
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
]);

// ========== 使用 useCRUD ==========
const {
  isEditing,
  currentRecord,
  handleAdd,
  handleEdit,
  handleDelete,
  handleBatchDelete,
  handleSave,
} = useCRUD<UserRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "userId",
  confirmDelete: true,
  getEmptyValues: () => ({
    username: "",
    realName: "",
    password: "",
    email: "",
    phone: "",
    deptIds: [],
    roleIds: [],
    sortOrder: 0,
    status: "1",
  }),
  getFormValues: (record) => ({
    username: record.username,
    realName: record.realName,
    password: "",
    email: record.email,
    phone: record.phone,
    deptIds: record.deptId ? [record.deptId] : [], // 如果只支持单部门可调整
    roleIds: record.roles?.map((r) => r.roleId) || [],
    sortOrder: record.sortOrder ?? 0,
    status: record.status,
  }),
  onCreate: async (values) => {
    await addUser(values);
  },
  onUpdate: async (id, values) => {
    await updateUser(id, values);
  },
  onDelete: async (record) => {
    await deleteUser(record.userId);
  },
  onBatchDelete: async (records) => {
    await batchDeleteUser(records.map((r) => r.userId));
  },
  onSaved: async () => {
    tableMethods.value?.reload();
  },
  onDeleted: async () => {
    tableMethods.value?.reload();
  },
  messages: {
    createSuccess: "用户创建成功",
    updateSuccess: "用户更新成功",
    deleteSuccess: "用户删除成功",
    batchDeleteSuccess: "批量删除成功",
    deleteConfirm: "确定要删除该用户吗？",
    batchDeleteConfirm: "确定要删除选中的用户吗？",
  },
});

// ========== 表格数据加载 ==========
async function mockApi(params: Record<string, any>) {
  const requestParams = {
    ...params,
    deptId: selectedDeptId.value || undefined,
  };
  return await getUserList(requestParams);
}

// ========== 列定义 ==========
const columns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "用户名", dataIndex: "username", key: "username", width: 120, align: "center" },
  { title: "真实姓名", dataIndex: "realName", key: "realName", width: 120, align: "center" },
  { title: "邮箱", dataIndex: "email", key: "email", width: 200, ellipsis: true },
  { title: "手机号", dataIndex: "phone", key: "phone", width: 140, align: "center" },
  { title: "部门", dataIndex: "deptName", key: "deptName", width: 140, align: "center" },
  { title: "角色", dataIndex: "roles", key: "roles", width: 160, align: "center" },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 170, align: "center" },
];

// ========== 导出 ==========
function handleExport() {
  const selectedRows = tableMethods.value?.getSelectRows?.() || [];
  if (selectedRows.length === 0) {
    message.warning("请先选择要导出的用户");
    return;
  }
  const headers = ["用户名", "真实姓名", "邮箱", "手机号", "部门", "角色", "状态"];
  const rows = selectedRows.map((i: UserRecord) => [
    i.username,
    i.realName,
    i.email,
    i.phone,
    i.deptName || "",
    (i.roleNames || []).join(","),
    i.status === "1" ? "正常" : "禁用",
  ]);
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "用户列表");
  XLSX.writeFile(wb, `用户列表_${new Date().toISOString().slice(0, 10)}.xlsx`);
  message.success(`成功导出 ${selectedRows.length} 条数据`);
}

// ========== 打印 ==========
function handlePrint() {
  usePrint({ title: "用户列表", target: ".ant-card-body" });
}
const getActions = (record: any): ActionItem[] => {
  return [
    {
      icon: "ant-design:edit-outlined",
      label: "编辑",
      onClick: () => handleEdit(record),
    },
    {
      icon: "ant-design:delete-outlined",
      label: "删除",
      danger: true,
      popConfirm: {
        title: "删除用户",
        content: `确定删除「${record.username}」吗？`,
        confirm: () => handleDelete(record),
      },
    },
  ];
};
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧部门树 -->
    <div :class="leftPanelClassName">
      <a-card :class="treeCardClassName" title="部门列表" size="small">
        <a-tree
          :tree-data="deptTreeData"
          :field-names="{ children: 'children', title: 'deptName', key: 'deptId' }"
          :expanded-keys="treeExpandedKeys"
          :default-selected-keys="selectedDeptId ? [selectedDeptId] : []"
          block-node
          @select="handleDeptSelect"
          @update:expandedKeys="
            (keys: string[]) => {
              treeExpandedKeys = keys;
            }
          "
        />
      </a-card>
    </div>

    <!-- 右侧用户列表 -->
    <div :class="rightPanelClassName">
      <a-card title="用户管理" :class="cardClassName">
        <BasicTable
          :columns="columns"
          :api="mockApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
          :action-column="{ width: 260, title: '操作', fixed: 'right' }"
          :row-selection="{ type: 'checkbox' }"
          :pagination="{ showSizeChanger: true, pageSizeOptions: ['10', '20', '50'] }"
          :scroll="{ x: 1400 }"
          :row-key="(record) => record.userId"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button type="primary" @click="() => handleAdd()">
              <template #icon><Icon icon="ant-design:plus-outlined" /></template>
              新增用户
            </a-button>
            <a-button @click="handleExport">
              <template #icon><Icon icon="carbon:export" /></template>
              导出
            </a-button>
            <a-button @click="handlePrint">
              <template #icon><Icon icon="carbon:printer" /></template>
              打印
            </a-button>
            <a-button danger @click="() => handleBatchDelete()">
              <template #icon><Icon icon="ant-design:delete-outlined" /></template>
              批量删除
            </a-button>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="statusColorMap[record.status] || 'default'">
              <span :class="statusTagClassName">
                <Icon
                  :icon="
                    record.status === '1' ? 'carbon:checkmark-outline' : 'carbon:close-outline'
                  "
                />
                {{ statusLabelMap[record.status] || "未知" }}
              </span>
            </a-tag>
          </template>
          <template #cell-roles="{ record }">
            {{ record.roles?.map((r) => r.roleName || "-").join(",") || "-" }}
          </template>

          <template #action="{ record }">
            <table-action :actions="getActions(record)"></table-action>
          </template>
        </BasicTable>
      </a-card>
    </div>

    <!-- 新增/编辑弹窗 -->
    <BasicModal
      :title="isEditing ? '编辑用户' : '新增用户'"
      :width="640"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="modalFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>
  </div>
</template>
