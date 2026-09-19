<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { message } from "antdv-next";
import { computed, onMounted, ref, watch } from "vue";

// ========== 抽离的模块 ==========
import { type FileActionContext, getFileActions } from "./actions";
import { fileActionColumn, fileColumns, filePagination, fileRowKey, fileScroll } from "./columns";
import FileCategoryNav from "./components/FileCategoryNav.vue";
import UploadTaskModal from "./components/UploadTaskModal.vue";
import { FILE_CATEGORIES, UPLOAD_ACCEPT, UPLOAD_ACTION, UPLOAD_MAX_SIZE } from "./constants";
import { fileSearchSchemas } from "./schemas";
import { formatSize, getFileColor, getFileIcon } from "./utils";

import type { FileCategory, FileRecord } from "./types";

import { deleteFile, downloadFile, getFileList, previewFile } from "~/api";
import { type ActionItem, BasicTable, TableAction, useTable } from "~/components/business/Table";
import PreviewDialog from "~/components/common/PreviewDialog.vue";
import { ChunkUpload, type ChunkUploadTask, Upload } from "~/components/common/Upload";
import { useUserStore } from "~/stores/modules/user";
defineOptions({ name: "SystemFile" });
const chunkRef = ref<InstanceType<typeof ChunkUpload> | null>(null);
const chunkDrawerOpen = ref(false);
const taskModalOpen = ref(false);
const previewVisible = ref(false);
const current = ref({
  fileId: "",
  url: "",
  fileName: "",
  mimeType: "",
  category: "",
});

// ============================================================
// 分类
// ============================================================
const categories = ref<FileCategory[]>(FILE_CATEGORIES.map((c) => ({ ...c, count: 0 })));
const currentCategory = ref<string>("all");

// ============================================================
// 表格
// ============================================================
const [tableRegister, tableMethods] = useTable();

/** 传给 BasicTable 的额外参数：分类由左侧导航驱动 */
const tableParams = computed<Record<string, unknown>>(() =>
  currentCategory.value === "all" ? {} : { category: currentCategory.value },
);

/** 包装 API：记录总数到"全部"分类 */
async function fetchFileList(_params: Record<string, unknown>) {
  const params = {
    ..._params,
    ...tableParams.value,
  };
  if (currentCategory.value === "all") {
    delete params.category;
  }
  const res = await getFileList(params as never);

  return res;
}

// 切换分类 → 重新加载
watch(currentCategory, () => {
  tableMethods.value?.reload();
  if (currentCategory.value === "all") {
    tableMethods.value?.reload();
  }
});
const contentFunc: FileActionContext = {
  async onPreview(record) {
    current.value = {
      fileId: record.fileId,
      url: record.url, // ⬅️ 数据库里的原始 COS URL，作为兜底
      fileName: record.filename,
      mimeType: record.mimeType!,
      category: record.category!,
    };
    previewVisible.value = true;
  },
  onDelete(record) {
    deleteFile(record.url).then(() => {
      message.success("删除成功");
      tableMethods.value?.reload();
    });
  },
  async onDownload(record) {
    const res: any = await downloadFile({
      url: record.url,
      fileId: record.fileId,
    });
    res.data.url && window.open(res.data.url, "_blank");
  },
};
function openChunkDrawer() {
  chunkDrawerOpen.value = true;
}
function handleChunkComplete(tasks: ChunkUploadTask[]) {
  const successCount = tasks.filter((t) => t.status === "success").length;
  const errorCount = tasks.filter((t) => t.status === "error").length;

  if (successCount > 0) {
    message.success(`上传成功 ${successCount} 个文件`);
    tableMethods.value?.reload();
  }
  if (errorCount > 0) {
    message.warning(`${errorCount} 个文件上传失败，可在列表中重试`);
  }

  // 全部成功 → 自动关闭抽屉
  if (errorCount === 0) {
    setTimeout(() => {
      chunkDrawerOpen.value = false;
      chunkRef.value?.clear();
    }, 600);
  }
}

/** 抽屉关闭时清理已完成任务 */
function handleChunkDrawerClose() {
  const tasks = chunkRef.value?.getTasks() ?? [];
  const allSuccess = tasks.every((t) => t.status === "success");
  if (allSuccess) {
    chunkRef.value?.clear();
  }
}
function openTaskModal() {
  taskModalOpen.value = true;
}

/** 任务被取消 → 刷新列表（取消后文件可能不存在，或状态变化） */
function handleTasksCanceled(_taskIds: string[]) {
  tableMethods.value?.reload();
}
</script>

<template>
  <div class="flex flex-col gap-4 md:flex-row">
    <!-- 左侧分类导航 -->
    <FileCategoryNav v-model="currentCategory" :categories="categories" />

    <!-- 右侧文件列表 -->
    <div class="min-w-0 flex-1">
      <div
        class="rounded-lg border p-4 border-gray-100 bg-white dark:border-gray-800 dark:bg-gray-900"
      >
        <BasicTable
          :columns="fileColumns"
          :api="fetchFileList"
          :params="tableParams"
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
          <!-- 工具栏：导出 + 上传 -->
          <template #toolbar>
            <Upload
              :max-size="10"
              :max-count="5"
              :show-upload-list="false"
              upload-text="上传"
              @success="() => tableMethods?.reload()"
            />
            <a-button type="primary" @click="openChunkDrawer">
              <template #icon><Icon icon="carbon:cloud-upload" /></template>
              大文件上传
            </a-button>
            <a-button @click="openTaskModal">
              <template #icon><Icon icon="carbon:task" /></template>
              上传任务
            </a-button>
          </template>

          <!-- 文件名列：图标 + 名称 -->
          <template #cell-filename="{ record }">
            <div class="flex min-w-0 items-center gap-2">
              <Icon
                :icon="getFileIcon(record as FileRecord)"
                :style="{
                  color: getFileColor(record as FileRecord),
                  fontSize: '16px',
                }"
                class="shrink-0"
              />
              <span class="truncate" :title="record.filename">
                {{ record.filename }}
              </span>
            </div>
          </template>

          <!-- 操作列 -->
          <template #action="{ record }">
            <TableAction :actions="getFileActions(record as FileRecord, contentFunc)" />
          </template>
        </BasicTable>
      </div>
    </div>
    <a-drawer
      v-model:open="chunkDrawerOpen"
      title="大文件上传"
      :width="720"
      placement="right"
      :destroy-on-close="false"
      @close="handleChunkDrawerClose"
    >
      <template #extra>
        <span class="text-xs text-gray-400 dark:text-gray-500">
          支持分片、断点续传、暂停/继续
        </span>
      </template>

      <ChunkUpload
        ref="chunkRef"
        :chunk-size="5 * 1024 * 1024"
        :concurrency="3"
        :multiple="true"
        @complete="handleChunkComplete"
      />
    </a-drawer>
    <UploadTaskModal v-model:open="taskModalOpen" @canceled="handleTasksCanceled" />
    <PreviewDialog
      v-model="previewVisible"
      :file-id="current.fileId"
      :url="current.url"
      :file-name="current.fileName"
      :mime-type="current.mimeType"
      :category="current.category"
    />
  </div>
</template>
