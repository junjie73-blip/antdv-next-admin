<script setup lang="ts">
import type { TemplateColumn } from '@antdv/shared/template';

import { h, ref } from 'vue';

import { DownloadOutlined, UploadOutlined } from '@antdv-next/icons';
import { generateTemplate } from '@antdv/shared/template';
// 自动导入（unplugin-vue-components）只重写模板标签；这里的滚动区在 h() 渲染函数里，必须显式 import
import { Scrollbar } from '@antdv/ui/scrollbar';
import { message, Modal } from 'antdv-next';
import { isError } from 'es-toolkit';
import { request } from '~/composables';
import { submitExport } from '~/views/system/export/api';

interface Props {
  module: string;
  filename?: string;
  fieldName?: string;
  accept?: string;
  maxSizeMB?: number;
  exportParams?: Record<string, any>;
  disableExport?: boolean;
  disableImport?: boolean;
  exportText?: string;
  importText?: string;
  onImportSuccess?: (result: ImportResult) => void;
  onExportSuccess?: () => void;
  onImportError?: (result: ImportResult) => boolean | void;
  importTemplate?: TemplateColumn[];
  permissions: string[];
  importProps?: Record<string, any>;
  exportProps?: Record<string, any>;
}

interface ImportResult {
  successCount: number;
  failCount: number;
  errors: string[];
  summary?: Record<string, any>;
}

const props = withDefaults(defineProps<Props>(), {
  fieldName: 'file',
  accept: '.xlsx,.xls',
  maxSizeMB: 10,
  disableExport: false,
  disableImport: false,
  exportText: '导出',
  importText: '导入',
});

const emit = defineEmits<{
  exportError: [error: Error];
  importError: [error: Error];
}>();

const exporting = ref(false);
const importing = ref(false);

async function handleExport() {
  if (exporting.value) return;
  exporting.value = true;
  const params: Record<string, any> = { ...props.exportParams };

  const ids = params?.ids;
  if (Array.isArray(ids) && ids.length <= 0) {
    message.error('请选择导出数据');
    exporting.value = false;
    return;
  }
  if (Array.isArray(ids)) params.ids = ids.join(',');

  try {
    const {
      data: { taskId },
    } = await submitExport({
      bizType: props.exportProps?.bizType,
      exportFormat: props.exportProps?.exportFormat ?? 'xlsx',
      queryParams: params,
    });
    message.success(
      `导出任务已提交（ID: ${taskId.slice(0, 8)}），可在「导出中心」查看进度`,
    );
    props.onExportSuccess?.();
  } catch (error) {
    // es-toolkit isError 替代 instanceof Error
    const err = isError(error) ? error : new Error(String(error));
    message.error(err.message || '导出失败');
    emit('exportError', err);
  } finally {
    exporting.value = false;
  }
}

function handleBeforeUpload(file: File): boolean {
  if (!props.importTemplate) {
    message.error('请先配置导入模板');
    return false;
  }

  const isValidType = props.accept
    .split(',')
    .some((ext) => file.name.toLowerCase().endsWith(ext.trim().toLowerCase()));
  if (!isValidType) {
    message.error(`仅支持 ${props.accept} 格式文件`);
    return false;
  }

  const sizeMB = file.size / 1024 / 1024;
  if (sizeMB > props.maxSizeMB) {
    message.error(`文件大小不能超过 ${props.maxSizeMB}MB`);
    return false;
  }

  void uploadFile(file);
  return false;
}

async function uploadFile(file: File) {
  if (importing.value) return;
  importing.value = true;

  try {
    const formData = new FormData();
    formData.append(props.fieldName, file);

    const res: any = await request.post(`${props.module}/import`, formData);
    const result: ImportResult = res?.data ?? res;

    handleImportResult(result);
    props.onImportSuccess?.(result);
  } catch (error) {
    const err = isError(error) ? error : new Error(String(error));
    message.error(err.message || '导入失败');
    emit('importError', err);
  } finally {
    importing.value = false;
  }
}

function handleImportResult(result: ImportResult) {
  const { successCount = 0, failCount = 0, errors = [] } = result;

  if (failCount === 0) {
    message.success(`导入成功 ${successCount} 条`);
    return;
  }

  const MAX_SHOW = 20;
  const shownErrors = errors.slice(0, MAX_SHOW);
  const moreText =
    errors.length > MAX_SHOW
      ? `\n...还有 ${errors.length - MAX_SHOW} 条错误未显示`
      : '';

  if (props.onImportError?.(result)) return;

  Modal.info({
    title: '导入结果',
    width: 640,
    content: () =>
      h('div', [
        h(
          'p',
          { class: 'mb-3 text-sm' },
          `成功 ${successCount} 条，失败 ${failCount} 条`,
        ),
        errors.length > 0 &&
          // 原生纵向滚动容器换成 Scrollbar：max-h 移到 rootClass，
          // padding 挪到 viewClass（真正滚动的元素在组件内部，挂内容侧才不丢边距）
          h(
            Scrollbar,
            {
              rootClass:
                'max-h-[400px] rounded bg-red-50 text-xs dark:bg-red-900/20',
              viewClass: 'p-3',
            },
            () =>
              shownErrors.map((err, i) =>
                h(
                  'div',
                  { key: i, class: 'mb-1 text-red-600 dark:text-red-400' },
                  err,
                ),
              ),
          ),
        moreText && h('p', { class: 'mt-2 text-xs text-stone-500' }, moreText),
      ]),
    okText: '知道了',
  });
}

function downloadTemplate() {
  generateTemplate(
    props.filename ?? `${props.module.split('/').pop()}导入模板`,
    props.importTemplate!,
  );
}
</script>

<template>
  <a-space>
    <a-button
      :loading="exporting"
      :disabled="disableExport"
      v-permission="permissions[1]"
      @click="handleExport"
    >
      <template #icon><DownloadOutlined /></template>
      {{ exportText }}
    </a-button>

    <a-upload
      :show-upload-list="false"
      :accept="accept"
      :disabled="disableImport"
      :before-upload="handleBeforeUpload"
      :multiple="false"
    >
      <a-button
        :loading="importing"
        :disabled="disableImport"
        v-permission="permissions[0]"
      >
        <template #icon><UploadOutlined /></template>
        {{ importText }}
      </a-button>
    </a-upload>
    <a-button type="primary" @click="downloadTemplate">
      <template #icon><UploadOutlined /></template>
      导入模板
    </a-button>
  </a-space>
</template>
