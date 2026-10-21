<script setup lang="ts">
import type { TemplateColumn } from '@antdv/shared/utils/template';

import { computed, h, inject, ref } from 'vue';

import { alert, message } from '@antdv/popup-ui';
import { request } from '@antdv/request';
import { Button } from '@antdv/shadcn-ui';
import { generateTemplate } from '@antdv/shared/utils/template';
import { Icon } from '@iconify/vue';
import { useFileDialog } from '@vueuse/core';
import { isError } from 'es-toolkit';

// 这里的滚动区要出现在 h() 渲染函数里，模板标签的自动重写帮不上忙，全部显式 import
import { Scrollbar } from '../scrollbar';
import { Space } from '../space';
import { PERMISSION_CHECK } from './context';

/** 提交导出任务的入参与回参：回参只需要任务号，用于提示「去导出中心看进度」 */
interface ExportTaskPayload {
  bizType?: string;
  exportFormat?: string;
  queryParams: Record<string, any>;
}

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
  /**
   * 导出任务的提交通道。默认 POST `${module}/export` 并读信封里的 `data.taskId`；
   * 后端不是这个形状（异步队列、独立导出服务）时由宿主传进来替换。
   */
  submitExport?: (
    payload: ExportTaskPayload,
  ) => Promise<{ taskId: null | string }>;
}

interface ImportResult {
  successCount: number;
  failCount: number;
  errors: string[];
  summary?: Record<string, any>;
}

const props = withDefaults(defineProps<Props>(), {
  exportParams: undefined,
  exportProps: undefined,
  filename: undefined,
  importProps: undefined,
  importTemplate: undefined,
  onExportSuccess: undefined,
  onImportError: undefined,
  onImportSuccess: undefined,
  submitExport: undefined,
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

/** 未注入判定器时一律放行：见 `./context` 的说明 */
const hasPermission = inject(PERMISSION_CHECK, () => true);
const canExport = computed(() => hasPermission(props.permissions[1] ?? []));
const canImport = computed(() => hasPermission(props.permissions[0] ?? []));

/**
 * 提交导出任务。
 *
 * 迁移前这里 import 的是 `~/views/system/export/api` 的 `submitExport`，
 * 而那个模块在应用里并不存在（这条引用一直是悬空的，只因为组件没人用才没暴露）；
 * 公共包里更不能反向引应用，于是默认走 `${module}/export`，宿主可注入替换。
 */
async function submitExportTask(
  payload: ExportTaskPayload,
): Promise<null | string> {
  if (props.submitExport) {
    const { taskId } = await props.submitExport(payload);
    return taskId;
  }
  const res = await request.post<{
    code: number;
    data?: { taskId?: string };
    message?: string;
  }>(`${props.module}/export`, payload);
  return res?.data?.taskId ?? null;
}

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
    const taskId = await submitExportTask({
      bizType: props.exportProps?.bizType,
      exportFormat: props.exportProps?.exportFormat ?? 'xlsx',
      queryParams: params,
    });
    message.success(
      taskId
        ? `导出任务已提交（ID: ${taskId.slice(0, 8)}），可在「导出中心」查看进度`
        : '导出任务已提交，可在「导出中心」查看进度',
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

  // 单按钮提示框替代旧 Modal.info：content 用 VNode 承载滚动区
  void alert({
    title: '导入结果',
    type: 'info',
    content: h('div', [
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
  });
}

function downloadTemplate() {
  const columns = props.importTemplate;
  if (!columns) return;
  generateTemplate(
    props.filename ?? `${props.module.split('/').pop()}导入模板`,
    columns,
  );
}

/* ============================================================
 * 选文件：vueuse useFileDialog 替代 antdv Upload
 * ============================================================ */
const { open: openImportPicker, onChange: onImportChange } = useFileDialog({
  accept: props.accept,
  multiple: false,
  reset: true,
});

onImportChange((picked: FileList | null) => {
  const file = picked?.[0];
  if (file) handleBeforeUpload(file);
});

function handleImportClick() {
  if (props.disableImport) return;
  openImportPicker();
}
</script>

<template>
  <Space>
    <Button
      v-if="canExport"
      :disabled="disableExport || exporting"
      @click="handleExport"
    >
      <Icon v-if="!exporting" icon="carbon:download" />
      <span v-else class="animate-spin">…</span>
      {{ exportText }}
    </Button>

    <Button
      v-if="canImport"
      :disabled="disableImport || importing"
      @click="handleImportClick"
    >
      <Icon v-if="!importing" icon="carbon:upload" />
      <span v-else class="animate-spin">…</span>
      {{ importText }}
    </Button>

    <Button v-if="importTemplate?.length" @click="downloadTemplate">
      <Icon icon="carbon:download" />
      导入模板
    </Button>
  </Space>
</template>
