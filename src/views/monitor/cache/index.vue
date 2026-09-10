<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { onMounted, ref } from "vue";
import { getCacheInfo, getCacheKeys, deleteCacheKey, clearCache } from "@/api/system";
import { BasicTable, useTable } from "@/components/business/Table";
import { Modal, message } from "antdv-next";

defineOptions({ name: "MonitorCache" });

const info = ref<any>({});
const [tableRegister, tableMethods] = useTable();
const pattern = ref("");

async function loadInfo() {
  const res = await getCacheInfo();
  info.value = res?.data ?? res ?? {};
}

async function handleDelete(key: string) {
  Modal.confirm({
    title: "删除 Key",
    content: `确定删除「${key}」吗？`,
    async onOk() {
      await deleteCacheKey(key);
      message.success("已删除");
      tableMethods.value?.reload();
    },
  });
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

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / k ** i).toFixed(2)} ${units[i]}`;
}

function formatUptime(s: number): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  return `${d} 天 ${h} 小时`;
}

const columns = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }: any) => index + 1,
  },
  { title: "Key", dataIndex: "key", key: "key", ellipsis: true },
  { title: "类型", dataIndex: "type", key: "type", width: 100, align: "center" },
  {
    title: "TTL",
    dataIndex: "ttl",
    key: "ttl",
    width: 120,
    align: "center",
    customRender: ({ record }: any) => (record.ttl < 0 ? "永久" : `${record.ttl}s`),
  },
];

onMounted(loadInfo);
</script>

<template>
  <div class="space-y-4">
    <div class="grid grid-cols-4 gap-4">
      <a-card size="small" class="shadow-sm">
        <a-statistic title="Redis 版本" :value="info.version || '-'" />
      </a-card>
      <a-card size="small" class="shadow-sm">
        <a-statistic title="连接客户端" :value="info.connectedClients || 0" suffix="个" />
      </a-card>
      <a-card size="small" class="shadow-sm">
        <a-statistic title="已用内存" :value="formatBytes(info.usedMemory || 0)" />
      </a-card>
      <a-card size="small" class="shadow-sm">
        <a-statistic title="运行时间" :value="formatUptime(info.uptime || 0)" />
      </a-card>
      <a-card size="small" class="shadow-sm">
        <a-statistic title="命中次数" :value="info.hits || 0" />
      </a-card>
      <a-card size="small" class="shadow-sm">
        <a-statistic title="未命中次数" :value="info.misses || 0" />
      </a-card>
      <a-card size="small" class="shadow-sm">
        <a-statistic title="命中率" :value="info.hitRate + '%'" />
      </a-card>
      <a-card size="small" class="shadow-sm">
        <a-statistic title="Key 数量" :value="info.dbKeys || 0" suffix="个" />
      </a-card>
    </div>

    <a-card title="缓存 Key 列表" class="shadow-sm">
      <template #extra>
        <a-space>
          <a-input
            v-model:value="pattern"
            placeholder="搜索 pattern，如 session:*"
            allow-clear
            style="width: 200px"
            @press-enter="() => tableMethods.value?.reload()"
          />
          <a-button type="primary" @click="() => tableMethods.value?.reload()">搜索</a-button>
          <a-button danger @click="handleClear">
            <template #icon><Icon icon="ant-design:clear-outlined" /></template>
            清空
          </a-button>
        </a-space>
      </template>

      <BasicTable
        :columns="columns"
        :api="getCacheKeys"
        :immediate="true"
        :use-search-form="false"
        :pagination="false"
        :action-column="{ width: 100, title: '操作', fixed: 'right' }"
        @register="tableRegister"
      >
        <template #action="{ record }">
          <a-popconfirm
            :title="`确定删除「${record.key}」吗？`"
            @confirm="() => handleDelete(record.key)"
          >
            <a-button type="link" danger size="small">删除</a-button>
          </a-popconfirm>
        </template>
      </BasicTable>
    </a-card>
  </div>
</template>
