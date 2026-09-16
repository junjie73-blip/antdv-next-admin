<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { Modal, message } from "antdv-next";
import { computed, onMounted, ref } from "vue";
import ImportExport from "@/components/business/ImportExport.vue";

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
} from "@/api";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";
import { BasicTable, TableAction, useTable, type ActionItem } from "@/components/business/Table";
import { useCRUD } from "@/composables/useCRUD";
import { DictType } from "@/enums/dict";
import { useDictStore } from "@/stores";

// 抽离的模块
import { getUserActions } from "./actions";
import {
  userActionColumn,
  userColumns,
  userPagination,
  userRowKey,
  userRowSelection,
  userScroll,
  USER_IMPORT_TEMPLATE,
} from "./columns";
import {
  USER_STATUS_COLOR_MAP,
  USER_STATUS_ICON_MAP,
  USER_STATUS_LABEL_MAP,
  cardClassName,
  containerClassName,
  leftPanelClassName,
  rightPanelClassName,
  statusTagClassName,
  treeCardClassName,
} from "./constants";
import {
  USER_EMPTY_VALUES,
  userDetailSchema,
  useUserFormSchemas,
  useUserSearchSchemas,
} from "./schemas";
import type { DeptTreeNode, FlatDeptNode, RoleOption, UserRecord } from "./types";
import { convertDeptTree, flattenDeptTree, getUserRoleNames, printUserList } from "./utils";
import { http } from "@/utils";

defineOptions({ name: "SystemUser" });

// ========== 字典 ==========
const dictStore = useDictStore();
const statusOptions = computed(() => dictStore.getOptions(DictType.NORMAL_DISABLE));

// ========== 基础数据 ==========
const deptTreeData = ref<DeptTreeNode[]>([]);
const allDeptNodes = ref<FlatDeptNode[]>([]);
const roleOptions = ref<RoleOption[]>([]);
const uploadLoading = ref(false);
async function loadBaseData() {
  try {
    const [deptRes, optionRes] = await Promise.all<any[]>([getDeptTree(), getUserOptions()]);
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

// ========== 选中部门 ==========
const selectedDeptId = ref<string>("");
const treeExpandedKeys = ref<string[]>([]);

function handleDeptSelect(_selectedKeys: (string | number)[], info: { node: { deptId: string } }) {
  const clickedId = info.node.deptId;
  // 再次点击已选中的节点，取消选中
  selectedDeptId.value = selectedDeptId.value === clickedId ? "" : clickedId;
  tableMethods.value?.reload();
}

// ========== 注册实例 ==========
const [modalRegister, modalMethods] = useModal();
const [tableRegister, tableMethods] = useTable();
const [formRegister, formMethods] = useForm();

// ========== Schema ==========
const searchFormSchemas = useUserSearchSchemas(statusOptions);

// ========== useCRUD ==========
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

// ========== 表格数据加载 ==========
async function fetchUserList(params: Record<string, any>) {
  return await getUserList({
    ...params,
    deptId: selectedDeptId.value || undefined,
  });
}

// ========== 批量删除（先弹确认） ==========
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
// 头像上传
// 文件校验函数（before-upload 调用）
function beforeUpload(file: File) {
  // 1. 类型校验：仅允许 JPG/PNG
  const isJpgOrPng = file.type === "image/jpeg" || file.type === "image/png";
  if (!isJpgOrPng) {
    message.error("只能上传 JPG/PNG 格式的图片");
    return false; // 阻止上传
  }

  // 2. 大小校验：不超过 2MB
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    message.error("图片大小不能超过 2MB");
    return false; // 阻止上传
  }

  return true; // 校验通过，允许上传
}

// 自定义上传函数（custom-request 调用）
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

// ========== 打印 ==========
function handlePrint() {
  printUserList();
}

// ============ 重置密码 ============
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

// ============ 敏感信息 ============
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

// ========== 操作项 ==========
function getActions(record: UserRecord): ActionItem[] {
  return getUserActions(record, {
    onEdit: handleEdit,
    onDelete: handleDelete,
    onResetPassword: handleResetPassword,
    onViewSensitive: handleViewSensitive,
  });
}

// ========== 初始化 ==========
onMounted(loadBaseData);
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
          @update:expanded-keys="(keys: string[]) => (treeExpandedKeys = keys)"
        />
      </a-card>
    </div>

    <!-- 右侧用户列表 -->
    <div :class="rightPanelClassName">
      <a-card title="用户管理" :class="cardClassName">
        <BasicTable
          :columns="userColumns"
          :api="fetchUserList"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: searchFormSchemas, labelWidth: 80 }"
          :action-column="userActionColumn"
          :row-selection="userRowSelection"
          :pagination="userPagination"
          :scroll="userScroll"
          :row-key="userRowKey"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button type="primary" @click="handleAdd()">
              <template #icon><Icon icon="ant-design:plus-outlined" /></template>
              新增用户
            </a-button>
            <ImportExport
              filename="用户列表"
              module="/user"
              :export-params="{
                ids: tableMethods?.getSelectRowKeys(),
              }"
              :import-template="USER_IMPORT_TEMPLATE"
            />
            <a-button @click="handlePrint">
              <template #icon><Icon icon="carbon:printer" /></template>
              打印
            </a-button>
            <a-button danger @click="handleBatchDelete()">
              <template #icon><Icon icon="ant-design:delete-outlined" /></template>
              批量删除
            </a-button>
          </template>

          <template #cell-status="{ record }">
            <a-tag :color="USER_STATUS_COLOR_MAP[record.status] || 'default'">
              <span :class="statusTagClassName">
                <Icon :icon="USER_STATUS_ICON_MAP[record.status] || 'carbon:help'" />
                {{ USER_STATUS_LABEL_MAP[record.status] || "未知" }}
              </span>
            </a-tag>
          </template>

          <template #cell-roles="{ record }">
            {{ getUserRoleNames(record as UserRecord) }}
          </template>

          <template #action="{ record }">
            <TableAction :actions="getActions(record as UserRecord)" />
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
      >
        <template #avatarUpload="{ model, field }">
          <div class="flex items-center gap-4">
            <a-upload
              :show-upload-list="false"
              :accept="'.jpg,.jpeg,.png'"
              :before-upload="beforeUpload"
              :custom-request="customUpload"
            >
              <a-button :loading="uploadLoading"> 上传头像 </a-button>
            </a-upload>
            <img
              v-if="model[field]"
              :src="model[field]"
              class="w-16 h-16 rounded-full object-cover border"
              alt="avatar"
            />
          </div>
        </template>
      </BasicForm>
    </BasicModal>
    <!-- 重置密码弹窗 -->
    <a-modal
      v-model:open="resetPwdVisible"
      title="重置密码"
      :width="420"
      :confirm-loading="resetPwdLoading"
      @ok="confirmResetPassword"
    >
      <div class="space-y-3 py-2">
        <p class="text-sm text-gray-500">为用户「{{ resetPwdTarget?.username }}」设置新密码</p>
        <a-input-password
          v-model:value="resetPwdValue"
          placeholder="请输入新密码（至少 6 位）"
          :maxlength="64"
        />
      </div>
    </a-modal>

    <!-- 敏感信息弹窗 -->
    <a-modal v-model:open="sensitiveVisible" title="用户敏感信息" :width="520" :footer="null">
      <a-spin :spinning="sensitiveLoading">
        <Description :column="1" :data="sensitiveData" :schema="userDetailSchema"></Description>
      </a-spin>
    </a-modal>
  </div>
</template>
