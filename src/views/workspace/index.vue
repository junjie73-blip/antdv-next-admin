<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { BorderBeam } from 'antdv-next'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getWorkbenchSummary } from '~/api'
import { useUserStore } from '~/stores/modules/user'

import type { LogItem, WorkbenchData } from './types'

import { DEFAULT_WORKBENCH_DATA, SHORTCUTS, STAT_CARD_CONFIGS } from './constants'
import { renderLogItem, renderNoticeItem } from './render'
import { getSubGreeting, getTodayLabel, getWeekLabel, greeting } from './utils'

defineOptions({ name: 'WorkBench' })

const router = useRouter()
const userStore = useUserStore()

const data = ref<WorkbenchData>({ ...DEFAULT_WORKBENCH_DATA })

async function load() {
  const res = await getWorkbenchSummary()
  data.value = res?.data ?? res ?? data.value
}

const todayLabel = computed(() => getTodayLabel())
const weekLabel = computed(() => getWeekLabel())
const subGreeting = computed(() => getSubGreeting())

const statCards = computed(() =>
  STAT_CARD_CONFIGS.map((cfg) => ({
    ...cfg,
    value: data.value.stats?.[cfg.key] || 0,
  })),
)

const recentLogs = computed<LogItem[]>(() => data.value.recentLogs || [])
function getLogRowKey(item: LogItem) {
  return item.log_id
}

function navigate(path: string) {
  router.push(path)
}
const notices = computed(() => data.value.notices || [])
onMounted(load)
</script>

<template>
  <PerfectScrollbar class="h-full">
    <div class="relative isolate h-full p-1">
      <div class="relative z-10 flex h-full flex-col justify-between gap-4">
        <!-- ==================== 欢迎卡片 ==================== -->
        <a-card :bordered="false">
          <div class="flex items-center gap-2">
            <!-- 头像 -->
            <div class="relative shrink-0">
              <div
                class="absolute -inset-1 rounded-full bg-[conic-gradient(from_0deg,#60a5fa,#a78bfa,#34d399,#60a5fa)] opacity-55 blur-md dark:opacity-35"
              />
              <a-avatar
                :size="72"
                :src="userStore.avatar"
                class="relative bg-slate-100 text-2xl text-slate-600 shadow-sm ring-4 ring-white/70 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-800/70"
              >
                {{ userStore.username?.charAt(0)?.toUpperCase() || 'U' }}
              </a-avatar>
              <span
                class="absolute right-1 bottom-1 h-4 w-4 rounded-full bg-emerald-500 ring-[3px] ring-white dark:ring-slate-900"
              />
            </div>

            <!-- 文案 -->
            <div class="min-w-0 flex-1">
              <h1
                class="flex items-center gap-2 text-[22px] font-semibold tracking-tight text-slate-800 md:text-2xl dark:text-slate-100"
              >
                {{ greeting }}，{{ userStore.username || '朋友' }}
                <span class="text-2xl select-none">👋</span>
              </h1>
              <p class="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
                {{ subGreeting }}
              </p>

              <div class="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-2.5 py-1 text-slate-600 backdrop-blur-sm dark:border-slate-600/40 dark:bg-slate-800/60 dark:text-slate-300"
                >
                  <Icon icon="carbon:calendar" class="text-ant-primary" />
                  {{ todayLabel }} · {{ weekLabel }}
                </span>
                <span
                  class="inline-flex items-center gap-1.5 rounded-full border border-white/70 bg-white/60 px-2.5 py-1 text-slate-600 backdrop-blur-sm dark:border-slate-600/40 dark:bg-slate-800/60 dark:text-slate-300"
                >
                  <Icon icon="carbon:user-role" class="text-violet-500" />
                  {{ userStore.roles?.join('、') || '未分配角色' }}
                </span>
              </div>
            </div>

            <!-- 右侧数据 -->
            <div class="hidden items-center gap-4 pr-1 md:flex">
              <button
                class="group flex flex-col items-end gap-1 rounded-2xl px-4 py-3 transition-colors hover:bg-white/55 dark:hover:bg-slate-800/50"
                @click="navigate('/message/todo')"
              >
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl leading-none font-bold text-slate-800 tabular-nums dark:text-slate-100">
                    {{ data.stats?.todoUncompleted || 0 }}
                  </span>
                  <span class="text-xs text-slate-400">项</span>
                </div>
                <span class="text-[11px] text-slate-500 dark:text-slate-400">待处理</span>
              </button>

              <div class="h-10 w-px bg-slate-200/80 dark:bg-slate-700/80" />

              <button
                class="group flex flex-col items-end gap-1 rounded-2xl px-4 py-3 transition-colors hover:bg-white/55 dark:hover:bg-slate-800/50"
                @click="navigate('/message/my')"
              >
                <div class="flex items-baseline gap-1">
                  <span class="text-2xl leading-none font-bold text-slate-800 tabular-nums dark:text-slate-100">
                    {{ data.stats?.unreadNotice || 0 }}
                  </span>
                  <span class="text-xs text-slate-400">条</span>
                </div>
                <span class="text-[11px] text-slate-500 dark:text-slate-400">未读</span>
              </button>
            </div>
          </div>
        </a-card>

        <!-- ==================== 统计卡片 ==================== -->
        <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
          <BorderBeam v-for="card in statCards" :key="card.title" :color="card.color" :duration="5" :size="120">
            <a-card :bordered="false" @click="navigate(card.path)">
              <div class="flex items-start justify-between gap-3">
                <div class="min-w-0">
                  <div class="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {{ card.title }}
                  </div>
                  <div class="mt-3 flex items-baseline gap-1">
                    <span
                      class="text-[28px] leading-none font-semibold tracking-tight text-slate-800 tabular-nums dark:text-slate-100"
                    >
                      {{ card.value }}
                    </span>
                    <span class="text-xs text-slate-400">{{ card.suffix }}</span>
                  </div>
                </div>

                <div
                  class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3"
                  :style="{ backgroundColor: `${card.color}14`, color: card.color }"
                >
                  <Icon :icon="card.icon" class="text-xl" />
                </div>
              </div>

              <!-- 底部高光 -->
              <div
                class="absolute right-5 bottom-0 left-5 h-px rounded-full opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                :style="{
                  background: `linear-gradient(90deg, transparent, ${card.color}, transparent)`,
                }"
              />
            </a-card>
          </BorderBeam>
        </div>

        <!-- ==================== 快捷入口 + 待办 ==================== -->
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <!-- 快捷入口 -->
          <a-card class="col-span-2" :bordered="false">
            <div class="flex items-center justify-between border-b border-white/40 dark:border-slate-700/40">
              <div class="flex items-center gap-2.5">
                <div
                  class="text-ant-primary flex h-8 w-8 items-center justify-center rounded-xl bg-blue-500/[0.12] text-base"
                >
                  <Icon icon="carbon:apps" />
                </div>
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-200"> 快捷入口 </span>
              </div>
              <span class="text-xs text-slate-400">常用功能一触即达</span>
            </div>

            <div class="grid grid-cols-4 gap-1">
              <div
                v-for="s in SHORTCUTS"
                :key="s.path"
                class="group flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl py-4 transition-all duration-300 hover:bg-white/50 dark:hover:bg-slate-800/40"
                @click="navigate(s.path)"
              >
                <div
                  class="relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110 group-hover:-rotate-3"
                  :style="{ backgroundColor: `${s.color}12`, color: s.color }"
                >
                  <Icon :icon="s.icon" class="text-[22px]" />
                  <div
                    class="absolute inset-0 rounded-2xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
                    :style="{ boxShadow: `0 4px 16px ${s.color}33` }"
                  />
                </div>
                <span
                  class="text-xs font-medium text-slate-600 transition-colors group-hover:text-slate-900 dark:text-slate-400 dark:group-hover:text-slate-100"
                >
                  {{ s.title }}
                </span>
              </div>
            </div>
          </a-card>

          <!-- 我的待办 -->
          <a-card :bordered="false">
            <div class="flex items-center justify-between border-b border-white/40 pb-3 dark:border-slate-700/40">
              <div class="flex items-center gap-2.5">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-xl bg-cyan-500/[0.12] text-base text-cyan-500"
                >
                  <Icon icon="carbon:task" />
                </div>
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-200"> 我的待办 </span>
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

            <div class="space-y-3">
              <!-- 进行中 -->
              <div
                class="rounded-2xl border border-blue-500/[0.15] bg-gradient-to-br from-blue-100/60 to-indigo-100/40 p-3.5 dark:border-blue-500/[0.25] dark:from-blue-900/25 dark:to-indigo-900/20"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 text-white shadow-[0_4px_12px_-2px_rgba(59,130,246,0.25)]"
                  >
                    <Icon icon="carbon:list-checked" class="text-lg" />
                  </div>
                  <div>
                    <div class="text-xs font-medium text-blue-600/90 dark:text-blue-400/90">进行中</div>
                    <div class="mt-0.5 text-xl leading-none font-bold text-slate-800 tabular-nums dark:text-slate-100">
                      {{ data.stats?.todoUncompleted || 0 }}
                      <span class="text-xs font-normal text-slate-400">项</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- 已逾期 -->
              <div
                class="rounded-2xl border border-rose-500/[0.15] bg-gradient-to-br from-rose-100/60 to-pink-100/40 p-3.5 dark:border-rose-500/[0.25] dark:from-rose-900/25 dark:to-pink-900/20"
              >
                <div class="flex items-center gap-3">
                  <div
                    class="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-400 to-pink-500 text-white shadow-[0_4px_12px_-2px_rgba(59,130,246,0.25)]"
                  >
                    <Icon icon="carbon:warning-alt" class="text-lg" />
                  </div>
                  <div>
                    <div class="text-xs font-medium text-rose-600/90 dark:text-rose-400/90">已逾期</div>
                    <div class="mt-0.5 text-xl leading-none font-bold text-slate-800 tabular-nums dark:text-slate-100">
                      {{ data.stats?.todoOverdue || 0 }}
                      <span class="text-xs font-normal text-slate-400">项</span>
                    </div>
                  </div>
                </div>
              </div>

              <button
                class="flex w-full items-center justify-center gap-1.5 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 py-2.5 text-sm font-medium text-white shadow-[0_4px_16px_-4px_rgba(59,130,246,0.35)] transition-all duration-250 hover:-translate-y-px hover:from-blue-600 hover:to-indigo-700 hover:shadow-[0_6px_20px_-4px_rgba(59,130,246,0.45)]"
                @click="navigate('/message/todo')"
              >
                <Icon icon="carbon:arrow-right" />
                查看全部待办
              </button>
            </div>
          </a-card>
        </div>
        <!-- ==================== 最近操作 ==================== -->
        <div class="grid flex-1 grid-cols-2 gap-4">
          <a-card :bordered="false">
            <div class="flex items-center justify-between border-b border-white/40 pb-3 dark:border-slate-700/40">
              <div class="flex items-center gap-2.5">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-500/10 text-base text-slate-500 dark:text-slate-400"
                >
                  <Icon icon="ant-design:alert-outlined" />
                </div>
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-200"> 重要 </span>
                <span class="text-xs text-slate-400">（{{ notices.length }} 条）</span>
              </div>
            </div>
            <!-- 通知列表 -->
            <div v-if="notices.length === 0" class="flex flex-1 items-center justify-center py-12 text-center">
              <a-empty description="暂无通知" class="text-sm text-slate-400">
                <template #image>
                  <Icon icon="carbon:notification" class="text-3xl text-slate-300 dark:text-slate-600" />
                </template>
              </a-empty>
            </div>

            <a-listy v-else :items="notices" row-key="noticeId" :height="560" :item-render="renderNoticeItem" />
          </a-card>
          <a-card :bordered="false">
            <div class="flex items-center justify-between border-b border-white/40 pb-3 dark:border-slate-700/40">
              <div class="flex items-center gap-2.5">
                <div
                  class="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-500/10 text-base text-slate-500 dark:text-slate-400"
                >
                  <Icon icon="carbon:time" />
                </div>
                <span class="text-sm font-semibold text-slate-700 dark:text-slate-200"> 最近操作 </span>
                <span class="text-xs text-slate-400">（{{ recentLogs.length }} 条）</span>
              </div>
            </div>

            <div v-if="recentLogs.length === 0" class="flex flex-1 items-center justify-center py-16 text-center">
              <a-empty description="暂无操作记录" class="text-sm text-slate-400">
                <template #image>
                  <Icon icon="carbon:document" class="text-3xl text-slate-300 dark:text-slate-600" />
                </template>
              </a-empty>
            </div>

            <a-listy v-else :items="recentLogs" :row-key="getLogRowKey" :height="560" :item-render="renderLogItem" />
          </a-card>
        </div>
      </div>
    </div>
  </PerfectScrollbar>
</template>
