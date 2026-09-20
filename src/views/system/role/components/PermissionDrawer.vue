<script setup lang="ts">
import { message } from "antdv-next";
import { ref, watch } from "vue";

import type { RoleRecord } from "../types";

import {
  assignRoleDepts,
  assignRoleMenus,
  assignRolePermissions,
  assignRoleUsers,
  getAllPermissions,
  getDeptTree,
  getRoleDepts,
  getRoleMenusTree,
  getRoleUsers,
  getUserAllOptions,
} from "~/api";

import { http } from "~/utils";

defineOptions({ name: "RolePermissionDrawer" });

const props = defineProps<{
  open: boolean;
  role: RoleRecord | null;
}>();

const emit = defineEmits<{
  "update:open": [v: boolean];
  saved: [];
}>();

// ============ Tab ============
const activeTab = ref<"menu" | "api" | "users" | "dept">("menu");

// ============ 菜单权限 ============
const menuTreeData = ref<any[]>([]);
const checkedMenuKeys = ref<string[]>([]); // 叶子节点，用于回显
const savedMenuIds = ref<string[]>([]); // 完整 menuIds，含半选父节点，提交用

function filterLeafKeys(tree: any[], selectedIds: string[]): string[] {
  const idSet = new Set(selectedIds);
  const leaf: string[] = [];
  function walk(list: any[]) {
    for (const node of list) {
      if (node.children?.length) walk(node.children);
      else if (idSet.has(node.menuId)) leaf.push(node.menuId);
    }
  }
  walk(tree);
  return leaf;
}

function onMenuCheck(checkedKeys: any, info: any) {
  const checked = Array.isArray(checkedKeys) ? checkedKeys : (checkedKeys?.checked ?? []);
  const half = info?.halfCheckedKeys ?? [];
  savedMenuIds.value = Array.from(new Set([...checked, ...half]));
}

// ============ API 权限 ============
const apiOptions = ref<{ label: string; value: string }[]>([]);
const selectedPermIds = ref<string[]>([]);
const apiLoading = ref(false);

async function loadApiPermissions() {
  apiLoading.value = true;
  try {
    const res: any = await getAllPermissions();
    const list = res?.data ?? res ?? [];
    apiOptions.value = list.map((p: any) => ({
      label: `${p.permName} (${p.permCode})`,
      value: p.permId,
    }));
    // 已关联的权限
    if (props.role) {
      const rolePerms: any = await http
        .Get(`/role/${props.role.roleId}/permissions`)
        .then((r: any) => r?.data ?? r)
        .catch(() => []);
      selectedPermIds.value = (rolePerms || []).map((p: any) => p.permId ?? p);
    }
  } finally {
    apiLoading.value = false;
  }
}

// ============ 关联用户 ============
const userOptions = ref<{ label: string; value: string }[]>([]);
const selectedUserIds = ref<string[]>([]);
const userLoading = ref(false);

async function loadUsers() {
  userLoading.value = true;
  try {
    const [all, bound] = await Promise.all([
      getUserAllOptions(),
      props.role ? getRoleUsers(props.role.roleId) : Promise.resolve([]),
    ]);
    const allList = (all as any)?.data ?? all ?? [];
    userOptions.value = allList.map((u: any) => ({
      label: u.username || u.label,
      value: u.userId || u.value,
    }));
    selectedUserIds.value = (bound as any[]).map((u: any) => u.userId ?? u);
  } finally {
    userLoading.value = false;
  }
}

// ============ 数据权限部门 ============
const deptTreeData = ref<any[]>([]);
const checkedDeptKeys = ref<string[]>([]);

async function loadDepts() {
  try {
    const [tree, bound] = await Promise.all([
      getDeptTree(),
      props.role ? getRoleDepts(props.role.roleId) : Promise.resolve([]),
    ]);
    deptTreeData.value = tree;
    checkedDeptKeys.value = (bound as string[]) || [];
  } catch {
    deptTreeData.value = [];
    checkedDeptKeys.value = [];
  }
}

function onDeptCheck(checkedKeys: any) {
  checkedDeptKeys.value = Array.isArray(checkedKeys) ? checkedKeys : (checkedKeys?.checked ?? []);
}
// ========== 权限树 ==========

async function loadPermissionTree() {
  try {
    const res = (await http
      .Get("/menu/tree", {
        params: {
          menuType: [1, 2, 3],
        },
      })
      .send(true)) as any;
    menuTreeData.value = res.data;
  } catch (e) {
    console.error("加载菜单树失败", e);
  }
}
// ============ 初始化 ============
async function init() {
  if (!props.role) return;

  activeTab.value = "menu";
  savedMenuIds.value = [...(props.role.menuIds || [])];
  checkedMenuKeys.value = [];

  await loadPermissionTree();
  // 菜单树
  try {
    const selectedIds = await getRoleMenusTree(props.role.roleId);
    // 用 role 里已有的 menuIds 计算叶子
    checkedMenuKeys.value = filterLeafKeys(menuTreeData.value, selectedIds);
  } catch {}

  // API 权限 / 用户 / 部门，按需加载（先只加载当前 Tab 的）
  loadApiPermissions();
  loadUsers();
  if (props.role.dataScope === "2") {
    loadDepts();
  }
}

watch(
  () => props.open,
  (v) => {
    if (v) init();
  },
);
watch(activeTab, (tab) => {
  if (tab === "api" && apiOptions.value.length === 0) loadApiPermissions();
  if (tab === "users" && userOptions.value.length === 0) loadUsers();
  if (tab === "dept" && deptTreeData.value.length === 0) loadDepts();
});

// ============ 保存 ============
const saving = ref(false);

async function save() {
  if (!props.role) return;
  const id = props.role.roleId;
  saving.value = true;
  try {
    // 1. 菜单权限
    await assignRoleMenus(id, savedMenuIds.value);
    // 2. API 权限
    await assignRolePermissions(id, selectedPermIds.value);
    // 3. 用户关联
    await assignRoleUsers(id, selectedUserIds.value);
    // 4. 数据权限部门（仅 dataScope=2 时）
    if (props.role.dataScope === "2") {
      await assignRoleDepts(id, checkedDeptKeys.value);
    }

    message.success("权限已更新");
    emit("saved");
    emit("update:open", false);
  } catch (e: any) {
    message.error(e?.message || "保存失败");
  } finally {
    saving.value = false;
  }
}

function close() {
  emit("update:open", false);
}
</script>

<template>
  <a-drawer
    :open="open"
    :title="`权限分配 - ${role?.roleName || ''}`"
    :width="560"
    :footer="null"
    @close="close"
  >
    <div class="flex flex-col h-full">
      <PerfectScrollbar class="h-full">
        <div class="flex-1 overflow-hidden">
          <a-tabs v-model:active-key="activeTab" class="h-full">
            <!-- 菜单权限 -->
            <a-tab-pane key="menu" tab="菜单权限">
              <a-alert message="勾选菜单和按钮权限，父子联动" type="info" show-icon class="mb-3" />
              <a-tree
                checkable
                default-expand-all
                defaultExpandParent
                :tree-data="menuTreeData"
                :checked-keys="checkedMenuKeys"
                :field-names="{ title: 'menuName', key: 'menuId' }"
                @check="onMenuCheck"
              />
            </a-tab-pane>

            <!-- API 权限 -->
            <a-tab-pane key="api" tab="API 权限">
              <a-spin :spinning="apiLoading">
                <a-checkbox-group v-model:value="selectedPermIds" class="w-full">
                  <div class="grid grid-cols-2 gap-2">
                    <a-checkbox v-for="opt in apiOptions" :key="opt.value" :value="opt.value">
                      {{ opt.label }}
                    </a-checkbox>
                  </div>
                </a-checkbox-group>
                <a-empty
                  v-if="apiOptions.length === 0 && !apiLoading"
                  description="暂无可分配权限"
                />
              </a-spin>
            </a-tab-pane>

            <!-- 关联用户 -->
            <a-tab-pane key="users" tab="关联用户">
              <a-spin :spinning="userLoading">
                <a-select
                  v-model:value="selectedUserIds"
                  mode="multiple"
                  placeholder="选择用户"
                  :options="userOptions"
                  :max-tag-count="8"
                  show-search
                  :filter-option="
                    (input: string, opt: any) =>
                      String(opt.label).toLowerCase().includes(input.toLowerCase())
                  "
                  class="w-full"
                />
              </a-spin>
            </a-tab-pane>

            <!-- 数据权限部门 -->
            <a-tab-pane v-if="role?.dataScope === '2'" key="dept" tab="数据权限">
              <a-alert
                message="该角色数据权限为「自定义」，请勾选可见部门"
                type="warning"
                show-icon
                class="mb-3"
              />
              <a-tree
                checkable
                default-expand-all
                :tree-data="deptTreeData"
                :checked-keys="checkedDeptKeys"
                :field-names="{ title: 'deptName', key: 'deptId' }"
                @check="onDeptCheck"
              />
            </a-tab-pane>
          </a-tabs>
        </div>
      </PerfectScrollbar>
      <div class="flex justify-end gap-2 pt-4 border-t border-solid border-gray-200">
        <a-button @click="close">取消</a-button>
        <a-button type="primary" :loading="saving" @click="save">保存</a-button>
      </div>
    </div>
  </a-drawer>
</template>
