<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";

import { deleteFile, getFileList } from "@/api";
import { BasicTable, TableAction, useTable, type ActionItem } from "@/components/business/Table";
import { exportToExcel } from "@/utils/excel";

// 抽离的模块
import { getFileActions } from "./actions";
import { fileActionColumn, fileColumns, filePagination, fileRowKey, fileScroll } from "./columns";
import { cardClassName, containerClassName } from "./constants";
import { fileSearchSchemas } from "./schemas";
import type { FileRecord } from "./types";
import { formatSize, getFileColor, getFileIcon } from "./utils";

defineOptions({ name: "SystemFile" });

// ========== 表格实例 ==========
const [tableRegister, tableMethods] = useTable();

// ========== 删除 ==========
// 说明：确认环节由操作项的 popConfirm 负责，这里直接执行删除
async function handleDelete(record: FileRecord) {
  try {
    await deleteFile(record.fileId);
    message.success(`已删除：${record.filename}`);
    tableMethods.value?.reload();
  } catch (e: any) {
    message.error(e?.message || "删除失败");
  }
}

// ========== 预览 / 下载 ==========
function handlePreview(record: FileRecord) {
  if (!record.url) {
    message.warning("文件地址不存在");
    return;
  }
  window.open(record.url, "_blank");
}

function handleDownload(record: FileRecord) {
  if (!record.url) {
    message.warning("文件地址不存在");
    return;
  }
  window.open(record.url, "_blank");
}

// ========== 导出 ==========
function handleExport() {
  const rows = (tableMethods.value?.getDataSource?.() || []) as FileRecord[];
  if (rows.length === 0) {
    message.warning("暂无数据可导出");
    return;
  }
  exportToExcel({
    filename: "文件列表",
    sheetName: "文件列表",
    columns: [
      { header: "文件ID", key: "fileId", width: 36 },
      { header: "文件名", key: "filename", width: 30 },
      { header: "大小", key: "size", width: 12 },
      { header: "MIME 类型", key: "mimeType", width: 24 },
      { header: "上传者", key: "uploader", width: 36 },
      { header: "文件地址", key: "url", width: 50 },
      { header: "上传时间", key: "createdAt", width: 20 },
    ],
    data: rows.map((r) => ({ ...r, size: formatSize(r.size) })),
  });
  message.success("导出成功");
}

// ========== 操作项 ==========
function getActions(record: FileRecord): ActionItem[] {
  return getFileActions(record, {
    onPreview: handlePreview,
    onDownload: handleDownload,
    onDelete: handleDelete,
  });
}
</script>

<template>
  <div :class="containerClassName">
    <a-card :class="cardClassName" :bordered="false">
      <div class="p-4">
        <BasicTable
          :columns="fileColumns"
          :api="getFileList"
          :immediate="true"
          :use-search-form="true"
          :form-config="{ schemas: fileSearchSchemas, labelWidth: 80 }"
          :action-column="fileActionColumn"
          :pagination="filePagination"
          :scroll="fileScroll"
          :row-key="fileRowKey"
          table-layout="fixed"
          @register="tableRegister"
        >
          <template #toolbar>
            <a-button @click="handleExport">
              <template #icon><Icon icon="carbon:export" /></template>
              导出
            </a-button>
          </template>

          <!-- 文件名列：图标 + 名称 -->
          <template #cell-filename="{ record }">
            <div class="flex items-center gap-2 min-w-0">
              <Icon
                :icon="getFileIcon(record as FileRecord)"
                :style="{ color: getFileColor(record as FileRecord), fontSize: '16px' }"
                class="shrink-0"
              />
              <span class="truncate" :title="record.filename">{{ record.filename }}</span>
            </div>
          </template>

          <!-- 操作列 -->
          <template #action="{ record }">
            <TableAction :actions="getActions(record as FileRecord)" />
          </template>
        </BasicTable>
      </div>
    </a-card>
  </div>
</template>
