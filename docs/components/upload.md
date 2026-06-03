# Upload 上传组件

基于 [Antdv Next Upload](https://antdv-next.com/components/upload) 封装的文件上传组件，支持多种文件类型、上传前校验、进度显示和图片预览。

## 基础用法

```vue
<script setup lang="ts">
import { BasicUpload } from '@/components/business/Upload'
import { ref } from 'vue'

const fileList = ref([])
</script>

<template>
  <BasicUpload
    v-model:value="fileList"
    action="/api/upload"
    :max-size="10"
    accept=".jpg,.png,.pdf"
    @success="handleSuccess"
    @error="handleError"
  />
</template>
```

## 组件 Props

| 属性 | 说明 | 类型 | 默认值 |
|------|------|------|--------|
| `action` | 上传接口地址 | `string` | - |
| `value` | 文件列表（v-model） | `UploadFile[]` | `[]` |
| `multiple` | 是否支持多选 | `boolean` | `false` |
| `maxCount` | 最大文件数量 | `number` | - |
| `maxSize` | 单文件大小限制（MB） | `number` | - |
| `accept` | 接受的文件类型 | `string` | - |
| `showUploadList` | 是否显示文件列表 | `boolean` | `true` |
| `listType` | 列表展示类型 | `'text' \| 'picture' \| 'picture-card'` | `'text'` |
| `uploadText` | 上传按钮文本 | `string` | `'点击上传'` |
| `uploadIcon` | 上传按钮图标 | `string` | - |
| `disabled` | 是否禁用 | `boolean` | `false` |
| `readonly` | 是否只读 | `boolean` | `false` |
| `customRequest` | 自定义上传方法 | `(options) => void` | - |
| `beforeUpload` | 上传前钩子 | `(file, fileList) => boolean \| Promise<boolean>` | - |

## 组件事件

| 事件名 | 说明 | 回调参数 |
|--------|------|----------|
| `update:value` | 文件列表变化（v-model） | `(fileList: UploadFile[]) => void` |
| `change` | 文件状态变化 | `(fileList: UploadFile[]) => void` |
| `success` | 上传成功 | `(response, file: UploadFile) => void` |
| `error` | 上传失败 | `(error: Error, file: UploadFile) => void` |

## 组件实例方法

通过 ref 调用：

```ts
const uploadRef = ref<UploadInstance>()

// 获取当前文件列表
uploadRef.value?.getFileList()

// 设置文件列表（用于编辑回显）
uploadRef.value?.setFileList(existingFiles)

// 清空所有文件
uploadRef.value?.clear()
```

| 方法 | 说明 | 返回值 |
|------|------|--------|
| `getFileList` | 获取文件列表 | `UploadFile[]` |
| `setFileList` | 设置文件列表 | `(fileList: UploadFile[]) => void` |
| `clear` | 清空文件列表 | `void` |
| `upload` | 手动触发上传 | `void` |

## 支持的文件类型配置

### 图片类型

```vue
<BasicUpload
  v-model:value="imageList"
  action="/api/upload/image"
  accept="image/*"
  list-type="picture-card"
  :max-count="9"
  :max-size="5"
/>
```

### 文档类型

```vue
<BasicUpload
  v-model:value="docList"
  action="/api/upload/document"
  accept=".pdf,.doc,.docx,.xls,.xlsx"
  :max-size="20"
/>
```

### 所有文件类型

```vue
<BasicUpload
  v-model:value="allFiles"
  action="/api/upload"
  :multiple="true"
  :max-count="10"
/>
```

## 常见 MIME 类型速查

| 类型 | accept 值 | 说明 |
|------|-----------|------|
| 图片 | `image/*` 或 `.jpg,.png,.gif,.webp` | 所有图片格式 |
| PDF | `.pdf` | PDF 文档 |
| Word | `.doc,.docx` | Word 文档 |
| Excel | `.xls,.xlsx` | Excel 表格 |
| 视频 | `video/*` 或 `.mp4,.avi` | 视频文件 |
| 音频 | `audio/*` 或 `.mp3,.wav` | 音频文件 |
| 压缩包 | `.zip,.rar,.7z` | 压缩文件 |

## 上传前钩子 (beforeUpload)

在上传前进行自定义校验和处理：

```vue
<script setup lang="ts">
function handleBeforeUpload(file: UploadFile, fileList: UploadFile[]): boolean {
  // 自定义文件类型检查
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
  if (!allowedTypes.includes(file.type || '')) {
    message.error('仅支持 JPG、PNG、GIF 格式')
    return false
  }

  // 自定义文件名处理
  // const newFile = new File([file], `custom_${file.name}`, { type: file.type })

  return true
}
</script>

<template>
  <BasicUpload
    v-model:value="fileList"
    :before-upload="handleBeforeUpload"
  />
</template>
```

内置的上传前校验：
- **文件大小**：超过 `maxSize`（MB）时自动拦截并提示
- **文件数量**：超过 `maxCount` 时自动拦截并提示

## 进度显示

Antdv Next Upload 内置了上传进度条显示。当使用 `list-type="picture-card"` 时：

```vue
<BasicUpload
  v-model:value="fileList"
  action="/api/upload"
  list-type="picture-card"
/>
```

上传过程中每个文件卡片会显示进度环，完成后显示预览图或文件图标。

## 图片预览

当 `list-type` 为 `'picture'` 或 `'picture-card'` 时，点击已上传的图片可触发预览功能：

```vue
<BasicUpload
  v-model:value="imageList"
  action="/api/upload/image"
  accept="image/*"
  list-type="picture-card"
  :max-count="6"
/>
```

配合 Antdv Next 的图片预览能力实现大图查看。

## 自定义上传 (customRequest)

当需要对接特殊上传服务时，使用 `customRequest` 完全控制上传逻辑：

```vue
<script setup lang="ts">
import { useChunkUpload } from '@/composables/useChunkUpload'

function customRequest(options: any) {
  const { file, onSuccess, onError, onProgress } = options

  // 使用分片上传
  const uploader = useChunkUpload({
    file: file as File,
    url: '/api/upload/chunk',
    onProgress: (percent) => onProgress?.({ percent }),
  })

  uploader.then((result) => {
    onSuccess(result.url, file)
  }).catch((err) => {
    onError(err)
  })
}
</script>

<template>
  <BasicUpload
    v-model:value="fileList"
    :custom-request="customRequest"
  />
</template>
```

## 编辑回显场景

在编辑页面中回显已上传的文件列表：

```vue
<script setup lang="ts">
import { BasicUpload } from '@/components/business/Upload'
import { ref, onMounted } from 'vue'

const uploadRef = ref<UploadInstance>()
const fileList = ref([])

const props = defineProps<{
  id: string
}>()

onMounted(async () => {
  // 从接口获取已有文件
  const data = await api.getDetail(props.id)
  // 回显到上传组件
  uploadRef.value?.setFileList(data.files.map(file => ({
    uid: file.id,
    name: file.name,
    status: 'done',
    url: file.url,
  })))
})
</script>

<template>
  <BasicUpload
    ref="uploadRef"
    v-model:value="fileList"
    action="/api/upload"
  />
</template>
```
