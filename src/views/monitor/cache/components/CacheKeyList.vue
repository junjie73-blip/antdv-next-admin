<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import { ref, watch } from "vue";

import { formatTtl } from "../utils";

import type { CacheKeyInfo } from "../types";

import { deleteCacheKey, getCacheKeys } from "~/api";

defineOptions({ name: "CacheKeyList" });

const props = defineProps<{
  prefix: string | null;
  groupName: string | null;
  currentKey: string | null;
}>();

const emit = defineEmits<{
  change: [key: string | null];
}>();

const loading = ref(false);
const keys = ref<CacheKeyInfo[]>([]);

async function loadKeys() {
  if (!props.prefix) {
    keys.value = [];
    return;
  }
  loading.value = true;
  try {
    const res = (await getCacheKeys({ prefix: props.prefix })) as
      | { data?: CacheKeyInfo[] }
      | CacheKeyInfo[];
    keys.value = (res as { data?: CacheKeyInfo[] })?.data ?? (res as CacheKeyInfo[]) ?? [];
  } finally {
    loading.value = false;
  }
}

function handleSelect(item: CacheKeyInfo) {
  if (props.currentKey === item.key) return;
  emit("change", item.key);
}

async function handleDelete(item: CacheKeyInfo, e: Event) {
  e.stopPropagation();
  await deleteCacheKey(item.key);
  message.success("已删除");
  if (props.currentKey === item.key) emit("change", null);
  await loadKeys();
}

watch(
  () => props.prefix,
  () => {
    emit("change", null);
    void loadKeys();
  },
  { immediate: true },
);
</script>

<template>
  <div
    class="flex h-full flex-col rounded-lg border border-gray-100 bg-white shadow-sm dark:border-gray-800 dark:bg-gray-900"
  >
    <!-- 头部 -->
    <div
      class="flex shrink-0 items-center justify-between border-b border-gray-100 px-3 py-2.5 dark:border-gray-800"
    >
      <div class="flex items-center gap-2">
        <span class="h-3 w-0.5 rounded bg-blue-500" />
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200"> 键名列表 </span>
        <a-tag color="blue" class="!m-0 !text-[10px]"> 共 {{ keys.length }} 项 </a-tag>
      </div>
      <button
        type="button"
        class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        title="刷新"
        @click="loadKeys"
      >
        <Icon icon="carbon:renew" class="text-sm" />
      </button>
    </div>

    <!-- 内容 -->
    <div class="min-h-0 flex-1 overflow-hidden">
      <!-- 未选中缓存组 -->
      <div
        v-if="!prefix"
        class="flex h-full flex-col items-center justify-center gap-2 text-xs text-gray-400 dark:text-gray-500"
      >
        <Icon icon="carbon:database" class="text-3xl" />
        <span>请先选择左侧缓存名称</span>
      </div>

      <!-- 加载中 -->
      <div v-else-if="loading" class="p-4 text-center text-xs text-gray-400">加载中...</div>

      <!-- 空 -->
      <div v-else-if="keys.length === 0" class="p-4 text-center text-xs text-gray-400">
        暂无数据
      </div>

      <!-- 列表 -->
      <div v-else class="h-full">
        <Scrollbar class="h-full" height="594">
          <div
            v-for="item in keys"
            :key="item.key"
            :class="[
              'group flex cursor-pointer items-center justify-between gap-2 border-b border-gray-50 px-3 py-2 transition-colors last:border-b-0',
              'dark:border-gray-800/50',
              currentKey === item.key
                ? 'bg-blue-50 dark:bg-blue-950/40'
                : 'hover:bg-gray-50 dark:hover:bg-gray-800/60',
            ]"
            @click="handleSelect(item)"
          >
            <div class="min-w-0 flex-1">
              <div
                :class="[
                  'truncate font-mono text-xs',
                  currentKey === item.key
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-700 dark:text-gray-200',
                ]"
                :title="item.key"
              >
                {{ item.key }}
              </div>
              <div class="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                <span>{{ item.type }}</span>
                <span>·</span>
                <span>{{ formatTtl(item.ttl) }}</span>
              </div>
            </div>

            <button
              type="button"
              class="shrink-0 rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/40"
              title="删除该 Key"
              @click="(e) => handleDelete(item, e)"
            >
              <Icon icon="carbon:trash-can" class="text-sm" />
            </button>
          </div>
        </Scrollbar>
      </div>
    </div>
  </div>
</template>
