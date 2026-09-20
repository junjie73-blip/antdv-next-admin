<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { onMounted, onUnmounted, ref } from "vue";

import CacheGroupList from "./components/CacheGroupList.vue";
import CacheKeyList from "./components/CacheKeyList.vue";
import CacheValuePanel from "./components/CacheValuePanel.vue";

import type { CacheInfo } from "./types";

import { getCacheInfo } from "~/api";

defineOptions({ name: "MonitorCache" });

/* ============================================================
 * 联动状态
 * ============================================================ */
const info = ref<CacheInfo | null>(null);

/** 左侧选中 */
const currentGroup = ref<{ name: string; prefix: string } | null>(null);
/** 中间选中 */
const currentKey = ref<string | null>(null);

/** 左栏选中变化 → 重置中、右栏 */
function handleGroupChange(group: { name: string; prefix: string } | null) {
  currentGroup.value = group;
  currentKey.value = null;
}

/** 中栏选中变化 */
function handleKeyChange(key: string | null) {
  currentKey.value = key;
}

/* ============================================================
 * 顶部概览
 * ============================================================ */
async function loadInfo() {
  const res = (await getCacheInfo()) as { data?: CacheInfo } | CacheInfo;
  info.value = (res as { data?: CacheInfo })?.data ?? (res as CacheInfo) ?? null;
}

const lastUpdate = ref("");

function updateTimeText() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  lastUpdate.value = `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

let timer: ReturnType<typeof setInterval> | null = null;

onMounted(() => {
  void loadInfo();
  updateTimeText();
  timer = setInterval(() => void loadInfo(), 30000);
  // 每 5 秒更新"更新于"文案
  setInterval(updateTimeText, 5000);
});

onUnmounted(() => {
  if (timer) clearInterval(timer);
});

function refreshInfo() {
  void loadInfo();
  updateTimeText();
}
</script>

<template>
  <div class="flex h-full flex-col overflow-hidden gap-3">
    <!-- 顶部概览 -->
    <div
      class="rounded-lg border border-gray-100 bg-white p-4 shadow-sm dark:border-gray-800 dark:bg-gray-900"
    >
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-base font-medium text-gray-800 dark:text-gray-100">缓存监控</h2>
          <p class="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            按缓存名称、键名逐级浏览 Redis 缓存内容，支持单条与全量清理
          </p>
        </div>
        <div class="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <span>更新于 {{ lastUpdate }}</span>
          <button
            type="button"
            class="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800"
            title="刷新"
            @click="refreshInfo"
          >
            <Icon icon="carbon:renew" class="text-sm" />
          </button>
        </div>
      </div>

      <!-- 指标条 -->
      <div class="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6">
        <div class="flex flex-col">
          <span class="text-xs text-gray-500 dark:text-gray-400">Redis 版本</span>
          <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
            {{ info?.redisVersion || "-" }}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-gray-500 dark:text-gray-400">连接客户端</span>
          <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
            {{ info?.connectedClients ?? 0 }} 个
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-gray-500 dark:text-gray-400">已用内存</span>
          <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
            {{ info?.usedMemoryHuman || "-" }}
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-gray-500 dark:text-gray-400">运行时间</span>
          <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
            {{ info?.uptimeDays ?? 0 }} 天
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-gray-500 dark:text-gray-400">命中率</span>
          <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
            {{ info?.hitRate || "0.00" }}%
          </span>
        </div>
        <div class="flex flex-col">
          <span class="text-xs text-gray-500 dark:text-gray-400">Key 数量</span>
          <span class="text-sm font-medium text-gray-800 dark:text-gray-100">
            {{ info?.dbKeys ?? 0 }} 个
          </span>
        </div>
      </div>
    </div>

    <!-- 三栏布局 -->
    <div class="grid flex-1 grid-cols-12 gap-3">
      <!-- 左：缓存列表 -->
      <div class="col-span-3 min-h-0">
        <CacheGroupList :current="currentGroup?.name ?? null" @change="handleGroupChange" />
      </div>

      <!-- 中：键名列表 -->
      <div class="col-span-4 min-h-0">
        <CacheKeyList
          :prefix="currentGroup?.prefix ?? null"
          :group-name="currentGroup?.name ?? null"
          :current-key="currentKey"
          @change="handleKeyChange"
        />
      </div>

      <!-- 右：缓存内容 -->
      <div class="col-span-5 min-h-0">
        <CacheValuePanel :cache-key="currentKey" />
      </div>
    </div>
  </div>
</template>
