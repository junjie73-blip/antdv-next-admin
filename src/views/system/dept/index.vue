<script setup lang="ts">
import type { FormSchema } from "@/components/business/Form";
import type { BasicColumn } from "@/components/business/Table";
import { Icon } from "@iconify/vue";
import { computed, onMounted, ref } from "vue";
import { addDept, deleteDept, getDeptList, getDeptTree, updateDept } from "@/api/system";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, useTable } from "@/components/business/Table";
import { DictType } from "@/enums/dict";
import { useDictStore } from "@/stores";
import { cn } from "@/utils/cn";
import { useCRUD } from "@/composables/useCRUD";
import { message } from "antdv-next";

defineOptions({ name: "SystemDept" });

// ========== 类型定义 ==========
interface DeptRecord {
  deptId: string; // 主键
  parentId: string | null;
  deptCode: string;
  deptName: string;
  leader?: string;
  phone?: string;
  email?: string;
  sortOrder: number;
  status: string; // '0' | '1'
  createdAt: string;
  children?: DeptRecord[];
  userCount?: number; // 可选，需后端支持
}

interface DeptTreeNode {
  deptId: string;
  deptName: string;
  children?: DeptTreeNode[];
}

// ========== 样式类名 ==========
const containerClassName = cn("flex gap-4");
const leftPanelClassName = cn("w-[280px] shrink-0");
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

const statusColorMap: Record<number, string> = { 1: "green", 0: "red" };
const statusLabelMap: Record<number, string> = { 1: "正常", 0: "停用" };

// ========== 数据状态 ==========
const allData = ref<DeptRecord[]>([]);
const deptTreeData = ref<DeptTreeNode[]>([]);
const selectedDeptId = ref<string | undefined>(undefined); // 默认选中根节点
const treeExpandedKeys = ref<string[]>([]);

// 将 DeptRecord 转换为树节点格式
function convertToTreeNode(dept: DeptRecord): DeptTreeNode {
  const node: DeptTreeNode = { deptId: dept.deptId, deptName: dept.deptName };
  if (dept.children?.length) {
    node.children = dept.children.map(convertToTreeNode);
  }
  return node;
}

const loading = ref(false);
// 初始化部门树
async function initDeptTree() {
  loading.value = true;
  try {
    const res = await getDeptTree();
    allData.value = res;
    deptTreeData.value = res.map(convertToTreeNode);
  } catch (e) {
    console.error("获取部门树失败", e);
    message.error("获取部门树失败");
  } finally {
    loading.value = false;
  }
}
onMounted(() => {
  initDeptTree();
});

// ========== 表格/表单/弹窗注册 ==========
const [modalRegister, modalMethods] = useModal();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

// ========== 表单配置 ==========
function createSearchFormSchemas(): FormSchema[] {
  return [
    {
      field: "keyword",
      label: "部门名称",
      component: "Input",
      componentProps: { placeholder: "搜索部门名称...", allowClear: true },
      colProps: { span: 6 },
    },
  ];
}

function createModalFormSchemas(): FormSchema[] {
  return [
    {
      field: "parentId",
      label: "上级部门",
      component: "TreeSelect",
      componentProps: {
        treeData: deptTreeData.value,
        fieldNames: { children: "children", label: "deptName", value: "deptId" },
      },
    },
    {
      field: "deptName", // 改为 deptName
      label: "部门名称",
      component: "Input",
      required: true,
      componentProps: { placeholder: "请输入部门名称" },
    },
    {
      field: "deptCode", // 改为 deptCode
      label: "部门编码",
      component: "Input",
      required: true,
      componentProps: { placeholder: "请输入部门编码（唯一）" },
    },
    {
      field: "leader",
      label: "负责人",
      component: "Input",
      componentProps: { placeholder: "请输入负责人姓名" },
    },
    {
      field: "phone",
      label: "联系电话",
      component: "Input",
      componentProps: { placeholder: "请输入联系电话" },
    },
    {
      field: "email", // 新增 email 字段
      label: "邮箱",
      component: "Input",
      componentProps: { placeholder: "请输入邮箱" },
    },
    {
      field: "sortOrder",
      label: "排序号",
      component: "InputNumber",
      defaultValue: 0,
      colProps: { span: 12 },
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
    // 移除 remark 字段，数据库无此字段
  ];
}

const searchFormSchemas = createSearchFormSchemas();
const modalFormSchemas = computed(() => createModalFormSchemas());

// ========== 表格 API（本地过滤实现树形展示） ==========
async function mockApi(params: Record<string, any>) {
  return await getDeptList({ ...params, parentId: selectedDeptId.value });
}

// ========== 使用 useCRUD 管理右侧表格 CRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<DeptRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "id",
  confirmDelete: true,
  getEmptyValues: () => ({
    parentId: selectedDeptId.value,
    deptName: "",
    deptCode: "",
    leader: "",
    phone: "",
    email: "",
    sortOrder: 0,
    status: "1",
  }),
  getFormValues: (record) => ({
    parentId: record.parentId === null ? undefined : record.parentId,
    deptName: record.deptName,
    deptCode: record.deptCode,
    leader: record.leader,
    phone: record.phone,
    email: record.email,
    sortOrder: record.sortOrder,
    status: record.status,
  }),
  onCreate: async (values) => {
    await addDept(values);
  },
  onUpdate: async (id, values) => {
    await updateDept(id, values);
  },
  onDelete: async (record) => {
    await deleteDept(record.deptId);
  },
  onSaved: async () => {
    await initDeptTree(); // 操作成功后刷新树
  },
  onDeleted: async () => {
    await initDeptTree();
  },
  messages: {
    createSuccess: "部门创建成功",
    updateSuccess: "部门更新成功",
    deleteSuccess: "部门删除成功",
    deleteConfirm: "确定要删除该部门吗？子部门也将一并删除。",
  },
});

// ========== 自定义事件 ==========
function handleDeptSelect(_selectedKeys: (string | number)[], info: { node: { deptId: number } }) {
  selectedDeptId.value = info.node.deptId;
  tableMethods.value?.reload();
}

function handleAddChild(record: DeptRecord) {
  handleAdd({
    parentId: record.deptId,
  });
}

// ========== 表格列 ==========
const columns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "部门名称", dataIndex: "deptName", key: "deptName", width: 160 },
  { title: "部门编码", dataIndex: "deptCode", key: "deptCode", width: 200, align: "center" },
  { title: "负责人", dataIndex: "leader", key: "leader", width: 120, align: "center" },
  { title: "联系电话", dataIndex: "phone", key: "phone", width: 140, align: "center" },
  { title: "邮箱", dataIndex: "email", key: "email", width: 180, align: "center" }, // 新增邮箱列
  { title: "排序号", dataIndex: "sortOrder", key: "sortOrder", width: 80, align: "center" },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 170, align: "center" },
];
const getActions = (record: DeptRecord) => [
  {
    label: "新增子部门",
    icon: "ant-design:plus-outlined",
    onClick: () => handleAddChild(record),
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
      title: "删除部门",
      confirm: () => handleDelete(record),
    },
  },
];
</script>

<template>
  <div :class="containerClassName">
    <!-- 左侧部门树 -->
    <div :class="leftPanelClassName">
      <a-card :class="treeCardClassName" title="部门架构" size="small">
        <a-spin :spinning="loading">
          <a-tree
            :tree-data="deptTreeData"
            :field-names="{ children: 'children', title: 'deptName', key: 'deptId' }"
            :expanded-keys="treeExpandedKeys"
            :default-selected-keys="[selectedDeptId]"
            block-node
            @select="handleDeptSelect"
            @update:expandedKeys="
              (keys: number[]) => {
                treeExpandedKeys = keys;
              }
            "
        /></a-spin>
      </a-card>
    </div>

    <!-- 右侧部门列表 -->
    <div :class="rightPanelClassName">
      <a-card title="部门列表" :class="cardClassName">
        <BasicTable
          :columns="columns"
          :api="mockApi"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
          :is-tree="true"
          children-column-name="children"
          :pagination="false"
          :scroll="{ x: 1400 }"
          :action-column="{ width: 280, title: '操作', fixed: 'right' }"
          :row-key="(record) => record.id"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button type="primary" @click="() => handleAdd()">
              <template #icon><Icon icon="ant-design:plus-outlined" /></template>
              新增部门
            </a-button>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="statusColorMap[record.status] || 'default'">
              <span :class="statusTagClassName">
                <Icon
                  :icon="record.status === 1 ? 'carbon:checkmark-outline' : 'carbon:close-outline'"
                />
                {{ statusLabelMap[record.status] || "未知" }}
              </span>
            </a-tag>
          </template>

          <template #cell-userCount="{ record }">
            <a-badge :count="record.userCount" :number-style="{ backgroundColor: '#1677ff' }" />
          </template>

          <template #action="{ record }">
            <TableAction :actions="getActions(record)" :record="record"></TableAction>
          </template>
        </BasicTable>
      </a-card>
    </div>

    <!-- 新增/编辑弹窗 -->
    <BasicModal
      :title="isEditing ? '编辑部门' : '新增部门'"
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
