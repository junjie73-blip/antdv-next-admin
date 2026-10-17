<script setup lang="ts">
import type {
  UploadChangeParam,
  UploadFile,
  UploadListType,
} from '@antdv/common-ui';

import { computed, ref, useTemplateRef } from 'vue';

import { Card, Image, Scrollbar, Upload } from '@antdv/common-ui';
// ===== 大文件切片上传 =====
import { useChunkUpload } from '@antdv/hooks/use-chunk-upload';
import { message } from '@antdv/popup-ui';

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/utils/cn';
import { Icon } from '@iconify/vue';
import { http } from '~/composables';

/**
 * 上传示例统一走应用请求层（`http.Post` → fetch），而不是上传组件默认的直连通道。
 *
 * 两个非改不可的理由：
 * 1. 组件默认提交的 `/api/...` 是硬编码前缀，可前缀只在 `.env.development` 里配
 *    （`VITE_APP_BASE_API`），生产构建拿不到它，产物里发出去的就是 `/api/upload`；
 * 2. 包内浏览器 mock 劫持的是 `globalThis.fetch`，XHR 从它旁边绕过去 ——
 *    生产部署没有 Node 后端，点一次上传就是一次货真价实的 404。
 *
 * 换成 `customRequest` 后，dev（vite proxy → Nitro）与生产（浏览器内 mock）
 * 打到的是同一个接口、同一种信封，`file.response.data.url` 两边都拿得到。
 */
function uploadRequest(variant: string) {
  return (options: any) => {
    const { file, onError, onProgress, onSuccess } = options;
    const formData = new FormData();
    formData.append('file', file as File);
    // 组件不消费返回值（customRequest 的签名是 void | abort），不 return Promise
    http
      .Post<{
        code: number;
        data: {
          fileId: string;
          storedPath: string;
          uploadedAt: string;
          url: string;
          variant: string;
        };
        message: string;
      }>(variant ? `/upload/${variant}` : '/upload', formData)
      .then((res) => {
        onProgress({ percent: 100 }, res);
        onSuccess(res, file);
        return res;
      })
      .catch((error: unknown) => {
        onError(error as Error);
      });
  };
}

/** UploadProps 的本地等价形状：`imageUploadProps` 用 v-bind 摊平进 Upload */
interface ImageUploadBindings {
  accept: string;
  listType: UploadListType;
  maxCount: number;
}

const containerClassName = cn('space-y-6');
const descClassName = cn('mb-3 text-sm text-gray-500 dark:text-gray-400');

const basicFileList = ref<UploadFile[]>([]);

const imageFileList = ref<UploadFile[]>([]);

const imageUploadProps: ImageUploadBindings = {
  accept: 'image/jpeg,image/png,image/gif',
  listType: 'picture-card',
  maxCount: 8,
};

const handleImageBeforeUpload = (file: File): boolean => {
  const isLt2M = file.size / 1024 / 1024 < 2;
  if (!isLt2M) {
    message.error('图片大小不能超过 2MB');
    return false;
  }
  return true;
};

const imagePreviewVisible = ref(false);
const imagePreviewUrl = ref('');

/**
 * 预览地址的三个来源，按"用户此刻实际能看到的东西"排序。
 *
 * 以前只读 `file.url || file.response?.url`，于是图片墙点了半天没反应：
 * - 刚选完的本地图片根本没有 `url`，组件生成的是 blob `thumbUrl`；
 * - 服务端返回挂在信封里，`file.response` 是整个响应体，地址在 `response.data.url`。
 */
function resolvePreviewUrl(file: UploadFile): string {
  const response = file.response as
    | undefined
    | { data?: { url?: string }; url?: string };
  return (
    file.thumbUrl || file.url || response?.data?.url || response?.url || ''
  );
}

/**
 * 预览图片墙里的某一张。
 *
 * ⚠️ 必须吃掉原生事件：图片地址是 data:/blob: URL，若哪天卡片外层被包成
 * `<a target="_blank">`，不拦 `preventDefault` 就是"站内预览 + 新开一个标签页看同一张图"。
 *
 * `Upload` 的 `preview` 事件固定带原生 MouseEvent，但自定义入口可能不带事件，
 * 所以处处按可选处理。
 */
function handleImagePreview(file: UploadFile, event?: Event) {
  event?.preventDefault();
  const url = resolvePreviewUrl(file);
  if (!url) {
    message.warning('这张图片还没有可预览的地址');
    return;
  }
  imagePreviewUrl.value = url;
  imagePreviewVisible.value = true;
}

/** 预览层自己会关（点遮罩、按 Esc、点关闭），状态要跟着回来，否则第二次点同一张图没反应 */
function handleImagePreviewVisibleChange(value: boolean) {
  imagePreviewVisible.value = value;
}

const avatarFileList = ref<UploadFile[]>([]);
const avatarLoading = ref(false);

/**
 * 头像预览地址：和图片墙共用同一个解析函数。
 *
 * 以前这里写的是 `file.url || file.response?.url`，而后端把地址放在信封里
 * （`response.data.url`），`file.url` 又只有回填过的历史文件才有，
 * 于是刚上传完头像会渲染成破图。
 */
const avatarPreviewSrc = computed(() =>
  resolvePreviewUrl(avatarFileList.value[0] ?? ({} as UploadFile)),
);

const avatarUploaderClassName = cn(
  'flex size-24 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-gray-300 bg-gray-50 transition-colors hover:border-blue-500 dark:bg-gray-800',
);

const avatarImageClassName = cn('size-full object-cover');

const avatarInfoClassName = cn('flex-1');
const avatarTitleClassName = cn(
  'mb-2 font-medium text-gray-700 dark:text-gray-300',
);
const avatarRuleListClassName = cn(
  'space-y-1 text-sm text-gray-500 dark:text-gray-400',
);

const handleAvatarBeforeUpload = (file: File): boolean => {
  const isImage = file.type.startsWith('image/');
  const isLt5M = file.size / 1024 / 1024 < 5;

  if (!isImage) {
    message.error('只能上传图片文件');
    return false;
  }
  if (!isLt5M) {
    message.error('头像大小不能超过 5MB');
    return false;
  }

  return true;
};

const handleAvatarChange = (info: UploadChangeParam) => {
  if (info.file.status === 'uploading') {
    avatarLoading.value = true;
  } else {
    avatarLoading.value = false;
    if (info.file.status === 'done') {
      message.success(`${info.file.name} 上传成功`);
    } else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败`);
    }
  }
};

const customFileList = ref<UploadFile[]>([]);

const customUploadAreaClassName = cn(
  'flex h-32 w-full cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 transition-all duration-200 hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20',
);

const customIconClassName = cn('mb-2 size-12 text-gray-400');
const customTextClassName = cn('text-sm text-gray-500 dark:text-gray-400');
const customHintClassName = cn('mt-1 text-xs text-gray-400');

const statusFileList = ref<UploadFile[]>([
  {
    uid: '-1',
    name: 'uploading-document.pdf',
    status: 'uploading',
    percent: 60,
  },
  {
    uid: '-2',
    name: 'error-file.txt',
    status: 'error',
    error: new Error('网络连接失败'),
  },
  {
    uid: '-3',
    name: 'success-image.png',
    status: 'done',
    url: 'https://via.placeholder.com/100',
  },
]);

const statusLegendClassName = cn(
  'mt-4 rounded-lg bg-gray-50 p-4 dark:bg-gray-800',
);
const statusGridClassName = cn('grid grid-cols-1 gap-4 text-sm md:grid-cols-3');
const statusItemClassName = cn('flex items-center gap-2');
const statusDotUploadingClassName = cn(
  'size-3 animate-pulse rounded-full bg-blue-500',
);
const statusTextUploadingClassName = cn('text-blue-600 dark:text-blue-400');
const statusDotErrorClassName = cn('size-3 rounded-full bg-red-500');
const statusTextErrorClassName = cn('text-red-600 dark:text-red-400');
const statusDotDoneClassName = cn('size-3 rounded-full bg-green-500');
const statusTextDoneClassName = cn('text-green-600 dark:text-green-400');

const handleStatusChange = (_info: UploadChangeParam) => {};

const validateFileList = ref<UploadFile[]>([]);

const handleValidateBeforeUpload = (file: File): boolean => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ];

  const maxSize = 10 * 1024 * 1024;

  if (!allowedTypes.includes(file.type)) {
    message.error(`不支持的文件格式：${file.type}`);
    return false;
  }

  if (file.size > maxSize) {
    message.error(
      `文件大小不能超过 10MB，当前：${(file.size / 1024 / 1024).toFixed(2)}MB`,
    );
    return false;
  }

  message.success(`校验通过：${file.name}`);
  return true;
};

const validateTipClassName = cn(
  'mt-3 rounded-sm border border-yellow-200 bg-yellow-50 p-3 text-xs text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
);

const manualFileList = ref<UploadFile[]>([]);
const manualUploading = ref(false);
const manualUploadRef = ref<InstanceType<typeof Upload> | null>(null);

const manualButtonGroupClassName = cn('flex gap-3');
const manualSelectedTipClassName = cn(
  'mt-3 text-sm text-gray-500 dark:text-gray-400',
);

async function handleManualUpload() {
  if (manualFileList.value.length === 0) {
    message.warning('请先选择文件');
    return;
  }

  manualUploading.value = true;
  try {
    // `auto-upload=false` 队列的冲刷入口是组件 expose 的 `upload()`
    manualUploadRef.value?.upload();
    message.success('所有文件已提交上传');
  } catch (error) {
    console.error('手动上传失败', error);
    message.error('上传失败，请重试');
  } finally {
    manualUploading.value = false;
  }
}

function handleManualClear() {
  manualFileList.value = [];
  message.info('已清空文件列表');
}

// ===== 自研 AvatarUploader（组件示例：头像上传） =====
/**
 * 页面本地的头像地址，喂给本仓库自研的 `AvatarUploader`。
 *
 * 该组件内部把裁剪结果以 multipart 发到 `POST /upload/avatar`（真实文件上传通道，
 * 与 `~/api/system` 那个只登记元数据的 `uploadFile` 不是一条路），
 * 裁剪确认后把返回的 url 通过 `update:modelValue` / `uploaded` 回抛，
 * 这里只负责展示地址和提供「重置」。
 */
const inhouseAvatarUrl = ref('');
/** 与 AvatarUploader 的 outputSize 保持一致，用于展示裁剪输出尺寸 */
const inhouseAvatarOutputSize = 256;
const inhouseAvatarSize = 88;

const inhouseAvatarDescClassName = cn(
  'mb-3 text-sm text-gray-500 dark:text-gray-400',
);
const inhouseAvatarRowClassName = cn('flex items-center gap-4');
const inhouseAvatarInfoClassName = cn(
  'mt-4 space-y-1 text-sm text-gray-500 dark:text-gray-400',
);
const inhouseAvatarUrlClassName = cn(
  'rounded-sm bg-gray-50 px-2 py-1 font-mono text-xs break-all text-gray-700 dark:bg-gray-800 dark:text-gray-300',
);

function handleInhouseAvatarUploaded(url: string) {
  inhouseAvatarUrl.value = url;
}

function handleInhouseAvatarReset() {
  inhouseAvatarUrl.value = '';
  message.info('已重置头像');
}

const largeFileCardDescClassName = cn(
  'mb-3 text-sm text-gray-500 dark:text-gray-400',
);

const largeFileToolbarClassName = cn('mb-4 flex gap-2');
const largeFileSelectInputClassName = cn('hidden');

const largeFileStatusWaitingClassName = cn('text-gray-500');
const largeFileStatusUploadingClassName = cn('text-blue-600');
const largeFileStatusPausedClassName = cn('text-yellow-600');
const largeFileStatusCompletedClassName = cn('text-green-600');
const largeFileStatusErrorClassName = cn('text-red-600');

const largeFileStatusClassNameMap: Record<string, string> = {
  waiting: largeFileStatusWaitingClassName,
  uploading: largeFileStatusUploadingClassName,
  paused: largeFileStatusPausedClassName,
  completed: largeFileStatusCompletedClassName,
  error: largeFileStatusErrorClassName,
};

const largeFileStatusTextMap: Record<string, string> = {
  waiting: '等待中',
  uploading: '上传中',
  paused: '已暂停',
  completed: '已完成',
  error: '失败',
};

const largeFileTableProgressBarClassName = cn(
  'h-2 flex-1 overflow-hidden rounded-full bg-gray-200',
);
const largeFileTableProgressFillClassName = cn(
  'h-full rounded-full bg-blue-500 transition-all duration-300',
);
const largeFileTableProgressTextClassName = cn(
  'w-10 text-right text-xs text-gray-500',
);
const largeFileTableActionsClassName = cn(
  'flex flex-wrap items-center justify-center gap-1',
);
const largeFileTableProgressRowClassName = cn(
  'flex items-center justify-center gap-2',
);

interface FileQueueItem {
  id: string;
  fileName: string;
  fileSize: number;
  status: 'completed' | 'error' | 'paused' | 'uploading' | 'waiting';
  progress: number;
  file: File;
}

/** 大文件表格列：与模板里按 `column.key` 分支渲染的单元格一一对应 */
interface LargeFileColumn {
  dataIndex?: keyof FileQueueItem;
  ellipsis?: boolean;
  key: string;
  title: string;
  width?: number;
}

const largeFileColumns: LargeFileColumn[] = [
  { title: '缩略图', key: 'thumbnail', width: 80 },
  { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
  { title: '大小', key: 'fileSize', width: 120 },
  { title: '进度', key: 'progress', width: 220 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'actions', width: 280 },
];

const fileQueue = ref<FileQueueItem[]>([]);
const largeFileInputRef = useTemplateRef<HTMLInputElement>('largeFileInputRef');
const isProcessingQueue = ref(false);
const uploaderMap = new Map<string, ReturnType<typeof useChunkUpload>>();
let idCounter = 0;

function getUploader(item: FileQueueItem): ReturnType<typeof useChunkUpload> {
  return uploaderMap.get(item.id)!;
}

function createFileQueueItem(file: File): FileQueueItem {
  const id = `file-${++idCounter}`;
  const uploader = useChunkUpload({
    chunkSize: 5 * 1024 * 1024,
    concurrent: 3,
  });
  uploaderMap.set(id, uploader);

  const item: FileQueueItem = {
    id,
    fileName: file.name,
    fileSize: file.size,
    status: 'waiting',
    progress: 0,
    file,
  };

  watch(
    () => uploader.progress.value,
    (val) => {
      item.progress = val;
    },
  );

  watch(
    () => uploader.status.value,
    (val) => {
      if (val === 'idle') item.status = 'waiting';
      else if (val === 'uploading') item.status = 'uploading';
      else if (val === 'paused') item.status = 'paused';
      else if (val === 'completed') item.status = 'completed';
      else if (val === 'error') item.status = 'error';
    },
  );

  return item;
}

function handleSelectFileClick() {
  largeFileInputRef.value?.click();
}

function handleLargeFileSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files;
  if (!files || files.length === 0) return;
  const fileArray = [...files];
  for (const file of fileArray) {
    fileQueue.value.push(createFileQueueItem(file));
  }
  (e.target as HTMLInputElement).value = '';
}

async function startQueueUpload() {
  if (isProcessingQueue.value) return;
  isProcessingQueue.value = true;

  for (const item of fileQueue.value) {
    if (item.status === 'completed' || item.status === 'error') continue;

    const uploader = getUploader(item);

    if (item.status === 'paused') {
      uploader.resume();
    } else {
      uploader.uploadFile(item.file).catch(() => {});
    }

    await new Promise<void>((resolve) => {
      const stop = watch(
        () => item.status,
        (val) => {
          if (val === 'completed' || val === 'error') {
            stop();
            resolve();
          }
        },
      );
    });
  }

  isProcessingQueue.value = false;
}

const hasUploadingItem = computed(() =>
  fileQueue.value.some((item) => item.status === 'uploading'),
);
const hasPausedItem = computed(() =>
  fileQueue.value.some((item) => item.status === 'paused'),
);

function handlePauseAll() {
  fileQueue.value.forEach((item) => {
    if (item.status === 'uploading') getUploader(item).pause();
  });
}

function handleResumeAll() {
  fileQueue.value.forEach((item) => {
    if (item.status === 'paused') getUploader(item).resume();
  });
  if (!isProcessingQueue.value) {
    startQueueUpload();
  }
}

function handleCancelAll() {
  fileQueue.value.forEach((item) => {
    getUploader(item).cancel();
  });
  uploaderMap.clear();
  fileQueue.value = [];
  isProcessingQueue.value = false;
}

function handlePauseItem(item: FileQueueItem) {
  getUploader(item).pause();
}

function handleResumeItem(item: FileQueueItem) {
  getUploader(item).resume();
  if (!isProcessingQueue.value) {
    startQueueUpload();
  }
}

function handleDeleteItem(item: FileQueueItem) {
  getUploader(item).cancel();
  uploaderMap.delete(item.id);
  const idx = fileQueue.value.indexOf(item);
  if (idx !== -1) fileQueue.value.splice(idx, 1);
}

function handleCancelItem(item: FileQueueItem) {
  getUploader(item).cancel();
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function getStatusClassName(status: string) {
  return largeFileStatusClassNameMap[status] || largeFileStatusWaitingClassName;
}

function getStatusText(status: string) {
  return largeFileStatusTextMap[status] || status;
}

/** 根据文件扩展名获取对应图标 */
function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const iconMap: Record<string, string> = {
    png: 'carbon:image',
    jpg: 'carbon:image',
    jpeg: 'carbon:image',
    gif: 'carbon:image',
    webp: 'carbon:image',
    svg: 'carbon:image',
    pdf: 'carbon:document-pdf',
    doc: 'carbon:document',
    docx: 'carbon:document',
    xls: 'carbon:table',
    xlsx: 'carbon:table',
    zip: 'carbon:archive',
    rar: 'carbon:archive',
    mp4: 'carbon:video-filled',
    mp3: 'carbon:music',
    txt: 'carbon:document',
  };
  return iconMap[ext] || 'carbon:document';
}

/** 模板里拿不到全局 `URL`（不是实例属性），缩略图 blob 地址包一层页面函数 */
function createThumbUrl(file: File): string {
  return URL.createObjectURL(file);
}

/** 判断是否为图片文件（可预览） */
function isImageFile(fileName: string): boolean {
  const imgExts = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return imgExts.includes(ext);
}

/** 判断是否为 PDF 文件 */
function isPdfFile(fileName: string): boolean {
  return fileName.split('.').pop()?.toLowerCase() === 'pdf';
}

/** 判断是否为 Word 文档 */
function isDocxFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['doc', 'docx'].includes(ext);
}

/** 判断是否为 Excel 文件 */
function isExcelFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['xls', 'xlsx'].includes(ext);
}

/** 获取文件预览类型 */
type PreviewType = 'docx' | 'excel' | 'image' | 'pdf' | null;

function getPreviewType(fileName: string): PreviewType {
  if (isImageFile(fileName)) return 'image';
  if (isPdfFile(fileName)) return 'pdf';
  if (isDocxFile(fileName)) return 'docx';
  if (isExcelFile(fileName)) return 'excel';
  return null;
}

const previewVisible = ref(false);
const previewUrl = ref('');
const previewType = ref<PreviewType>(null);
const previewFileName = ref('');

/** 通用预览处理 */
function handlePreview(item: FileQueueItem) {
  const type = getPreviewType(item.fileName);
  if (!type) {
    message.info(
      `暂不支持预览 ${item.fileName.split('.').pop()?.toUpperCase()} 格式文件`,
    );
    return;
  }

  previewType.value = type;
  previewFileName.value = item.fileName;

  if (type === 'image') {
    previewUrl.value = URL.createObjectURL(item.file);
  } else if (type === 'pdf') {
    previewUrl.value = URL.createObjectURL(item.file);
  } else {
    // docx/excel 使用 ArrayBuffer 传给 @vue-office 组件
    const reader = new FileReader();
    reader.onload = (e) => {
      previewUrl.value = e.target?.result as string;
      previewVisible.value = true;
    };
    reader.readAsArrayBuffer(item.file);
    return; // 等待 FileReader 完成
  }
  previewVisible.value = true;
}

function handlePreviewClose() {
  previewVisible.value = false;
  previewUrl.value = '';
  previewType.value = null;
  // 释放 Object URL 避免内存泄漏
}

/** Dialog 自己会关（遮罩 / Esc / 右上角关闭），只把关闭信号接回页面 */
function handlePreviewOpenChange(value: boolean) {
  if (!value) handlePreviewClose();
}
</script>

<template>
  <div :class="containerClassName">
    <Card title="基础上传" variant="borderless">
      <div :class="descClassName">
        点击或拖拽文件到此区域进行上传，支持多文件选择
      </div>
      <Upload
        v-model:file-list="basicFileList"
        :custom-request="uploadRequest('')"
        :multiple="true"
        :drag="true"
      >
        <p class="mb-2 text-2xl text-gray-400">
          <Icon icon="ant-design:inbox-outlined" />
        </p>
        <p class="text-sm">点击或拖拽文件到此区域上传</p>
        <p :class="customHintClassName">
          支持单个或批量上传，严禁上传公司数据或其他敏感信息
        </p>
      </Upload>
    </Card>

    <Card title="图片墙" variant="borderless">
      <div :class="descClassName">
        图片墙效果，支持预览，仅 jpg/png/gif 格式，单张不超过 2MB
      </div>
      <Upload
        v-model:file-list="imageFileList"
        v-bind="imageUploadProps"
        :custom-request="uploadRequest('image')"
        :before-upload="handleImageBeforeUpload"
        @preview="handleImagePreview"
      >
        <div>
          <Icon icon="ant-design:plus-outlined" />
          <div class="mt-2 text-sm">上传</div>
        </div>
      </Upload>
      <!--
        受控预览：只借 `Image` 的大图预览层，本体藏起来。
        以前这里常驻渲染且 `src` 初始为空字符串，卡片里就留了一个破图占位。
      -->
      <Image
        v-if="imagePreviewUrl"
        :src="imagePreviewUrl"
        :style="{ display: 'none' }"
        :preview="{
          visible: imagePreviewVisible,
          onVisibleChange: handleImagePreviewVisibleChange,
        }"
      />
    </Card>

    <Card title="头像上传" variant="borderless">
      <div :class="descClassName">
        圆形头像裁剪上传，仅限图片格式，不超过 5MB
      </div>
      <div class="flex items-start gap-6">
        <Upload
          v-model:file-list="avatarFileList"
          :custom-request="uploadRequest('avatar')"
          :show-upload-list="false"
          :before-upload="handleAvatarBeforeUpload"
          list-type="picture"
          @change="handleAvatarChange"
        >
          <!--
            占位与图片只看"有没有地址"，不看数组长度：
            文件进了列表但还没有 thumbUrl/回填 url 的那一瞬，
            按长度判断会两边都不渲染，头像框直接消失。
          -->
          <div v-if="!avatarPreviewSrc" :class="avatarUploaderClassName">
            <Icon
              v-if="avatarLoading"
              class="animate-spin text-2xl text-gray-400"
              icon="svg-spinners:180-ring-with-bg"
            />
            <Icon
              v-else
              class="text-2xl text-gray-400"
              icon="ant-design:camera-outlined"
            />
          </div>
          <img
            v-else
            :src="avatarPreviewSrc"
            alt="avatar"
            :class="avatarImageClassName"
          />
        </Upload>
        <div :class="avatarInfoClassName">
          <h4 :class="avatarTitleClassName">上传头像</h4>
          <ul :class="avatarRuleListClassName">
            <li>支持 JPG、PNG、GIF 格式</li>
            <li>文件大小不超过 5MB</li>
            <li>建议尺寸 200x200 像素</li>
          </ul>
        </div>
      </div>
    </Card>

    <Card title="自定义上传按钮" variant="borderless">
      <div :class="descClassName">带图标的自定义上传区域，支持拖拽</div>
      <Upload
        v-model:file-list="customFileList"
        :custom-request="uploadRequest('custom')"
        :drag="true"
        :multiple="true"
      >
        <div :class="customUploadAreaClassName">
          <Icon
            :class="customIconClassName"
            icon="ant-design:cloud-upload-outlined"
          />
          <span :class="customTextClassName">点击或拖拽文件到此处上传</span>
          <span :class="customHintClassName">支持任意文件类型</span>
        </div>
      </Upload>
    </Card>

    <Card title="上传状态展示" variant="borderless">
      <div :class="descClassName">
        展示 uploading（上传中）、error（错误）、done（完成）三种状态
      </div>
      <Upload
        v-model:file-list="statusFileList"
        :custom-request="uploadRequest('status')"
        @change="handleStatusChange"
      >
        <Button>
          <Icon icon="ant-design:upload-outlined" />
          选择文件
        </Button>
      </Upload>
      <div :class="statusLegendClassName">
        <div :class="statusGridClassName">
          <div :class="statusItemClassName">
            <span :class="statusDotUploadingClassName"></span>
            <span :class="statusTextUploadingClassName">上传中</span>
          </div>
          <div :class="statusItemClassName">
            <span :class="statusDotErrorClassName"></span>
            <span :class="statusTextErrorClassName">上传失败</span>
          </div>
          <div :class="statusItemClassName">
            <span :class="statusDotDoneClassName"></span>
            <span :class="statusTextDoneClassName">上传成功</span>
          </div>
        </div>
      </div>
    </Card>

    <Card title="上传前校验" variant="borderless">
      <div :class="descClassName">
        文件类型和大小校验提示，仅允许 PDF/Word/图片，最大 10MB
      </div>
      <Upload
        v-model:file-list="validateFileList"
        :custom-request="uploadRequest('validate')"
        :before-upload="handleValidateBeforeUpload"
        :multiple="true"
      >
        <Button>
          <Icon icon="ant-design:file-text-outlined" />
          选择文件（PDF/Word/图片）
        </Button>
      </Upload>
      <div :class="validateTipClassName">
        提示：尝试上传非指定格式的文件或超过 10MB 的文件，查看校验效果
      </div>
    </Card>

    <Card title="手动上传" variant="borderless">
      <div :class="descClassName">先选择文件，再点击按钮才会上传</div>
      <div :class="manualButtonGroupClassName">
        <Upload
          ref="manualUploadRef"
          v-model:file-list="manualFileList"
          :custom-request="uploadRequest('manual')"
          :auto-upload="false"
          :multiple="true"
        >
          <Button>
            <Icon icon="ant-design:folder-open-outlined" />
            选择文件
          </Button>
        </Upload>
        <Button
          :disabled="manualUploading || manualFileList.length === 0"
          @click="handleManualUpload"
        >
          <Icon
            v-if="manualUploading"
            class="animate-spin"
            icon="svg-spinners:bouncing-ball"
          />
          开始上传
        </Button>
        <Button
          :disabled="manualFileList.length === 0"
          @click="handleManualClear"
        >
          清空列表
        </Button>
      </div>
      <div v-if="manualFileList.length > 0" :class="manualSelectedTipClassName">
        已选择 {{ manualFileList.length }} 个文件，请点击「开始上传」按钮
      </div>
    </Card>

    <Card title="头像上传（自研组件）" variant="borderless">
      <div :class="inhouseAvatarDescClassName">
        基于本仓库自研的
        <code class="font-mono text-xs">AvatarUploader</code>
        组件，选择图片后可 1:1 裁剪，确认后以 multipart 发到
        <code class="font-mono text-xs">POST /upload/avatar</code>
        上传并回填地址（示例返回一张内联 SVG 占位图，mock 不落盘）。
      </div>
      <div :class="inhouseAvatarRowClassName">
        <AvatarUploader
          v-model="inhouseAvatarUrl"
          :max-size-mb="5"
          :output-size="inhouseAvatarOutputSize"
          :size="inhouseAvatarSize"
          round
          @uploaded="handleInhouseAvatarUploaded"
        />
        <Button :disabled="!inhouseAvatarUrl" @click="handleInhouseAvatarReset">
          重置
        </Button>
      </div>
      <div :class="inhouseAvatarInfoClassName">
        <template v-if="inhouseAvatarUrl">
          <div>
            当前地址：<span :class="inhouseAvatarUrlClassName">{{
              inhouseAvatarUrl
            }}</span>
          </div>
          <div>
            裁剪输出尺寸：{{ inhouseAvatarOutputSize }}×{{
              inhouseAvatarOutputSize
            }}
            PNG
          </div>
        </template>
        <div v-else>尚未上传头像，选择图片并确认后地址会显示在这里。</div>
      </div>
    </Card>

    <Card title="大文件上传" variant="borderless">
      <div :class="largeFileCardDescClassName">
        支持暂停/恢复，基于切片上传的大文件上传组件，支持多文件队列
      </div>

      <div :class="largeFileToolbarClassName">
        <input
          ref="largeFileInputRef"
          type="file"
          multiple
          :class="largeFileSelectInputClassName"
          @change="handleLargeFileSelect"
        />
        <Button @click="handleSelectFileClick">
          <Icon icon="carbon:document-import" />
          选择文件
        </Button>
        <Button :disabled="fileQueue.length === 0" @click="startQueueUpload">
          <Icon icon="carbon:cloud-upload" />
          开始上传
        </Button>
        <Button :disabled="!hasUploadingItem" @click="handlePauseAll">
          <Icon icon="carbon:pause" />
          暂停
        </Button>
        <Button :disabled="!hasPausedItem" @click="handleResumeAll">
          <Icon icon="carbon:play" />
          恢复
        </Button>
        <Button
          variant="destructive"
          :disabled="fileQueue.length === 0"
          @click="handleCancelAll"
        >
          <Icon icon="carbon:close" />
          取消
        </Button>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <!-- 整表单元格统一居中：表头跟着正文对齐，否则居中的内容顶着左对齐的标题 -->
            <TableHead
              v-for="column in largeFileColumns"
              :key="column.key"
              class="text-center"
            >
              {{ column.title }}
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="record in fileQueue" :key="record.id">
            <TableCell
              v-for="column in largeFileColumns"
              :key="column.key"
              class="text-center"
            >
              <template v-if="column.key === 'thumbnail'">
                <div
                  v-if="isImageFile(record.fileName)"
                  class="mx-auto h-10 w-10 cursor-pointer overflow-hidden rounded border border-gray-200"
                  @click="handlePreview(record)"
                >
                  <img
                    :src="createThumbUrl(record.file)"
                    alt=""
                    class="h-full w-full object-cover"
                  />
                </div>
                <div
                  v-else-if="getPreviewType(record.fileName)"
                  class="mx-auto flex h-10 w-10 cursor-pointer items-center justify-center rounded bg-gray-100 transition-colors hover:bg-blue-50 dark:bg-gray-800 dark:hover:bg-blue-900/30"
                  @click="handlePreview(record)"
                >
                  <Icon
                    :icon="getFileIcon(record.fileName)"
                    :width="20"
                    class="text-gray-500 hover:text-blue-500"
                  />
                </div>
                <div
                  v-else
                  class="mx-auto flex h-10 w-10 items-center justify-center rounded bg-gray-100 dark:bg-gray-800"
                >
                  <Icon
                    :icon="getFileIcon(record.fileName)"
                    :width="20"
                    class="text-gray-400"
                  />
                </div>
              </template>
              <template v-else-if="column.key === 'fileName'">
                {{ record.fileName }}
              </template>
              <template v-else-if="column.key === 'fileSize'">
                {{ formatFileSize(record.fileSize) }}
              </template>
              <template v-else-if="column.key === 'progress'">
                <div :class="largeFileTableProgressRowClassName">
                  <div :class="largeFileTableProgressBarClassName">
                    <div
                      :style="{ width: `${record.progress}%` }"
                      :class="largeFileTableProgressFillClassName"
                    ></div>
                  </div>
                  <span :class="largeFileTableProgressTextClassName"
                    >{{ record.progress }}%</span
                  >
                </div>
              </template>
              <template v-else-if="column.key === 'status'">
                <span :class="getStatusClassName(record.status)">{{
                  getStatusText(record.status)
                }}</span>
              </template>
              <template v-else-if="column.key === 'actions'">
                <div :class="largeFileTableActionsClassName">
                  <Button
                    variant="link"
                    size="sm"
                    class="h-auto px-0"
                    :disabled="record.status !== 'uploading'"
                    @click="handlePauseItem(record)"
                  >
                    暂停
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    class="h-auto px-0"
                    :disabled="record.status !== 'paused'"
                    @click="handleResumeItem(record)"
                  >
                    恢复
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    class="h-auto px-0 text-destructive hover:text-destructive"
                    @click="handleDeleteItem(record)"
                  >
                    删除
                  </Button>
                  <Button
                    variant="link"
                    size="sm"
                    class="h-auto px-0 text-destructive hover:text-destructive"
                    :disabled="
                      record.status !== 'uploading' &&
                      record.status !== 'paused'
                    "
                    @click="handleCancelItem(record)"
                  >
                    取消
                  </Button>
                </div>
              </template>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <!-- 文件预览弹窗 -->
      <Dialog :open="previewVisible" @update:open="handlePreviewOpenChange">
        <DialogContent v-if="previewVisible" class="sm:max-w-[800px]">
          <DialogHeader>
            <DialogTitle>预览：{{ previewFileName }}</DialogTitle>
            <DialogDescription class="sr-only">
              {{ previewFileName }} 的文件预览
            </DialogDescription>
          </DialogHeader>
          <!-- 图片预览 -->
          <Image
            v-if="previewType === 'image'"
            :src="previewUrl"
            :style="{ maxHeight: '70vh' }"
            :preview="{ visible: false }"
          />
          <!-- PDF 预览（iframe 嵌入） -->
          <iframe
            v-else-if="previewType === 'pdf'"
            :src="previewUrl"
            class="w-full rounded border-0"
            style="height: 70vh"
          ></iframe>
          <!-- Word 预览（@vue-office/docx，需安装依赖） -->
          <!-- view-class="h-full"：Scrollbar 的 slot 容器 scrollbar__view 自身没有高度，
               不显式撑满的话，内部 h-full 的占位内容会塌成 0 -->
          <Scrollbar
            v-else-if="previewType === 'docx'"
            root-class="w-full rounded bg-gray-50 p-4 dark:bg-gray-900"
            view-class="h-full"
            style="height: 70vh"
          >
            <div class="flex h-full items-center justify-center text-gray-400">
              <div class="text-center">
                <Icon
                  icon="carbon:document"
                  :width="48"
                  class="mb-2 opacity-50"
                />
                <p>Word 预览组件加载中...</p>
                <p class="mt-1 text-xs">
                  如未显示请确认已安装 @vue-office/docx 依赖
                </p>
              </div>
            </div>
          </Scrollbar>
          <!-- Excel 预览（@vue-office/excel，需安装依赖）：view-class 同 Word 场景 -->
          <Scrollbar
            v-else-if="previewType === 'excel'"
            root-class="w-full rounded bg-gray-50 p-4 dark:bg-gray-900"
            view-class="h-full"
            style="height: 70vh"
          >
            <div class="flex h-full items-center justify-center text-gray-400">
              <div class="text-center">
                <Icon icon="carbon:table" :width="48" class="mb-2 opacity-50" />
                <p>Excel 预览组件加载中...</p>
                <p class="mt-1 text-xs">
                  如未显示请确认已安装 @vue-office/excel 依赖
                </p>
              </div>
            </div>
          </Scrollbar>
        </DialogContent>
      </Dialog>
    </Card>
  </div>
</template>
