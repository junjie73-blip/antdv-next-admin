<script setup lang="ts">
import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'
import type { MarkdownEditorInstance, MarkdownEditorProps } from './types'
import { Editor, Toolbar } from '@wangeditor/editor-for-vue'
import { computed, ref, shallowRef, watch } from 'vue'
import { cn } from '@/utils/cn'
import '@wangeditor/editor/dist/css/style.css'

/**
 * MarkdownEditor - Markdown 富文本编辑器组件
 * 基于 WangEditor 封装
 */

const props = withDefaults(defineProps<MarkdownEditorProps>(), {
  modelValue: '',
  height: '500px',
  mode: 'edit',
  theme: 'light',
  placeholder: '请输入内容...',
  readonly: false,
  disabled: false,
  showToolbar: true,
  autoFocus: false,
  showCount: true,
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void
  (e: 'change', value: string, html: string): void
  (e: 'focus', editor: IDomEditor): void
  (e: 'blur', editor: IDomEditor): void
  (e: 'uploadSuccess', file: File, response: any): void
  (e: 'uploadError', file: File, error: any): void
  (e: 'maxLength', currentLength: number, maxLength: number): void
}>()

// 编辑器实例
const editorRef = shallowRef<IDomEditor | null>(null)

// 编辑器内容
const editorValue = ref(props.modelValue)

// 字数统计
const textLength = ref(0)
const htmlLength = ref(0)

/**
 * 计算编辑器高度
 */
const editorHeight = computed(() => {
  if (typeof props.height === 'number') {
    return `${props.height}px`
  }
  return props.height
})

/**
 * 工具栏配置
 */
const defaultToolbarConfig: Partial<IToolbarConfig> = {
  toolbarKeys: [
    'headerSelect',
    '|',
    'bold',
    'italic',
    'underline',
    'through',
    'color',
    'bgColor',
    '|',
    'fontSize',
    'fontFamily',
    'lineHeight',
    '|',
    'bulletedList',
    'numberedList',
    'todo',
    'justifyLeft',
    'justifyCenter',
    'justifyRight',
    '|',
    'insertLink',
    'uploadImage',
    'insertVideo',
    'insertTable',
    'codeBlock',
    '|',
    'undo',
    'redo',
    '|',
    'fullScreen',
  ],
}

const toolbarConfig = computed((): Partial<IToolbarConfig> => {
  return {
    ...defaultToolbarConfig,
    ...props.toolbarConfig,
  }
})

/**
 * 编辑器配置
 */
const editorConfig = computed((): Partial<IEditorConfig> => {
  const config: Partial<IEditorConfig> = {
    placeholder: props.placeholder,
    readOnly: props.readonly || props.disabled,
    autoFocus: props.autoFocus,
    scroll: true,
    ...props.editorConfig,
  }

  // 图片上传配置
  if (props.imageUpload) {
    config.MENU_CONF = {
      ...config.MENU_CONF,
      uploadImage: {
        server: props.imageUpload.server,
        fieldName: props.imageUpload.fieldName || 'file',
        headers: props.imageUpload.headers,
        meta: props.imageUpload.meta,
        maxFileSize: (props.imageUpload.maxFileSize || 5) * 1024 * 1024,
        allowedFileTypes: props.imageUpload.allowedFileTypes || ['image/png', 'image/jpeg', 'image/gif'],
        customUpload: props.imageUpload.customUpload,
        onSuccess: (file: File, response: any) => {
          emit('uploadSuccess', file, response)
        },
        onError: (file: File, error: any) => {
          emit('uploadError', file, error)
        },
      },
    }
  }

  // 最大字数限制
  if (props.maxLength) {
    config.maxLength = props.maxLength
    config.onMaxLength = (editor: IDomEditor) => {
      const length = editor.getText().length
      emit('maxLength', length, props.maxLength!)
    }
  }

  return config
})

/**
 * 编辑器容器类名
 */
const containerClassName = computed(() => {
  return cn(
    'markdown-editor',
    'border rounded overflow-hidden',
    props.theme === 'dark' && 'dark-theme',
    props.disabled && 'opacity-60 pointer-events-none',
  )
})

/**
 * 编辑器创建完成回调
 */
function handleCreated(editor: IDomEditor) {
  editorRef.value = editor

  // 初始化内容
  if (props.modelValue && editor.isEmpty()) {
    editor.setHtml(props.modelValue)
  }

  // 更新字数统计
  updateStats()
}

/**
 * 内容变化回调
 */
function handleChange(editor: IDomEditor) {
  const html = editor.getHtml()
  const text = editor.getText()

  editorValue.value = html
  textLength.value = text.length
  htmlLength.value = html.length

  emit('update:modelValue', html)
  emit('change', html, text)
}

/**
 * 聚焦回调
 */
function handleFocus(editor: IDomEditor) {
  emit('focus', editor)
}

/**
 * 失焦回调
 */
function handleBlur(editor: IDomEditor) {
  emit('blur', editor)
}

/**
 * 更新字数统计
 */
function updateStats() {
  const editor = editorRef.value
  if (editor) {
    textLength.value = editor.getText().length
    htmlLength.value = editor.getHtml().length
  }
}

/**
 * 监听 modelValue 变化
 */
watch(
  () => props.modelValue,
  (newValue) => {
    const editor = editorRef.value
    if (editor && newValue !== editor.getHtml()) {
      editor.setHtml(newValue || '')
      updateStats()
    }
  },
)

/**
 * 监听 disabled 变化
 */
watch(
  () => props.disabled,
  (disabled) => {
    const editor = editorRef.value
    if (editor) {
      if (disabled) {
        editor.disable()
      }
      else {
        editor.enable()
      }
    }
  },
)

/**
 * 组件实例方法
 */
const instance: MarkdownEditorInstance = {
  getEditor: () => editorRef.value,
  getHtml: () => editorRef.value?.getHtml() || '',
  getMarkdown: () => editorRef.value?.getHtml() || '', // WangEditor 输出 HTML，如需 Markdown 需额外转换
  getText: () => editorRef.value?.getText() || '',
  setHtml: (html: string) => {
    editorRef.value?.setHtml(html)
    updateStats()
  },
  setMarkdown: (markdown: string) => {
    // 如需支持 Markdown 输入，需要引入 markdown-it 等库进行转换
    editorRef.value?.setHtml(markdown)
    updateStats()
  },
  clear: () => {
    editorRef.value?.clear()
    updateStats()
  },
  focus: () => editorRef.value?.focus(),
  blur: () => editorRef.value?.blur(),
  undo: () => editorRef.value?.undo(),
  redo: () => editorRef.value?.redo(),
  insertText: (text: string) => editorRef.value?.insertText(text),
  insertHtml: (html: string) => editorRef.value?.dangerouslyInsertHtml(html),
  selectAll: () => editorRef.value?.selectAll(),
  getStats: () => ({
    textLength: textLength.value,
    htmlLength: htmlLength.value,
  }),
}

// 暴露实例方法
defineExpose(instance)
</script>

<template>
  <div :class="containerClassName">
    <!-- 工具栏 -->
    <Toolbar
      v-if="showToolbar && mode !== 'preview'"
      :editor="editorRef"
      :default-config="toolbarConfig"
      :mode="mode === 'split' ? 'default' : mode"
      class="border-b"
    />

    <!-- 编辑器 -->
    <Editor
      :default-config="editorConfig"
      :mode="mode === 'split' ? 'default' : mode"
      :style="{ height: editorHeight }"
      class="overflow-hidden"
      @onCreated="handleCreated"
      @onChange="handleChange"
      @onFocus="handleFocus"
      @onBlur="handleBlur"
    />

    <!-- 字数统计 -->
    <div
      v-if="showCount"
      class="flex justify-end px-3 py-1 text-xs text-gray-500 border-t bg-gray-50"
    >
      <span>{{ textLength }} 字</span>
      <span
        v-if="maxLength"
        class="ml-2"
      >/ {{ maxLength }} 字上限</span>
    </div>
  </div>
</template>

<style scoped>
.markdown-editor :deep(.w-e-text-container) {
  background-color: transparent;
}

.markdown-editor.dark-theme :deep(.w-e-toolbar) {
  background-color: #1f2937;
  color: #e5e7eb;
}

.markdown-editor.dark-theme :deep(.w-e-text-container) {
  background-color: #111827;
  color: #e5e7eb;
}
</style>
