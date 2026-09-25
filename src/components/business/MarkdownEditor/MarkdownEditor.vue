<script setup lang="ts">
import { Editor, EditorContent } from '@tiptap/vue-3'
import { message } from 'antdv-next'
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'

import { cn } from '~/utils/cn'

import type {
  ImageUploadConfig,
  MarkdownEditorEvents,
  MarkdownEditorInstance,
  MarkdownEditorProps,
  MarkdownEditorToolbarKey,
  VideoUploadConfig,
} from './types'

import EditorToolbar from './components/EditorToolbar.vue'
import { DEFAULT_TOOLBAR_KEYS } from './constants'
import { createEditorExtensions } from './extensions'
import { uploadFile, validateFile } from './utils'

defineOptions({ name: 'MarkdownEditor' })

const props = withDefaults(defineProps<MarkdownEditorProps>(), {
  value: '',
  minHeight: 160,
  maxHeight: 500,
  height: undefined,
  mode: 'edit',
  theme: 'light',
  placeholder: '请输入内容...',
  readonly: false,
  disabled: false,
  showToolbar: true,
  autoFocus: false,
  showCount: true,
  compact: false,
})

const emit = defineEmits<MarkdownEditorEvents>()

/* ============================================================
 * 状态
 * ============================================================ */

const editorRef = shallowRef<Editor | undefined>()
const textLength = ref(0)
const htmlLength = ref(0)
const isFullScreen = ref(false)

const imageInputRef = ref<HTMLInputElement | null>(null)
const videoInputRef = ref<HTMLInputElement | null>(null)

let isInternalUpdate = false
let internalUpdateTimer: ReturnType<typeof setTimeout> | null = null

/* ============================================================
 * 内容工具
 * ============================================================ */

function isEmptyContent(html: string | null | undefined): boolean {
  if (!html) return true
  const text = html
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim()
  return text === ''
}

function normalizeHtml(v: string | null | undefined): string {
  return v == null ? '' : String(v)
}

function isSameContent(a: string, b: string): boolean {
  if (isEmptyContent(a) && isEmptyContent(b)) return true
  return a === b
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * 外部写入内容后短时间内忽略 value 的回落
 *
 * 父组件收到 update:value 后可能再传回一个等价但字符串不同的值，
 * 若不屏蔽会触发一次多余的重解析（光标丢失）。
 */
function markInternalUpdate(): void {
  isInternalUpdate = true
  if (internalUpdateTimer) clearTimeout(internalUpdateTimer)
  internalUpdateTimer = setTimeout(() => {
    isInternalUpdate = false
    internalUpdateTimer = null
  }, 200)
}

function updateStats(): void {
  const editor = editorRef.value
  if (!editor) return
  textLength.value = editor.getText().length
  htmlLength.value = editor.getHTML().length
}

/** 编辑器内容变化后统一回写 model、抛事件、刷新统计 */
function syncFromEditor(editor: Editor): void {
  const html = editor.getHTML()
  const text = editor.getText()

  markInternalUpdate()
  emit('update:value', html)
  emit('change', html, text)

  textLength.value = text.length
  htmlLength.value = html.length
}

function replaceContent(html: string): void {
  const editor = editorRef.value
  if (!editor) return
  markInternalUpdate()
  editor.commands.setContent(html, { emitUpdate: false })
  syncFromEditor(editor)
}

/* ============================================================
 * 高度 / 全屏
 * ============================================================ */

function toCssSize(v: number | string | undefined): string | undefined {
  if (v === undefined) return undefined
  return typeof v === 'number' ? `${v}px` : v
}

const fixedHeight = computed(() => toCssSize(props.height))
const minHeightCss = computed(() => toCssSize(props.minHeight) ?? '160px')
const maxHeightCss = computed(() => toCssSize(props.maxHeight) ?? '500px')

/**
 * 内容区高度用 flex 表达而不是单纯 height，容器被父级约束时才能撑满
 */
const contentStyle = computed(() => {
  if (isFullScreen.value) return { flex: '1 1 0%' }
  if (fixedHeight.value) return { flex: '0 0 auto', height: fixedHeight.value }
  return { flex: '1 1 auto', minHeight: minHeightCss.value, maxHeight: maxHeightCss.value }
})

function toggleFullScreen(): void {
  isFullScreen.value = !isFullScreen.value
}

/* ============================================================
 * 上传
 * ============================================================ */

const DEFAULT_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']

const DEFAULT_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/ogg', 'video/quicktime']

const imageUploadConfig = computed<ImageUploadConfig>(() => ({
  maxFileSize: 5,
  allowedFileTypes: DEFAULT_IMAGE_TYPES,
  ...props.imageUpload,
}))

const videoUploadConfig = computed<VideoUploadConfig>(() => ({
  maxFileSize: 100,
  allowedFileTypes: DEFAULT_VIDEO_TYPES,
  ...props.videoUpload,
}))

const imageAccept = computed(() => (imageUploadConfig.value.allowedFileTypes ?? DEFAULT_IMAGE_TYPES).join(','))

const videoAccept = computed(() => (videoUploadConfig.value.allowedFileTypes ?? DEFAULT_VIDEO_TYPES).join(','))

function insertImageNode(url: string, alt = '', href = ''): void {
  editorRef.value
    ?.chain()
    .focus()
    .insertContent({ type: 'image', attrs: { src: url, alt: alt || null, dataHref: href || null } })
    .run()
}

function insertVideoNode(url: string, poster = ''): void {
  editorRef.value
    ?.chain()
    .focus()
    .insertContent({ type: 'video', attrs: { src: url, poster: poster || null } })
    .run()
}

async function uploadImageByHttp(file: File): Promise<void> {
  const cfg = imageUploadConfig.value

  try {
    const result = await uploadFile({
      file,
      server: cfg.server,
      fieldName: cfg.fieldName,
      meta: cfg.meta,
    })

    insertImageNode(result.url, result.filename, result.url)

    cfg.onSuccess?.(file, result)
    emit('uploadSuccess', file, result)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    message.error(`图片上传失败：${error.message}`)
    cfg.onError?.(file, error)
    emit('uploadError', file, error)
  }
}

async function uploadVideoByHttp(file: File): Promise<void> {
  const cfg = videoUploadConfig.value

  try {
    const result = await uploadFile({
      file,
      server: cfg.server,
      fieldName: cfg.fieldName,
      meta: cfg.meta,
    })

    insertVideoNode(result.url)

    cfg.onSuccess?.(file, result)
    emit('uploadSuccess', file, result)
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err))
    message.error(`视频上传失败：${error.message}`)
    cfg.onError?.(file, error)
    emit('uploadError', file, error)
  }
}

/** 取文件并复位 input，保证同一文件可重复选择 */
function takeSelectedFile(event: Event): File | null {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  input.value = ''
  return file
}

function openImagePicker(): void {
  if (props.disabled || props.readonly) return
  imageInputRef.value?.click()
}

function openVideoPicker(): void {
  if (props.disabled || props.readonly) return
  videoInputRef.value?.click()
}

function handleImageChange(event: Event): void {
  const file = takeSelectedFile(event)
  if (!file) return

  const cfg = imageUploadConfig.value
  // 自定义上传同样先走体积 / 格式校验，与 wangEditor 的菜单配置语义一致
  if (
    !validateFile(file, {
      maxSizeMB: cfg.maxFileSize,
      allowedTypes: cfg.allowedFileTypes,
      label: '图片',
    })
  ) {
    return
  }

  if (cfg.customUpload) {
    cfg.customUpload(file, insertImageNode)
    return
  }

  void uploadImageByHttp(file)
}

function handleVideoChange(event: Event): void {
  const file = takeSelectedFile(event)
  if (!file) return

  const cfg = videoUploadConfig.value
  if (
    !validateFile(file, {
      maxSizeMB: cfg.maxFileSize,
      allowedTypes: cfg.allowedFileTypes,
      label: '视频',
    })
  ) {
    return
  }

  if (cfg.customUpload) {
    cfg.customUpload(file, insertVideoNode)
    return
  }

  void uploadVideoByHttp(file)
}

/* ============================================================
 * 工具栏
 * ============================================================ */

const toolbarKeys = computed<MarkdownEditorToolbarKey[]>(() => {
  const cfg = props.toolbarConfig
  // 与 wangEditor 一致：配了 toolbarKeys 就不再理会 excludeKeys
  if (cfg?.toolbarKeys?.length) return cfg.toolbarKeys

  const excluded = new Set(cfg?.excludeKeys ?? [])
  return DEFAULT_TOOLBAR_KEYS.filter((key) => !excluded.has(key))
})

/* ============================================================
 * 编辑器实例
 * ============================================================ */

const isLocked = computed(() => props.readonly || props.disabled || props.mode === 'preview')

/**
 * 超过 maxLength 时拦截输入
 *
 * 不用 CharacterCount 扩展：它只在事务结束后统计，无法阻止本次输入落库。
 */
function exceedsMaxLength(nextLength: number): boolean {
  const limit = props.maxLength
  if (!limit || nextLength <= limit) return false
  emit('maxLength', nextLength, limit)
  return true
}

function currentTextLength(): number {
  return editorRef.value?.getText().length ?? 0
}

editorRef.value = new Editor({
  extensions: createEditorExtensions({ placeholder: props.placeholder }),
  content: normalizeHtml(props.value),
  editable: !isLocked.value,
  autofocus: !isLocked.value && props.autoFocus,
  editorProps: {
    attributes: { class: 'md-content' },
    handleTextInput: (view, from, to, text) => {
      const removed = view.state.doc.textBetween(from, to, '', '').length
      return exceedsMaxLength(currentTextLength() - removed + text.length)
    },
    handlePaste: (_view, event) => {
      const text = event.clipboardData?.getData('text/plain') ?? ''
      return exceedsMaxLength(currentTextLength() + text.length)
    },
    handleDrop: (_view, event) => {
      const text = (event as DragEvent).dataTransfer?.getData('text/plain') ?? ''
      return exceedsMaxLength(currentTextLength() + text.length)
    },
  },
  // 回调给的是 core 的 Editor 基类，运行时实例其实是 vue-3 的 Editor 子类
  onUpdate: ({ editor }) => syncFromEditor(editor as Editor),
  onFocus: ({ editor }) => emit('focus', editor as Editor),
  onBlur: ({ editor }) => emit('blur', editor as Editor),
})

onMounted(() => {
  const editor = editorRef.value
  if (editor) emit('created', editor)
})

watch(
  () => props.value,
  (newValue) => {
    if (isInternalUpdate) return
    const editor = editorRef.value
    if (!editor) return

    const next = normalizeHtml(newValue)
    if (isSameContent(next, editor.getHTML())) return

    editor.commands.setContent(next, { emitUpdate: false })
    updateStats()
  },
)

watch(isLocked, (locked) => {
  editorRef.value?.setEditable(!locked)
})

onBeforeUnmount(() => {
  if (internalUpdateTimer) {
    clearTimeout(internalUpdateTimer)
    internalUpdateTimer = null
  }
  editorRef.value?.destroy()
  editorRef.value = undefined
  emit('destroyed')
})

/* ============================================================
 * 实例方法
 * ============================================================ */

const instance: MarkdownEditorInstance = {
  getEditor: () => editorRef.value ?? null,
  getHtml: () => editorRef.value?.getHTML() ?? '',
  // 与迁移前一致：Markdown 语义由 HTML 承接
  getMarkdown: () => editorRef.value?.getHTML() ?? '',
  getText: () => editorRef.value?.getText() ?? '',
  setHtml: (html: string) => replaceContent(normalizeHtml(html)),
  setMarkdown: (html: string) => replaceContent(normalizeHtml(html)),
  clear: () => {
    const editor = editorRef.value
    if (!editor) return
    markInternalUpdate()
    editor.commands.setContent('', { emitUpdate: false })
    emit('update:value', '')
    emit('change', '', '')
    updateStats()
  },
  focus: () => editorRef.value?.commands.focus(),
  blur: () => editorRef.value?.commands.blur(),
  undo: () => editorRef.value?.commands.undo(),
  redo: () => editorRef.value?.commands.redo(),
  insertText: (text: string) => editorRef.value?.chain().focus().insertContent(escapeHtml(text)).run(),
  insertHtml: (html: string) => editorRef.value?.chain().focus().insertContent(html).run(),
  insertImage: (url: string, alt = '', href = '') => insertImageNode(url, alt, href),
  insertVideo: (url: string, poster = '') => insertVideoNode(url, poster),
  selectAll: () => editorRef.value?.commands.selectAll(),
  getStats: () => ({
    textLength: textLength.value,
    htmlLength: htmlLength.value,
  }),
}

defineExpose(instance)

/* ============================================================
 * 类名
 * ============================================================ */

const containerClassName = computed(() =>
  cn(
    'markdown-editor flex flex-col overflow-hidden rounded-md border',
    'border-gray-200 bg-white transition-colors',
    'focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20',
    'dark:border-gray-700 dark:bg-gray-900',
    props.disabled && 'pointer-events-none opacity-60',
    props.compact && 'markdown-editor-compact',
    isFullScreen.value && 'markdown-editor-fullscreen',
  ),
)

const toolbarClassName = computed(() =>
  cn('shrink-0 border-b border-gray-200 dark:border-gray-700', props.compact && 'compact-toolbar'),
)
</script>

<template>
  <div :class="containerClassName">
    <!-- 工具栏 -->
    <EditorToolbar
      v-if="showToolbar && mode !== 'preview'"
      :editor="editorRef"
      :keys="toolbarKeys"
      :disabled="isLocked"
      :full-screen="isFullScreen"
      :class="toolbarClassName"
      @upload-image="openImagePicker"
      @upload-video="openVideoPicker"
      @toggle-full-screen="toggleFullScreen"
    />

    <!-- 编辑器内容：滚动容器由本组件提供，ProseMirror 只负责排版 -->
    <div class="min-h-0 overflow-auto" :style="contentStyle">
      <EditorContent :editor="editorRef" />
    </div>

    <!-- 字数统计 -->
    <div
      v-if="showCount"
      class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
    >
      <span>{{ textLength }} 字</span>
      <span v-if="maxLength" class="text-gray-400 dark:text-gray-500"> / {{ maxLength }} 上限 </span>
    </div>

    <input ref="imageInputRef" type="file" :accept="imageAccept" class="hidden" @change="handleImageChange" />
    <input ref="videoInputRef" type="file" :accept="videoAccept" class="hidden" @change="handleVideoChange" />
  </div>
</template>

<style scoped>
/* ============================================================
 * ProseMirror 内容排版
 * Tailwind 的 preflight 会清掉列表 / 标题样式，这里按 wangEditor 的观感补齐
 * ============================================================ */

.markdown-editor :deep(.md-content) {
  padding: 12px 16px;
  font-size: 14px;
  line-height: 1.6;
  color: #1f2937;
  outline: none;
}

.markdown-editor :deep(.md-content p) {
  margin: 0 0 0.5em;
}

.markdown-editor :deep(.md-content > :last-child) {
  margin-bottom: 0;
}

.markdown-editor :deep(.md-content h1),
.markdown-editor :deep(.md-content h2),
.markdown-editor :deep(.md-content h3),
.markdown-editor :deep(.md-content h4),
.markdown-editor :deep(.md-content h5) {
  margin: 0.8em 0 0.4em;
  font-weight: 600;
  line-height: 1.35;
}

.markdown-editor :deep(.md-content h1) {
  font-size: 1.75em;
}

.markdown-editor :deep(.md-content h2) {
  font-size: 1.5em;
}

.markdown-editor :deep(.md-content h3) {
  font-size: 1.25em;
}

.markdown-editor :deep(.md-content h4) {
  font-size: 1.1em;
}

.markdown-editor :deep(.md-content h5) {
  font-size: 1em;
}

.markdown-editor :deep(.md-content ul),
.markdown-editor :deep(.md-content ol) {
  margin: 0 0 0.5em;
  padding-left: 1.5em;
}

.markdown-editor :deep(.md-content ul) {
  list-style: disc;
}

.markdown-editor :deep(.md-content ol) {
  list-style: decimal;
}

.markdown-editor :deep(.md-content li) {
  margin: 0.15em 0;
}

.markdown-editor :deep(.md-content li > p) {
  margin: 0;
}

.markdown-editor :deep(.md-content blockquote) {
  margin: 0.5em 0;
  padding-left: 12px;
  border-left: 4px solid #d1d5db;
  color: #4b5563;
}

.markdown-editor :deep(.md-content hr) {
  margin: 1em 0;
  border: none;
  border-top: 1px solid #e5e7eb;
}

.markdown-editor :deep(.md-content a) {
  color: #2563eb;
  text-decoration: underline;
  cursor: pointer;
}

.markdown-editor :deep(.md-content code) {
  padding: 1px 4px;
  border-radius: 3px;
  background-color: #f3f4f6;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.9em;
}

.markdown-editor :deep(.md-content pre) {
  margin: 0.5em 0;
  padding: 8px 12px;
  overflow-x: auto;
  border-radius: 4px;
  background-color: #1f2937;
  color: #e5e7eb;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
}

.markdown-editor :deep(.md-content pre code) {
  padding: 0;
  background: none;
  color: inherit;
  font-size: inherit;
}

.markdown-editor :deep(.md-content img),
.markdown-editor :deep(.md-content video) {
  max-width: 100%;
}

.markdown-editor :deep(.md-content img.ProseMirror-selectednode),
.markdown-editor :deep(.md-content video.ProseMirror-selectednode) {
  outline: 2px solid #3b82f6;
}

/* 表格 */
.markdown-editor :deep(.md-content table) {
  width: 100%;
  margin: 0.5em 0;
  border-collapse: collapse;
  table-layout: fixed;
}

.markdown-editor :deep(.md-content th),
.markdown-editor :deep(.md-content td) {
  min-width: 1em;
  padding: 6px 8px;
  border: 1px solid #d1d5db;
  vertical-align: top;
}

.markdown-editor :deep(.md-content th) {
  background-color: #f3f4f6;
  font-weight: 600;
  text-align: left;
}

/* 占位符 */
.markdown-editor :deep(.md-content .is-empty::before) {
  float: left;
  height: 0;
  color: #9ca3af;
  content: attr(data-placeholder);
  pointer-events: none;
}

/* ============================================================
 * 全屏
 * ============================================================ */

.markdown-editor-fullscreen {
  position: fixed;
  inset: 0;
  z-index: 50;
  border: none;
  border-radius: 0;
}

/* ============================================================
 * 紧凑模式
 * ============================================================ */

.markdown-editor-compact :deep(.compact-toolbar) {
  padding-block: 2px;
}

.markdown-editor-compact :deep(.compact-toolbar button) {
  height: 24px;
  min-width: 24px;
}

.markdown-editor-compact :deep(.md-content) {
  padding: 8px 10px;
  font-size: 13px;
}

/* ============================================================
 * 深色模式
 * ============================================================ */

:global(.dark) .markdown-editor :deep(.md-content) {
  color: #e5e7eb;
}

:global(.dark) .markdown-editor :deep(.md-content th) {
  background-color: #374151;
}

:global(.dark) .markdown-editor :deep(.md-content th),
:global(.dark) .markdown-editor :deep(.md-content td) {
  border-color: #4b5563;
}

:global(.dark) .markdown-editor :deep(.md-content blockquote) {
  border-color: #4b5563;
  color: #9ca3af;
}

:global(.dark) .markdown-editor :deep(.md-content code) {
  background-color: #374151;
}

:global(.dark) .markdown-editor :deep(.md-content hr) {
  border-color: #374151;
}

:global(.dark) .markdown-editor :deep(.md-content a) {
  color: #60a5fa;
}

:global(.dark) .markdown-editor :deep(.md-content .is-empty::before) {
  color: #6b7280;
}
</style>
