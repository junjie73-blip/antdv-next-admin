<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import { onMounted, ref, watch } from "vue";

import type { CacheGroupInfo } from "../types";

import { clearCacheGroup, getCacheGroups } from "~/api";

defineOptions({ name: "CacheGroupList" });

const props = defineProps<{
  current: string | null;
}>();

const emit = defineEmits<{
  change: [group: { name: string; prefix: string } | null];
}>();

const loading = ref(false);
const groups = ref<CacheGroupInfo[]>([]);

async function loadGroups() {
  loading.value = true;
  try {
    const res = (await getCacheGroups()) as { data?: CacheGroupInfo[] } | CacheGroupInfo[];
    groups.value = (res as { data?: CacheGroupInfo[] })?.data ?? (res as CacheGroupInfo[]) ?? [];
  } finally {
    loading.value = false;
  }
}

function handleSelect(group: CacheGroupInfo) {
  if (props.current === group.name) return;
  emit("change", { name: group.name, prefix: group.prefix });
}

async function handleClearGroup(group: CacheGroupInfo, e: Event) {
  e.stopPropagation();
  await clearCacheGroup(group.prefix);
  message.success(`已清空「${group.remark}」`);
  await loadGroups();
  if (props.current === group.name) {
    emit("change", null);
  }
}

watch(
  () => props.current,
  () => {
    // 每次切换后重新统计（可选）
  },
);

defineExpose({ reload: loadGroups });

onMounted(loadGroups);
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
        <span class="text-sm font-medium text-gray-700 dark:text-gray-200"> 缓存列表 </span>
        <a-tag color="blue" class="!m-0 !text-[10px]"> 共 {{ groups.length }} 项 </a-tag>
      </div>
      <button
        type="button"
        class="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-800 dark:hover:text-gray-300"
        title="刷新"
        @click="loadGroups"
      >
        <Icon icon="carbon:renew" class="text-sm" />
      </button>
    </div>

    <!-- 列表 -->
    <div class="min-h-0 flex-1 overflow-auto">
      <div v-if="loading" class="p-4 text-center text-xs text-gray-400">加载中...</div>
      <div v-else-if="groups.length === 0" class="p-4 text-center text-xs text-gray-400">
        暂无数据
      </div>
      <div v-else>
        <div
          v-for="group in groups"
          :key="group.name"
          :class="[
            'group flex cursor-pointer items-center justify-between gap-2 border-b border-gray-50 px-3 py-2 transition-colors last:border-b-0',
            'dark:border-gray-800/50',
            current === group.name
              ? 'bg-blue-50 dark:bg-blue-950/40'
              : 'hover:bg-gray-50 dark:hover:bg-gray-800/60',
          ]"
          @click="handleSelect(group)"
        >
          <div class="min-w-0 flex-1">
            <div
              :class="[
                'flex items-center gap-1 truncate text-sm',
                current === group.name
                  ? 'font-medium text-blue-600 dark:text-blue-400'
                  : 'text-gray-700 dark:text-gray-200',
              ]"
              :title="group.name"
            >
              <span class="truncate">{{ group.name }}</span>

              <!-- ⭐ 未分类标记 -->
              <span
                v-if="group.discovered"
                class="shrink-0 rounded bg-amber-100 px-1 text-[10px] leading-4 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400"
                title="未在 CACHE_GROUPS 中配置"
              >
                自动
              </span>
            </div>

            <div class="mt-0.5 flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
              <span>{{ group.remark }}</span>
              <span
                v-if="group.count > 0"
                class="rounded-full bg-blue-100 px-1.5 text-[10px] leading-4 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300"
              >
                {{ group.count }}
              </span>
            </div>
          </div>

          <button
            type="button"
            class="shrink-0 rounded p-1 text-gray-300 opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100 dark:hover:bg-red-950/40"
            title="清空该缓存组"
            @click="(e) => handleClearGroup(group, e)"
          >
            <Icon icon="carbon:trash-can" class="text-sm" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
