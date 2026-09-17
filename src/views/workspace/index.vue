<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { BorderBeam } from "antdv-next";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { getWorkbenchSummary } from "@/api";
import { useUserStore } from "@/stores/modules/user";

import { DEFAULT_WORKBENCH_DATA, SHORTCUTS, STAT_CARD_CONFIGS } from "./constants";
import { greeting, getSubGreeting, getTodayLabel, getWeekLabel } from "./utils";
import { renderLogItem } from "./render";
import type { LogItem, WorkbenchData } from "./types";

defineOptions({ name: "WorkBench" });

const router = useRouter();
const userStore = useUserStore();

const data = ref<WorkbenchData>({ ...DEFAULT_WORKBENCH_DATA });

async function load() {
  const res = await getWorkbenchSummary();
  data.value = res?.data ?? res ?? data.value;
}

const todayLabel = computed(() => getTodayLabel());
const weekLabel = computed(() => getWeekLabel());
const subGreeting = computed(() => getSubGreeting());

const statCards = computed(() =>
  STAT_CARD_CONFIGS.map((cfg) => ({
    ...cfg,
    value: data.value.stats?.[cfg.key] || 0,
  })),
);

const recentLogs = computed<LogItem[]>(() => data.value.recentLogs || []);
function getLogRowKey(item: LogItem) {
  return item.log_id;
}

function navigate(path: string) {
  router.push(path);
}

onMounted(load);
</script>

<template>
  <div class="workbench">
    <!-- ============================================================ -->
    <!-- 背景光晕层（绝对定位，不影响布局）                             -->
    <!-- ============================================================ -->
    <div class="wb-bg" aria-hidden="true">
      <div class="wb-blob wb-blob-1" />
      <div class="wb-blob wb-blob-2" />
      <div class="wb-blob wb-blob-3" />
    </div>

    <!-- ============================================================ -->
    <!-- 内容层                                                        -->
    <!-- ============================================================ -->
    <div class="relative z-10 space-y-5">
      <!-- ==================== 欢迎卡片 ==================== -->
      <div class="welcome-glass rounded-3xl overflow-hidden">
        <div class="relative flex items-center gap-6 p-7 md:p-8">
          <!-- 头像 -->
          <div class="relative flex-shrink-0">
            <div class="avatar-ring" />
            <a-avatar
              :size="72"
              :src="userStore.avatar"
              class="relative ring-4 ring-white/70 dark:ring-slate-800/70 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-2xl shadow-sm"
            >
              {{ userStore.username?.charAt(0)?.toUpperCase() || "U" }}
            </a-avatar>
            <span
              class="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-3 ring-white dark:ring-slate-900"
            />
          </div>

          <!-- 文案 -->
          <div class="flex-1 min-w-0">
            <h1
              class="text-[22px] md:text-2xl font-semibold text-slate-800 dark:text-slate-100 tracking-tight flex items-center gap-2"
            >
              {{ greeting }}，{{ userStore.username || "朋友" }}
              <span class="text-2xl select-none">👋</span>
            </h1>
            <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
              {{ subGreeting }}
            </p>

            <div class="mt-3 flex items-center gap-2 text-xs flex-wrap">
              <span class="pill-glass">
                <Icon icon="carbon:calendar" class="text-blue-500" />
                {{ todayLabel }} · {{ weekLabel }}
              </span>
              <span class="pill-glass">
                <Icon icon="carbon:user-role" class="text-violet-500" />
                {{ userStore.roles?.join("、") || "未分配角色" }}
              </span>
            </div>
          </div>

          <!-- 右侧数据 -->
          <div class="hidden md:flex items-center gap-4 pr-1">
            <button class="stat-mini group" @click="navigate('/message/todo')">
              <div class="flex items-baseline gap-1">
                <span
                  class="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-none"
                >
                  {{ data.stats?.todoUncompleted || 0 }}
                </span>
                <span class="text-xs text-slate-400">项</span>
              </div>
              <span class="text-[11px] text-slate-500 dark:text-slate-400">待处理</span>
            </button>

            <div class="w-px h-10 bg-slate-200/80 dark:bg-slate-700/80" />

            <button class="stat-mini group" @click="navigate('/message/my')">
              <div class="flex items-baseline gap-1">
                <span
                  class="text-2xl font-bold text-slate-800 dark:text-slate-100 tabular-nums leading-none"
                >
                  {{ data.stats?.unreadNotice || 0 }}
                </span>
                <span class="text-xs text-slate-400">条</span>
              </div>
              <span class="text-[11px] text-slate-500 dark:text-slate-400">未读</span>
            </button>
          </div>
        </div>
      </div>

      <!-- ==================== 统计卡片 ==================== -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <BorderBeam
          v-for="card in statCards"
          :key="card.title"
          :color="`linear-gradient(90deg, transparent, ${card.color}, transparent)`"
          :duration="5"
          :size="120"
          class="rounded-2xl"
        >
          <div
            class="glass-card group relative rounded-2xl px-5 py-5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5"
            @click="navigate(card.path)"
          >
            <div class="flex items-start justify-between gap-3">
              <div class="min-w-0">
                <div class="text-xs text-slate-500 dark:text-slate-400 font-medium">
                  {{ card.title }}
                </div>
                <div class="mt-3 flex items-baseline gap-1">
                  <span
                    class="text-[28px] font-semibold tracking-tight text-slate-800 dark:text-slate-100 tabular-nums leading-none"
                  >
                    {{ card.value }}
                  </span>
                  <span class="text-xs text-slate-400">{{ card.suffix }}</span>
                </div>
              </div>

              <div
                class="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3"
                :style="{ backgroundColor: `${card.color}14`, color: card.color }"
              >
                <Icon :icon="card.icon" class="text-xl" />
              </div>
            </div>

            <!-- 底部高光 -->
            <div
              class="absolute bottom-0 left-5 right-5 h-px rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              :style="{
                background: `linear-gradient(90deg, transparent, ${card.color}, transparent)`,
              }"
            />
          </div>
        </BorderBeam>
      </div>

      <!-- ==================== 快捷入口 + 待办 ==================== -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <!-- 快捷入口 -->
        <BorderBeam
          class="rounded-2xl lg:col-span-2"
          color="linear-gradient(90deg, transparent, #3B82F6, transparent)"
          :duration="7"
          :size="200"
        >
          <div class="glass-card rounded-2xl h-full">
            <div
              class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/40 dark:border-slate-700/40"
            >
              <div class="flex items-center gap-2.5">
                <div class="icon-chip bg-blue-500/12 text-blue-500">
                  <Icon icon="carbon:apps" />
                </div>
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  快捷入口
                </span>
              </div>
              <span class="text-xs text-slate-400">常用功能一触即达</span>
            </div>

            <div class="grid grid-cols-4 gap-1 p-4">
              <div
                v-for="s in SHORTCUTS"
                :key="s.path"
                class="group flex flex-col items-center gap-2.5 py-4 rounded-2xl cursor-pointer transition-all duration-300 hover:bg-white/50 dark:hover:bg-slate-800/40"
                @click="navigate(s.path)"
              >
                <div
                  class="relative w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3"
                  :style="{ backgroundColor: `${s.color}12`, color: s.color }"
                >
                  <Icon :icon="s.icon" class="text-[22px]" />
                  <div
                    class="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                    :style="{ boxShadow: `0 4px 16px ${s.color}33` }"
                  />
                </div>
                <span
                  class="text-xs font-medium text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors"
                >
                  {{ s.title }}
                </span>
              </div>
            </div>
          </div>
        </BorderBeam>

        <!-- 我的待办 -->
        <BorderBeam
          class="rounded-2xl"
          color="linear-gradient(90deg, transparent, #06B6D4, transparent)"
          :duration="8"
          :size="200"
        >
          <div class="glass-card rounded-2xl h-full">
            <div
              class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/40 dark:border-slate-700/40"
            >
              <div class="flex items-center gap-2.5">
                <div class="icon-chip bg-cyan-500/12 text-cyan-500">
                  <Icon icon="carbon:task" />
                </div>
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">
                  我的待办
                </span>
              </div>
              <a-button
                type="link"
                size="small"
                class="!px-1 !text-slate-500 hover:!text-blue-600"
                @click="navigate('/message/todo')"
              >
                更多
                <Icon icon="carbon:chevron-right" class="text-xs" />
              </a-button>
            </div>

            <div class="p-5 space-y-3">
              <!-- 进行中 -->
              <div class="todo-tile todo-tile-blue">
                <div class="flex items-center gap-3">
                  <div class="todo-icon bg-gradient-to-br from-blue-400 to-indigo-500">
                    <Icon icon="carbon:list-checked" class="text-lg" />
                  </div>
                  <div>
                    <div class="text-xs text-blue-600/90 dark:text-blue-400/90 font-medium">
                      进行中
                    </div>
                    <div
                      class="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none mt-0.5 tabular-nums"
                    >
                      {{ data.stats?.todoUncompleted || 0 }}
                      <span class="text-xs font-normal text-slate-400">项</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 已逾期 -->
              <div class="todo-tile todo-tile-rose">
                <div class="flex items-center gap-3">
                  <div class="todo-icon bg-gradient-to-br from-rose-400 to-pink-500">
                    <Icon icon="carbon:warning-alt" class="text-lg" />
                  </div>
                  <div>
                    <div class="text-xs text-rose-600/90 dark:text-rose-400/90 font-medium">
                      已逾期
                    </div>
                    <div
                      class="text-xl font-bold text-slate-800 dark:text-slate-100 leading-none mt-0.5 tabular-nums"
                    >
                      {{ data.stats?.todoOverdue || 0 }}
                      <span class="text-xs font-normal text-slate-400">项</span>
                    </div>
                  </div>
                </div>
              </div>

              <button class="primary-action" @click="navigate('/message/todo')">
                <Icon icon="carbon:arrow-right" />
                查看全部待办
              </button>
            </div>
          </div>
        </BorderBeam>
      </div>

      <!-- ==================== 最近操作 ==================== -->
      <div class="glass-card rounded-2xl overflow-hidden">
        <div
          class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/40 dark:border-slate-700/40"
        >
          <div class="flex items-center gap-2.5">
            <div class="icon-chip bg-slate-500/10 text-slate-500 dark:text-slate-400">
              <Icon icon="carbon:time" />
            </div>
            <span class="text-sm font-semibold text-slate-700 dark:text-slate-200"> 最近操作 </span>
            <span class="text-xs text-slate-400">（{{ recentLogs.length }} 条）</span>
          </div>
        </div>

        <div v-if="recentLogs.length === 0" class="py-16 text-center">
          <div
            class="w-16 h-16 mx-auto rounded-2xl bg-slate-100/60 dark:bg-slate-800/40 flex items-center justify-center mb-3"
          >
            <Icon icon="carbon:document" class="text-3xl text-slate-300 dark:text-slate-600" />
          </div>
          <div class="text-sm text-slate-400">暂无操作记录</div>
        </div>

        <a-listy
          v-else
          :items="recentLogs"
          :row-key="getLogRowKey"
          :height="360"
          :item-render="renderLogItem"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* ============================================================
   工作台容器
   ============================================================ */
.workbench {
  position: relative;
  isolation: isolate;
  min-height: 100%;
  padding: 4px;
}

/* ============================================================
   液态玻璃卡片（核心）
   ============================================================ */
.glass-card {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.65);
  box-shadow:
    0 4px 24px -8px rgba(15, 23, 42, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.7);
}

:global(.dark) .glass-card {
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(148, 163, 184, 0.14);
  box-shadow:
    0 4px 24px -8px rgba(0, 0, 0, 0.3),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* ============================================================
   欢迎卡片
   ============================================================ */
.welcome-glass {
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.7);
  box-shadow:
    0 8px 32px -12px rgba(59, 130, 246, 0.1),
    0 4px 16px -8px rgba(139, 92, 246, 0.06),
    inset 0 1px 0 rgba(255, 255, 255, 0.8);
}

:global(.dark) .welcome-glass {
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(148, 163, 184, 0.15);
  box-shadow:
    0 8px 32px -12px rgba(0, 0, 0, 0.4),
    inset 0 1px 0 rgba(255, 255, 255, 0.05);
}

/* 头像光环 */
.avatar-ring {
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  background: conic-gradient(from 0deg, #60a5fa, #a78bfa, #34d399, #60a5fa);
  filter: blur(8px);
  opacity: 0.55;
}

/* 玻璃胶囊 */
.pill-glass {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  color: rgb(71 85 105);
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border: 1px solid rgba(255, 255, 255, 0.7);
}

:global(.dark) .pill-glass {
  color: rgb(203 213 225);
  background: rgba(30, 41, 59, 0.5);
  border-color: rgba(148, 163, 184, 0.12);
}

/* 右侧数据按钮 */
.stat-mini {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
  padding: 12px 16px;
  border-radius: 16px;
  transition: background-color 200ms ease;
}
.stat-mini:hover {
  background: rgba(255, 255, 255, 0.55);
}
:global(.dark) .stat-mini:hover {
  background: rgba(30, 41, 59, 0.5);
}

/* ============================================================
   图标小胶囊（标题左侧）
   ============================================================ */
.icon-chip {
  width: 32px;
  height: 32px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
}

/* ============================================================
   待办小卡
   ============================================================ */
.todo-tile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  border-radius: 16px;
  border: 1px solid transparent;
}

.todo-tile-blue {
  background: linear-gradient(135deg, rgba(219, 234, 254, 0.6), rgba(224, 231, 255, 0.4));
  border-color: rgba(59, 130, 246, 0.15);
}
:global(.dark) .todo-tile-blue {
  background: linear-gradient(135deg, rgba(30, 58, 138, 0.2), rgba(49, 46, 129, 0.15));
  border-color: rgba(59, 130, 246, 0.15);
}

.todo-tile-rose {
  background: linear-gradient(135deg, rgba(255, 228, 230, 0.6), rgba(252, 231, 243, 0.4));
  border-color: rgba(244, 63, 94, 0.15);
}
:global(.dark) .todo-tile-rose {
  background: linear-gradient(135deg, rgba(136, 19, 55, 0.2), rgba(131, 24, 67, 0.15));
  border-color: rgba(244, 63, 94, 0.15);
}

.todo-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 4px 12px -2px rgba(59, 130, 246, 0.25);
}

/* ============================================================
   主操作按钮
   ============================================================ */
.primary-action {
  width: 100%;
  padding: 10px 16px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, #6366f1);
  color: white;
  font-size: 14px;
  font-weight: 500;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 4px 16px -4px rgba(59, 130, 246, 0.35);
  transition: all 250ms ease;
  cursor: pointer;
}
.primary-action:hover {
  background: linear-gradient(135deg, #2563eb, #4f46e5);
  box-shadow: 0 6px 20px -4px rgba(59, 130, 246, 0.45);
  transform: translateY(-1px);
}

/* ============================================================
   降级方案：不支持 backdrop-filter 的浏览器
   ============================================================ */
@supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
  .glass-card {
    background: rgba(255, 255, 255, 0.92);
  }
  :global(.dark) .glass-card {
    background: rgba(30, 41, 59, 0.92);
  }
  .welcome-glass {
    background: rgba(255, 255, 255, 0.9);
  }
  :global(.dark) .welcome-glass {
    background: rgba(30, 41, 59, 0.9);
  }
  .pill-glass {
    background: rgba(255, 255, 255, 0.95);
  }
  :global(.dark) .pill-glass {
    background: rgba(30, 41, 59, 0.95);
  }
}
</style>
