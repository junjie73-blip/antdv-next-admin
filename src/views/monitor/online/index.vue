<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { Modal, message } from "antdv-next";

import { getOnlineList, kickAllOnline, kickOnline } from "@/api/system";
import { BasicTable, TableAction, useTable, type ActionItem } from "@/components/business/Table";

// 抽离的模块
import { getOnlineActions } from "./actions";
import { onlineActionColumn, onlineColumns, onlineRowKey, onlineScroll } from "./columns";
import type { OnlineUserRecord } from "./types";

defineOptions({ name: "MonitorOnline" });

// ========== 表格实例 ==========
const [tableRegister, tableMethods] = useTable();

// ========== 强制单个用户下线 ==========
// 说明：确认环节由操作项的 popConfirm 负责，这里直接执行副作用
async function handleKick(record: OnlineUserRecord) {
  await kickOnline(record.userId);
  message.success("已强制下线");
  tableMethods.value?.reload();
}

// ========== 全部下线 ==========
async function handleKickAll() {
  Modal.confirm({
    title: "全部下线",
    content: "确定要强制所有在线用户下线吗？",
    okText: "确定",
    cancelText: "取消",
    okType: "danger",
    async onOk() {
      await kickAllOnline();
      message.success("已全部下线");
      tableMethods.value?.reload();
    },
  });
}

// ========== 操作项 ==========
function getActions(record: OnlineUserRecord): ActionItem[] {
  return getOnlineActions(record, { onKick: handleKick });
}
</script>

<template>
  <a-card title="在线用户" :bordered="false" class="shadow-sm">
    <BasicTable
      :columns="onlineColumns"
      :api="getOnlineList"
      :immediate="true"
      :use-search-form="false"
      :scroll="onlineScroll"
      :row-key="onlineRowKey"
      :action-column="onlineActionColumn"
      @register="tableRegister"
    >
      <template #toolbar>
        <a-button danger @click="handleKickAll">
          <template #icon><Icon icon="ant-design:logout-outlined" /></template>
          全部下线
        </a-button>
      </template>

      <template #action="{ record }">
        <TableAction :actions="getActions(record as OnlineUserRecord)" />
      </template>
    </BasicTable>
  </a-card>
</template>
