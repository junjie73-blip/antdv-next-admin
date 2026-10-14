<script setup lang="ts">
import type {
  UploadChangeParam,
  UploadFile,
  UploadRequestOptions,
} from '@antdv/common-ui';

import type { UploadInstance, UploadProps } from './types';

import { ref, watch } from 'vue';

import { Upload as BaseUpload } from '@antdv/common-ui';
import { message } from '@antdv/popup-ui';
import { Button } from '@antdv/shadcn-ui';
import { cn } from '@antdv/shared/cn';
import { Icon } from '@iconify/vue';

import { uploadSingleFile } from './api';

defineOptions({ name: 'Upload' });

const props = withDefaults(defineProps<UploadProps>(), {
  multiple: false,
  showUploadList: true,
  listType: 'text',
  uploadText: '点击上传',
  disabled: false,
  readonly: false,
  name: 'file',
});

const emit = defineEmits<{
  'update:value': [fileList: UploadFile[]];
  change: [fileList: UploadFile[]];
  success: [response: unknown, file: UploadFile];
  error: [error: Error, file: UploadFile];
}>();

// 文件列表：与 common-ui Upload 的 v-model:fileList 双向绑定
const fileList = ref<UploadFile[]>(props.value ?? []);

watch(
  () => props.value,
  (nv) => {
    if (nv && nv !== fileList.value) fileList.value = nv;
  },
  { deep: true },
);

/**
 * 自定义上传：走系统 http 封装
 * - 自动带 token / tenant header / 请求拦截
 * - 支持进度上报
 */
function handleCustomRequest(options: UploadRequestOptions) {
  const file = options.file as unknown as File;
  const extra = props.data ?? {};

  uploadSingleFile(file, extra)
    .then((res) => {
      message.success('上传成功');
      options.onSuccess?.(res);
    })
    .catch((error) => {
      message.error(error.message || '上传失败');
      options.onError?.(error);
    });
}

/**
 * 处理文件变化
 * 内存优化：done 后释放 originFileObj 引用
 */
function handleChange(info: UploadChangeParam) {
  fileList.value = info.fileList.map((f) => {
    if (f.status === 'done' && f.response) {
      return { ...f, originFileObj: undefined } as UploadFile;
    }
    return f;
  });
  emit('update:value', fileList.value);
  emit('change', fileList.value);

  if (info.file.status === 'done') {
    emit('success', info.file.response, info.file);
  } else if (info.file.status === 'error') {
    emit('error', new Error(info.file.error?.message || '上传失败'), info.file);
  }
}

/**
 * 上传前校验：maxSize / maxCount 的警告文案与拦截时机保持原样
 */
function handleBeforeUpload(file: File, list: File[]) {
  if (props.maxSize && file.size > props.maxSize * 1024 * 1024) {
    message.warning(`文件大小不能超过 ${props.maxSize}MB`);
    return false;
  }
  if (props.maxCount && fileList.value.length + list.length > props.maxCount) {
    message.warning(`最多只能上传 ${props.maxCount} 个文件`);
    return false;
  }
  if (props.beforeUpload) {
    return props.beforeUpload(
      file as unknown as UploadFile,
      list as unknown as UploadFile[],
    );
  }
  return true;
}

/** 删除回调：base 已完成移除，这里只把 onRemove 契约透传给消费方 */
function handleRemove(file: UploadFile) {
  props.onRemove?.(file);
}

// 实例方法
function getFileList() {
  return fileList.value;
}
function setFileList(list: UploadFile[]) {
  fileList.value = list;
  emit('update:value', list);
}
function clear() {
  fileList.value = [];
  emit('update:value', []);
}

defineExpose<UploadInstance>({
  getFileList,
  setFileList,
  clear,
  upload: () => {},
});
</script>

<template>
  <div :class="cn('upload-wrapper', props.className)">
    <BaseUpload
      v-model:file-list="fileList"
      :accept="props.accept"
      :multiple="props.multiple"
      :list-type="props.listType"
      :show-upload-list="props.showUploadList"
      :disabled="props.disabled || props.readonly"
      :before-upload="handleBeforeUpload"
      :custom-request="handleCustomRequest"
      @change="handleChange"
      @remove="handleRemove"
    >
      <Button v-if="!readonly" :disabled="disabled">
        <Icon :icon="props.uploadIcon ?? 'carbon:upload'" />
        {{ uploadText }}
      </Button>
    </BaseUpload>
  </div>
</template>
