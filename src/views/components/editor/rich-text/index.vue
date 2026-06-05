<script setup lang="ts">
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { message } from 'antdv-next'
import { computed, ref, shallowRef, watch } from 'vue'
import { cn } from '@/utils/cn'
import '@wangeditor/editor/dist/css/style.css'

defineOptions({ name: 'EditorRichText' })

const editorRef = shallowRef<IDomEditor | null>(null)
const editorHtml = ref('')

const containerClassName = cn('space-y-4')
const toolbarCardClassName = cn('shadow-sm', 'sticky', 'top-0', 'z-10')
const editorCardClassName = cn('shadow-sm')

const editorConfig = computed((): Partial<IEditorConfig> => ({
  placeholder: '请输入内容...',
  autoFocus: false,
  scroll: true,
  MENU_CONF: {
    uploadImage: {
      fieldName: 'file',
      maxFileSize: 5 * 1024 * 1024,
      allowedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
      async customUpload(file: File, insertFn: (url: string, alt: string, href: string) => void) {
        const reader = new FileReader()
        reader.onload = (e) => {
          const url = e.target?.result as string
          insertFn(url, file.name, url)
        }
        reader.readAsDataURL(file)
      },
    },
    uploadVideo: {
      async customUpload(file: File, insertFn: (url: string, poster: string) => void) {
        const url = URL.createObjectURL(file)
        insertFn(url, '')
        message.warning('视频文件较大，建议使用视频链接代替')
      },
    },
  },
}))

const toolbarConfig: Partial<IToolbarConfig> = {
  excludeKeys: [
    'group-more-style',
    'fullScreen',
  ],
}

function handleCreated(editor: IDomEditor) {
  editorRef.value = editor
}

function handleChange(editor: IDomEditor) {
  editorHtml.value = editor.getHtml()
}

watch(() => editorRef.value, () => {
  if (editorRef.value && editorHtml.value) {
    editorRef.value.setHtml(editorHtml.value)
  }
})
</script>

<template>
  <div :class="containerClassName">
    <a-card
      :class="toolbarCardClassName"
      :styles="{ body: { padding: '0' } }"
    >
      <Toolbar
        :editor="editorRef"
        :default-config="toolbarConfig"
        mode="default"
        class="!border-0"
      />
    </a-card>

    <a-card
      :class="editorCardClassName"
      :styles="{ body: { padding: '0' } }"
    >
      <Editor
        :default-config="editorConfig"
        :style="{ height: '600px' }"
        class="overflow-y-auto"
        @onCreated="handleCreated"
        @onChange="handleChange"
      />
    </a-card>
  </div>
</template>
