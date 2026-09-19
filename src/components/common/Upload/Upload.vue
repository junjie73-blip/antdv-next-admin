<script setup lang="ts">
import { Icon } from "@iconify/vue";
import { Button, message, Upload as AntUpload } from "antdv-next";
import { computed, ref, watch } from "vue";

import { uploadSingleFile } from "./api";

import type { UploadFile, UploadProps as AntUploadProps, UploadRequestOption } from "antdv-next";

import type { UploadInstance, UploadProps } from "./types";

import { cn } from "~/utils/cn";

defineOptions({ name: "Upload" });

const props = withDefaults(defineProps<UploadProps>(), {
  multiple: false,
  showUploadList: true,
  listType: "text",
  uploadText: "点击上传",
  disabled: false,
  readonly: false,
  name: "file",
});

const emit = defineEmits<{
  "update:value": [fileList: UploadFile[]];
  change: [fileList: UploadFile[]];
  success: [response: unknown, file: UploadFile];
  error: [error: Error, file: UploadFile];
}>();

// 文件列表
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
function handleCustomRequest(options: UploadRequestOption) {
  const file = options.file as unknown as File;
  const extra = props.data ?? {};

  uploadSingleFile(file, extra)
    .then((res) => {
      message.success("上传成功");
      options.onSuccess?.(res);
    })
    .catch((err) => {
      message.error(err.message || "上传失败");
      options.onError?.(err);
    });
}

/**
 * 处理文件变化
 * 内存优化：done 后释放 originFileObj 引用
 */
const handleChange: AntUploadProps["onChange"] = (info) => {
  fileList.value = info.fileList.map((f) => {
    if (f.status === "done" && f.response) {
      return { ...f, originFileObj: undefined } as UploadFile;
    }
    return f;
  });
  emit("update:value", fileList.value);
  emit("change", fileList.value);

  if (info.file.status === "done") {
    emit("success", info.file.response, info.file);
  } else if (info.file.status === "error") {
    emit("error", new Error(info.file.error?.message || "上传失败"), info.file);
  }
};

/**
 * 上传前校验
 */
const handleBeforeUpload: AntUploadProps["beforeUpload"] = (file, list) => {
  if (props.maxSize && file.size > props.maxSize * 1024 * 1024) {
    message.warning(`文件大小不能超过 ${props.maxSize}MB`);
    return false;
  }
  if (props.maxCount && fileList.value.length + list.length > props.maxCount) {
    message.warning(`最多只能上传 ${props.maxCount} 个文件`);
    return false;
  }
  if (props.beforeUpload) {
    return props.beforeUpload(file as UploadFile, list as UploadFile[]);
  }
  return true;
};

/**
 * 组装上传配置
 * 注意：不再传 action，使用 customRequest 走系统 http
 */
const uploadProps = computed((): AntUploadProps => {
  return {
    name: props.name,
    multiple: props.multiple,
    accept: props.accept,
    listType: props.listType,
    showUploadList: props.showUploadList,
    disabled: props.disabled || props.readonly,
    beforeUpload: handleBeforeUpload,
    customRequest: handleCustomRequest,
    onRemove: props.onRemove,
  };
});

// 实例方法
function getFileList() {
  return fileList.value;
}
function setFileList(list: UploadFile[]) {
  fileList.value = list;
  emit("update:value", list);
}
function clear() {
  fileList.value = [];
  emit("update:value", []);
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
    <AntUpload v-model:file-list="fileList" v-bind="uploadProps" @change="handleChange">
      <Button v-if="!readonly" :disabled="disabled">
        <template #icon>
          <Icon icon="carbon:upload" />
        </template>
        {{ uploadText }}
      </Button>
    </AntUpload>
  </div>
</template>
