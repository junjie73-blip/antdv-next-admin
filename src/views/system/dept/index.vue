<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import { computed, onMounted, ref } from "vue";

import { getDeptActions } from "./actions";
import { deptActionColumn, deptColumns, deptRowKey, deptScroll } from "./columns";
import DeptUserDrawer from "./components/DeptUserDrawer.vue";

import {
  cardBodyClassName,
  cardClassName,
  cardHeaderClassName,
  cardTitleBarClassName,
  cardTitleClassName,
  containerClassName,
  DEPT_STATUS_COLOR_MAP,
  DEPT_STATUS_ICON_MAP,
  DEPT_STATUS_LABEL_MAP,
  deptSearchClassName,
  leftPanelClassName,
  rightPanelClassName,
  statusTagClassName,
  toolbarClassName,
  treeNodeClassName,
  treeNodeIconClassName,
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

defineOptions({ name: "SystemDept" });

/* ============================================================
 * 字典
 * ============================================================ */
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

/* ============================================================
 * 状态
 * ============================================================ */
const allData = ref<DeptRecord[]>([]);
const deptTreeData = ref<DeptTreeNode[]>([]);
const selectedDeptId = ref<string | undefined>(undefined);
const treeExpandedKeys = ref<string[]>([]);
const loading = ref(false);
const deptUserOpen = ref(false);
const deptUserRecord = ref<DeptRecord | null>(null);

/** 部门树搜索 */
const deptKeyword = ref("");

/** 过滤后的部门树 */
const filteredTreeData = computed(() => {
  if (!deptKeyword.value.trim()) return deptTreeData.value;
  const kw = deptKeyword.value.toLowerCase();

  function filter(nodes: DeptTreeNode[]): DeptTreeNode[] {
    const result: DeptTreeNode[] = [];
    for (const node of nodes) {
      const children = node.children ? filter(node.children) : [];
      const matched = node.deptName.toLowerCase().includes(kw);
      if (matched || children.length > 0) {
        result.push({
          ...node,
          children: children.length ? children : undefined,
        });
      }
    }
    return result;
  }
  return filter(deptTreeData.value);
});

/* ============================================================
 * 注册实例
 * ============================================================ */
const [modalRegister, modalMethods] = useModal();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

/* ============================================================
 * Schema
 * ============================================================ */
const deptFormSchemas = useDeptFormSchemas(
  computed(() => deptTreeData.value),
  statusOptions,
);

/* ============================================================
 * 初始化部门树
 * ============================================================ */
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

/* ============================================================
 * 表格 API
 * ============================================================ */
async function fetchDeptList(params: any) {
  return await getDeptList({ ...params, parentId: selectedDeptId.value });
}

/* ============================================================
 * CRUD
 * ============================================================ */
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

/* ============================================================
 * 事件
 * ============================================================ */
function handleDeptSelect(_keys: (string | number)[], info: { node: { deptId: string } }) {
  const clicked = info.node.deptId;
  // 再次点击取消选中
  selectedDeptId.value = selectedDeptId.value === clicked ? undefined : clicked;
  tableMethods.value?.reload();
}

function clearDeptFilter() {
  selectedDeptId.value = undefined;
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

/** 手动刷新 */
function handleRefresh() {
  void initDeptTree();
  tableMethods.value?.reload();
}

/* ============================================================
 * 操作项
 * ============================================================ */
function getActions(record: DeptRecord) {
  return getDeptActions(record, {
    onAddChild: handleAddChild,
    onEdit: handleEdit,
    onDelete: handleDelete,
    onAssignUsers: handleAssignUsers,
  });
}

/* ============================================================
 * 初始化
 * ============================================================ */
onMounted(() => {
  void initDeptTree();
});
</script>

<template>
  <div :class="containerClassName">
    <!-- ============================================================ -->
    <!-- 左：部门架构                                                   -->
    <!-- ============================================================ -->
    <aside :class="leftPanelClassName">
      <div :class="cardClassName">
        <!-- 头部 -->
        <div :class="cardHeaderClassName">
          <div :class="cardTitleClassName">
            <span :class="cardTitleBarClassName" />
            <span>部门架构</span>
            <span
              class="rounded-full bg-gray-100 px-1.5 text-[10px] font-normal text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            >
              {{ allData.length }}
            </span>
          </div>

          <div class="flex items-center gap-0.5">
            <button
              v-if="selectedDeptId"
              type="button"
              class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title="清除筛选"
              @click="clearDeptFilter"
            >
              <Icon icon="carbon:filter-remove" />
            </button>

            <button
              type="button"
              class="rounded p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
              title="刷新"
              @click="handleRefresh"
            >
              <Icon icon="carbon:renew" />
            </button>
          </div>
        </div>

        <!-- 搜索 -->
        <div :class="deptSearchClassName">
          <a-input v-model:value="deptKeyword" placeholder="搜索部门名称" allow-clear size="small">
            <template #prefix>
              <Icon icon="carbon:search" class="text-gray-400" />
            </template>
          </a-input>
        </div>

        <!-- 树 -->
        <div :class="cardBodyClassName" class="p-3">
          <a-spin :spinning="loading">
            <!-- 空态 -->
            <div
              v-if="filteredTreeData.length === 0"
              class="flex flex-col items-center gap-2 py-10 text-gray-400 dark:text-gray-500"
            >
              <Icon icon="carbon:tree-view" class="text-3xl opacity-40" />
              <span class="text-xs">
                {{ deptKeyword ? "未匹配到部门" : "暂无部门" }}
              </span>
            </div>

            <!-- 树 -->
            <a-tree
              v-else
              :tree-data="filteredTreeData"
              :field-names="{ children: 'children', title: 'deptName', key: 'deptId' }"
              :expanded-keys="treeExpandedKeys"
              :selected-keys="selectedDeptId ? [selectedDeptId] : []"
              block-node
              @select="handleDeptSelect"
              @update:expanded-keys="(keys: string[]) => (treeExpandedKeys = keys)"
            >
              <template #title="{ deptName, deptId }">
                <span :class="treeNodeClassName(selectedDeptId === deptId)">
                  <Icon
                    icon="carbon:folder"
                    :class="treeNodeIconClassName(selectedDeptId === deptId)"
                  />
                  <span class="truncate">{{ deptName }}</span>
                </span>
              </template>
            </a-tree>
          </a-spin>
        </div>
      </div>
    </aside>

    <!-- ============================================================ -->
    <!-- 右：部门列表                                                   -->
    <!-- ============================================================ -->
    <section :class="rightPanelClassName">
      <div :class="cardClassName">
        <!-- 头部 -->
        <div :class="cardHeaderClassName">
          <div :class="cardTitleClassName">
            <span :class="cardTitleBarClassName" />
            <span>部门列表</span>
            <span
              v-if="selectedDeptId"
              class="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-normal text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
            >
              已筛选子部门
            </span>
          </div>
        </div>

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
          size="small"
          class="p-4"
          @register="tableRegister"
        >
          <template #toolbar>
            <div :class="toolbarClassName" class="!p-0">
              <a-button type="primary" @click="handleAdd()">
                <template #icon>
                  <Icon icon="ant-design:plus-outlined" />
                </template>
                新增部门
              </a-button>

              <a-button @click="handleRefresh">
                <template #icon><Icon icon="carbon:renew" /></template>
                刷新
              </a-button>
            </div>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="DEPT_STATUS_COLOR_MAP[record.status] || 'default'" class="!m-0">
              <span :class="statusTagClassName">
                <Icon
                  :icon="DEPT_STATUS_ICON_MAP[record.status] || 'carbon:help'"
                  class="text-xs"
                />
                {{ DEPT_STATUS_LABEL_MAP[record.status] || "未知" }}
              </span>
            </a-tag>
          </template>

          <template #action="{ record }">
            <TableAction :actions="getActions(record as DeptRecord)" :record="record" />
          </template>
        </BasicTable>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- 新增/编辑弹窗                                                  -->
    <!-- ============================================================ -->
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

    <!-- 分配用户抽屉 -->
    <DeptUserDrawer v-model:open="deptUserOpen" :dept="deptUserRecord" @saved="handleUsersSaved" />
  </div>
</template>
