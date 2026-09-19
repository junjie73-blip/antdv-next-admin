<script setup lang="ts">
import { Editor, Toolbar } from "@wangeditor/editor-for-vue";
import { message } from "antdv-next";
import { computed, nextTick, onBeforeUnmount, ref, shallowRef, watch } from "vue";

import { uploadFile, validateFile } from "./utils";

import type { IDomEditor, IEditorConfig, IToolbarConfig } from "@wangeditor/editor";

import type {
  ImageUploadConfig,
  MarkdownEditorInstance,
  MarkdownEditorProps,
  VideoUploadConfig,
} from "./types";

import { cn } from "~/utils/cn";

import "@wangeditor/editor/dist/css/style.css";

defineOptions({ name: "MarkdownEditor" });

const props = withDefaults(defineProps<MarkdownEditorProps>(), {
  value: "",
  minHeight: 160,
  maxHeight: 500,
  height: undefined,
  mode: "edit",
  theme: "light",
  placeholder: "请输入内容...",
  readonly: false,
  disabled: false,
  showToolbar: true,
  autoFocus: false,
  showCount: true,
  compact: false,
});

const model = defineModel<string>("value", { default: "" });

const emit = defineEmits<{
  change: [html: string, text: string];
  focus: [editor: IDomEditor];
  blur: [editor: IDomEditor];
  uploadSuccess: [file: File, response: unknown];
  uploadError: [file: File, error: unknown];
  maxLength: [currentLength: number, maxLength: number];
  created: [editor: IDomEditor];
  destroyed: [];
}>();

/* ============================================================
 * 状态
 * ============================================================ */

const editorRef = shallowRef<IDomEditor | null>(null);
const textLength = ref(0);
const htmlLength = ref(0);

let isInternalUpdate = false;
let internalUpdateTimer: ReturnType<typeof setTimeout> | null = null;

/* ============================================================
 * 工具
 * ============================================================ */

function isEmptyContent(html: string | null | undefined): boolean {
  if (!html) return true;
  const text = html
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
  return text === "";
}

function normalizeHtml(v: string | null | undefined): string {
  return v == null ? "" : String(v);
}

function isSameContent(a: string, b: string): boolean {
  if (isEmptyContent(a) && isEmptyContent(b)) return true;
  return a === b;
}

function markInternalUpdate(): void {
  isInternalUpdate = true;
  if (internalUpdateTimer) clearTimeout(internalUpdateTimer);
  internalUpdateTimer = setTimeout(() => {
    isInternalUpdate = false;
    internalUpdateTimer = null;
  }, 200);
}

function updateStats(): void {
  const editor = editorRef.value;
  if (!editor) return;
  textLength.value = editor.getText().length;
  htmlLength.value = editor.getHtml().length;
}

/* ============================================================
 * 高度
 * ============================================================ */

function toCssSize(v: number | string | undefined): string | undefined {
  if (v === undefined) return undefined;
  return typeof v === "number" ? `${v}px` : v;
}

const fixedHeight = computed(() => toCssSize(props.height));
const minHeightCss = computed(() => toCssSize(props.minHeight) ?? "160px");
const maxHeightCss = computed(() => toCssSize(props.maxHeight) ?? "500px");

const editorStyle = computed(() => {
  if (fixedHeight.value) return { height: fixedHeight.value };
  return {
    minHeight: minHeightCss.value,
    maxHeight: maxHeightCss.value,
  };
});

/* ============================================================
 * ⭐ 图片上传
 * ============================================================ */

const DEFAULT_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/gif", "image/webp"];

const DEFAULT_VIDEO_TYPES = ["video/mp4", "video/webm", "video/ogg", "video/quicktime"];

const imageUploadConfig = computed<ImageUploadConfig>(() => ({
  maxFileSize: 5,
  allowedFileTypes: DEFAULT_IMAGE_TYPES,
  ...props.imageUpload,
}));

const videoUploadConfig = computed<VideoUploadConfig>(() => ({
  maxFileSize: 100,
  allowedFileTypes: DEFAULT_VIDEO_TYPES,
  ...props.videoUpload,
}));

/**
 * 图片自定义上传
 *
 * 说明：
 *  - 走系统 http 封装，自动带 token / 租户头 / 错误提示
 *  - 成功后调 insertFn(url) 让 wangeditor 插入
 */
function createImageUploader(insertFn: (url: string, alt?: string, href?: string) => void) {
  return async (file: File) => {
    const cfg = imageUploadConfig.value;

    if (
      !validateFile(file, {
        maxSizeMB: cfg.maxFileSize,
        allowedTypes: cfg.allowedFileTypes,
        label: "图片",
      })
    ) {
      return;
    }

    try {
      // 上传前插入占位（可选：如果想让用户看到上传中状态）
      const result = await uploadFile({
        file,
        server: cfg.server,
        fieldName: cfg.fieldName,
        meta: cfg.meta,
      });

      // 插入到编辑器
      insertFn(result.url, result.filename, result.url);

      cfg.onSuccess?.(file, result);
      emit("uploadSuccess", file, result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      message.error(`图片上传失败：${error.message}`);
      cfg.onError?.(file, error);
      emit("uploadError", file, error);
    }
  };
}

/**
 * 视频自定义上传
 */
function createVideoUploader(insertFn: (url: string, poster?: string) => void) {
  return async (file: File) => {
    const cfg = videoUploadConfig.value;

    if (
      !validateFile(file, {
        maxSizeMB: cfg.maxFileSize,
        allowedTypes: cfg.allowedFileTypes,
        label: "视频",
      })
    ) {
      return;
    }

    try {
      const result = await uploadFile({
        file,
        server: cfg.server,
        fieldName: cfg.fieldName,
        meta: cfg.meta,
      });

      insertFn(result.url);

      cfg.onSuccess?.(file, result);
      emit("uploadSuccess", file, result);
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      message.error(`视频上传失败：${error.message}`);
      cfg.onError?.(file, error);
      emit("uploadError", file, error);
    }
  };
}

/* ============================================================
 * 工具栏配置
 * ============================================================ */

const defaultToolbarConfig: Partial<IToolbarConfig> = {
  toolbarKeys: [
    "headerSelect",
    "|",
    "bold",
    "italic",
    "underline",
    "through",
    "color",
    "bgColor",
    "|",
    "fontSize",
    "fontFamily",
    "lineHeight",
    "|",
    "bulletedList",
    "numberedList",
    "todo",
    "justifyLeft",
    "justifyCenter",
    "justifyRight",
    "|",
    "insertLink",
    "uploadImage",
    "uploadVideo",
    "insertTable",
    "codeBlock",
    "|",
    "undo",
    "redo",
    "|",
    "fullScreen",
  ],
};

const toolbarConfig = computed<Partial<IToolbarConfig>>(() => ({
  ...defaultToolbarConfig,
  ...props.toolbarConfig,
}));

/* ============================================================
 * 编辑器配置
 * ============================================================ */

const editorConfig = computed<Partial<IEditorConfig>>(() => {
  const config: Partial<IEditorConfig> = {
    placeholder: props.placeholder,
    readOnly: props.readonly || props.disabled,
    autoFocus: props.autoFocus,
    scroll: true,
    ...props.editorConfig,
  };

  const menuConf: Record<string, unknown> = {
    ...(config.MENU_CONF as Record<string, unknown> | undefined),
  };

  // ⭐ 图片上传
  const imgCfg = imageUploadConfig.value;
  menuConf.uploadImage = {
    // wangeditor 要求的字段
    server: imgCfg.server ?? "", // 实际不用，走 customUpload
    fieldName: imgCfg.fieldName ?? "file",
    maxFileSize: (imgCfg.maxFileSize ?? 5) * 1024 * 1024,
    allowedFileTypes: imgCfg.allowedFileTypes ?? DEFAULT_IMAGE_TYPES,

    // ⭐ 自定义上传：走系统 http
    customUpload: (file: File, insertFn: (url: string, alt?: string, href?: string) => void) => {
      if (imgCfg.customUpload) {
        imgCfg.customUpload(file, insertFn);
      } else {
        void createImageUploader(insertFn)(file);
      }
    },
  };

  // ⭐ 视频上传
  const vidCfg = videoUploadConfig.value;
  menuConf.uploadVideo = {
    server: vidCfg.server ?? "",
    fieldName: vidCfg.fieldName ?? "file",
    maxFileSize: (vidCfg.maxFileSize ?? 100) * 1024 * 1024,
    allowedFileTypes: vidCfg.allowedFileTypes ?? DEFAULT_VIDEO_TYPES,

    customUpload: (file: File, insertFn: (url: string, poster?: string) => void) => {
      if (vidCfg.customUpload) {
        vidCfg.customUpload(file, insertFn);
      } else {
        void createVideoUploader(insertFn)(file);
      }
    },
  };

  config.MENU_CONF = menuConf as IEditorConfig["MENU_CONF"];

  if (props.maxLength) {
    config.maxLength = props.maxLength;
    config.onMaxLength = (editor: IDomEditor) => {
      emit("maxLength", editor.getText().length, props.maxLength!);
    };
  }

  return config;
});

/* ============================================================
 * 类名
 * ============================================================ */

const containerClassName = computed(() =>
  cn(
    "markdown-editor flex flex-col overflow-hidden rounded-md border",
    "border-gray-200 bg-white transition-colors",
    "focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-500/20",
    "dark:border-gray-700 dark:bg-gray-900",
    props.disabled && "pointer-events-none opacity-60",
    props.compact && "markdown-editor-compact",
  ),
);

const toolbarClassName = computed(() =>
  cn("shrink-0 border-b border-gray-200 dark:border-gray-700", props.compact && "compact-toolbar"),
);

/* ============================================================
 * 生命周期
 * ============================================================ */

function handleCreated(editor: IDomEditor) {
  editorRef.value = editor;

  const initial = normalizeHtml(model.value);
  if (!isEmptyContent(initial)) {
    nextTick(() => {
      if (editorRef.value !== editor) return;
      editor.setHtml(initial);
      updateStats();
    });
  }

  if (props.autoFocus) {
    nextTick(() => editor.focus());
  }

  updateStats();
  emit("created", editor);
}

function handleChange(editor: IDomEditor) {
  const html = editor.getHtml();
  const text = editor.getText();

  markInternalUpdate();
  model.value = html;

  emit("change", html, text);
  textLength.value = text.length;
  htmlLength.value = html.length;
}

function handleFocus(editor: IDomEditor) {
  emit("focus", editor);
}

function handleBlur(editor: IDomEditor) {
  emit("blur", editor);
}

watch(
  () => model.value,
  (newValue) => {
    if (isInternalUpdate) return;
    const editor = editorRef.value;
    if (!editor) return;

    const next = normalizeHtml(newValue);
    const current = editor.getHtml();
    if (isSameContent(next, current)) return;

    editor.setHtml(next);
    updateStats();
  },
  {
    immediate: true,
  },
);

watch(
  () => props.readonly || props.disabled,
  (locked) => {
    const editor = editorRef.value;
    if (!editor) return;
    if (locked) editor.disable();
    else editor.enable();
  },
);

onBeforeUnmount(() => {
  if (internalUpdateTimer) {
    clearTimeout(internalUpdateTimer);
    internalUpdateTimer = null;
  }
  const editor = editorRef.value;
  if (editor) {
    editor.destroy();
    editorRef.value = null;
  }
  emit("destroyed");
});

/* ============================================================
 * 实例方法
 * ============================================================ */

const instance: MarkdownEditorInstance = {
  getEditor: () => editorRef.value,
  getHtml: () => editorRef.value?.getHtml() ?? "",
  getMarkdown: () => editorRef.value?.getHtml() ?? "",
  getText: () => editorRef.value?.getText() ?? "",
  setHtml: (html: string) => {
    const editor = editorRef.value;
    if (!editor) return;
    markInternalUpdate();
    editor.setHtml(normalizeHtml(html));
    model.value = html;
    updateStats();
  },
  setMarkdown: (markdown: string) => {
    const editor = editorRef.value;
    if (!editor) return;
    markInternalUpdate();
    editor.setHtml(normalizeHtml(markdown));
    model.value = markdown;
    updateStats();
  },
  clear: () => {
    const editor = editorRef.value;
    if (!editor) return;
    markInternalUpdate();
    editor.clear();
    model.value = "";
    updateStats();
  },
  focus: () => editorRef.value?.focus(),
  blur: () => editorRef.value?.blur(),
  undo: () => editorRef.value?.undo?.(),
  redo: () => editorRef.value?.redo?.(),
  insertText: (text: string) => editorRef.value?.insertText(text),
  insertHtml: (html: string) => editorRef.value?.dangerouslyInsertHtml(html),
  // ⭐ 新增：手动插入图片 / 视频（供外部调用）
  insertImage: (url: string, alt = "", href = "") => {
    editorRef.value?.dangerouslyInsertHtml(
      `<img src="${url}" alt="${alt}" ${href ? `data-href="${href}"` : ""} />`,
    );
  },
  insertVideo: (url: string, poster = "") => {
    editorRef.value?.dangerouslyInsertHtml(
      `<video src="${url}" ${poster ? `poster="${poster}"` : ""} controls></video>`,
    );
  },
  selectAll: () => editorRef.value?.selectAll(),
  getStats: () => ({
    textLength: textLength.value,
    htmlLength: htmlLength.value,
  }),
};

defineExpose(instance);
</script>

<template>
  <div :class="containerClassName">
    <!-- 工具栏 -->
    <Toolbar
      v-if="showToolbar && mode !== 'preview'"
      :editor="editorRef"
      :default-config="toolbarConfig"
      :mode="mode === 'split' ? 'default' : mode"
      :class="toolbarClassName"
    />

    <!-- 编辑器（自适应高度） -->
    <Editor
      :default-config="editorConfig"
      :mode="mode === 'split' ? 'default' : mode"
      :style="editorStyle"
      class="min-h-0 flex-1 overflow-hidden"
      @onCreated="handleCreated"
      @onChange="handleChange"
      @onFocus="handleFocus"
      @onBlur="handleBlur"
    />

    <!-- 字数统计 -->
    <div
      v-if="showCount"
      class="flex shrink-0 items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-3 py-1 text-xs text-gray-500 dark:border-gray-700 dark:bg-gray-800/60 dark:text-gray-400"
    >
      <span>{{ textLength }} 字</span>
      <span v-if="maxLength" class="text-gray-400 dark:text-gray-500">
        / {{ maxLength }} 上限
      </span>
    </div>
  </div>
</template>

<style scoped>
/* ============================================================
 * WangEditor 内部 DOM，无法用 Tailwind 类名控制
 * ============================================================ */

.markdown-editor :deep(.w-e-text-container) {
  background-color: transparent;
  /* 让内容区自适应父容器高度 */
  height: 100% !important;
}

.markdown-editor :deep(.w-e-text-placeholder) {
  top: 12px;
  font-style: normal;
}

/* 紧凑模式：压缩工具栏 */
.markdown-editor-compact :deep(.w-e-bar) {
  padding: 2px 4px;
}

.markdown-editor-compact :deep(.w-e-bar-item) {
  height: 26px;
  padding: 0 2px;
}

.markdown-editor-compact :deep(.w-e-bar-item button) {
  height: 26px;
  min-width: 26px;
  padding: 0 4px;
}

.markdown-editor-compact :deep(.w-e-text-container) {
  min-height: 120px;
}

/* 深色模式 */
:global(.dark) .markdown-editor :deep(.w-e-toolbar) {
  background-color: #1f2937;
  border-color: #374151;
  color: #e5e7eb;
}

:global(.dark) .markdown-editor :deep(.w-e-bar-item button) {
  color: #e5e7eb;
}

:global(.dark) .markdown-editor :deep(.w-e-bar-item button:hover) {
  background-color: #374151;
}

:global(.dark) .markdown-editor :deep(.w-e-text-container) {
  background-color: #111827;
  color: #e5e7eb;
}

:global(.dark) .markdown-editor :deep(.w-e-text-placeholder) {
  color: #6b7280;
}

:global(.dark) .markdown-editor :deep(.w-e-bar-divider) {
  background-color: #374151;
}
</style>
