<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { message } from 'antdv-next'
import { computed, onMounted, ref } from 'vue'

import { getMyLoginLogs, type LoginLogItem } from '~/api/auth'
import dayjs from '~/utils/dayjs'

defineOptions({ name: 'LoginLogPanel' })

/* ============================================================
 * 状态
 * ============================================================ */
const loading = ref(false)
const list = ref<LoginLogItem[]>([])
const total = ref(0)
const pageNum = ref(1)
const pageSize = ref(10)
const statusFilter = ref<'0' | '1' | undefined>(undefined)

/* ============================================================
 * 数据加载
 * ============================================================ */
async function load() {
  loading.value = true
  try {
    const res: any = await getMyLoginLogs({
      pageNum: pageNum.value,
      pageSize: pageSize.value,
      status: statusFilter.value,
    })
    const data = res?.data ?? res ?? {}
    list.value = data.list ?? []
    total.value = data.total ?? 0
  } catch (e: any) {
    message.error(e?.message || '加载登录日志失败')
  } finally {
    loading.value = false
  }
}

function handlePageChange(page: number, size: number) {
  pageNum.value = page
  pageSize.value = size
  void load()
}

function handleStatusChange(val: '0' | '1' | undefined) {
  statusFilter.value = val
  pageNum.value = 1
  void load()
}

function handleRefresh() {
  pageNum.value = 1
  void load()
}

/* ============================================================
 * UA 图标映射
 * ============================================================ */
const OS_ICON_MAP: Record<string, string> = {
  'Windows 11': 'mdi:microsoft-windows',
  Windows: 'mdi:microsoft-windows',
  macOS: 'mdi:apple',
  iOS: 'mdi:apple',
  Android: 'mdi:android',
  Linux: 'mdi:linux',
  其他: 'carbon:unknown',
  未知: 'carbon:unknown',
}

const BROWSER_ICON_MAP: Record<string, string> = {
  Chrome: 'mdi:google-chrome',
  Edge: 'mdi:microsoft-edge',
  Firefox: 'mdi:firefox',
  Safari: 'mdi:apple-safari',
  微信: 'mdi:wechat',
  curl: 'carbon:terminal',
  Postman: 'carbon:api',
  其他: 'carbon:browser',
  未知: 'carbon:unknown',
}

function getOsIcon(os: string): string {
  return OS_ICON_MAP[os] ?? 'carbon:unknown'
}

function getBrowserIcon(browser: string): string {
  return BROWSER_ICON_MAP[browser] ?? 'carbon:browser'
}

/* ============================================================
 * 派生数据
 * ============================================================ */
const isEmpty = computed(() => !loading.value && list.value.length === 0)

/* ============================================================
 * 生命周期
 * ============================================================ */
onMounted(load)
</script>

<template>
  <div class="space-y-4">
    <!-- 标题栏 + 筛选 -->
    <div class="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 dark:border-slate-800">
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-slate-700 dark:text-slate-200"> 最近登录记录 </span>
        <span
          class="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800 dark:text-slate-400"
        >
          共 {{ total }} 条
        </span>
      </div>

      <div class="flex items-center gap-2">
        <a-radio-group v-model:value="statusFilter" size="small" button-style="solid" @change="handleStatusChange">
          <a-radio-button :value="undefined">全部</a-radio-button>
          <a-radio-button value="1">成功</a-radio-button>
          <a-radio-button value="0">失败</a-radio-button>
        </a-radio-group>

        <a-button size="small" @click="handleRefresh">
          <template #icon>
            <Icon icon="carbon:renew" />
          </template>
          刷新
        </a-button>
      </div>
    </div>

    <!-- 加载中 -->
    <a-spin :spinning="loading">
      <!-- 空状态 -->
      <div
        v-if="isEmpty"
        class="flex flex-col items-center justify-center gap-3 py-12 text-slate-400 dark:text-slate-500"
      >
        <Icon icon="carbon:document-blank" class="text-4xl opacity-40" />
        <span class="text-xs">暂无登录记录</span>
      </div>

      <!-- 日志列表 -->
      <div v-else class="space-y-2">
        <div
          v-for="(log, index) in list"
          :key="log.logId"
          class="group relative flex items-start gap-3 rounded-xl border border-slate-100 bg-white/60 p-3.5 transition-all duration-200 hover:-translate-y-px hover:border-slate-200 hover:bg-white hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/40 dark:hover:border-slate-700 dark:hover:bg-slate-900/60"
        >
          <!-- 序号 -->
          <div
            class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-semibold tabular-nums"
            :class="
              log.status === '1'
                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400'
            "
          >
            <Icon v-if="log.status === '1'" icon="carbon:checkmark" class="text-lg" />
            <Icon v-else icon="carbon:close" class="text-lg" />
          </div>

          <!-- 内容 -->
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              <!-- 状态标签 -->
              <a-tag :color="log.status === '1' ? 'green' : 'red'" class="!m-0 !text-[11px]">
                {{ log.status === '1' ? '登录成功' : '登录失败' }}
              </a-tag>

              <!-- IP -->
              <span class="inline-flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <Icon icon="carbon:location" />
                {{ log.ipAddress || '未知 IP' }}
              </span>

              <!-- 时间 -->
              <span class="text-xs text-slate-400 dark:text-slate-500">
                {{ dayjs(log.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
              </span>
              <span v-if="dayjs(log.createdAt).fromNow()" class="text-[11px] text-slate-400 dark:text-slate-500">
                · {{ dayjs(log.createdAt).fromNow() }}
              </span>
            </div>

            <!-- UA 解析 -->
            <div class="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span class="inline-flex items-center gap-1">
                <Icon :icon="getOsIcon(log.os)" />
                {{ log.os }}
              </span>
              <span class="inline-flex items-center gap-1">
                <Icon :icon="getBrowserIcon(log.browser)" />
                {{ log.browser }}
              </span>
              <span v-if="log.message" class="inline-flex items-center gap-1 text-slate-400 dark:text-slate-500">
                <Icon icon="carbon:information" />
                {{ log.message }}
              </span>
            </div>

            <!-- 原始 UA（hover 显示） -->
            <div
              v-if="log.userAgent"
              class="mt-1.5 max-h-0 overflow-hidden text-[10px] text-slate-400 transition-all duration-300 group-hover:max-h-20 dark:text-slate-500"
            >
              <code class="break-all">{{ log.userAgent }}</code>
            </div>
          </div>
        </div>
      </div>

      <!-- 分页 -->
      <div
        v-if="!isEmpty"
        class="mt-4 flex items-center justify-end border-t border-slate-100 pt-3 dark:border-slate-800"
      >
        <a-pagination
          v-model:current="pageNum"
          v-model:page-size="pageSize"
          :total="total"
          :show-size-changer="true"
          :page-size-options="['10', '20', '50']"
          :show-total="(t: number) => `共 ${t} 条`"
          size="small"
          @change="handlePageChange"
          @show-size-change="handlePageChange"
        />
      </div>
    </a-spin>
  </div>
</template>
