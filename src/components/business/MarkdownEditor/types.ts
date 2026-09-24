import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'

export type MarkdownEditorMode = 'edit' | 'preview' | 'split'
export type MarkdownEditorTheme = 'light' | 'dark'

/** 上传响应（后端统一格式） */
export interface UploadResponse {
  fileId: string
  filename: string
  url: string
  size: number
  mimeType?: string
}

/** 上传回调 */
export interface UploadCallbacks {
  /** 上传成功 */
  onSuccess?: (file: File, response: UploadResponse) => void
  /** 上传失败 */
  onError?: (file: File, error: Error) => void
  /** 上传进度 */
  onProgress?: (file: File, percent: number) => void
}

/**
 * 图片上传配置
 */
export interface ImageUploadConfig extends UploadCallbacks {
  /** 上传地址，默认走系统封装的上传接口 */
  server?: string
  /** 上传字段名，默认 "file" */
  fieldName?: string
  /** 附加字段 */
  meta?: Record<string, unknown>
  /** 最大体积（MB），默认 5 */
  maxFileSize?: number
  /** 允许的 MIME，默认 png/jpeg/gif/webp */
  allowedFileTypes?: string[]
  /** 自定义上传（不传则走内置 http 上传） */
  customUpload?: (file: File, insertFn: (url: string, alt?: string, href?: string) => void) => void
}

/**
 * 视频上传配置
 */
export interface VideoUploadConfig extends UploadCallbacks {
  /** 上传地址 */
  server?: string
  /** 上传字段名，默认 "file" */
  fieldName?: string
  /** 附加字段 */
  meta?: Record<string, unknown>
  /** 最大体积（MB），默认 100 */
  maxFileSize?: number
  /** 允许的 MIME，默认 mp4/webm/ogg */
  allowedFileTypes?: string[]
  /** 自定义上传 */
  customUpload?: (file: File, insertFn: (url: string, poster?: string) => void) => void
}

/**
 * 编辑器 Props
 */
export interface MarkdownEditorProps {
  value?: string
  minHeight?: number | string
  maxHeight?: number | string
  height?: number | string
  mode?: MarkdownEditorMode
  theme?: MarkdownEditorTheme
  placeholder?: string
  readonly?: boolean
  disabled?: boolean
  showToolbar?: boolean
  toolbarConfig?: Partial<IToolbarConfig>
  editorConfig?: Partial<IEditorConfig>
  imageUpload?: ImageUploadConfig
  /** ⭐ 新增：视频上传配置 */
  videoUpload?: VideoUploadConfig
  autoFocus?: boolean
  maxLength?: number
  showCount?: boolean
  compact?: boolean
}

export interface MarkdownEditorInstance {
  getEditor: () => IDomEditor | null
  getHtml: () => string
  getMarkdown: () => string
  getText: () => string
  setHtml: (html: string) => void
  setMarkdown: (markdown: string) => void
  clear: () => void
  focus: () => void
  blur: () => void
  undo: () => void
  redo: () => void
  insertText: (text: string) => void
  insertHtml: (html: string) => void
  insertImage: (url: string, alt?: string, href?: string) => void
  insertVideo: (url: string, poster?: string) => void
  selectAll: () => void
  getStats: () => { textLength: number; htmlLength: number }
}
