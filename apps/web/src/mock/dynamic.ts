import type { FixtureRoute } from './types';

/**
 * 快照表达不了的接口：由覆盖层**当场构造**应答。
 *
 * 上传为什么不能进 fixtures（见 `scripts/generate-mock-fixtures.mjs` 的透传名单）：
 * 1. 请求体是 multipart，抓一次就真往开发中的 mock 服务写了数据；
 * 2. 返回值要求"每次唯一"（`fileId` 与预览地址），静态快照会让同一页里
 *    多个文件共用一张图、一个 id，列表的 key 直接撞车。
 *
 * ⚠️ 契约镜像自 `apps/backend-mock/server/utils/upload.ts`：字段名、信封文案、
 * 占位图的取色规则都跟着那边。改那边记得改这里，否则
 * "dev 走 Nitro、生产走包内 mock" 会给出两种响应。
 */
export const dynamicRoutes: FixtureRoute[] = [
  { method: 'POST', path: '/upload', replier: 'upload' },
  { method: 'POST', path: '/upload/:variant', replier: 'upload' },
];

const PALETTES: [string, string][] = [
  ['#1677ff', '#69b1ff'],
  ['#13c2c2', '#5cdbd3'],
  ['#722ed1', '#b37feb'],
  ['#eb2f96', '#ff85c0'],
  ['#fa8c16', '#ffc069'],
  ['#52c41a', '#b7eb8f'],
];

/** 稳定散列：同一个变体每次拿到的配色一致，示例页截图不会每次跳色 */
function hashCode(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

/** SVG 文本节点里不能出现尖括号与引号，标签也来自 URL，统一收敛一次 */
function escapeSvgText(value: string, maxLength = 24): string {
  return value
    .replaceAll(/[<>&'"]/g, '')
    .slice(0, maxLength)
    .trim();
}

/**
 * 占位缩略图：mock 不落盘，也就没有真实可访问的地址。
 * 和 Nitro 那边一样用 `encodeURIComponent` 而不是 base64（中文标签不乱码、体积更小），
 * 并且已在 CSP 的 `img-src data:` 里放行。
 */
function previewDataUrl(seed: string, label: string): string {
  const [from, to] = PALETTES[hashCode(seed) % PALETTES.length] as [
    string,
    string,
  ];
  const title = escapeSvgText(label) || 'Mock';
  const svg = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320" role="img">`,
    '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">',
    `<stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/>`,
    '</linearGradient></defs>',
    '<rect width="320" height="320" fill="url(#g)"/>',
    '<circle cx="238" cy="86" r="44" fill="#ffffff" opacity="0.3"/>',
    '<path d="M28 258 L116 162 L176 224 L228 168 L292 258 Z" fill="#ffffff" opacity="0.34"/>',
    `<text x="24" y="46" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="22" font-weight="600" fill="#ffffff" opacity="0.92">${title}</text>`,
    '<text x="24" y="298" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="16" fill="#ffffff" opacity="0.8">Mock 上传成功</text>',
    '</svg>',
  ].join('');
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/** 进程内自增，够 mock 用（口径与 Nitro 的 `nextUploadId` 一致） */
let seq = 0;
export function resetUploadSeq(): void {
  seq = 0;
}

export interface ReplierResult {
  data: unknown;
  message: string;
}

export type Replier = (
  params: Record<string, string>,
  now: number,
) => ReplierResult;

/**
 * 上传应答：`{ variant, fileId, url, storedPath, uploadedAt }`。
 *
 * `now` 由调用方给（覆盖层要拿它拼 `YYYY-MM-DD HH:mm:ss`），
 * 测试里传固定值就不会被执行顺序影响。
 */
export function uploadReplier(
  params: Record<string, string>,
  now = Date.now(),
): ReplierResult {
  const variant = params.variant || 'upload';
  seq += 1;
  const fileId = `mock-${now.toString(36)}-${seq}`;
  return {
    data: {
      fileId,
      storedPath: `/uploads/${variant}/${fileId}`,
      uploadedAt: formatUploadedAt(now),
      url: previewDataUrl(`${variant}:${fileId}`, variant),
      variant,
    },
    message: '上传成功',
  };
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Nitro 那边用 dayjs 写 `YYYY-MM-DD HH:mm:ss`，这里手写同格式 */
function formatUploadedAt(now: number): string {
  const date = new Date(now);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
  );
}

export const repliers: Record<string, Replier> = {
  upload: uploadReplier,
};
