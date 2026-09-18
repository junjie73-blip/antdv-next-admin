<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message, Modal, Tag } from "antdv-next";
import { computed, h, ref, watch } from "vue";

import { formatSize } from "../utils";

import {
  cancelUploadTasks,
  getUploadTaskList,
  type UploadTaskItem,
  type UploadTaskListParams,
  type UploadTaskStatus,
} from "@/api";

import {
  type ActionItem,
  type BasicColumn,
  BasicTable,
  TableAction,
  useTable,
} from "@/components/business/Table";

defineOptions({ name: "UploadTaskModal" });

const props = defineProps<{
  open: boolean;
}>();

const emit = defineEmits<{
  "update:open": [v: boolean];
  /** 取消成功后通知外部（比如刷新文件列表） */
  canceled: [taskIds: string[]];
}>();

const visible = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

const STATUS_MAP: Record<UploadTaskStatus, { label: string; color: string; icon: string }> = {
  pending: { label: "等待中", color: "default", icon: "carbon:time" },
  uploading: {
    label: "上传中",
    color: "processing",
    icon: "carbon:in-progress",
  },
  merging: { label: "合并中", color: "purple", icon: "carbon:merge" },
  failed: { label: "失败", color: "error", icon: "carbon:warning" },
};

const [tableRegister, tableMethods] = useTable();
const selectedKeys = ref<string[]>([]);
/* ============================================================
 * 表格列
 * ============================================================ */
const columns: BasicColumn[] = [
  {
    title: "文件名",
    dataIndex: "fileName",
    key: "fileName",
    width: 240,
    ellipsis: true,
  },
  {
    title: "大小",
    dataIndex: "totalSize",
    key: "totalSize",
    width: 100,
    align: "center",
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 110,
    align: "center",
  },
  {
    title: "进度",
    dataIndex: "progress",
    key: "progress",
    width: 160,
    align: "center",
  },
  {
    title: "错误信息",
    dataIndex: "errorMsg",
    key: "errorMsg",
    ellipsis: true,
    customRender: ({ text }) =>
      text
        ? h("span", { class: "text-xs text-red-500" }, String(text))
        : h("span", { class: "text-xs text-gray-400" }, "-"),
  },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 170,
    align: "center",
  },
];

/* ============================================================
 * 行操作
 * ============================================================ */
function getTaskActions(record: UploadTaskItem): ActionItem[] {
  const canCancel =
    record.status === "pending" ||
    record.status === "uploading" ||
    record.status === "merging" ||
    record.status === "failed";

  if (!canCancel) return [];

  return [
    {
      label: "取消",
      icon: "ant-design:close-circle-outlined",
      danger: true,
      disabled: () => record.status === "failed",
      popConfirm: {
        title: "取消上传任务",
        content: `确定取消「${record.fileName}」吗？`,
        confirm: () => handleCancelSingle(record),
      },
    },
  ];
}

const actionColumn = {
  width: 120,
  title: "操作",
  fixed: "right" as const,
  actions: (record: UploadTaskItem) => getTaskActions(record),
};

/* ============================================================
 * 取消逻辑
 * ============================================================ */
const canceling = ref(false);

async function handleCancelSingle(record: UploadTaskItem) {
  canceling.value = true;
  try {
    await cancelUploadTasks([record.taskId]);
    message.success(`已取消「${record.filename}」`);
    emit("canceled", [record.taskId]);
    tableMethods.value?.reload();
  } finally {
    canceling.value = false;
  }
}

async function handleBatchCancel() {
  if (selectedKeys.value.length === 0) {
    message.warning("请至少选择一条任务");
    return;
  }

  Modal.confirm({
    title: "批量取消上传任务",
    content: `确定取消选中的 ${selectedKeys.value.length} 个任务吗？`,
    okButtonProps: { danger: true },
    async onOk() {
      canceling.value = true;
      try {
        const ids = [...selectedKeys.value];
        await cancelUploadTasks(ids);
        message.success(`已取消 ${ids.length} 个任务`);
        emit("canceled", ids);
        selectedKeys.value = [];
        tableMethods.value?.reload();
      } finally {
        canceling.value = false;
      }
    },
  });
}
function getProgress(record: UploadTaskItem) {
  const r = record as UploadTaskItem;
  const uploaded = r.uploadedChunks ?? 0;
  const total = r.totalChunks ?? 0;
  const percent =
    r.progress != null ? r.progress : total > 0 ? Math.round((uploaded / total) * 100) : 0;
  return percent;
}
</script>

<template>
  <a-modal
    v-model:open="visible"
    title="上传任务"
    width="1000px"
    :footer="null"
    :mask-closable="true"
    :destroy-on-close="false"
  >
    <div class="space-y-3">
      <!-- 工具栏 -->

      <!-- 列表 -->
      <BasicTable
        :columns="columns"
        :api="getUploadTaskList"
        :immediate="true"
        :use-search-form="false"
        :action-column="actionColumn"
        row-key="taskId"
        :pagination="{ pageSize: 10, showSizeChanger: true }"
        :scroll="{ x: 1000 }"
        table-layout="fixed"
        @register="tableRegister"
        :show-table-setting="false"
      >
        <template #tool>
          <div class="flex items-center justify-between">
            <span class="text-sm text-gray-500 dark:text-gray-400">
              已选 {{ selectedKeys.length }} 项
            </span>
            <a-button
              danger
              :disabled="selectedKeys.length === 0"
              :loading="canceling"
              @click="handleBatchCancel"
            >
              <template #icon><Icon icon="carbon:close" /></template>
              批量取消
            </a-button>
          </div>
        </template>
        <template #cell-totalSize="{ text }">
          {{ formatSize(Number(text) || 0) }}
        </template>
        <template #cell-status="{ text }">
          <a-tag :color="STATUS_MAP[text as UploadTaskStatus]?.color || 'blue'">{{
            STATUS_MAP[text as UploadTaskStatus]?.label || "-"
          }}</a-tag>
        </template>
        <template #cell-progress="{ record }">
          <a-progress :percent="getProgress(record)" />
        </template>
        <template #action="{ record }">
          <TableAction :actions="getTaskActions(record as UploadTaskItem)" />
        </template>
      </BasicTable>
    </div>
  </a-modal>
</template>
