<script setup lang="ts">
/**
 * 通用文件预览：按扩展名分派到原生标签 / 轻量解析器 / @vue-office 渲染器。
 *
 * - 大体积的 Office 渲染器按需 import，图片/音视频只创建 Object URL，不在首屏加载；
 * - 所有异步读取都带错误与空数据兜底，未知格式给「下载查看」而不是白屏；
 * - `source` 既接受 File（本地选择/聊天附件），也接受 URL（服务端已上传的文件）。
 */
import type { Component } from 'vue';

import { computed, defineAsyncComponent, onBeforeUnmount, ref, watch } from 'vue';

import { Icon } from '@iconify/vue';
import MarkdownIt from 'markdown-it';

import '@vue-office/docx/lib/index.css';
import '@vue-office/excel/lib/index.css';

defineOptions({ name: 'FilePreview' });

type PreviewKind =
  | 'audio'
  | 'csv'
  | 'docx'
  | 'image'
  | 'legacy'
  | 'markdown'
  | 'pdf'
  | 'pptx'
  | 'unsupported'
  | 'video'
  | 'xlsx';

const props = withDefaults(
  defineProps<{
    /** 本地文件或远程 URL */
    source: File | string;
    /** 文件名为空时从 File.name / URL 末段推断 */
    name?: string;
  }>(),
  { name: '' },
);

const OfficeDocx = defineAsyncComponent({
  loader: () => import('@vue-office/docx').then((m) => m.default as Component),
  delay: 0,
}) as Component;
const OfficeExcel = defineAsyncComponent({
  loader: () => import('@vue-office/excel').then((m) => m.default as Component),
  delay: 0,
}) as Component;
const OfficePptx = defineAsyncComponent({
  loader: () => import('@vue-office/pptx').then((m) => m.default as Component),
  delay: 0,
}) as Component;

const md = new MarkdownIt({ html: false, linkify: true, breaks: true });

const loading = ref(false);
const error = ref('');
const text = ref('');
const table = ref<string[][]>([]);
const officeBuffer = ref<ArrayBuffer | null>(null);
const objectUrl = ref('');

const MAX_ROWS = 1000;

const fileName = computed(() => {
  if (props.name) return props.name;
  if (props.source instanceof File) return props.source.name;
  return decodeURIComponent(String(props.source).split('/').pop()?.split('?')[0] ?? '');
});
const ext = computed(() => fileName.value.split('.').pop()?.toLowerCase() ?? '');

const kind = computed<PreviewKind>(() => {
  switch (ext.value) {
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
    case 'svg':
    case 'bmp':
      return 'image';
    case 'mp4':
    case 'webm':
    case 'ogg':
    case 'mov':
      return 'video';
    case 'mp3':
    case 'wav':
    case 'm4a':
    case 'flac':
      return 'audio';
    case 'pdf':
      return 'pdf';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'csv':
      return 'csv';
    case 'docx':
      return 'docx';
    case 'xls':
    case 'xlsx':
      return 'xlsx';
    case 'pptx':
      return 'pptx';
    case 'doc':
    case 'ppt':
      return 'legacy';
    default:
      return 'unsupported';
  }
});

const markdownHtml = computed(() => (kind.value === 'markdown' ? md.render(text.value) : ''));

/** 简化 CSV 解析：支持引号包裹、逗号与换行，首行当表头，超长只取前 1000 行 */
function parseCsv(source: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i]!;
    if (quoted) {
      if (char === '"' && source[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ',') {
      row.push(cell);
      cell = '';
    } else if (char === '\n') {
      row.push(cell);
      rows.push(row);
      if (rows.length >= MAX_ROWS) return rows;
      row = [];
      cell = '';
    } else if (char !== '\r') cell += char;
  }
  if (cell || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.slice(0, MAX_ROWS);
}

/**
 * 旧版 doc/ppt 是二进制复合文档，没有轻量解析库时不假装能还原排版：
 * 分别按单字节与 UTF-16LE 提取可读片段并去重，给用户一个"能看大概内容"的兜底。
 */
function extractLegacyText(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const ascii: string[] = [];
  for (let i = 0; i < bytes.length; i += 8192) {
    ascii.push(String.fromCharCode(...bytes.subarray(i, i + 8192)));
  }
  let utf16 = '';
  let utf8 = '';
  try {
    utf16 = new TextDecoder('utf-16le').decode(bytes);
    utf8 = new TextDecoder('utf-8').decode(bytes);
  } catch {
    // 解码器不可用就只保留单字节结果
  }
  const readable = (raw: string) =>
    raw
      .replace(/[^\x20-\x7E\u4e00-\u9fa5\r\n\t]/gu, ' ')
      .split(/[\r\n]+/u)
      .map((line) => line.replace(/ {2,}/gu, ' ').trim())
      .filter((line) => line.length >= 3)
      .slice(0, 300);
  return (
    [...new Set([...readable(ascii.join('')), ...readable(utf16), ...readable(utf8)])].join('\n') ||
    '未能从文件中提取到可读文本，请下载后用本地软件打开。'
  );
}

/** jsdom 与旧浏览器不一定有 Blob.text/arrayBuffer，统一走 FileReader 兜底 */
function readLocalFile(file: File, asText: boolean): Promise<string | ArrayBuffer> {
  if (asText && typeof file.text === 'function') return file.text();
  if (!asText && typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result ?? '');
    reader.onerror = () => reject(reader.error ?? new Error('文件读取失败'));
    if (asText) reader.readAsText(file);
    else reader.readAsArrayBuffer(file);
  });
}

async function sourceBuffer(): Promise<ArrayBuffer> {
  if (props.source instanceof File)
    return (await readLocalFile(props.source, false)) as ArrayBuffer;
  const response = await fetch(props.source);
  if (!response.ok) throw new Error(`文件加载失败（HTTP ${response.status}）`);
  return response.arrayBuffer();
}

async function sourceText(): Promise<string> {
  if (props.source instanceof File)
    return String(await readLocalFile(props.source, true));
  const response = await fetch(props.source);
  if (!response.ok) throw new Error(`文件加载失败（HTTP ${response.status}）`);
  return response.text();
}

watch(
  () => [props.source, props.name] as const,
  async () => {
    error.value = '';
    text.value = '';
    table.value = [];
    officeBuffer.value = null;
    if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
    objectUrl.value = '';

    const current = kind.value;
    if (current === 'unsupported') return;
    if (['image', 'video', 'audio', 'pdf'].includes(current)) {
      objectUrl.value =
        props.source instanceof File
          ? URL.createObjectURL(props.source)
          : String(props.source);
      return;
    }

    loading.value = true;
    try {
      if (current === 'markdown') text.value = await sourceText();
      else if (current === 'csv') table.value = parseCsv(await sourceText());
      else if (current === 'legacy') text.value = extractLegacyText(await sourceBuffer());
      else officeBuffer.value = await sourceBuffer();
    } catch (cause) {
      error.value = cause instanceof Error ? cause.message : '文件读取失败';
    } finally {
      loading.value = false;
    }
  },
  { immediate: true },
);

function revoke() {
  if (objectUrl.value) URL.revokeObjectURL(objectUrl.value);
  objectUrl.value = '';
}
onBeforeUnmount(revoke);

defineExpose({
  /** 供外层「下载」按钮复用，避免重复创建 Object URL */
  getUrl: () =>
    props.source instanceof File ? URL.createObjectURL(props.source) : String(props.source),
});
</script>

<template>
  <div class="file-preview flex min-h-40 w-full flex-col overflow-hidden" :data-preview-kind="kind">
    <div v-if="error" class="flex min-h-40 flex-col items-center justify-center gap-2 text-sm text-destructive">
      <Icon icon="carbon:warning-alt" class="size-8" />
      <span>{{ error }}</span>
    </div>

    <div v-else-if="loading" class="flex min-h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <Icon icon="carbon:progress-bar-round" class="size-7 animate-spin" />
      <span>正在解析 {{ fileName }}…</span>
    </div>

    <img
      v-else-if="kind === 'image'"
      :src="objectUrl"
      :alt="fileName"
      class="mx-auto max-h-[70vh] max-w-full object-contain"
    />
    <video
      v-else-if="kind === 'video'"
      :src="objectUrl"
      controls
      preload="metadata"
      class="mx-auto max-h-[70vh] max-w-full"
    />
    <audio v-else-if="kind === 'audio'" :src="objectUrl" controls preload="metadata" class="w-full" />
    <iframe
      v-else-if="kind === 'pdf'"
      :src="objectUrl"
      class="min-h-[70vh] w-full rounded border-0"
      :title="fileName"
    />

    <!-- markdown-it 关闭 raw HTML，输出仅来自受控解析结果 -->
    <article
      v-else-if="kind === 'markdown'"
      class="file-preview-markdown max-h-[70vh] overflow-auto px-4 py-2 text-sm leading-relaxed"
      v-html="markdownHtml"
    />

    <div v-else-if="kind === 'csv'" class="max-h-[70vh] overflow-auto">
      <table v-if="table.length" class="w-full border-collapse text-xs">
        <thead class="bg-muted/60">
          <tr>
            <th v-for="(cell, index) in table[0]" :key="index" class="border px-2 py-1 text-left font-medium">
              {{ cell }}
            </th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, rowIndex) in table.slice(1)" :key="rowIndex">
            <td v-for="(cell, index) in row" :key="index" class="border px-2 py-1 align-top">
              {{ cell }}
            </td>
          </tr>
        </tbody>
      </table>
      <p v-else class="py-10 text-center text-sm text-muted-foreground">CSV 文件为空</p>
      <p v-if="table.length >= MAX_ROWS" class="py-2 text-center text-xs text-muted-foreground">
        仅预览前 {{ MAX_ROWS }} 行，完整内容请下载查看
      </p>
    </div>

    <div v-else-if="officeBuffer" class="max-h-[70vh] overflow-auto rounded bg-white p-2" data-office-host>
      <OfficeDocx v-if="kind === 'docx'" :src="officeBuffer" />
      <OfficeExcel v-else-if="kind === 'xlsx'" :src="officeBuffer" />
      <OfficePptx v-else-if="kind === 'pptx'" :src="officeBuffer" />
    </div>

    <div v-else-if="kind === 'legacy'" class="max-h-[70vh] overflow-auto rounded bg-muted/30 p-3">
      <p class="mb-2 text-xs text-muted-foreground">
        这是旧版二进制格式，仅提取可读文本，排版与图片会丢失；完整内容请下载查看。
      </p>
      <pre class="whitespace-pre-wrap break-all text-xs leading-relaxed">{{ text }}</pre>
    </div>

    <div v-else class="flex min-h-40 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
      <Icon icon="carbon:document-unknown" class="size-8" />
      <span>{{ ext ? `${ext.toUpperCase()} 暂不支持在线预览` : '无法识别文件类型' }}</span>
      <span class="text-xs">可下载后用本地软件打开</span>
    </div>
  </div>
</template>

<style scoped>
.file-preview-markdown :deep(h1),
.file-preview-markdown :deep(h2),
.file-preview-markdown :deep(h3) {
  margin: 0.75rem 0 0.4rem;
  font-weight: 600;
}
.file-preview-markdown :deep(p),
.file-preview-markdown :deep(ul),
.file-preview-markdown :deep(ol),
.file-preview-markdown :deep(pre) {
  margin: 0.4rem 0 0.75rem;
}
.file-preview-markdown :deep(pre) {
  overflow: auto;
  border-radius: 0.5rem;
  padding: 0.75rem;
  background: hsl(var(--muted));
}
.file-preview-markdown :deep(code) {
  font-family: monospace;
}
</style>
