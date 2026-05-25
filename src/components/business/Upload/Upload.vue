<script setup lang="ts">
import type { UploadProps as AntUploadProps, UploadFile } from 'antdv-next'
import type { UploadInstance, UploadProps } from './types'
import { UploadOutlined } from '@ant-design/icons-vue'
import { Upload as AntUpload, Button } from 'antdv-next'

import { computed, ref, watch } from 'vue'
import { cn } from '@/utils/cn'

/**
 * Upload - 上传组件
 * 基于 Ant Design Vue Upload 封装
 */

const props = withDefaults(defineProps<UploadProps>(), {
  multiple: false,
  showUploadList: true,
  listType: 'text',
  uploadText: '点击上传',
  disabled: false,
  readonly: false,
})

const emit = defineEmits<{
  'update:value': [fileList: UploadFile[]]
  'change': [fileList: UploadFile[]]
  'success': [response: any, file: UploadFile]
  'error': [error: Error, file: UploadFile]
}>()

// 文件列表
const fileList = ref<UploadFile[]>(props.value || [])

// 监听 value 变化
watch(
  () => props.value,
  (newValue) => {
    if (newValue && newValue !== fileList.value) {
      fileList.value = newValue
    }
  },
  { deep: true },
)

/**
 * 处理文件变化
 */
const handleChange: AntUploadProps['onChange'] = (info) => {
  fileList.value = info.fileList
  emit('update:value', info.fileList)
  emit('change', info.fileList)

  // 处理上传状态
  if (info.file.status === 'done') {
    emit('success', info.file.response, info.file)
  }
  else if (info.file.status === 'error') {
    emit('error', new Error(info.file.error?.message || 'Upload failed'), info.file)
  }
}

/**
 * 上传前处理
 */
const handleBeforeUpload: AntUploadProps['beforeUpload'] = (file, fileList) => {
  // 文件大小检查
  if (props.maxSize && file.size > props.maxSize * 1024 * 1024) {
    // 可以使用 message 提示
    console.warn(`文件大小不能超过 ${props.maxSize}MB`)
    return false
  }

  // 文件数量检查
  if (props.maxCount && fileList.length + fileList.length > props.maxCount) {
    console.warn(`最多只能上传 ${props.maxCount} 个文件`)
    return false
  }

  // 调用自定义 beforeUpload
  if (props.beforeUpload) {
    return props.beforeUpload(file as UploadFile, fileList as UploadFile[])
  }

  return true
}

/**
 * 计算上传组件属性
 */
const uploadProps = computed((): AntUploadProps => {
  return {
    action: props.action,
    multiple: props.multiple,
    accept: props.accept,
    listType: props.listType,
    showUploadList: props.showUploadList,
    disabled: props.disabled || props.readonly,
    customRequest: props.customRequest,
    beforeUpload: handleBeforeUpload,
    onRemove: props.onRemove,
  }
})

/**
 * 获取文件列表
 */
const getFileList = () => fileList.value

/**
 * 设置文件列表
 */
function setFileList(list: UploadFile[]) {
  fileList.value = list
  emit('update:value', list)
}

/**
 * 清空文件列表
 */
function clear() {
  fileList.value = []
  emit('update:value', [])
}

// 暴露实例方法
defineExpose<UploadInstance>({
  getFileList,
  setFileList,
  clear,
  upload: () => {}, // 由 Ant Upload 内部处理
})
</script>

<template>
  <div :class="cn('upload-wrapper', props.className)">
    <AntUpload
      v-model:file-list="fileList"
      v-bind="uploadProps"
      @change="handleChange"
    >
      <Button
        v-if="!readonly"
        :disabled="disabled"
      >
        <UploadOutlined />
        {{ uploadText }}
      </Button>
    </AntUpload>
  </div>
</template>
