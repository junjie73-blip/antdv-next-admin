<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message, Modal } from "antdv-next";
import { computed, ref, watch } from "vue";

import {
  createTodoGroup,
  deleteTodoGroup,
  getTodoGroups,
  updateTodoGroup,
  type TodoGroup,
} from "@/api/todo-group";

defineOptions({ name: "TodoGroupManager" });

const props = defineProps<{ open: boolean }>();
const emit = defineEmits<{
  "update:open": [v: boolean];
  /** 分组数据变更后通知外部刷新 */
  changed: [];
}>();

// ============ 数据 ============
const list = ref<TodoGroup[]>([]);
const loading = ref(false);
const editing = ref<TodoGroup | null>(null);
const formVisible = ref(false);
const submitting = ref(false);

const form = ref({
  name: "",
  color: "#1677ff",
  sortOrder: 0,
});

/** 常用颜色预设 */
const COLOR_PRESETS = [
  "#1677ff",
  "#52c41a",
  "#faad14",
  "#f5222d",
  "#722ed1",
  "#13c2c2",
  "#eb2f96",
  "#8c8c8c",
];

// ============ 加载 ============
async function load() {
  loading.value = true;
  try {
    list.value = await getTodoGroups();
  } catch (e) {
    console.error("[GroupManager] 加载失败", e);
    message.error("加载分组失败");
  } finally {
    loading.value = false;
  }
}

// ============ 新增 / 编辑 ============
function openAdd() {
  editing.value = null;
  form.value = { name: "", color: "#1677ff", sortOrder: 0 };
  formVisible.value = true;
}

function openEdit(row: TodoGroup) {
  editing.value = row;
  form.value = {
    name: row.name,
    color: row.color || "#1677ff",
    sortOrder: row.sortOrder ?? 0,
  };
  formVisible.value = true;
}

async function handleSave() {
  const name = form.value.name.trim();
  if (!name) {
    message.warning("请输入分组名称");
    return;
  }

  submitting.value = true;
  try {
    const payload = { ...form.value, name };
    if (editing.value) {
      await updateTodoGroup(editing.value.groupId, payload);
      message.success("更新成功");
    } else {
      await createTodoGroup(payload);
      message.success("创建成功");
    }
    formVisible.value = false;
    await load();
    emit("changed");
  } catch (e: any) {
    message.error(e?.message || "保存失败");
  } finally {
    submitting.value = false;
  }
}

// ============ 删除 ============
function handleDelete(row: TodoGroup) {
  Modal.confirm({
    title: "删除分组",
    content: `确定删除「${row.name}」吗？分组下的待办需先处理完。`,
    okType: "danger",
    async onOk() {
      try {
        await deleteTodoGroup(row.groupId);
        message.success("已删除");
        await load();
        emit("changed");
      } catch (e: any) {
        message.error(e?.message || "删除失败");
        throw e; // 让 Modal 保持打开
      }
    },
  });
}

// ============ 生命周期 ============
watch(
  () => props.open,
  (v) => {
    if (v) load();
  },
  { immediate: true },
);

const title = computed(() => (editing.value ? "编辑分组" : "新建分组"));

function close() {
  emit("update:open", false);
}
</script>

<template>
  <a-drawer :open="open" title="待办分组管理" :width="480" @close="close">
    <template #extra>
      <a-button type="primary" @click="openAdd">
        <template #icon><Icon icon="ant-design:plus-outlined" /></template>
        新建分组
      </a-button>
    </template>

    <a-spin :spinning="loading">
      <!-- 空状态 -->
      <a-empty
        v-if="list.length === 0 && !loading"
        description="暂无分组"
        icon="carbon:folder"
        class="py-12 text-center text-gray-400"
      >
      </a-empty>

      <!-- 列表 -->
      <div v-else class="space-y-2">
        <div
          v-for="item in list"
          :key="item.groupId"
          class="group flex items-center justify-between p-3 rounded-lg border border-gray-100 dark:border-gray-800 hover:border-blue-200 dark:hover:border-blue-900 transition-colors"
        >
          <div class="flex items-center gap-3 min-w-0">
            <span
              class="w-3 h-3 rounded-full flex-shrink-0"
              :style="{ backgroundColor: item.color || '#8c8c8c' }"
            />
            <div class="min-w-0">
              <div class="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                {{ item.name }}
              </div>
              <div class="text-xs text-gray-400">排序：{{ item.sortOrder }}</div>
            </div>
          </div>

          <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <a-button type="text" size="small" @click="openEdit(item)">
              <Icon icon="ant-design:edit-outlined" />
            </a-button>
            <a-button type="text" size="small" danger @click="handleDelete(item)">
              <Icon icon="ant-design:delete-outlined" />
            </a-button>
          </div>
        </div>
      </div>
    </a-spin>

    <!-- 新增 / 编辑弹窗 -->
    <a-modal
      v-model:open="formVisible"
      :title="title"
      :width="420"
      :confirm-loading="submitting"
      @ok="handleSave"
    >
      <div class="space-y-4 py-2">
        <div>
          <div class="text-sm text-gray-600 dark:text-gray-300 mb-1.5">分组名称</div>
          <a-input v-model:value="form.name" placeholder="请输入分组名称" :maxlength="64" />
        </div>

        <div>
          <div class="text-sm text-gray-600 dark:text-gray-300 mb-1.5">颜色</div>
          <div class="flex items-center gap-2 flex-wrap">
            <button
              v-for="c in COLOR_PRESETS"
              :key="c"
              type="button"
              class="w-7 h-7 rounded-md transition-transform hover:scale-110"
              :class="{
                'ring-2 ring-offset-2 ring-blue-500': form.color === c,
              }"
              :style="{ backgroundColor: c }"
              @click="form.color = c"
            />
            <a-input
              v-model:value="form.color"
              class="w-24"
              placeholder="#1677ff"
              :maxlength="16"
            />
          </div>
        </div>

        <div>
          <div class="text-sm text-gray-600 dark:text-gray-300 mb-1.5">排序（数字越小越靠前）</div>
          <a-input-number v-model:value="form.sortOrder" :min="0" class="w-full" />
        </div>
      </div>
    </a-modal>
  </a-drawer>
</template>
