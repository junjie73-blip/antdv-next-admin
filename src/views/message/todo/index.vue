<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { computed, onMounted, ref } from "vue";
import { message } from "antdv-next";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

import {
  completeTodo,
  createTodo,
  deleteTodo,
  getTodoList,
  getTodoStats,
  updateTodo,
} from "@/api/system";
import { BasicForm, useForm } from "@/components/business/Form";
import { BasicModal, useModal } from "@/components/business/Modal";

// 抽离的模块
import { FILTER_META, PRIORITY_MAP } from "./constants";
import { TODO_EMPTY_VALUES, todoFormSchemas } from "./schemas";
import type { TodoFilterKey, TodoFilterOption, TodoRecord, TodoStats } from "./types";
import { filterTodos, getDueTimeInfo, isOverdue, todoToFormValues } from "./utils";

dayjs.extend(relativeTime);
defineOptions({ name: "MessageTodo" });

// ============ 状态 ============
const loading = ref(false);
const stats = ref<TodoStats>({ all: 0, uncompleted: 0, completed: 0, overdue: 0 });
const list = ref<TodoRecord[]>([]);
const activeFilter = ref<TodoFilterKey>("all");
const [modalRegister, modalMethods] = useModal();
const [formRegister, formMethods] = useForm();
const editingId = ref<string | null>(null);

// ============ 过滤器配置（合并统计数值） ============
const filterOptions = computed<TodoFilterOption[]>(() =>
  (Object.keys(FILTER_META) as TodoFilterKey[]).map((key) => ({
    key,
    ...FILTER_META[key],
    count: stats.value[key],
  })),
);

// ============ 过滤后的列表 ============
const filteredList = computed(() => filterTodos(list.value, activeFilter.value));

// ============ 数据加载 ============
async function load() {
  loading.value = true;
  try {
    const [listRes, statsRes] = await Promise.all([
      getTodoList({ pageNum: 1, pageSize: 200 }),
      getTodoStats(),
    ]);
    const ld = listRes?.data ?? listRes;
    list.value = ld?.list || [];
    stats.value = (statsRes?.data ?? statsRes) || stats.value;
  } finally {
    loading.value = false;
  }
}

// ============ CRUD ============
function handleAdd() {
  editingId.value = null;
  formMethods.setFieldsValue({ ...TODO_EMPTY_VALUES });
  formMethods.clearValidate();
  modalMethods.openModal();
}

function handleEdit(item: TodoRecord) {
  editingId.value = item.todoId;
  formMethods.setFieldsValue(todoToFormValues(item));
  formMethods.clearValidate();
  modalMethods.openModal();
}

async function handleSave() {
  const values = await formMethods.validate();
  if (!values) return;

  const payload: any = {
    ...values,
    dueTime: values.dueTime ? dayjs(values.dueTime).format("YYYY-MM-DD HH:mm:ss") : null,
  };

  if (editingId.value) {
    await updateTodo(editingId.value, payload);
    message.success("更新成功");
  } else {
    await createTodo(payload);
    message.success("创建成功");
  }

  modalMethods.closeModal();
  load();
}

async function handleComplete(item: TodoRecord) {
  if (item.status === "1") return;
  await completeTodo(item.todoId);
  message.success("已完成");
  load();
}

async function handleDelete(item: TodoRecord) {
  await deleteTodo(item.todoId);
  message.success("已删除");
  load();
}

onMounted(load);
</script>

<template>
  <div class="flex gap-4 h-full">
    <!-- ==================== 左侧分类 ==================== -->
    <div class="w-[220px] shrink-0 flex flex-col gap-3">
      <!-- 统计概览卡片 -->
      <div
        class="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
      >
        <div class="text-xs text-gray-400 mb-1">我的待办</div>
        <div class="flex items-baseline gap-1">
          <span class="text-3xl font-bold text-gray-800 dark:text-white">{{ stats.all }}</span>
          <span class="text-xs text-gray-400">项</span>
        </div>
        <div class="mt-3 flex items-center gap-2 text-xs">
          <span class="text-gray-500"> 完成率 </span>
          <a-progress
            :percent="stats.all > 0 ? Math.round((stats.completed / stats.all) * 100) : 0"
            size="small"
            class="flex-1"
            :show-info="false"
            :stroke-color="'#52c41a'"
          />
          <span class="text-gray-500 font-medium">
            {{ stats.all > 0 ? Math.round((stats.completed / stats.all) * 100) : 0 }}%
          </span>
        </div>
      </div>

      <!-- 筛选菜单 -->
      <div
        class="rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-2"
      >
        <div
          v-for="f in filterOptions"
          :key="f.key"
          class="group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-all duration-200 mb-1 last:mb-0"
          :class="
            activeFilter === f.key
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/60 text-gray-600 dark:text-gray-400'
          "
          @click="activeFilter = f.key"
        >
          <div class="flex items-center gap-2">
            <Icon
              :icon="f.icon"
              class="text-base transition-transform duration-200 group-hover:scale-110"
              :style="{ color: activeFilter === f.key ? f.color : undefined }"
            />
            <span class="text-sm">{{ f.label }}</span>
          </div>
          <span
            class="min-w-[22px] h-5 px-1.5 rounded-full text-xs flex items-center justify-center"
            :class="
              activeFilter === f.key
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
            "
          >
            {{ f.count }}
          </span>
        </div>
      </div>

      <!-- 新建按钮 -->
      <a-button type="primary" block @click="handleAdd">
        <template #icon><Icon icon="ant-design:plus-outlined" /></template>
        新建待办
      </a-button>
    </div>

    <!-- ==================== 右侧列表 ==================== -->
    <div
      class="flex-1 min-w-0 rounded-xl border border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 p-4"
    >
      <a-spin :spinning="loading">
        <!-- 空状态 -->
        <div
          v-if="filteredList.length === 0"
          class="flex flex-col items-center justify-center py-24 text-gray-400"
        >
          <div
            class="w-20 h-20 rounded-full bg-gray-50 dark:bg-gray-800/60 flex items-center justify-center mb-3"
          >
            <Icon icon="carbon:task" class="text-4xl opacity-40" />
          </div>
          <div class="text-sm">
            {{
              activeFilter === "all" ? "暂无待办" : `没有${FILTER_META[activeFilter].label}的待办`
            }}
          </div>
          <a-button type="link" @click="handleAdd">立即创建一个 →</a-button>
        </div>

        <!-- 待办列表 -->
        <div v-else class="space-y-2">
          <div
            v-for="item in filteredList"
            :key="item.todoId"
            class="group relative flex items-start gap-3 p-3 rounded-lg border border-transparent transition-all duration-200 hover:border-blue-100 dark:hover:border-blue-900/50 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 hover:shadow-sm"
            :class="{ 'opacity-60': item.status === '1' }"
          >
            <!-- 左侧优先级色条 -->
            <div
              class="absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-all"
              :style="{ backgroundColor: PRIORITY_MAP[item.priority]?.color }"
            />

            <!-- 完成勾选 -->
            <a-checkbox
              :checked="item.status === '1'"
              class="mt-0.5"
              @change="() => handleComplete(item)"
            />

            <!-- 内容 -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center gap-2 flex-wrap">
                <span
                  class="text-sm font-medium"
                  :class="
                    item.status === '1'
                      ? 'line-through text-gray-400'
                      : 'text-gray-800 dark:text-gray-200'
                  "
                >
                  {{ item.title }}
                </span>
                <span
                  class="px-1.5 py-0.5 rounded text-[11px] font-medium"
                  :class="PRIORITY_MAP[item.priority]?.bg"
                >
                  {{ PRIORITY_MAP[item.priority]?.label }}
                </span>
                <span
                  v-if="isOverdue(item)"
                  class="px-1.5 py-0.5 rounded text-[11px] font-medium bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"
                >
                  逾期
                </span>
              </div>

              <p
                v-if="item.content"
                class="text-xs text-gray-500 dark:text-gray-400 mt-1 line-clamp-2"
              >
                {{ item.content }}
              </p>

              <div class="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                <span
                  v-if="getDueTimeInfo(item)"
                  class="inline-flex items-center gap-1"
                  :class="
                    getDueTimeInfo(item)?.overdue
                      ? 'text-red-500'
                      : getDueTimeInfo(item)?.urgent
                        ? 'text-amber-500'
                        : ''
                  "
                >
                  <Icon icon="carbon:time" />
                  截止 {{ getDueTimeInfo(item)?.text }}
                </span>
                <span class="inline-flex items-center gap-1">
                  <Icon icon="carbon:time" />
                  创建 {{ dayjs(item.createdAt).fromNow() }}
                </span>
              </div>
            </div>

            <!-- 操作 -->
            <div
              class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <a-tooltip title="编辑">
                <a-button type="text" size="small" @click="handleEdit(item)">
                  <Icon icon="ant-design:edit-outlined" />
                </a-button>
              </a-tooltip>
              <a-popconfirm title="确定删除这条待办？" @confirm="handleDelete(item)">
                <a-button type="text" size="small" danger>
                  <Icon icon="ant-design:delete-outlined" />
                </a-button>
              </a-popconfirm>
            </div>
          </div>
        </div>
      </a-spin>
    </div>

    <!-- ==================== 新建/编辑弹窗 ==================== -->
    <BasicModal
      :title="editingId ? '编辑待办' : '新建待办'"
      :width="520"
      @register="modalRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="todoFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      />
    </BasicModal>
  </div>
</template>
