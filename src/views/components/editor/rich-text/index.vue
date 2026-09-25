<script setup lang="ts">
import { message } from 'antdv-next'
import { ref } from 'vue'

import type {
  ImageUploadConfig,
  MarkdownEditorToolbarConfig,
  VideoUploadConfig,
} from '~/components/business/MarkdownEditor'

import { MarkdownEditor } from '~/components/business/MarkdownEditor'
import { cn } from '~/utils/cn'

defineOptions({ name: 'EditorRichText' })

const editorHtml = ref('')

const toolbarConfig: MarkdownEditorToolbarConfig = {
  excludeKeys: ['fullScreen'],
}

// 演示用：图片转 base64 内联，视频用临时 blob 地址
const imageUpload: ImageUploadConfig = {
  customUpload(file, insertFn) {
    const reader = new FileReader()
    reader.onload = (event) => {
      const url = event.target?.result as string
      insertFn(url, file.name, url)
    }
    reader.readAsDataURL(file)
  },
}

const videoUpload: VideoUploadConfig = {
  customUpload(file, insertFn) {
    insertFn(URL.createObjectURL(file), '')
    message.warning('视频文件较大，建议使用视频链接代替')
  },
}

const pageTitleClassName = cn('text-2xl font-bold', 'text-gray-800 dark:text-gray-100', 'mb-1')

const pageSubtitleClassName = cn('text-sm text-gray-500 dark:text-gray-400')
</script>

<template>
  <div class="flex h-full flex-col p-4">
    <div class="mb-3">
      <h1 :class="pageTitleClassName">富文本编辑器</h1>
      <p :class="pageSubtitleClassName">
        基于 tiptap 的富文本编辑器，支持文本格式化、列表、表格、图片 / 视频上传与撤销重做
      </p>
    </div>

    <MarkdownEditor
      v-model:value="editorHtml"
      :height="600"
      placeholder="请输入内容..."
      :toolbar-config="toolbarConfig"
      :image-upload="imageUpload"
      :video-upload="videoUpload"
    />
  </div>
</template>
