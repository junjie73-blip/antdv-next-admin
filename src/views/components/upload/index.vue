<script setup lang="ts">
import type { UploadChangeParam, UploadFile, UploadProps } from 'antdv-next'
import { message } from 'antdv-next'
import { computed, ref, useTemplateRef } from 'vue'

// ===== 大文件切片上传 =====
import { useChunkUpload } from '@/composables/useChunkUpload'

import { cn } from '@/utils/cn'

const containerClassName = cn('space-y-6')
const descClassName = cn('mb-3 text-sm text-gray-500 dark:text-gray-400')

const basicFileList = ref<UploadFile[]>([])

const imageFileList = ref<UploadFile[]>([])

const imageUploadProps: Partial<UploadProps> = {
  accept: 'image/jpeg,image/png,image/gif',
  listType: 'picture-card',
  maxCount: 8,
}

const handleImageBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isLt2M = file.size / 1024 / 1024 < 2
  if (!isLt2M) {
    message.error('图片大小不能超过 2MB')
    return false
  }
  return true
}

const imagePreviewVisible = ref(false)
const imagePreviewUrl = ref('')

function handleImagePreview(file: UploadFile) {
  imagePreviewUrl.value = file.url || file.response?.url || ''
  imagePreviewVisible.value = true
}

function handleImageCancel() {
  imagePreviewVisible.value = false
}

const avatarFileList = ref<UploadFile[]>([])
const avatarLoading = ref(false)

const avatarUploaderClassName = cn(
  'w-24 h-24 rounded-full overflow-hidden cursor-pointer border-2 border-dashed border-gray-300 hover:border-blue-500 transition-colors flex items-center justify-center bg-gray-50 dark:bg-gray-800',
)

const avatarImageClassName = cn(
  'w-full h-full object-cover',
)

const avatarInfoClassName = cn('flex-1')
const avatarTitleClassName = cn('font-medium text-gray-700 dark:text-gray-300 mb-2')
const avatarRuleListClassName = cn('text-sm text-gray-500 dark:text-gray-400 space-y-1')

const handleAvatarBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    message.error('只能上传图片文件')
    return false
  }
  if (!isLt5M) {
    message.error('头像大小不能超过 5MB')
    return false
  }

  return true
}

const handleAvatarChange: UploadProps['onChange'] = (info: UploadChangeParam) => {
  if (info.file.status === 'uploading') {
    avatarLoading.value = true
  }
  else {
    avatarLoading.value = false
    if (info.file.status === 'done') {
      message.success(`${info.file.name} 上传成功`)
    }
    else if (info.file.status === 'error') {
      message.error(`${info.file.name} 上传失败`)
    }
  }
}

const customFileList = ref<UploadFile[]>([])

const customUploadAreaClassName = cn(
  'w-full h-32 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all duration-200',
)

const customIconClassName = cn('w-12 h-12 text-gray-400 mb-2')
const customTextClassName = cn('text-sm text-gray-500 dark:text-gray-400')
const customHintClassName = cn('text-xs text-gray-400 mt-1')

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
])

const statusLegendClassName = cn('mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg')
const statusGridClassName = cn('grid grid-cols-1 md:grid-cols-3 gap-4 text-sm')
const statusItemClassName = cn('flex items-center gap-2')
const statusDotUploadingClassName = cn('w-3 h-3 rounded-full bg-blue-500 animate-pulse')
const statusTextUploadingClassName = cn('text-blue-600 dark:text-blue-400')
const statusDotErrorClassName = cn('w-3 h-3 rounded-full bg-red-500')
const statusTextErrorClassName = cn('text-red-600 dark:text-red-400')
const statusDotDoneClassName = cn('w-3 h-3 rounded-full bg-green-500')
const statusTextDoneClassName = cn('text-green-600 dark:text-green-400')

const handleStatusChange: UploadProps['onChange'] = (_info: UploadChangeParam) => {
}

const validateFileList = ref<UploadFile[]>([])

const handleValidateBeforeUpload: UploadProps['beforeUpload'] = (file) => {
  const allowedTypes = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'image/jpeg',
    'image/png',
  ]

  const maxSize = 10 * 1024 * 1024

  if (!allowedTypes.includes(file.type)) {
    message.error(`不支持的文件格式：${file.type}`)
    return false
  }

  if (file.size > maxSize) {
    message.error(`文件大小不能超过 10MB，当前：${(file.size / 1024 / 1024).toFixed(2)}MB`)
    return false
  }

  message.success(`校验通过：${file.name}`)
  return true
}

const validateTipClassName = cn(
  'mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded text-xs text-yellow-700 dark:text-yellow-400',
)

const manualFileList = ref<UploadFile[]>([])
const manualUploading = ref(false)
const manualUploadRef = ref()

const manualButtonGroupClassName = cn('flex gap-3')
const manualSelectedTipClassName = cn('mt-3 text-sm text-gray-500 dark:text-gray-400')

async function handleManualUpload() {
  if (manualFileList.value.length === 0) {
    message.warning('请先选择文件')
    return
  }

  manualUploading.value = true
  try {
    await manualUploadRef.value?.submit()
    message.success('所有文件已提交上传')
  }
  catch (error) {
    console.error('手动上传失败', error)
    message.error('上传失败，请重试')
  }
  finally {
    manualUploading.value = false
  }
}

function handleManualClear() {
  manualFileList.value = []
  message.info('已清空文件列表')
}

const dragSortFileList = ref<UploadFile[]>([
  {
    uid: '-1',
    name: 'image1.png',
    status: 'done',
    url: 'https://via.placeholder.com/150?text=Image+1',
  },
  {
    uid: '-2',
    name: 'image2.png',
    status: 'done',
    url: 'https://via.placeholder.com/150?text=Image+2',
  },
  {
    uid: '-3',
    name: 'image3.png',
    status: 'done',
    url: 'https://via.placeholder.com/150?text=Image+3',
  },
  {
    uid: '-4',
    name: 'image4.png',
    status: 'done',
    url: 'https://via.placeholder.com/150?text=Image+4',
  },
])

const dragTipClassName = cn('mt-3 text-xs text-gray-400 dark:text-gray-500')

function handleDragSortChange(info: UploadChangeParam) {
  const { fileList } = info
  if (Array.isArray(fileList)) {
    dragSortFileList.value = fileList as UploadFile[]
  }
}

const largeFileCardDescClassName = cn('mb-3 text-sm text-gray-500 dark:text-gray-400')

const largeFileToolbarClassName = cn('flex gap-2 mb-4')
const largeFileSelectInputClassName = cn('hidden')

const largeFileStatusWaitingClassName = cn('text-gray-500')
const largeFileStatusUploadingClassName = cn('text-blue-600')
const largeFileStatusPausedClassName = cn('text-yellow-600')
const largeFileStatusCompletedClassName = cn('text-green-600')
const largeFileStatusErrorClassName = cn('text-red-600')

const largeFileStatusClassNameMap: Record<string, string> = {
  waiting: largeFileStatusWaitingClassName,
  uploading: largeFileStatusUploadingClassName,
  paused: largeFileStatusPausedClassName,
  completed: largeFileStatusCompletedClassName,
  error: largeFileStatusErrorClassName,
}

const largeFileStatusTextMap: Record<string, string> = {
  waiting: '等待中',
  uploading: '上传中',
  paused: '已暂停',
  completed: '已完成',
  error: '失败',
}

const largeFileTableProgressBarClassName = cn('flex-1 h-2 bg-gray-200 rounded-full overflow-hidden')
const largeFileTableProgressFillClassName = cn('h-full bg-blue-500 rounded-full transition-all duration-300')
const largeFileTableProgressTextClassName = cn('text-xs text-gray-500 w-10 text-right')
const largeFileTableActionsClassName = cn('flex gap-1')
const largeFileTableProgressRowClassName = cn('flex items-center gap-2')

interface FileQueueItem {
  id: string
  fileName: string
  fileSize: number
  status: 'waiting' | 'uploading' | 'paused' | 'completed' | 'error'
  progress: number
  file: File
}

const largeFileColumns = [
  { title: '文件名', dataIndex: 'fileName', key: 'fileName', ellipsis: true },
  { title: '大小', key: 'fileSize', width: 120 },
  { title: '进度', key: 'progress', width: 220 },
  { title: '状态', key: 'status', width: 100 },
  { title: '操作', key: 'actions', width: 280 },
]

const fileQueue = ref<FileQueueItem[]>([])
const largeFileInputRef = useTemplateRef<HTMLInputElement>('largeFileInputRef')
const isProcessingQueue = ref(false)
const uploaderMap = new Map<string, ReturnType<typeof useChunkUpload>>()
let idCounter = 0

function getUploader(item: FileQueueItem): ReturnType<typeof useChunkUpload> {
  return uploaderMap.get(item.id)!
}

function createFileQueueItem(file: File): FileQueueItem {
  const id = `file-${++idCounter}`
  const uploader = useChunkUpload({ chunkSize: 5 * 1024 * 1024, concurrent: 3 })
  uploaderMap.set(id, uploader)

  const item: FileQueueItem = {
    id,
    fileName: file.name,
    fileSize: file.size,
    status: 'waiting',
    progress: 0,
    file,
  }

  watch(
    () => uploader.progress.value,
    (val) => { item.progress = val },
  )

  watch(
    () => uploader.status.value,
    (val) => {
      if (val === 'idle')
        item.status = 'waiting'
      else if (val === 'uploading')
        item.status = 'uploading'
      else if (val === 'paused')
        item.status = 'paused'
      else if (val === 'completed')
        item.status = 'completed'
      else if (val === 'error')
        item.status = 'error'
    },
  )

  return item
}

function handleSelectFileClick() {
  largeFileInputRef.value?.click()
}

function handleLargeFileSelect(e: Event) {
  const files = (e.target as HTMLInputElement).files
  if (!files || files.length === 0)
    return
  const fileArray = Array.from(files)
  for (const file of fileArray) {
    fileQueue.value.push(createFileQueueItem(file))
  }
  ;(e.target as HTMLInputElement).value = ''
}

async function startQueueUpload() {
  if (isProcessingQueue.value)
    return
  isProcessingQueue.value = true

  for (const item of fileQueue.value) {
    if (item.status === 'completed' || item.status === 'error')
      continue

    const uploader = getUploader(item)

    if (item.status === 'paused') {
      uploader.resume()
    }
    else {
      uploader.uploadFile(item.file).catch(() => {})
    }

    await new Promise<void>((resolve) => {
      const stop = watch(
        () => item.status,
        (val) => {
          if (val === 'completed' || val === 'error') {
            stop()
            resolve()
          }
        },
      )
    })
  }

  isProcessingQueue.value = false
}

const hasUploadingItem = computed(() => fileQueue.value.some(item => item.status === 'uploading'))
const hasPausedItem = computed(() => fileQueue.value.some(item => item.status === 'paused'))

function handlePauseAll() {
  fileQueue.value.forEach((item) => {
    if (item.status === 'uploading')
      getUploader(item).pause()
  })
}

function handleResumeAll() {
  fileQueue.value.forEach((item) => {
    if (item.status === 'paused')
      getUploader(item).resume()
  })
  if (!isProcessingQueue.value) {
    startQueueUpload()
  }
}

function handleCancelAll() {
  fileQueue.value.forEach((item) => {
    getUploader(item).cancel()
  })
  uploaderMap.clear()
  fileQueue.value = []
  isProcessingQueue.value = false
}

function handlePauseItem(item: FileQueueItem) {
  getUploader(item).pause()
}

function handleResumeItem(item: FileQueueItem) {
  getUploader(item).resume()
  if (!isProcessingQueue.value) {
    startQueueUpload()
  }
}

function handleDeleteItem(item: FileQueueItem) {
  getUploader(item).cancel()
  uploaderMap.delete(item.id)
  const idx = fileQueue.value.indexOf(item)
  if (idx !== -1)
    fileQueue.value.splice(idx, 1)
}

function handleCancelItem(item: FileQueueItem) {
  getUploader(item).cancel()
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function getStatusClassName(status: string) {
  return largeFileStatusClassNameMap[status] || largeFileStatusWaitingClassName
}

function getStatusText(status: string) {
  return largeFileStatusTextMap[status] || status
}
</script>

<template>
  <div :class="containerClassName">
    <a-card
      title="基础上传"
      variant="borderless"
    >
      <div :class="descClassName">
        点击或拖拽文件到此区域进行上传，支持多文件选择
      </div>
      <a-upload
        v-model:file-list="basicFileList"
        :multiple="true"
        action="/api/upload"
        :drag="true"
      >
        <p class="ant-upload-drag-icon">
          <icon-inbox />
        </p>
        <p class="ant-upload-text">
          点击或拖拽文件到此区域上传
        </p>
        <p class="ant-upload-hint">
          支持单个或批量上传，严禁上传公司数据或其他敏感信息
        </p>
      </a-upload>
    </a-card>

    <a-card
      title="图片墙"
      variant="borderless"
    >
      <div :class="descClassName">
        图片墙效果，支持预览，仅 jpg/png/gif 格式，单张不超过 2MB
      </div>
      <a-upload
        v-model:file-list="imageFileList"
        v-bind="imageUploadProps"
        action="/api/upload/image"
        :before-upload="handleImageBeforeUpload"
        @preview="handleImagePreview"
      >
        <div>
          <plus-outlined />
          <div style="margin-top: 8px">
            上传
          </div>
        </div>
      </a-upload>
      <a-image
        :src="imagePreviewUrl"
        :visible="imagePreviewVisible"
        @cancel="handleImageCancel"
      />
    </a-card>

    <a-card
      title="头像上传"
      variant="borderless"
    >
      <div :class="descClassName">
        圆形头像裁剪上传，仅限图片格式，不超过 5MB
      </div>
      <div class="flex items-start gap-6">
        <a-upload
          v-model:file-list="avatarFileList"
          action="/api/upload/avatar"
          :show-upload-list="false"
          :before-upload="handleAvatarBeforeUpload"
          list-type="picture"
          @change="handleAvatarChange"
        >
          <div
            v-if="avatarFileList.length === 0"
            :class="avatarUploaderClassName"
          >
            <avatar-loading v-if="avatarLoading" />
            <camera-outlined
              v-else
              class="text-2xl text-gray-400"
            />
          </div>
          <img
            v-else
            :src="avatarFileList[0]?.url || avatarFileList[0]?.response?.url"
            alt="avatar"
            :class="avatarImageClassName"
          >
        </a-upload>
        <div :class="avatarInfoClassName">
          <h4 :class="avatarTitleClassName">
            上传头像
          </h4>
          <ul :class="avatarRuleListClassName">
            <li>支持 JPG、PNG、GIF 格式</li>
            <li>文件大小不超过 5MB</li>
            <li>建议尺寸 200x200 像素</li>
          </ul>
        </div>
      </div>
    </a-card>

    <a-card
      title="自定义上传按钮"
      variant="borderless"
    >
      <div :class="descClassName">
        带图标的自定义上传区域，支持拖拽
      </div>
      <a-upload
        v-model:file-list="customFileList"
        action="/api/upload/custom"
        :drag="true"
        :multiple="true"
      >
        <div :class="customUploadAreaClassName">
          <cloud-upload-outlined :class="customIconClassName" />
          <span :class="customTextClassName">点击或拖拽文件到此处上传</span>
          <span :class="customHintClassName">支持任意文件类型</span>
        </div>
      </a-upload>
    </a-card>

    <a-card
      title="上传状态展示"
      variant="borderless"
    >
      <div :class="descClassName">
        展示 uploading（上传中）、error（错误）、done（完成）三种状态
      </div>
      <a-upload
        v-model:file-list="statusFileList"
        action="/api/upload/status"
        @change="handleStatusChange"
      >
        <a-button>
          <upload-outlined />
          选择文件
        </a-button>
      </a-upload>
      <div :class="statusLegendClassName">
        <div :class="statusGridClassName">
          <div :class="statusItemClassName">
            <span :class="statusDotUploadingClassName" />
            <span :class="statusTextUploadingClassName">上传中</span>
          </div>
          <div :class="statusItemClassName">
            <span :class="statusDotErrorClassName" />
            <span :class="statusTextErrorClassName">上传失败</span>
          </div>
          <div :class="statusItemClassName">
            <span :class="statusDotDoneClassName" />
            <span :class="statusTextDoneClassName">上传成功</span>
          </div>
        </div>
      </div>
    </a-card>

    <a-card
      title="上传前校验"
      variant="borderless"
    >
      <div :class="descClassName">
        文件类型和大小校验提示，仅允许 PDF/Word/图片，最大 10MB
      </div>
      <a-upload
        v-model:file-list="validateFileList"
        action="/api/upload/validate"
        :before-upload="handleValidateBeforeUpload"
        :multiple="true"
      >
        <a-button>
          <file-text-outlined />
          选择文件（PDF/Word/图片）
        </a-button>
      </a-upload>
      <div :class="validateTipClassName">
        提示：尝试上传非指定格式的文件或超过 10MB 的文件，查看校验效果
      </div>
    </a-card>

    <a-card
      title="手动上传"
      variant="borderless"
    >
      <div :class="descClassName">
        先选择文件，再点击按钮才会上传
      </div>
      <div :class="manualButtonGroupClassName">
        <a-upload
          ref="manualUploadRef"
          v-model:file-list="manualFileList"
          action="/api/upload/manual"
          :auto-upload="false"
          :multiple="true"
        >
          <a-button>
            <folder-open-outlined />
            选择文件
          </a-button>
        </a-upload>
        <a-button
          type="primary"
          :loading="manualUploading"
          :disabled="manualFileList.length === 0"
          @click="handleManualUpload"
        >
          开始上传
        </a-button>
        <a-button
          :disabled="manualFileList.length === 0"
          @click="handleManualClear"
        >
          清空列表
        </a-button>
      </div>
      <div
        v-if="manualFileList.length > 0"
        :class="manualSelectedTipClassName"
      >
        已选择 {{ manualFileList.length }} 个文件，请点击「开始上传」按钮
      </div>
    </a-card>

    <a-card
      title="拖拽排序"
      variant="borderless"
    >
      <div :class="descClassName">
        上传后的图片列表可通过拖拽调整顺序
      </div>
      <a-upload
        v-model:file-list="dragSortFileList"
        action="/api/upload/drag-sort"
        list-type="picture-card"
        :draggable="true"
        @change="handleDragSortChange"
      >
        <div>
          <plus-outlined />
          <div style="margin-top: 8px">
            添加图片
          </div>
        </div>
      </a-upload>
      <div :class="dragTipClassName">
        提示：鼠标悬停在图片上可看到操作按钮，拖拽图标可调整顺序
      </div>
    </a-card>

    <a-card
      title="大文件上传"
      variant="borderless"
    >
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
        >
        <a-button @click="handleSelectFileClick">
          <folder-open-outlined />
          选择文件
        </a-button>
        <a-button
          type="primary"
          :disabled="fileQueue.length === 0"
          @click="startQueueUpload"
        >
          <cloud-upload-outlined />
          开始上传
        </a-button>
        <a-button
          :disabled="!hasUploadingItem"
          @click="handlePauseAll"
        >
          <pause-outlined />
          暂停
        </a-button>
        <a-button
          :disabled="!hasPausedItem"
          @click="handleResumeAll"
        >
          <caret-right-outlined />
          恢复
        </a-button>
        <a-button
          danger
          :disabled="fileQueue.length === 0"
          @click="handleCancelAll"
        >
          <close-outlined />
          取消
        </a-button>
      </div>

      <a-table
        :columns="largeFileColumns"
        :data-source="fileQueue"
        :pagination="false"
        row-key="id"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'fileSize'">
            {{ formatFileSize(record.fileSize) }}
          </template>
          <template v-else-if="column.key === 'progress'">
            <div :class="largeFileTableProgressRowClassName">
              <div :class="largeFileTableProgressBarClassName">
                <div
                  :style="{ width: `${record.progress}%` }"
                  :class="largeFileTableProgressFillClassName"
                />
              </div>
              <span :class="largeFileTableProgressTextClassName">{{ record.progress }}%</span>
            </div>
          </template>
          <template v-else-if="column.key === 'status'">
            <span :class="getStatusClassName(record.status)">{{ getStatusText(record.status) }}</span>
          </template>
          <template v-else-if="column.key === 'actions'">
            <div :class="largeFileTableActionsClassName">
              <a-button
                size="small"
                :disabled="record.status !== 'uploading'"
                @click="handlePauseItem(record)"
              >
                <pause-outlined />
                暂停
              </a-button>
              <a-button
                size="small"
                :disabled="record.status !== 'paused'"
                @click="handleResumeItem(record)"
              >
                <caret-right-outlined />
                恢复
              </a-button>
              <a-button
                size="small"
                danger
                @click="handleDeleteItem(record)"
              >
                <delete-outlined />
                删除
              </a-button>
              <a-button
                size="small"
                danger
                :disabled="record.status !== 'uploading' && record.status !== 'paused'"
                @click="handleCancelItem(record)"
              >
                <close-outlined />
                取消
              </a-button>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
