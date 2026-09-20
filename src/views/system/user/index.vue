<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message, Modal } from "antdv-next";
import { computed, onMounted, ref } from "vue";

import { getUserActions } from "./actions";

import {
  USER_IMPORT_TEMPLATE,
  userActionColumn,
  userColumns,
  userPagination,
  userRowKey,
  userRowSelection,
  userScroll,
} from "./columns";

import {
  cardBodyClassName,
  cardClassName,
  cardHeaderClassName,
  cardTitleBarClassName,
  cardTitleClassName,
  containerClassName,
  deptSearchClassName,
  leftPanelClassName,
  rightPanelClassName,
  statusTagClassName,
  toolbarClassName,
  USER_STATUS_COLOR_MAP,
  USER_STATUS_ICON_MAP,
  USER_STATUS_LABEL_MAP,
} from "./constants";

import {
  USER_EMPTY_VALUES,
  userDetailSchema,
  useUserFormSchemas,
  useUserSearchSchemas,
} from "./schemas";

import { convertDeptTree, flattenDeptTree, getUserRoleNames, printUserList } from "./utils";

import type { DeptTreeNode, FlatDeptNode, RoleOption, UserRecord } from "./types";

import {
  addUser,
  batchDeleteUser,
  deleteUser,
  getDeptTree,
  getUserList,
  getUserOptions,
  getUserSensitive,
  resetUserPassword,
  updateUser,
} from "~/api";

import { BasicForm, useForm } from "~/components/business/Form";
import ImportExport from "~/components/business/ImportExport.vue";
import { BasicModal, useModal } from "~/components/business/Modal";
import { type ActionItem, BasicTable, TableAction, useTable } from "~/components/business/Table";
import { useCRUD } from "~/composables/useCRUD";
import { DictType } from "~/enums/dict";
import { useDictStore } from "~/stores";
import { http } from "~/utils";
import { cn } from "~/utils/cn";

defineOptions({ name: "SystemUser" });

/* ============================================================
 * 字典
 * ============================================================ */
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

/* ============================================================
 * 基础数据
 * ============================================================ */
const deptTreeData = ref<DeptTreeNode[]>([]);
const allDeptNodes = ref<FlatDeptNode[]>([]);
const roleOptions = ref<RoleOption[]>([]);
const uploadLoading = ref(false);

/** 部门树搜索关键词 */
const deptKeyword = ref("");
const deptSearchLoading = ref(false);

/** 过滤后的部门树（按关键词过滤，保留父链） */
const filteredDeptTree = computed(() => {
  if (!deptKeyword.value.trim()) return deptTreeData.value;
  const kw = deptKeyword.value.toLowerCase();

  function filter(nodes: DeptTreeNode[]): DeptTreeNode[] {
    const result: DeptTreeNode[] = [];
    for (const node of nodes) {
      const children = node.children ? filter(node.children) : [];
      const matched = node.deptName.toLowerCase().includes(kw);
      if (matched || children.length > 0) {
        result.push({ ...node, children: children.length ? children : undefined });
      }
    }
    return result;
  }

  return filter(deptTreeData.value);
});

async function loadBaseData() {
  deptSearchLoading.value = true;
  try {
    const [deptRes, optionRes] = await Promise.all<unknown[]>([getDeptTree(), getUserOptions()]);
    const deptData = Array.isArray(deptRes) ? deptRes : ((deptRes as any)?.data ?? deptRes ?? []);
    const optData = Array.isArray(optionRes)
      ? optionRes
      : ((optionRes as any)?.data ?? optionRes ?? []);

    deptTreeData.value = convertDeptTree(deptData);
    allDeptNodes.value = flattenDeptTree(deptTreeData.value);
    roleOptions.value = (optData as any[]).map((item) => ({
      label: item.label,
      value: item.value,
    }));
  } catch (e) {
    console.error("加载基础数据失败", e);
    message.error("加载部门/角色选项失败");
  } finally {
    deptSearchLoading.value = false;
  }
}

/* ============================================================
 * 部门选择
 * ============================================================ */
const selectedDeptId = ref<string>("");
const treeExpandedKeys = ref<string[]>([]);

function handleDeptSelect(_keys: (string | number)[], info: { node: any }) {
  const clickedId = info.node.deptId;
  selectedDeptId.value = selectedDeptId.value === clickedId ? "" : clickedId;
  tableMethods.value?.reload();
}

function clearDeptFilter() {
  selectedDeptId.value = "";
  tableMethods.value?.reload();
}

/* ============================================================
 * 实例
 * ============================================================ */
const [modalRegister, modalMethods] = useModal();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

/* ============================================================
 * Schema
 * ============================================================ */
const searchFormSchemas = useUserSearchSchemas(statusOptions);

/* ============================================================
 * CRUD
 * ============================================================ */
const {
  isEditing,
  handleAdd,
  handleEdit,
  handleDelete,
  handleSave,
  handleBatchDelete: crudBatchDelete,
} = useCRUD<UserRecord>({
  containerType: "modal",
  modalMethods,
  formMethods,
  tableMethods,
  idKey: "userId",
  getEmptyValues: () => ({ ...USER_EMPTY_VALUES }),
  getFormValues: (record) => ({
    username: record.username,
    realName: record.realName,
    password: "",
    email: record.email,
    phone: record.phone,
    deptIds: record.deptId ? [record.deptId] : [],
    roleIds: record.roles?.map((r) => r.roleId) || [],
    sortOrder: record.sortOrder ?? 0,
    status: record.status,
    gender: record.gender ?? 0,
    avatar: record.avatar ?? "",
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
  messages: {
    createSuccess: "用户创建成功",
    updateSuccess: "用户更新成功",
    deleteSuccess: "用户删除成功",
    batchDeleteSuccess: "批量删除成功",
  },
});
const modalFormSchemas = useUserFormSchemas(statusOptions, isEditing);

/* ============================================================
 * 列表数据
 * ============================================================ */
async function fetchUserList(params: any) {
  return await getUserList({
    ...params,
    deptId: selectedDeptId.value || undefined,
  });
}

/* ============================================================
 * 批量删除
 * ============================================================ */
async function handleBatchDelete() {
  const selected = (tableMethods.value?.getSelectRows?.() || []) as UserRecord[];
  if (selected.length === 0) {
    message.warning("请先选择要删除的用户");
    return;
  }
  Modal.confirm({
    title: "批量删除",
    content: `确定要删除选中的 ${selected.length} 个用户吗？`,
    okType: "danger",
    async onOk() {
      await crudBatchDelete(selected);
    },
  });
}

/* ============================================================
 * 头像上传
 * ============================================================ */
function beforeUpload(file: File) {
  const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
  if (!isJpgOrPng) {
    message.error("只能上传 JPG/PNG 格式的图片");
    return false;
  }
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    message.error("图片大小不能超过 2MB");
    return false;
  }
  return true;
}

async function customUpload({ file, onSuccess, onError }: any) {
  const formData = new FormData();
  formData.append("file", file);

  uploadLoading.value = true;
  try {
    const res = (await http.Post("/upload/file", formData)) as any;
    const url = res?.data?.url || res?.url;
    formMethods.setFieldsValue({ avatar: url });
    message.success("头像上传成功");
    onSuccess(res);
  } catch (e: any) {
    message.error(e?.message || "头像上传失败");
    onError(e);
  } finally {
    uploadLoading.value = false;
  }
}

/* ============================================================
 * 打印
 * ============================================================ */
function handlePrint() {
  printUserList();
}

/* ============================================================
 * 重置密码
 * ============================================================ */
const resetPwdVisible = ref(false);
const resetPwdTarget = ref<UserRecord | null>(null);
const resetPwdValue = ref("");
const resetPwdLoading = ref(false);

function handleResetPassword(record: UserRecord) {
  resetPwdTarget.value = record;
  resetPwdValue.value = "";
  resetPwdVisible.value = true;
}

async function confirmResetPassword() {
  if (resetPwdValue.value.length < 6) {
    message.warning("密码至少 6 位");
    return;
  }
  resetPwdLoading.value = true;
  try {
    await resetUserPassword(resetPwdTarget.value!.userId, resetPwdValue.value);
    message.success("密码已重置");
    resetPwdVisible.value = false;
  } catch (e: any) {
    message.error(e?.message || "重置失败");
  } finally {
    resetPwdLoading.value = false;
  }
}

/* ============================================================
 * 敏感信息
 * ============================================================ */
const sensitiveVisible = ref(false);
const sensitiveData = ref<Record<string, unknown>>({});
const sensitiveLoading = ref(false);

async function handleViewSensitive(record: UserRecord) {
  sensitiveVisible.value = true;
  sensitiveLoading.value = true;
  sensitiveData.value = {};
  try {
    sensitiveData.value = await getUserSensitive(record.userId);
  } catch (e: any) {
    message.error(e?.message || "无权限查看");
    sensitiveVisible.value = false;
  } finally {
    sensitiveLoading.value = false;
  }
}

/* ============================================================
 * 操作项
 * ============================================================ */
function getActions(record: UserRecord): ActionItem[] {
  return getUserActions(record, {
    onEdit: handleEdit,
    onDelete: handleDelete,
    onResetPassword: handleResetPassword,
    onViewSensitive: handleViewSensitive,
  });
}

/* ============================================================
 * 初始化
 * ============================================================ */
onMounted(loadBaseData);
</script>

<template>
  <div :class="containerClassName">
    <!-- ============================================================ -->
    <!-- 左：部门树                                                     -->
    <!-- ============================================================ -->
    <aside :class="leftPanelClassName">
      <div :class="cardClassName">
        <!-- 头部 -->
        <div :class="cardHeaderClassName">
          <div :class="cardTitleClassName">
            <span :class="cardTitleBarClassName" />
            <span>部门列表</span>
            <span
              class="rounded-full bg-gray-100 px-1.5 text-[10px] font-normal text-gray-500 dark:bg-gray-800 dark:text-gray-400"
            >
              {{ allDeptNodes.length }}
            </span>
          </div>

          <button
            v-if="selectedDeptId"
            type="button"
            class="rounded p-1 text-xs text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
            title="清除筛选"
            @click="clearDeptFilter"
          >
            <Icon icon="carbon:filter-remove" />
          </button>
        </div>

        <!-- 搜索 -->
        <div :class="deptSearchClassName">
          <a-input v-model:value="deptKeyword" placeholder="搜索部门" allow-clear size="small">
            <template #prefix>
              <Icon icon="carbon:search" class="text-gray-400" />
            </template>
          </a-input>
        </div>

        <!-- 树 -->
        <div :class="cardBodyClassName" class="p-3">
          <a-spin :spinning="deptSearchLoading">
            <!-- 空态 -->
            <div
              v-if="filteredDeptTree.length === 0"
              class="flex flex-col items-center gap-2 py-10 text-gray-400 dark:text-gray-500"
            >
              <Icon icon="carbon:tree-view" class="text-3xl opacity-40" />
              <span class="text-xs">暂无部门</span>
            </div>

            <!-- 树 -->
            <a-tree
              v-else
              :tree-data="filteredDeptTree"
              :field-names="{ children: 'children', title: 'deptName', key: 'deptId' }"
              :expanded-keys="treeExpandedKeys"
              :selected-keys="selectedDeptId ? [selectedDeptId] : []"
              block-node
              @select="handleDeptSelect"
              @update:expanded-keys="(keys: string[]) => (treeExpandedKeys = keys)"
            >
              <template #title="{ deptName, deptId }">
                <span
                  :class="
                    cn(
                      'flex items-center gap-1.5 rounded px-1 py-0.5 text-sm transition-colors',
                      selectedDeptId === deptId
                        ? 'font-medium text-blue-600 dark:text-blue-400'
                        : 'text-gray-700 dark:text-gray-200',
                    )
                  "
                >
                  <Icon
                    icon="carbon:folder"
                    class="text-xs"
                    :class="
                      selectedDeptId === deptId
                        ? 'text-blue-500 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                    "
                  />
                  {{ deptName }}
                </span>
              </template>
            </a-tree>
          </a-spin>
        </div>
      </div>
    </aside>

    <!-- ============================================================ -->
    <!-- 右：用户管理                                                   -->
    <!-- ============================================================ -->
    <section :class="rightPanelClassName">
      <div :class="cardClassName">
        <!-- 头部 -->
        <div :class="cardHeaderClassName">
          <div :class="cardTitleClassName">
            <span :class="cardTitleBarClassName" />
            <span>用户管理</span>
            <span
              v-if="selectedDeptId"
              class="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-normal text-blue-600 dark:bg-blue-950/40 dark:text-blue-400"
            >
              已筛选部门
            </span>
          </div>
        </div>

        <!-- 搜索表单（嵌入 BasicTable 的 form-config） -->
        <BasicTable
          :columns="userColumns"
          :api="fetchUserList"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 60 }"
          :action-column="userActionColumn"
          :row-selection="userRowSelection"
          :pagination="userPagination"
          :scroll="userScroll"
          :row-key="userRowKey"
          size="small"
          class="p-4"
          @register="tableRegister"
        >
          <!-- 工具栏 -->
          <template #toolbar>
            <div :class="toolbarClassName" class="!p-0">
              <a-button type="primary" @click="handleAdd()">
                <template #icon>
                  <Icon icon="ant-design:plus-outlined" />
                </template>
                新增用户
              </a-button>

              <ImportExport
                filename="用户列表"
                module="/user"
                :export-params="{ ids: tableMethods?.getSelectRowKeys() }"
                :import-template="USER_IMPORT_TEMPLATE"
              />

              <a-button @click="handlePrint">
                <template #icon><Icon icon="carbon:printer" /></template>
                打印
              </a-button>

              <a-button danger @click="handleBatchDelete()">
                <template #icon>
                  <Icon icon="ant-design:delete-outlined" />
                </template>
                批量删除
              </a-button>
            </div>
          </template>

          <!-- 状态列 -->
          <template #cell-status="{ record }">
            <a-tag :color="USER_STATUS_COLOR_MAP[record.status] || 'default'" class="!m-0">
              <span :class="statusTagClassName">
                <Icon
                  :icon="USER_STATUS_ICON_MAP[record.status] || 'carbon:help'"
                  class="text-xs"
                />
                {{ USER_STATUS_LABEL_MAP[record.status] || "未知" }}
              </span>
            </a-tag>
          </template>

          <!-- 角色列 -->
          <template #cell-roles="{ record }">
            <span class="text-xs text-gray-600 dark:text-gray-300">
              {{ getUserRoleNames(record as UserRecord) }}
            </span>
          </template>

          <!-- 操作列 -->
          <template #action="{ record }">
            <TableAction :actions="getActions(record as UserRecord)" />
          </template>
        </BasicTable>
      </div>
    </section>

    <!-- ============================================================ -->
    <!-- 新增/编辑弹窗                                                  -->
    <!-- ============================================================ -->
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
      >
        <template #avatarUpload="{ model, field }">
          <div class="flex items-center gap-4">
            <a-upload
              :show-upload-list="false"
              accept=".jpg,.jpeg,.png"
              :before-upload="beforeUpload"
              :custom-request="customUpload"
            >
              <a-button :loading="uploadLoading">上传头像</a-button>
            </a-upload>
            <img
              v-if="model[field]"
              :src="model[field]"
              class="h-16 w-16 rounded-full border border-gray-200 object-cover dark:border-gray-700"
              alt="avatar"
            />
          </div>
        </template>
      </BasicForm>
    </BasicModal>

    <!-- ============================================================ -->
    <!-- 重置密码弹窗                                                   -->
    <!-- ============================================================ -->
    <a-modal
      v-model:open="resetPwdVisible"
      title="重置密码"
      :width="420"
      :confirm-loading="resetPwdLoading"
      @ok="confirmResetPassword"
    >
      <div class="space-y-3 py-2">
        <p class="text-sm text-gray-500 dark:text-gray-400">
          为用户「{{ resetPwdTarget?.username }}」设置新密码
        </p>
        <a-input-password
          v-model:value="resetPwdValue"
          placeholder="请输入新密码（至少 6 位）"
          :maxlength="64"
        />
      </div>
    </a-modal>

    <!-- ============================================================ -->
    <!-- 敏感信息弹窗                                                   -->
    <!-- ============================================================ -->
    <a-modal v-model:open="sensitiveVisible" title="用户敏感信息" :width="520" :footer="null">
      <a-spin :spinning="sensitiveLoading">
        <Description :column="1" :data="sensitiveData" :schema="userDetailSchema" />
      </a-spin>
    </a-modal>
  </div>
</template>
