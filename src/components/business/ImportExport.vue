<script setup lang="ts">
import { DownloadOutlined, UploadOutlined } from "@antdv-next/icons";
import { message, Modal } from "antdv-next";
import dayjs from "dayjs";
import { h, ref } from "vue";

import { http } from "@/utils";
import { generateTemplate, type TemplateColumn } from "@/utils/template";


interface Props {
  /** 模块路径，如 "/user"（自动调 `${module}/export` 和 `${module}/import`） */
  module: string;
  /** 导出文件名前缀，默认取 module 的最后一段 */
  filename?: string;
  /** 导入的字段名（默认 "file"） */
  fieldName?: string;
  /** 接受的文件类型 */
  accept?: string;
  /** 文件大小限制（MB） */
  maxSizeMB?: number;
  /** 导出的额外查询参数（用于筛选） */
  exportParams?: Record<string, any>;
  /** 是否禁用导出 */
  disableExport?: boolean;
  /** 是否禁用导入 */
  disableImport?: boolean;
  /** 导出按钮文案 */
  exportText?: string;
  /** 导入按钮文案 */
  importText?: string;
  /** 导入成功的回调 */
  onImportSuccess?: (result: ImportResult) => void;
  /** 导出成功的回调 */
  onExportSuccess?: () => void;
  /** 导入失败时的自定义处理（返回 true 表示已处理，不弹默认 Modal） */
  onImportError?: (result: ImportResult) => boolean | void;
  /** 导入模板 */
  importTemplate?: TemplateColumn[];
}

interface ImportResult {
  successCount: number;
  failCount: number;
  errors: string[];
  summary?: Record<string, any>;
}

const props = withDefaults(defineProps<Props>(), {
  fieldName: "file",
  accept: ".xlsx,.xls",
  maxSizeMB: 10,
  disableExport: false,
  disableImport: false,
  exportText: "导出",
  importText: "导入",
});

const emit = defineEmits<{
  exportError: [error: Error];
  importError: [error: Error];
}>();

const exporting = ref(false);
const importing = ref(false);

// ============================================================
// 导出
// ============================================================
async function handleExport() {
  if (exporting.value) return;
  exporting.value = true;
  const params = {
    ...props.exportParams,
  };
  if ((params?.ids as string[])?.length <= 0) {
    message.error("请选择导出数据");
    exporting.value = false;
    return;
  } else {
    params.ids = params.ids.join(",");
  }
  try {
    const res = await http
      .Get(`${props.module}/export`, {
        params,
        meta: { responseType: "blob" },
      } as any)
      .send(true);

    // res 可能是 Blob 或包含 blob 的对象
    const blob = res instanceof Blob ? res : (res as any)?.data;

    if (!(blob instanceof Blob)) {
      throw new Error("导出失败：返回数据格式不正确");
    }

    // 从 header 或默认命名生成文件名
    const downloadName = `${props.filename || props.module.split("/").pop()}_${dayjs().format("YYYY-MM-DD")}_${new Date().getTime()}.xlsx`;

    triggerDownload(blob, downloadName);
    message.success("导出成功");
    props.onExportSuccess?.();
  } catch (e: any) {
    const err = e instanceof Error ? e : new Error(String(e));
    message.error(err.message || "导出失败");
    emit("exportError", err);
  } finally {
    exporting.value = false;
  }
}

/** 触发浏览器下载 */
function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // 延迟释放，避免某些浏览器提前 revoke 导致下载失败
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ============================================================
// 导入
// ============================================================
function handleBeforeUpload(file: File): boolean {
  if (!props.importTemplate) {
    message.error("请先配置导入模板");
    return false;
  }

  // 1) 类型校验
  const isValidType = props.accept
    .split(",")
    .some((ext) => file.name.toLowerCase().endsWith(ext.trim().toLowerCase()));
  if (!isValidType) {
    message.error(`仅支持 ${props.accept} 格式文件`);
    return false;
  }

  // 2) 大小校验
  const sizeMB = file.size / 1024 / 1024;
  if (sizeMB > props.maxSizeMB) {
    message.error(`文件大小不能超过 ${props.maxSizeMB}MB`);
    return false;
  }

  // 3) 手动触发上传（返回 false 阻止默认行为）
  void uploadFile(file);
  return false;
}

async function uploadFile(file: File) {
  if (importing.value) return;
  importing.value = true;

  try {
    const formData = new FormData();
    formData.append(props.fieldName, file);

    const res: any = await http.Post(`${props.module}/import`, formData);
    const result: ImportResult = res?.data ?? res;

    handleImportResult(result);
    props.onImportSuccess?.(result);
  } catch (e: any) {
    const err = e instanceof Error ? e : new Error(String(e));
    message.error(err.message || "导入失败");
    emit("importError", err);
  } finally {
    importing.value = false;
  }
}

function handleImportResult(result: ImportResult) {
  const { successCount = 0, failCount = 0, errors = [] } = result;

  // 全部成功
  if (failCount === 0) {
    message.success(`导入成功 ${successCount} 条`);
    return;
  }

  // 部分失败 → 弹窗展示详情
  const MAX_SHOW = 20;
  const shownErrors = errors.slice(0, MAX_SHOW);
  const moreText =
    errors.length > MAX_SHOW ? `\n...还有 ${errors.length - MAX_SHOW} 条错误未显示` : "";

  // 允许自定义处理
  if (props.onImportError?.(result)) {
    return;
  }

  Modal.info({
    title: "导入结果",
    width: 640,
    content: () =>
      h("div", [
        h("p", { class: "mb-3 text-sm" }, `成功 ${successCount} 条，失败 ${failCount} 条`),
        errors.length > 0 &&
          h(
            "div",
            {
              class:
                "max-h-[400px] overflow-y-auto bg-red-50 dark:bg-red-900/20 p-3 rounded text-xs",
            },
            shownErrors.map((err, i) =>
              h("div", { key: i, class: "mb-1 text-red-600 dark:text-red-400" }, err),
            ),
          ),
        moreText && h("p", { class: "mt-2 text-xs text-stone-500" }, moreText),
      ]),
    okText: "知道了",
  });
}
function downloadTemplate() {
  generateTemplate(
    props.filename ?? props.module.split("/").pop() + "导入模板",
    props.importTemplate!,
  );
}
</script>

<template>
  <a-space>
    <a-button :loading="exporting"
:disabled="disableExport"
@click="handleExport">
      <template #icon>
        <DownloadOutlined />
      </template>
      {{ exportText }}
    </a-button>

    <a-upload
      :show-upload-list="false"
      :accept="accept"
      :disabled="disableImport"
      :before-upload="handleBeforeUpload"
      :multiple="false"
    >
      <a-button :loading="importing"
:disabled="disableImport">
        <template #icon>
          <UploadOutlined />
        </template>
        {{ importText }}
      </a-button>
    </a-upload>
    <a-button type="primary"
@click="downloadTemplate">
      <template #icon>
        <UploadOutlined />
      </template>
      导入模板
    </a-button>
  </a-space>
</template>
