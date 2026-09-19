<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import { ref, watch } from "vue";

import { getNoticeActions } from "./actions";
import { fetchMyNotices, markAllNoticesRead } from "./api";
import { noticeActionColumn, noticeColumns, noticeRowKey, noticeScroll } from "./columns";
import { NOTICE_TYPE_MAP, TAB_TO_IS_READ } from "./constants";

import type { NoticeTabKey } from "./types";

import { BasicTable, useTable } from "~/components/business/Table";

defineOptions({ name: "MessageMy" });

const activeTab = ref<NoticeTabKey>("all");
const [tableRegister, tableMethods] = useTable();

/** 单条标记已读后的处理 */
function handleMarkReadSuccess() {
  message.success("已标记为已读");
  tableMethods.value?.reload();
}

function handleMarkReadError() {
  message.error("操作失败");
}

/** 表格操作项（每次渲染重新生成以携带最新 record） */
function getActions(record: any) {
  return getNoticeActions(record, {
    onSuccess: handleMarkReadSuccess,
    onError: handleMarkReadError,
  });
}

/** 全部标记已读 */
async function markAllRead() {
  try {
    await markAllNoticesRead();
    message.success("已全部标记为已读");
    tableMethods.value?.reload();
  } catch {
    message.error("操作失败");
  }
}

/** 切换 Tab 时重新拉取数据 */
watch(activeTab, (newVal) => {
  tableMethods.value?.reload({
    searchInfo: {
      isRead: TAB_TO_IS_READ[newVal],
    },
  });
});
</script>

<template>
  <a-card :bordered="false" class="shadow-sm">
    <div class="flex items-center justify-between mb-4">
      <a-tabs v-model:active-key="activeTab">
        <a-tab-pane key="all" tab="全部消息" />
        <a-tab-pane key="unread" tab="未读消息" />
        <a-tab-pane key="read" tab="已读消息" />
      </a-tabs>
      <a-button @click="markAllRead">
        <template #icon><Icon icon="carbon:checkmark-outline" /></template>
        全部已读
      </a-button>
    </div>

    <BasicTable
      :columns="noticeColumns"
      :api="fetchMyNotices"
      :immediate="true"
      :use-search-form="false"
      :scroll="noticeScroll"
      :row-key="noticeRowKey"
      :action-column="noticeActionColumn"
      :show-table-setting="false"
      @register="tableRegister"
    >
      <template #cell-noticeType="{ record }">
        <a-tag :color="NOTICE_TYPE_MAP[record.noticeType]?.color">
          {{ NOTICE_TYPE_MAP[record.noticeType]?.label }}
        </a-tag>
      </template>

      <template #cell-isRead="{ record }">
        <a-tag :color="record.isRead === 1 ? 'default' : 'blue'">
          {{ record.isRead === 1 ? "已读" : "未读" }}
        </a-tag>
      </template>

      <template #action="{ record }">
        <table-action :actions="getActions(record)" />
      </template>
    </BasicTable>
  </a-card>
</template>
