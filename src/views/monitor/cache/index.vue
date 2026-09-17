<script setup lang="ts">


// 抽离的模块
import { Icon } from "@iconify/vue";
import { message, Modal } from "antdv-next";
import { onMounted, ref } from "vue";

import { getCacheActions } from "./actions";
import { cacheActionColumn, cacheColumns } from "./columns";
import { formatBytes, formatHitRate, formatUptime } from "./utils";

import type { CacheInfo, CacheKeyRecord } from "./types";

import { clearCache, deleteCacheKey, getCacheInfo, getCacheKeys } from "@/api";
import { type ActionItem, BasicTable, TableAction, useTable } from "@/components/business/Table";

defineOptions({ name: "MonitorCache" });

// ============ 状态 ============
const info = ref<CacheInfo>({});
const [tableRegister, tableMethods] = useTable();
const pattern = ref("");

// ============ 数据加载 ============
async function loadInfo() {
  const res = await getCacheInfo();
  info.value = res?.data ?? res ?? {};
}

function handleSearch() {
  tableMethods.value?.reload();
}

// ============ 删除 / 清空 ============
async function handleDelete(record: CacheKeyRecord) {
  await deleteCacheKey(record.key);
  message.success("已删除");
  tableMethods.value?.reload();
}

async function handleClear() {
  Modal.confirm({
    title: "清空缓存",
    content: "确定清空所有缓存？该操作不可恢复！",
    okType: "danger",
    async onOk() {
      await clearCache();
      message.success("已清空");
      tableMethods.value?.reload();
      loadInfo();
    },
  });
}

// ============ 操作项 ============
function getActions(record: any): ActionItem[] {
  return getCacheActions(record, { onDelete: handleDelete });
}

onMounted(loadInfo);
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-4 gap-4">
      <a-card size="small"
class="shadow-sm">
        <a-statistic title="Redis 版本"
:value="info.version || '-'" />
      </a-card>
      <a-card size="small"
class="shadow-sm">
        <a-statistic title="连接客户端"
:value="info.connectedClients || 0"
suffix="个" />
      </a-card>
      <a-card size="small"
class="shadow-sm">
        <a-statistic title="已用内存"
:value="formatBytes(info.usedMemory || 0)" />
      </a-card>
      <a-card size="small"
class="shadow-sm">
        <a-statistic title="运行时间"
:value="formatUptime(info.uptime || 0)" />
      </a-card>
      <a-card size="small"
class="shadow-sm">
        <a-statistic title="命中次数"
:value="info.hits || 0" />
      </a-card>
      <a-card size="small"
class="shadow-sm">
        <a-statistic title="未命中次数"
:value="info.misses || 0" />
      </a-card>
      <a-card size="small"
class="shadow-sm">
        <a-statistic title="命中率"
:value="formatHitRate(info.hitRate)" />
      </a-card>
      <a-card size="small"
class="shadow-sm">
        <a-statistic title="Key 数量"
:value="info.dbKeys || 0"
suffix="个" />
      </a-card>
    </div>

    <a-card title="缓存 Key 列表"
class="shadow-sm">
      <template #extra>
        <a-space>
          <a-input
            v-model:value="pattern"
            placeholder="搜索 pattern，如 session:*"
            allow-clear
            style="width: 200px"
            @press-enter="handleSearch"
          />
          <a-button type="primary"
@click="handleSearch">搜索</a-button>
          <a-button danger
@click="handleClear">
            <template #icon><Icon icon="ant-design:clear-outlined" /></template>
            清空
          </a-button>
        </a-space>
      </template>

      <BasicTable
        :columns="cacheColumns"
        :api="getCacheKeys"
        :immediate="true"
        :use-search-form="false"
        :pagination="false"
        :action-column="cacheActionColumn"
        @register="tableRegister"
      >
        <template #action="{ record }">
          <TableAction :actions="getActions(record)" />
        </template>
      </BasicTable>
    </a-card>
  </div>
</template>
