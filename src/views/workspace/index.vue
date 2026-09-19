<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { BorderBeam } from "antdv-next";
import { computed, onMounted, ref } from "vue";
import { useRouter } from "vue-router";

import { DEFAULT_WORKBENCH_DATA, SHORTCUTS, STAT_CARD_CONFIGS } from "./constants";
import { renderLogItem, renderNoticeItem } from "./render";
import { getSubGreeting, getTodayLabel, getWeekLabel, greeting } from "./utils";

import type { LogItem, WorkbenchData } from "./types";

import { getWorkbenchSummary } from "~/api";
import { useUserStore } from "~/stores/modules/user";

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
const notices = computed(() => data.value.notices || []);
onMounted(load);
</script>

<template>
  <div class="relative isolate h-full p-1">
    <div class="relative z-10 space-y-5 h-full flex justify-between flex-col">
      <!-- ==================== 欢迎卡片 ==================== -->
      <div
        class="rounded-3xl overflow-hidden bg-white/50 backdrop-blur-2xl border border-white/70 shadow-[0_8px_32px_-12px_rgba(59,130,246,0.1),0_4px_16px_-8px_rgba(139,92,246,0.06),inset_0_1px_0_rgba(255,255,255,0.8)] dark:bg-slate-900/55 dark:border-slate-600/40 dark:shadow-[0_8px_32px_-12px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
      >
        <div class="relative flex items-center gap-6 p-7 md:p-8">
          <!-- 头像 -->
          <div class="relative shrink-0">
            <div
              class="absolute -inset-1 rounded-full blur-md opacity-55 dark:opacity-35 bg-[conic-gradient(from_0deg,#60a5fa,#a78bfa,#34d399,#60a5fa)]"
            />
            <a-avatar
              :size="72"
              :src="userStore.avatar"
              class="relative ring-4 ring-white/70 dark:ring-slate-800/70 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-2xl shadow-sm"
            >
              {{ userStore.username?.charAt(0)?.toUpperCase() || "U" }}
            </a-avatar>
            <span
              class="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-[3px] ring-white dark:ring-slate-900"
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
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-white/70 dark:border-slate-600/40"
              >
                <Icon icon="carbon:calendar" class="text-blue-500" />
                {{ todayLabel }} · {{ weekLabel }}
              </span>
              <span
                class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-slate-600 dark:text-slate-300 bg-white/60 dark:bg-slate-800/60 backdrop-blur-sm border border-white/70 dark:border-slate-600/40"
              >
                <Icon icon="carbon:user-role" class="text-violet-500" />
                {{ userStore.roles?.join("、") || "未分配角色" }}
              </span>
            </div>
          </div>

          <!-- 右侧数据 -->
          <div class="hidden md:flex items-center gap-4 pr-1">
            <button
              class="group flex flex-col items-end gap-1 px-4 py-3 rounded-2xl hover:bg-white/55 dark:hover:bg-slate-800/50 transition-colors"
              @click="navigate('/message/todo')"
            >
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

            <button
              class="group flex flex-col items-end gap-1 px-4 py-3 rounded-2xl hover:bg-white/55 dark:hover:bg-slate-800/50 transition-colors"
              @click="navigate('/message/my')"
            >
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
            class="group relative rounded-2xl px-5 py-5 cursor-pointer transition-all duration-300 hover:-translate-y-0.5 bg-white/[0.55] dark:bg-slate-900/[0.55] backdrop-blur-xl border border-white/[0.65] dark:border-slate-600/[0.35] shadow-[0_4px_24px_-8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
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
                class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3"
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
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <!-- 快捷入口 -->
        <BorderBeam
          class="rounded-2xl"
          color="linear-gradient(90deg, transparent, #3B82F6, transparent)"
          :duration="7"
          :size="200"
        >
          <div
            class="rounded-2xl lg:col-span-2 h-full bg-white/[0.55] dark:bg-slate-900/[0.55] backdrop-blur-xl border border-white/[0.65] dark:border-slate-600/[0.35] shadow-[0_4px_24px_-8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <div
              class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/40 dark:border-slate-700/40"
            >
              <div class="flex items-center gap-2.5">
                <div
                  class="w-8 h-8 rounded-xl flex items-center justify-center text-base bg-blue-500/[0.12] text-blue-500"
                >
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
          <div
            class="rounded-2xl h-full bg-white/[0.55] dark:bg-slate-900/[0.55] backdrop-blur-xl border border-white/[0.65] dark:border-slate-600/[0.35] shadow-[0_4px_24px_-8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
          >
            <div
              class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/40 dark:border-slate-700/40"
            >
              <div class="flex items-center gap-2.5">
                <div
                  class="w-8 h-8 rounded-xl flex items-center justify-center text-base bg-cyan-500/[0.12] text-cyan-500"
                >
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
              <div
                class="p-3.5 rounded-2xl border bg-gradient-to-br from-blue-100/60 to-indigo-100/40 border-blue-500/[0.15] dark:from-blue-900/25 dark:to-indigo-900/20 dark:border-blue-500/[0.25]"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-blue-400 to-indigo-500 shadow-[0_4px_12px_-2px_rgba(59,130,246,0.25)]"
                  >
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
              <div
                class="p-3.5 rounded-2xl border bg-gradient-to-br from-rose-100/60 to-pink-100/40 border-rose-500/[0.15] dark:from-rose-900/25 dark:to-pink-900/20 dark:border-rose-500/[0.25]"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-gradient-to-br from-rose-400 to-pink-500 shadow-[0_4px_12px_-2px_rgba(59,130,246,0.25)]"
                  >
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

              <button
                class="w-full py-2.5 rounded-xl text-white text-sm font-medium bg-gradient-to-br from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 shadow-[0_4px_16px_-4px_rgba(59,130,246,0.35)] hover:shadow-[0_6px_20px_-4px_rgba(59,130,246,0.45)] hover:-translate-y-px transition-all duration-250 flex items-center justify-center gap-1.5"
                @click="navigate('/message/todo')"
              >
                <Icon icon="carbon:arrow-right" />
                查看全部待办
              </button>
            </div>
          </div>
        </BorderBeam>
      </div>
      <!-- ==================== 最近操作 ==================== -->
      <div class="grid grid-cols-2 gap-4 flex-1">
        <div
          class="flex flex-col rounded-2xl overflow-hidden bg-white/[0.55] dark:bg-slate-900/[0.55] backdrop-blur-xl border border-white/[0.65] dark:border-slate-600/[0.35] shadow-[0_4px_24px_-8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <div
            class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/40 dark:border-slate-700/40"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="w-8 h-8 rounded-xl flex items-center justify-center text-base bg-slate-500/10 text-slate-500 dark:text-slate-400"
              >
                <Icon icon="ant-design:alert-outlined" />
              </div>
              <span class="text-sm font-semibold text-slate-700 dark:text-slate-200"> 重要 </span>
              <span class="text-xs text-slate-400">（{{ notices.length }} 条）</span>
            </div>
          </div>
          <!-- 通知列表 -->
          <div
            v-if="notices.length === 0"
            class="py-12 text-center flex-1 flex justify-center items-center"
          >
            <a-empty description="暂无通知" class="text-sm text-slate-400">
              <template #image>
                <Icon
                  icon="carbon:notification"
                  class="text-3xl text-slate-300 dark:text-slate-600"
                />
              </template>
            </a-empty>
          </div>

          <a-listy
            v-else
            :items="notices"
            row-key="noticeId"
            :height="560"
            :item-render="renderNoticeItem"
          />
        </div>
        <div
          class="rounded-2xl flex flex-col overflow-hidden bg-white/[0.55] dark:bg-slate-900/[0.55] backdrop-blur-xl border border-white/[0.65] dark:border-slate-600/[0.35] shadow-[0_4px_24px_-8px_rgba(15,23,42,0.06),inset_0_1px_0_rgba(255,255,255,0.7)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]"
        >
          <div
            class="flex items-center justify-between px-5 pt-5 pb-3 border-b border-white/40 dark:border-slate-700/40"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="w-8 h-8 rounded-xl flex items-center justify-center text-base bg-slate-500/10 text-slate-500 dark:text-slate-400"
              >
                <Icon icon="carbon:time" />
              </div>
              <span class="text-sm font-semibold text-slate-700 dark:text-slate-200">
                最近操作
              </span>
              <span class="text-xs text-slate-400">（{{ recentLogs.length }} 条）</span>
            </div>
          </div>

          <div
            v-if="recentLogs.length === 0"
            class="py-16 text-center flex-1 flex justify-center items-center"
          >
            <a-empty description="暂无操作记录" class="text-sm text-slate-400">
              <template #image>
                <Icon icon="carbon:document" class="text-3xl text-slate-300 dark:text-slate-600" />
              </template>
            </a-empty>
          </div>

          <a-listy
            v-else
            :items="recentLogs"
            :row-key="getLogRowKey"
            :height="560"
            :item-render="renderLogItem"
          />
        </div>
      </div>
    </div>
  </div>
</template>
