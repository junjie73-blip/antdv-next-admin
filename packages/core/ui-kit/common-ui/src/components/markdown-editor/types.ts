import type { Editor } from '@tiptap/vue-3';

export type MarkdownEditorMode = 'edit' | 'preview' | 'split';
export type MarkdownEditorTheme = 'dark' | 'light';

/**
 * 工具栏按键标识
 *
 * 名称沿用 wangEditor 的叫法，存量配置（toolbarKeys / excludeKeys）无需改写。
 * `|` 表示分组竖线。
 */
export type MarkdownEditorToolbarKey =
  | 'bgColor'
  | 'bold'
  | 'bulletedList'
  | 'codeBlock'
  | 'color'
  | 'fontFamily'
  | 'fontSize'
  | 'fullScreen'
  | 'headerSelect'
  | 'insertLink'
  | 'insertTable'
  | 'italic'
  | 'justifyCenter'
  | 'justifyLeft'
  | 'justifyRight'
  | 'lineHeight'
  | 'numberedList'
  | 'redo'
  | 'through'
  | 'todo'
  | 'underline'
  | 'undo'
  | 'uploadImage'
  | 'uploadVideo'
  | '|';

export interface MarkdownEditorToolbarConfig {
  /**
   * 完整自定义按键列表。
   * 与 wangEditor 一致：一旦配置，excludeKeys 不再生效。
   */
  toolbarKeys?: MarkdownEditorToolbarKey[];
  /** 从默认按键中排除若干项 */
  excludeKeys?: MarkdownEditorToolbarKey[];
}

/** 上传响应（后端统一格式） */
export interface UploadResponse {
  fileId: string;
  filename: string;
  url: string;
  size: number;
  mimeType?: string;
}

/** 上传回调 */
export interface UploadCallbacks {
  /** 上传成功 */
  onSuccess?: (file: File, response: UploadResponse) => void;
  /** 上传失败 */
  onError?: (file: File, error: Error) => void;
  /** 上传进度 */
  onProgress?: (file: File, percent: number) => void;
}

/**
 * 图片上传配置
 */
export interface ImageUploadConfig extends UploadCallbacks {
  /** 上传地址，默认走系统封装的上传接口 */
  server?: string;
  /** 上传字段名，默认 "file" */
  fieldName?: string;
  /** 附加字段 */
  meta?: Record<string, unknown>;
  /** 最大体积（MB），默认 5 */
  maxFileSize?: number;
  /** 允许的 MIME，默认 png/jpeg/gif/webp */
  allowedFileTypes?: string[];
  /** 自定义上传（不传则走内置 http 上传） */
  customUpload?: (
    file: File,
    insertFn: (url: string, alt?: string, href?: string) => void,
  ) => void;
}

/**
 * 视频上传配置
 */
export interface VideoUploadConfig extends UploadCallbacks {
  /** 上传地址 */
  server?: string;
  /** 上传字段名，默认 "file" */
  fieldName?: string;
  /** 附加字段 */
  meta?: Record<string, unknown>;
  /** 最大体积（MB），默认 100 */
  maxFileSize?: number;
  /** 允许的 MIME，默认 mp4/webm/ogg */
  allowedFileTypes?: string[];
  /** 自定义上传 */
  customUpload?: (
    file: File,
    insertFn: (url: string, poster?: string) => void,
  ) => void;
}

/**
 * 编辑器 Props
 */
export interface MarkdownEditorProps {
  value?: string;
  minHeight?: number | string;
  maxHeight?: number | string;
  height?: number | string;
  mode?: MarkdownEditorMode;
  theme?: MarkdownEditorTheme;
  placeholder?: string;
  readonly?: boolean;
  disabled?: boolean;
  showToolbar?: boolean;
  toolbarConfig?: MarkdownEditorToolbarConfig;
  imageUpload?: ImageUploadConfig;
  videoUpload?: VideoUploadConfig;
  autoFocus?: boolean;
  maxLength?: number;
  showCount?: boolean;
  compact?: boolean;
  /**
   * `value` / `update:value` 承载的内容格式。
   * - `'html'`（默认）：与迁移前一致，v-model 走 HTML 字符串。
   * - `'markdown'`：v-model 走 Markdown 源码，内部仍用同一套 tiptap 文档模型。
   */
  contentType?: 'html' | 'markdown';
}

/**
 * 编辑器事件
 *
 * `change` 的第二个参数为纯文本。`update:value` 承载的字符串由 `contentType` 决定
 * （默认 HTML，`'markdown'` 时为 Markdown 源码）。
 * `getMarkdown` / `setMarkdown` 做真正的 Markdown ↔ 文档往返，与 `getHTML` / `setHTML` 各自诚实。
 * `update:value` 供 `v-model:value` 使用。
 */
export interface MarkdownEditorEvents {
  'update:value': [value: string];
  change: [html: string, text: string];
  focus: [editor: Editor];
  blur: [editor: Editor];
  uploadSuccess: [file: File, response: UploadResponse];
  uploadError: [file: File, error: Error];
  maxLength: [currentLength: number, maxLength: number];
  created: [editor: Editor];
  destroyed: [];
}

export interface MarkdownEditorInstance {
  getEditor: () => Editor | null;
  /** HTML 序列化（ProseMirror 原样） */
  getHtml: () => string;
  getHTML: () => string;
  /** Markdown 序列化（真正的往返，见 markdown.ts） */
  getMarkdown: () => string;
  getText: () => string;
  /** HTML 反序列化，整篇替换 */
  setHtml: (html: string) => void;
  setHTML: (html: string) => void;
  /** Markdown 反序列化，整篇替换 */
  setMarkdown: (markdown: string) => void;
  clear: () => void;
  focus: () => void;
  blur: () => void;
  undo: () => void;
  redo: () => void;
  insertText: (text: string) => void;
  insertHtml: (html: string) => void;
  insertMarkdown: (markdown: string) => void;
  insertImage: (url: string, alt?: string, href?: string) => void;
  insertVideo: (url: string, poster?: string) => void;
  selectAll: () => void;
  getStats: () => { textLength: number; htmlLength: number };
}
