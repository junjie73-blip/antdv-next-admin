import type { Attachment } from './types';

/**
 * 附件的归一化与准入校验。
 *
 * 分层位置：`core/`，纯函数，不认识 DOM 之外的东西：不读 File 的原生方法（只认结构），
 * 不发起上传（上传属于宿主），不生成预览地址（见 `resolvePreviewUrl` 的理由）。
 *
 * 这一层不做什么：不压缩、不转格式、不算哈希、不去重（同名的两个文件确实可能是两份东西）。
 */

/** 上传前的原始描述：宿主的 `File` 结构上就满足它，所以这里不 import DOM 类型 */
export interface AttachmentInput {
  lastModified?: number;
  name: string;
  size: number;
  type?: string;
  url?: string;
  /**
   * 宿主传进来的原始对象（`File` / `Blob`），只用于回给 `createObjectUrl`。
   * 本包不读它的任何方法 —— 读了就等于本包依赖浏览器的 File API，SSR 与单测都要打折扣。
   */
  source?: unknown;
}

/** File 与 Blob 都结构满足的最小形状，避免把 DOM 类型写进公共签名 */
export interface BlobLike {
  size: number;
  type?: string;
}

export interface AttachmentRules {
  /** 白名单：`.png` / `image/*` / `application/pdf` 三种写法都支持，混着写也行 */
  accept?: string[];
  /** 单个体积上限（MB），按十进制 1 MB = 1000 KB 计算，与网盘/IM 的显示口径一致 */
  maxSizeMb?: number;
}

export interface AttachmentCheck {
  attachment: Attachment;
  /** 拒绝原因，直接可展示：不返回错误码是因为本包不弹提示，文案要能一路传到宿主的界面 */
  error: string | undefined;
  ok: boolean;
  source: unknown;
}

/** 归一化：去路径、去空白、体积兜底为非负整数、MIME 小写 */
export function normalizeAttachment(input: AttachmentInput): Attachment {
  const name = stripPath(input.name).trim();
  const attachment: Attachment = {
    name: name === '' ? '未命名文件' : name,
    size: Number.isFinite(input.size) ? Math.max(0, Math.round(input.size)) : 0,
  };
  const type = input.type?.trim();
  if (type !== undefined && type !== '') attachment.type = type.toLowerCase();
  const url = input.url?.trim();
  if (url !== undefined && url !== '') attachment.url = url;
  return attachment;
}

/**
 * 校验单个附件。
 *
 * 顺序是「体积 → 类型」：超限是更硬的失败，先报它，用户不至于传了个 2GB 的文件才发现后缀不许。
 * `accept` 为空表示不限类型 —— 与浏览器的 `accept=""` 语义一致，别在这里发明"空数组=全拒"。
 */
export function validateAttachment(
  input: AttachmentInput,
  rules: AttachmentRules = {},
): AttachmentCheck {
  const attachment = normalizeAttachment(input);
  const error = checkAttachment(attachment, rules);
  return {
    attachment,
    error: error ?? undefined,
    ok: error === undefined,
    source: input.source,
  };
}

/** 批量校验：一次拖多个文件时必须把"哪些过了、哪些为什么没过"分开交出去 */
export function validateAttachments(
  inputs: readonly AttachmentInput[],
  rules: AttachmentRules = {},
): { accepted: AttachmentCheck[]; rejected: AttachmentCheck[] } {
  const accepted: AttachmentCheck[] = [];
  const rejected: AttachmentCheck[] = [];
  for (const input of inputs) {
    const result = validateAttachment(input, rules);
    (result.ok ? accepted : rejected).push(result);
  }
  return { accepted, rejected };
}

/** 命中白名单的判断，单独导出是因为宿主的选文件对话框也要用同一套规则算 `accept` 属性 */
export function isAcceptable(
  attachment: Attachment,
  accept: string[] | undefined,
): boolean {
  if (accept === undefined || accept.length === 0) return true;
  const name = attachment.name.toLowerCase();
  const mime =
    (attachment.type ?? inferTypeFromName(name))?.toLowerCase() ?? '';
  return accept.some((pattern) =>
    matchesPattern(pattern.trim().toLowerCase(), name, mime),
  );
}

/**
 * 预览地址的唯一出口。
 *
 * 规则：有 `url` 就用 `url`；否则**只有**在宿主注入了 `createObjectUrl` 且传了 `source` 时才生成，
 * 没注入就返回 undefined（界面退回渲染文件名）。
 *
 * 为什么本包不自己调 `URL.createObjectURL`：
 * 1. blob URL 必须配对 `revokeObjectURL`，而组件不知道这个附件之后还会不会被复用（历史分页、
 *    转发、消息列表重建），生命周期只有握住 File 的宿主知道；自己造就是稳定泄漏。
 * 2. 很多宿主给的是签名地址或自定义协议（Electron `app:` / 企业内网代理），
 *    `blob:` 前缀在 CSP 或 webview 里会被拦，硬编码等于把这类部署堵死。
 * 3. 单测与 SSR 没有 `URL.createObjectURL`，本包的 core 层要能在那两种环境里被直接调用。
 */
export function resolvePreviewUrl(
  attachment: Attachment,
  options: {
    createObjectUrl?: (source: BlobLike) => string;
    source?: unknown;
  } = {},
): string | undefined {
  if (attachment.url !== undefined) return attachment.url;
  const { createObjectUrl, source } = options;
  if (createObjectUrl === undefined || source === undefined) return undefined;
  return createObjectUrl(source as BlobLike);
}

/** 人读体积：列表与附件卡片都用它，避免每处自己写 1024 进制 */
export function formatFileSize(bytes: number): string {
  const value = Math.max(0, Math.round(bytes));
  if (value < 1000) return `${value} B`;
  if (value < 1000 ** 2) return `${trimZero(value / 1000)} KB`;
  if (value < 1000 ** 3) return `${trimZero(value / 1000 ** 2)} MB`;
  return `${trimZero(value / 1000 ** 3)} GB`;
}

function checkAttachment(
  attachment: Attachment,
  rules: AttachmentRules,
): string | undefined {
  if (rules.maxSizeMb !== undefined && rules.maxSizeMb > 0) {
    const limit = rules.maxSizeMb * 1000 ** 2;
    if (attachment.size > limit) {
      return `「${attachment.name}」${formatFileSize(attachment.size)}，超过 ${rules.maxSizeMb}MB 上限`;
    }
  }
  if (!isAcceptable(attachment, rules.accept)) {
    return `「${attachment.name}」不在允许的类型里（${rules.accept?.join(', ')}）`;
  }
  return undefined;
}

function matchesPattern(pattern: string, name: string, mime: string): boolean {
  if (pattern === '' || pattern === '*/*' || pattern === '*') return true;
  if (pattern.startsWith('.')) return name.endsWith(pattern);
  if (pattern.endsWith('/*')) return mime.startsWith(pattern.slice(0, -1));
  return mime === pattern;
}

/** 只有扩展名时的常见类型推断：够给 `accept` 判断和图标选择用，不足当 MIME 真值 */
function inferTypeFromName(name: string): string | undefined {
  const dot = name.lastIndexOf('.');
  if (dot === -1 || dot === name.length - 1) return undefined;
  const ext = name.slice(dot + 1);
  const table: Record<string, string> = {
    bmp: 'image/bmp',
    gif: 'image/gif',
    jpeg: 'image/jpeg',
    jpg: 'image/jpeg',
    pdf: 'application/pdf',
    png: 'image/png',
    svg: 'image/svg+xml',
    txt: 'text/plain',
    webp: 'image/webp',
    zip: 'application/zip',
  };
  return table[ext];
}

function stripPath(name: string): string {
  return name.replace(/^.*[\\/]/u, '');
}

function trimZero(value: number): string {
  return value.toFixed(1).replace(/\.0$/u, '');
}
