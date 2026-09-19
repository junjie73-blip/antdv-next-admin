<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import { computed, onMounted, ref } from "vue";

import { getDeptActions } from "./actions";
import { deptActionColumn, deptColumns, deptRowKey, deptScroll } from "./columns";
import DeptUserDrawer from "./components/DeptUserDrawer.vue";

import {
  cardClassName,
  containerClassName,
  DEPT_STATUS_COLOR_MAP,
  DEPT_STATUS_ICON_MAP,
  DEPT_STATUS_LABEL_MAP,
  leftPanelClassName,
  rightPanelClassName,
  statusTagClassName,
  treeCardClassName,
} from "./constants";

import { deptSearchSchemas, useDeptFormSchemas } from "./schemas";
import { convertToTreeNode } from "./utils";

import type { DeptRecord, DeptTreeNode } from "./types";

import { addDept, deleteDept, getDeptList, getDeptTree, updateDept } from "~/api";
import { BasicForm, useForm } from "~/components/business/Form";
import { BasicModal, useModal } from "~/components/business/Modal";
import { BasicTable, TableAction, useTable } from "~/components/business/Table";
import { useCRUD } from "~/composables/useCRUD";
import { DictType } from "~/enums/dict";
import { useDictStore } from "~/stores";

// 抽离的模块

defineOptions({ name: "SystemDept" });

// ========== 字典 ==========
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

// ========== 状态 ==========
const allData = ref<DeptRecord[]>([]);
const deptTreeData = ref<DeptTreeNode[]>([]);
const selectedDeptId = ref<string | undefined>(undefined);
const treeExpandedKeys = ref<string[]>([]);
const loading = ref(false);
const deptUserOpen = ref(false);
const deptUserRecord = ref<DeptRecord | null>(null);
// ========== 注册实例 ==========
const [modalRegister, modalMethods] = useModal();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

// ========== Schema ==========
const deptFormSchemas = useDeptFormSchemas(
  computed(() => deptTreeData.value),
  statusOptions,
);

// ========== 初始化部门树 ==========
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

// ========== 表格 API ==========
async function fetchDeptList(params: Record<string, any>) {
  return await getDeptList({ ...params, parentId: selectedDeptId.value });
}

// ========== useCRUD ==========
const { isEditing, handleAdd, handleEdit, handleDelete, handleSave } = useCRUD<DeptRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "deptId",
  getEmptyValues: () => ({
    parentId: selectedDeptId.value ?? null,
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
    await initDeptTree();
  },
  onDeleted: async () => {
    await initDeptTree();
  },
  messages: {
    createSuccess: "部门创建成功",
    updateSuccess: "部门更新成功",
    deleteSuccess: "部门删除成功",
  },
});

// ========== 事件 ==========
function handleDeptSelect(_selectedKeys: (string | number)[], info: { node: { deptId: string } }) {
  selectedDeptId.value = info.node.deptId;
  tableMethods.value?.reload();
}

function handleAddChild(record: DeptRecord) {
  handleAdd({ parentId: record.deptId });
}

function handleAssignUsers(record: DeptRecord) {
  deptUserRecord.value = record;
  deptUserOpen.value = true;
}

function handleUsersSaved() {
  tableMethods.value?.reload();
}
// ========== 操作项 ==========
function getActions(record: DeptRecord) {
  return getDeptActions(record, {
    onAddChild: handleAddChild,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onAssignUsers: handleAssignUsers,
  });
}

// ========== 初始化 ==========
onMounted(() => {
  initDeptTree();
});
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
            @update:expanded-keys="(keys: string[]) => (treeExpandedKeys = keys)"
          />
        </a-spin>
      </a-card>
    </div>

    <!-- 右侧部门列表 -->
    <div :class="rightPanelClassName">
      <a-card title="部门列表" :class="cardClassName">
        <BasicTable
          :columns="deptColumns"
          :api="fetchDeptList"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: deptSearchSchemas, labelWidth: 80 }"
          :is-tree="true"
          children-column-name="children"
          :pagination="false"
          :scroll="deptScroll"
          :action-column="deptActionColumn"
          :row-key="deptRowKey"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button type="primary" @click="handleAdd()">
              <template #icon><Icon icon="ant-design:plus-outlined" /></template>
              新增部门
            </a-button>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="DEPT_STATUS_COLOR_MAP[record.status] || 'default'">
              <span :class="statusTagClassName">
                <Icon :icon="DEPT_STATUS_ICON_MAP[record.status] || 'carbon:help'" />
                {{ DEPT_STATUS_LABEL_MAP[record.status] || "未知" }}
              </span>
            </a-tag>
          </template>

          <template #action="{ record }">
            <TableAction :actions="getActions(record as DeptRecord)" :record="record" />
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
        :schemas="deptFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 2, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>
    <DeptUserDrawer v-model:open="deptUserOpen" :dept="deptUserRecord" @saved="handleUsersSaved" />
  </div>
</template>
