<script setup lang="ts">
import type { UploadChangeParam, UploadFile } from './types';

import { computed, onBeforeUnmount, ref, type Ref } from 'vue';

import { cn } from '@antdv/shared/cn';
import { useFileDialog } from '@vueuse/core';

import UploadList from './UploadList.vue';

defineOptions({ name: 'Upload' });

const props = withDefaults(
  defineProps<{
    accept?: string;
    autoUpload?: boolean;
    beforeUpload?: (file: File, list: File[]) => any;
    customRequest?: (options: {
      file: File;
      filename: string;
      onSuccess?: (res: any) => void;
      onError?: (err: any) => void;
      onProgress?: (e: { percent: number }) => void;
    }) => (() => void) | void;
    disabled?: boolean;
    drag?: boolean;
    listType?: 'picture' | 'picture-card' | 'text';
    maxCount?: number;
    multiple?: boolean;
    previewFile?: (file: UploadFile) => Promise<string> | string;
    showUploadList?: boolean;
  }>(),
  {
    accept: undefined,
    autoUpload: true,
    beforeUpload: undefined,
    customRequest: undefined,
    disabled: false,
    drag: false,
    listType: 'text',
    maxCount: undefined,
    multiple: false,
    previewFile: undefined,
    showUploadList: true,
  },
);

const emit = defineEmits<{
  change: [UploadChangeParam];
  drop: [DragEvent];
  preview: [UploadFile, MouseEvent];
  remove: [UploadFile];
}>();

// `v-model:file-list`：prop 用 camel 后的 fileList，父级 kebab 绑定会被 Vue 归一
const fileList = defineModel<UploadFile[]>('fileList', { default: () => [] });

const inputRef = ref<HTMLInputElement>();
const isDragging = ref(false);

// accept / multiple 走 computed，保证 props 变化时 useFileDialog 的隐藏 input 同步刷新
const acceptRef = computed(() => props.accept ?? '*');
const multipleRef = computed(() => props.multiple);

/**
 * 选文件通道：交给 vueuse 的 useFileDialog 管理。
 * 传入模板里的 `data-common-upload-input` 元素作为 input 注入点，
 * 既复用 vueuse 的原生交互，也让单测能直接在 jsdom 里对该 input 驱动 change。
 */
const { open: openDialog, reset: resetDialog, onChange: onDialogChange } =
  useFileDialog({
    // 模板 ref 挂载前是 undefined，vueuse 内部会容错处理；这里做一次类型桥接
    input: inputRef as unknown as Ref<HTMLInputElement>,
    accept: acceptRef,
    multiple: multipleRef,
    // 每次打开前清空，保证连续选择同一文件仍能触发 change
    reset: true,
  });

onDialogChange((picked: FileList | null) => {
  const files = Array.from(picked ?? []);
  if (files.length) processFiles(files);
});

let uidCounter = 0;
const nextUid = () => `uid-${uidCounter++}-${Date.now()}`;

/** uid → blob：图片的本地预览地址，移除 / 卸载时必须 revoke 防泄漏 */
const blobUrls = new Map<string, string>();
/** autoUpload=false 时暂存的原始文件，等 upload() 再走通道 */
const queued = new Map<string, File>();
const timers = new Set<ReturnType<typeof setTimeout>>();

const rootClass = computed(() => cn('inline-block'));

const triggerClass = computed(() =>
  cn(
    props.drag
      ? 'rounded-md border border-dashed border-gray-300 bg-gray-50/50 p-6 text-center transition-colors hover:border-primary dark:border-gray-600 dark:bg-gray-800/40'
      : 'inline-block',
    props.disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
    isDragging.value ? 'border-primary bg-primary/5' : '',
  ),
);

function makeThumb(uf: UploadFile, raw: File) {
  if (!raw.type?.startsWith('image/')) return;
  if (typeof URL.createObjectURL !== 'function') return;
  const url = URL.createObjectURL(raw);
  blobUrls.set(uf.uid, url);
  uf.thumbUrl = url;
}

function revoke(uid: string) {
  const url = blobUrls.get(uid);
  if (url) {
    if (typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(url);
    blobUrls.delete(uid);
  }
}

/** 统一提交：重排数组触发 v-model，再按需抛 change（对齐 antd 的 file + fileList） */
function commit(next: UploadFile[], changeFile?: UploadFile, event?: any) {
  fileList.value = next.slice();
  if (changeFile)
    emit('change', { file: changeFile, fileList: next.slice(), event });
}

function updateFile(uid: string, patch: Partial<UploadFile>, notify = true) {
  const next = (fileList.value ?? []).map((f) =>
    f.uid === uid ? Object.assign(f, patch) : f,
  );
  const target = next.find((f) => f.uid === uid);
  if (notify && target)
    commit(next, target);
  else fileList.value = next.slice();
}

function startUpload(uf: UploadFile, raw: File) {
  const options = {
    file: raw,
    filename: uf.name,
    onSuccess: (res: any) => {
      uf.response = res;
      updateFile(uf.uid, { status: 'done', percent: 100 });
    },
    onError: (err: any) => {
      uf.error = err;
      updateFile(uf.uid, { status: 'error' });
    },
    onProgress: (e: { percent: number }) => {
      updateFile(uf.uid, { percent: e?.percent ?? 0 });
    },
  };

  if (props.customRequest) {
    props.customRequest(options);
    return;
  }

  // 没有自定义通道时模拟成功，保证纯页面开箱可用
  const timer = setTimeout(() => options.onSuccess({}), 300);
  timers.add(timer);
}

async function processFiles(rawFiles: File[]) {
  const list = rawFiles.length && props.multiple ? rawFiles : rawFiles.slice(0, 1);

  for (const raw of list) {
    let toUse: File = raw;

    if (props.beforeUpload) {
      try {
        const res = await props.beforeUpload(raw, list);
        if (res === false) continue;
        if (res instanceof Blob || (res instanceof File)) toUse = res as File;
      } catch {
        continue; // 拒绝的 Promise 视为跳过
      }
    }

    if (props.maxCount !== undefined && props.maxCount === 1) {
      for (const old of fileList.value ?? []) revoke(old.uid);
      fileList.value = [];
      queued.clear();
    } else if (
      props.maxCount !== undefined &&
      (fileList.value ?? []).length >= props.maxCount
    ) {
      continue; // 超出上限不再追加
    }

    const uf: UploadFile = {
      uid: nextUid(),
      name: toUse.name,
      status: 'uploading',
      percent: 0,
      size: toUse.size,
      originFileObj: toUse,
    };
    makeThumb(uf, toUse);

    const next = [...(fileList.value ?? []), uf];
    commit(next, uf);

    if (props.autoUpload) startUpload(uf, toUse);
    else queued.set(uf.uid, toUse);
  }
}

function openPicker() {
  if (props.disabled) return;
  // 交给 useFileDialog：open() 内部会按 reset/multiple/accept 同步 input 并触发原生选择
  openDialog();
}

function onDrop(event: DragEvent) {
  event.preventDefault();
  isDragging.value = false;
  if (props.disabled) return;
  emit('drop', event);
  const files = Array.from(event.dataTransfer?.files ?? []);
  if (files.length) processFiles(files);
}

function handleRemove(file: UploadFile) {
  revoke(file.uid);
  queued.delete(file.uid);
  emit('remove', file);
  const next = (fileList.value ?? []).filter((f) => f.uid !== file.uid);
  // 对齐 antd：移除用一条 status='removed' 的 change 通知父级
  commit(next, { ...file, status: 'removed' });
}

function handleRetry(file: UploadFile) {
  const raw = (file.originFileObj as File) ?? queued.get(file.uid);
  if (!raw) return;
  queued.delete(file.uid);
  updateFile(file.uid, { status: 'uploading', percent: 0, error: undefined }, false);
  startUpload(file, raw);
}

function handlePreview(file: UploadFile, event: MouseEvent) {
  emit('preview', file, event);
}

function upload() {
  for (const f of fileList.value ?? []) {
    const raw = queued.get(f.uid);
    if (!raw) continue;
    queued.delete(f.uid);
    updateFile(f.uid, { status: 'uploading', percent: 0 }, false);
    startUpload(f, raw);
  }
}

function reset() {
  for (const t of timers) clearTimeout(t);
  timers.clear();
  for (const uid of [...blobUrls.keys()]) revoke(uid);
  queued.clear();
  fileList.value = [];
  // 同步清空 useFileDialog 持有的 input，避免残留选择
  resetDialog();
}

onBeforeUnmount(() => {
  for (const t of timers) clearTimeout(t);
  for (const uid of [...blobUrls.keys()]) revoke(uid);
});

defineExpose({ upload, reset });
</script>

<template>
  <div data-common-upload :class="rootClass">
    <div
      :class="triggerClass"
      @click="openPicker"
      @dragover.prevent="isDragging = true"
      @dragleave.prevent="isDragging = false"
      @drop="onDrop"
    >
      <slot></slot>
    </div>

    <input
      ref="inputRef"
      data-common-upload-input
      type="file"
      class="hidden"
      :accept="props.accept"
      :multiple="props.multiple"
      :disabled="props.disabled"
    />

    <UploadList
      v-if="props.showUploadList"
      :items="fileList"
      :list-type="props.listType"
      :disabled="props.disabled"
      @remove="handleRemove"
      @retry="handleRetry"
      @preview="handlePreview"
    />
  </div>
</template>
