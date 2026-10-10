/**
 * 上传结果构造（纯函数）
 *
 * 为什么单独成文件：`server/api/upload*.post.ts` 只是 h3 适配层，真正的契约
 * （返回什么字段、预览地址怎么来）都在这里。抽出来有两个好处：
 * 1. Vitest 直接覆盖，不必起 Nitro；
 * 2. 「上传」示例页的 8 个 `action` 与未来的组件共用同一份返回结构。
 *
 * ⚠️ 关于 `url`：mock 不存文件，也就没有真实可访问的地址。
 * 这里返回一张**内联 SVG data URL**，好处是零外部依赖（不打到公网样例图床，
 * 也就不会出现"示例页满屏破图"），并且已在 CSP 的 `img-src data:` 里放行。
 * 需要真实落盘的对接走 `/system/file/upload`（那是文件管理页的元数据登记接口）。
 */

import { success } from './response';

/** antd Upload 的 `action` 直接消费响应体，字段挂在这里，页面侧按 `response.data.url` 取 */
export interface UploadResult {
  /** 变点名（upload / image / avatar / custom / status / validate / manual / drag-sort） */
  variant: string;
  /** 自增文件标识，模拟后端返回的 fileId */
  fileId: string;
  /** 可直接渲染的预览地址 */
  url: string;
  /** 存储路径，纯展示：mock 不真的落盘 */
  storedPath: string;
  uploadedAt: string;
}

const PALETTES: [string, string][] = [
  ['#1677ff', '#69b1ff'],
  ['#13c2c2', '#5cdbd3'],
  ['#722ed1', '#b37feb'],
  ['#eb2f96', '#ff85c0'],
  ['#fa8c16', '#ffc069'],
  ['#52c41a', '#b7eb8f'],
];

/** 稳定散列：同一个变体每次拿到的配色一致，示例页截图不会每次跳色 */
export function hashCode(input: string): number {
  let hash = 0;
  for (let index = 0; index < input.length; index += 1) {
    hash = (hash * 31 + input.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function pickPalette(seed: string): [string, string] {
  return PALETTES[hashCode(seed) % PALETTES.length] as [string, string];
}

/** SVG 文本节点里不能出现尖括号与引号，标签也来自 URL，统一收敛一次 */
function escapeSvgText(value: string, maxLength = 24): string {
  return value
    .replace(/[<>&'"]/g, '')
    .slice(0, maxLength)
    .trim();
}

/**
 * 生成占位缩略图的 data URL。
 * 用 `encodeURIComponent` 而不是 base64：中文标签不会乱码，体积也更小。
 */
export function previewDataUrl(seed: string, label: string): string {
  const [from, to] = pickPalette(seed);
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

/** 进程内自增，够 mock 用；真实后端换成分布式 ID 不影响调用方 */
let seq = 0;
export function nextUploadId(now = Date.now()): string {
  seq += 1;
  return `mock-${now.toString(36)}-${seq}`;
}

/** 测试与用例之间复位计数，避免断言被执行顺序影响 */
export function resetUploadSeq(): void {
  seq = 0;
}

export function buildUploadResult(
  variant: string,
  uploadedAt: string,
  fileId = nextUploadId(),
): UploadResult {
  return {
    fileId,
    storedPath: `/uploads/${variant}/${fileId}`,
    uploadedAt,
    url: previewDataUrl(`${variant}:${fileId}`, variant),
    variant,
  };
}

/** 统一信封：与其余 mock 接口同构（`{ code, data, message }`） */
export function uploadSuccess(variant: string, uploadedAt: string) {
  return success(buildUploadResult(variant, uploadedAt), '上传成功');
}
