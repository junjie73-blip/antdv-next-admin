import type { IDomEditor, IEditorConfig, IToolbarConfig } from '@wangeditor/editor'

/**
 * Markdown 编辑器模式
 */
export type MarkdownEditorMode = 'edit' | 'preview' | 'split'

/**
 * Markdown 编辑器主题
 */
export type MarkdownEditorTheme = 'light' | 'dark'

/**
 * 图片上传配置
 */
export interface ImageUploadConfig {
  /**
   * 上传地址
   */
  server: string

  /**
   * 上传字段名
   * @default 'file'
   */
  fieldName?: string

  /**
   * 自定义上传 headers
   */
  headers?: Record<string, string>

  /**
   * 自定义上传参数
   */
  meta?: Record<string, string>

  /**
   * 图片最大大小（MB）
   * @default 5
   */
  maxFileSize?: number

  /**
   * 允许的图片类型
   * @default ['image/png', 'image/jpeg', 'image/gif']
   */
  allowedFileTypes?: string[]

  /**
   * 自定义上传方法
   */
  customUpload?: (file: File, insertFn: (url: string, alt?: string, href?: string) => void) => void
}

/**
 * Markdown 编辑器属性
 */
export interface MarkdownEditorProps {
  /**
   * 编辑器内容（v-model）
   */
  modelValue?: string

  /**
   * 编辑器高度
   * @default '500px'
   */
  height?: string | number

  /**
   * 编辑器模式
   * @default 'edit'
   */
  mode?: MarkdownEditorMode

  /**
   * 编辑器主题
   * @default 'light'
   */
  theme?: MarkdownEditorTheme

  /**
   * 占位文本
   */
  placeholder?: string

  /**
   * 是否只读
   * @default false
   */
  readonly?: boolean

  /**
   * 是否禁用
   * @default false
   */
  disabled?: boolean

  /**
   * 是否显示工具栏
   * @default true
   */
  showToolbar?: boolean

  /**
   * 工具栏配置
   */
  toolbarConfig?: Partial<IToolbarConfig>

  /**
   * 编辑器配置
   */
  editorConfig?: Partial<IEditorConfig>

  /**
   * 图片上传配置
   */
  imageUpload?: ImageUploadConfig

  /**
   * 是否自动聚焦
   * @default false
   */
  autoFocus?: boolean

  /**
   * 最大字数限制
   */
  maxLength?: number

  /**
   * 是否显示字数统计
   * @default true
   */
  showCount?: boolean
}

/**
 * Markdown 编辑器实例方法
 */
export interface MarkdownEditorInstance {
  /**
   * 获取编辑器实例
   */
  getEditor: () => IDomEditor | null

  /**
   * 获取 HTML 内容
   */
  getHtml: () => string

  /**
   * 获取 Markdown 内容
   */
  getMarkdown: () => string

  /**
   * 获取纯文本内容
   */
  getText: () => string

  /**
   * 设置 HTML 内容
   */
  setHtml: (html: string) => void

  /**
   * 设置 Markdown 内容
   */
  setMarkdown: (markdown: string) => void

  /**
   * 清空内容
   */
  clear: () => void

  /**
   * 聚焦编辑器
   */
  focus: () => void

  /**
   * 失焦编辑器
   */
  blur: () => void

  /**
   * 撤销
   */
  undo: () => void

  /**
   * 重做
   */
  redo: () => void

  /**
   * 插入文本
   */
  insertText: (text: string) => void

  /**
   * 插入 HTML
   */
  insertHtml: (html: string) => void

  /**
   * 全选
   */
  selectAll: () => void

  /**
   * 获取字数统计
   */
  getStats: () => { textLength: number, htmlLength: number }
}

/**
 * Markdown 编辑器事件
 */
export interface MarkdownEditorEvents {
  /**
   * 内容变化事件
   */
  (e: 'update:modelValue', value: string): void

  /**
   * 内容变化事件（详细）
   */
  (e: 'change', value: string, html: string): void

  /**
   * 聚焦事件
   */
  (e: 'focus', editor: IDomEditor): void

  /**
   * 失焦事件
   */
  (e: 'blur', editor: IDomEditor): void

  /**
   * 图片上传成功事件
   */
  (e: 'uploadSuccess', file: File, response: any): void

  /**
   * 图片上传失败事件
   */
  (e: 'uploadError', file: File, error: any): void

  /**
   * 超过最大字数限制事件
   */
  (e: 'maxLength', currentLength: number, maxLength: number): void
}
