<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import { computed, onMounted, ref, watch } from "vue";

import { completeTodo, createTodo, deleteTodo, getTodoList, getTodoStats, updateTodo } from "@/api";
import { getTodoGroups, type TodoGroup } from "@/api/todo-group";
import { BasicDrawer, useDrawer } from "@/components/business/Drawer";
import { BasicForm, useForm } from "@/components/business/Form";
import { useUserStore } from "@/stores/modules/user";

import { FILTER_META, PRIORITY_MAP } from "./constants";
import GroupManager from "./components/GroupManager.vue";
import { TODO_EMPTY_VALUES, todoFormSchemas } from "./schemas";
import type { TodoFilterKey, TodoFilterOption, TodoRecord, TodoStats } from "./types";
import { filterTodos, getDueTimeInfo, isOverdue, todoToFormValues } from "./utils";

dayjs.extend(relativeTime);
defineOptions({ name: "MessageTodo" });

const userStore = useUserStore();

// ============ 状态 ============
const loading = ref(false);
const stats = ref<TodoStats>({ all: 0, uncompleted: 0, completed: 0, overdue: 0 });
const list = ref<TodoRecord[]>([]);
const activeFilter = ref<TodoFilterKey>("all");
const activeGroupId = ref<string | undefined>(undefined);
const groups = ref<TodoGroup[]>([]);
const groupManagerOpen = ref(false);
const editingId = ref<string | null>(null);

const [drawerRegister, drawerMethods] = useDrawer();
const [formRegister, formMethods] = useForm();

// ============ 计算 ============
const filterOptions = computed<TodoFilterOption[]>(() =>
  (Object.keys(FILTER_META) as TodoFilterKey[]).map((key) => ({
    key,
    ...FILTER_META[key],
    count: stats.value[key],
  })),
);

const filteredList = computed(() => filterTodos(list.value, activeFilter.value));

const completionRate = computed(() =>
  stats.value.all > 0 ? Math.round((stats.value.completed / stats.value.all) * 100) : 0,
);

// ============ 数据 ============
async function loadGroups() {
  try {
    groups.value = await getTodoGroups();
  } catch (e) {
    console.error("加载分组失败", e);
  }
}

async function load() {
  loading.value = true;
  try {
    const [listRes, statsRes] = await Promise.all([
      getTodoList({ pageNum: 1, pageSize: 200, groupId: activeGroupId.value }),
      getTodoStats(),
    ]);
    const ld = (listRes as any)?.data ?? listRes;
    list.value = ld?.list || [];
    stats.value = ((statsRes as any)?.data ?? statsRes) || stats.value;
  } finally {
    loading.value = false;
  }
}

async function handleGroupChanged() {
  await loadGroups();
  await load();
}

watch(activeGroupId, load);

// ============ CRUD ============
async function handleAdd() {
  editingId.value = null;
  await drawerMethods.openDrawer();
  await formMethods.clearValidate();
  formMethods.setFieldsValue({
    ...TODO_EMPTY_VALUES,
    groupId: activeGroupId.value ?? undefined,
  });
}

async function handleEdit(item: TodoRecord) {
  editingId.value = item.todoId;
  await drawerMethods.openDrawer();
  await formMethods.clearValidate();
  formMethods.setFieldsValue(
    todoToFormValues({ ...item, userId: userStore.userInfo?.userId || "" }),
  );
}

async function handleSave() {
  const values = await formMethods.validate();
  if (!values) return;

  const payload: any = {
    ...values,
    dueTime: values.dueTime ? new Date(values.dueTime) : null,
    userId: userStore.userInfo?.userId,
    groupId: values.groupId || null,
  };

  if (editingId.value) {
    await updateTodo(editingId.value, payload);
    message.success("更新成功");
  } else {
    await createTodo(payload);
    message.success("创建成功");
  }

  await drawerMethods.closeDrawer();
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

onMounted(() => {
  loadGroups();
  load();
});
</script>

<template>
  <div class="relative isolate min-h-full p-1">
    <div
      class="relative z-10 flex flex-col lg:flex-row gap-3 lg:gap-4 h-full min-h-0 w-full max-w-full"
    >
      <!-- ============================================================ -->
      <!-- 左侧导航区                                                    -->
      <!-- ============================================================ -->
      <aside class="w-full lg:w-[250px] xl:w-[270px] shrink-0 flex flex-col gap-3 min-w-0">
        <!-- 概览卡片 -->
        <div
          class="rounded-2xl p-5 relative overflow-hidden bg-white/[0.6] dark:bg-slate-900/[0.55] backdrop-blur-xl border border-white/[0.7] dark:border-slate-600/[0.35] shadow-[0_4px_24px_-8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <!-- 顶部渐变装饰 -->
          <div class="absolute inset-x-0 top-0 h-[2px] overflow-hidden">
            <div class="h-full bg-gradient-to-r from-transparent via-blue-500 to-transparent" />
          </div>

          <div class="flex items-center justify-between mb-4">
            <span class="text-xs font-medium text-slate-400 tracking-wide">我的待办</span>
            <div
              class="w-8 h-8 rounded-xl flex items-center justify-center bg-blue-500/10 dark:bg-blue-500/15"
            >
              <Icon icon="carbon:task" class="text-blue-500 text-sm" />
            </div>
          </div>

          <div class="flex items-baseline gap-1.5">
            <span
              class="text-3xl lg:text-4xl font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-none tracking-tight"
            >
              {{ stats.all }}
            </span>
            <span class="text-xs text-slate-400">项</span>
          </div>

          <!-- 完成率 -->
          <div class="mt-5">
            <div class="flex items-center justify-between text-xs mb-2">
              <span class="text-slate-500 dark:text-slate-400">完成进度</span>
              <span class="text-emerald-500 font-semibold tabular-nums">{{ completionRate }}%</span>
            </div>
            <div class="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden">
              <div
                class="h-full rounded-full bg-gradient-to-r from-emerald-400 to-teal-500 transition-all duration-500"
                :style="{ width: `${completionRate}%` }"
              />
            </div>
          </div>
        </div>

        <!-- 筛选卡片 -->
        <div
          class="rounded-2xl p-3 bg-white/[0.6] dark:bg-slate-900/[0.55] backdrop-blur-xl border border-white/[0.7] dark:border-slate-600/[0.35] shadow-[0_4px_24px_-8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <!-- 分组下拉 -->
          <a-select
            v-model:value="activeGroupId"
            placeholder="全部分组"
            allow-clear
            class="w-full mb-3 todo-group-select"
            :field-names="{ label: 'name', value: 'groupId' }"
            :options="groups"
          >
            <template #suffixIcon>
              <Icon icon="carbon:folder" class="text-slate-400" />
            </template>
          </a-select>

          <!-- 筛选菜单 -->
          <div
            class="flex lg:flex-col mt-2 gap-1.5 overflow-x-auto lg:overflow-visible pb-1 lg:pb-0 -mx-1 px-1 lg:mx-0 lg:px-0 [&::-webkit-scrollbar]:hidden"
            style="scrollbar-width: none"
          >
            <div
              v-for="f in filterOptions"
              :key="f.key"
              class="group relative flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl cursor-pointer transition-all duration-200 shrink-0 lg:shrink lg:w-full min-w-[110px] lg:min-w-0 overflow-hidden"
              :class="
                activeFilter === f.key
                  ? 'bg-white/70 dark:bg-slate-800/60 shadow-sm'
                  : 'hover:bg-white/40 dark:hover:bg-slate-800/30'
              "
              @click="activeFilter = f.key"
            >
              <!-- 激活态左侧色条 -->
              <div
                class="absolute left-0 top-2 bottom-2 w-0.5 rounded-full transition-all duration-300"
                :style="{ backgroundColor: activeFilter === f.key ? f.color : 'transparent' }"
              />

              <div class="flex items-center gap-2.5 min-w-0">
                <div
                  class="w-7 h-7 rounded-lg flex items-center justify-center transition-all duration-300 shrink-0"
                  :class="
                    activeFilter === f.key
                      ? `bg-gradient-to-br ${f.gradient} text-white shadow-sm`
                      : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-500 group-hover:scale-105'
                  "
                >
                  <Icon :icon="f.icon" class="text-sm" />
                </div>
                <span
                  class="text-sm transition-colors truncate"
                  :class="
                    activeFilter === f.key
                      ? 'text-slate-800 dark:text-slate-100 font-semibold'
                      : 'text-slate-600 dark:text-slate-400'
                  "
                >
                  {{ f.label }}
                </span>
              </div>

              <span
                class="min-w-[22px] h-5 px-1.5 rounded-full text-[11px] font-medium flex items-center justify-center shrink-0 tabular-nums transition-colors"
                :class="
                  activeFilter === f.key
                    ? 'text-white'
                    : 'bg-slate-100/80 dark:bg-slate-800/80 text-slate-500'
                "
                :style="{ backgroundColor: activeFilter === f.key ? f.color : undefined }"
              >
                {{ f.count }}
              </span>
            </div>
          </div>
        </div>

        <!-- 操作按钮 -->
        <div class="flex lg:flex-col gap-2">
          <button
            class="flex-1 lg:w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium text-white bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-[0_4px_14px_-4px_rgba(59,130,246,0.4)] hover:shadow-[0_6px_20px_-4px_rgba(59,130,246,0.5)] dark:shadow-[0_4px_14px_-4px_rgba(0,0,0,0.4)] dark:hover:shadow-[0_6px_20px_-4px_rgba(0,0,0,0.5)] hover:-translate-y-px transition-all duration-250"
            @click="handleAdd"
          >
            <Icon icon="ant-design:plus-outlined" />
            新建待办
          </button>
          <button
            class="flex-1 lg:w-full flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-[13px] font-medium text-slate-700 dark:text-slate-300 bg-white/[0.6] dark:bg-slate-800/[0.6] backdrop-blur border border-slate-300/[0.25] dark:border-slate-600/[0.25] hover:bg-white/90 dark:hover:bg-slate-800/90 hover:border-slate-400/[0.4] dark:hover:border-slate-500/[0.4] hover:-translate-y-px transition-all duration-250"
            @click="groupManagerOpen = true"
          >
            <Icon icon="carbon:folder" />
            管理分组
          </button>
        </div>
      </aside>

      <!-- ============================================================ -->
      <!-- 右侧内容区                                                    -->
      <!-- ============================================================ -->
      <main
        class="flex-1 min-w-0 rounded-2xl p-3 sm:p-4 flex flex-col bg-white/[0.6] dark:bg-slate-900/[0.55] backdrop-blur-xl border border-white/[0.7] dark:border-slate-600/[0.35] shadow-[0_4px_24px_-8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <!-- 标题栏 -->
        <div
          class="flex items-center justify-between mb-3 pb-3 border-b border-white/40 dark:border-slate-700/40"
        >
          <div class="flex items-center gap-2">
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">
              {{ FILTER_META[activeFilter].label }}待办
            </span>
            <span class="text-xs text-slate-400">{{ filteredList.length }} 项</span>
          </div>
        </div>

        <a-spin :spinning="loading" class="flex-1">
          <!-- 空状态 -->
          <div
            v-if="filteredList.length === 0"
            class="flex flex-col items-center justify-center py-16 sm:py-24"
          >
            <div
              class="w-20 h-20 rounded-3xl bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-800/60 dark:to-slate-800/30 flex items-center justify-center mb-4 rotate-3"
            >
              <Icon icon="carbon:task" class="text-4xl text-slate-300 dark:text-slate-600" />
            </div>
            <div class="text-sm text-slate-500 dark:text-slate-400 font-medium mb-1">
              {{
                activeFilter === "all" ? "暂无待办" : `没有${FILTER_META[activeFilter].label}的待办`
              }}
            </div>
            <div class="text-xs text-slate-400 mb-4">创建你的第一条待办吧</div>
            <button
              class="flex items-center justify-center gap-1.5 px-5 py-2 rounded-xl text-[13px] font-medium text-white bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-[0_4px_14px_-4px_rgba(59,130,246,0.4)] hover:-translate-y-px transition-all duration-250"
              @click="handleAdd"
            >
              <Icon icon="ant-design:plus-outlined" />
              立即创建
            </button>
          </div>

          <!-- 列表 -->
          <div v-else class="space-y-2">
            <div
              v-for="item in filteredList"
              :key="item.todoId"
              class="group relative flex items-start gap-3 p-3 sm:p-3.5 rounded-xl transition-all duration-200 bg-white/[0.5] dark:bg-slate-800/[0.45] border border-transparent hover:bg-white/[0.85] dark:hover:bg-slate-800/[0.75] hover:border-blue-500/[0.15] dark:hover:border-blue-400/[0.25] hover:shadow-[0_4px_16px_-6px_rgba(59,130,246,0.12)] dark:hover:shadow-[0_4px_16px_-6px_rgba(0,0,0,0.4)] hover:-translate-y-px"
              :class="{ 'opacity-55': item.status === '1' }"
            >
              <!-- 左侧优先级色条 -->
              <div
                class="absolute left-0 top-2.5 bottom-2.5 w-1 rounded-full transition-all duration-300 group-hover:w-1.5"
                :style="{
                  background: `linear-gradient(180deg, ${PRIORITY_MAP[item.priority]?.color}, ${PRIORITY_MAP[item.priority]?.dot})`,
                }"
              />

              <!-- 勾选 -->
              <a-checkbox
                :checked="item.status === '1'"
                class="mt-0.5 shrink-0"
                @change="() => handleComplete(item)"
              />

              <!-- 内容 -->
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <span
                    class="text-[14px] font-medium break-words transition-colors"
                    :class="
                      item.status === '1'
                        ? 'line-through text-slate-400'
                        : 'text-slate-800 dark:text-slate-200'
                    "
                  >
                    {{ item.title }}
                  </span>
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 inline-flex items-center gap-1"
                    :class="PRIORITY_MAP[item.priority]?.bg"
                  >
                    <span
                      class="w-1 h-1 rounded-full"
                      :style="{ backgroundColor: PRIORITY_MAP[item.priority]?.color }"
                    />
                    {{ PRIORITY_MAP[item.priority]?.label }}
                  </span>
                  <span
                    v-if="isOverdue(item)"
                    class="px-1.5 py-0.5 rounded text-[10px] font-medium shrink-0 bg-rose-50 text-rose-600 dark:bg-rose-900/20 dark:text-rose-400"
                  >
                    逾期
                  </span>
                </div>

                <p
                  v-if="item.content"
                  class="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 leading-relaxed"
                >
                  {{ item.content }}
                </p>

                <div
                  class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-[11px] text-slate-400"
                >
                  <span
                    v-if="getDueTimeInfo(item)"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md"
                    :class="
                      getDueTimeInfo(item)?.overdue
                        ? 'text-rose-500 bg-rose-50/60 dark:bg-rose-900/20'
                        : getDueTimeInfo(item)?.urgent
                          ? 'text-violet-500 bg-violet-50/60 dark:bg-violet-900/20'
                          : 'text-slate-400 dark:text-slate-500'
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

              <!-- 操作按钮 -->
              <div
                class="flex items-center gap-0.5 shrink-0 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity duration-200"
              >
                <button
                  class="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-slate-400 transition-all duration-200 hover:bg-blue-500/10 hover:text-blue-500 dark:hover:bg-blue-400/15 dark:hover:text-blue-400"
                  @click="handleEdit(item)"
                >
                  <Icon icon="ant-design:edit-outlined" class="text-sm" />
                </button>
                <a-popconfirm title="确定删除这条待办？" @confirm="handleDelete(item)">
                  <button
                    class="w-[30px] h-[30px] rounded-[9px] flex items-center justify-center text-slate-400 transition-all duration-200 hover:bg-rose-500/10 hover:text-rose-500 dark:hover:bg-rose-400/20 dark:hover:text-rose-400"
                  >
                    <Icon icon="ant-design:delete-outlined" class="text-sm" />
                  </button>
                </a-popconfirm>
              </div>
            </div>
          </div>
        </a-spin>
      </main>
    </div>

    <!-- ==================== 新建/编辑抽屉 ==================== -->
    <BasicDrawer
      :title="editingId ? '编辑待办' : '新建待办'"
      :width="520"
      @register="drawerRegister"
      @ok="handleSave"
    >
      <BasicForm
        :schemas="todoFormSchemas"
        :label-width="80"
        :show-action-button-group="false"
        :grid="{ cols: 1, gutter: 16 }"
        @register="formRegister"
      />
    </BasicDrawer>

    <GroupManager v-model:open="groupManagerOpen" @changed="handleGroupChanged" />
  </div>
</template>

<style scoped>
/* ============================================================
   仅保留 :deep() —— 穿透 antdv 内部 DOM，无法用 Tailwind 表达
   ============================================================ */
.todo-group-select :deep(.ant-select-selector) {
  background: rgba(255, 255, 255, 0.5) !important;
  border-color: rgba(148, 163, 184, 0.25) !important;
  border-radius: 10px !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
}
.todo-group-select :deep(.ant-select-selector:hover) {
  border-color: rgba(59, 130, 246, 0.4) !important;
}
:global(.dark) .todo-group-select :deep(.ant-select-selector) {
  background: rgba(30, 41, 59, 0.6) !important;
  border-color: rgba(71, 85, 105, 0.4) !important;
  color: #cbd5e1 !important;
}
:global(.dark) .todo-group-select :deep(.ant-select-selector:hover) {
  border-color: rgba(96, 165, 250, 0.5) !important;
}
</style>
