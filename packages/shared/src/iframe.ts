/**
 * iframe `sandbox` 属性的构造器。
 *
 * 为什么要有这个文件：`sandbox="allow-scripts allow-same-origin"` 是一个**看起来很安全、
 * 其实等于没加**的组合——浏览器会直接告警
 * "An iframe which has both allow-scripts and allow-same-origin for its sandbox
 * attribute can escape its sandboxing"：框架里的脚本可以用自己的脚本访问同源存储，
 * 再通过 `window.parent` / `frameElement` 走到顶层文档，读走主应用的 token 与用户信息。
 *
 * 本站的两个坑点尤其危险：
 * - 微前端预览会嵌入"注册表里配的任意 URL"，URL 由后台/配置文件决定，不该默认拿到同源身份；
 * - 演示模式曾把子应用映射到本站自己的页面（同源 + 可脚本 = 顶层会话全部暴露）。
 *
 * 所以默认**不给** `allow-same-origin`：嵌入的框架被隔离成独立的不透明源，
 * 脚本能跑、页面能看，但碰不到主应用的存储与 DOM。
 * 只有明确知道自己需要保留同源能力（比如同域部署、需要共享登录态的子应用）
 * 才由调用方显式传 `allowSameOrigin: true`，并且用 `canEscapeSandbox()` 在界面上标出来。
 *
 * 输出的 token 顺序是固定的，方便快照断言，也避免同一处配置在 git diff 里乱跳。
 */

/** `sandbox` 允许的全部取值（HTML 规范里的关键字） */
export const SANDBOX_FLAGS = [
  'allow-downloads',
  'allow-forms',
  'allow-modals',
  'allow-orientation-lock',
  'allow-pointer-lock',
  'allow-popups',
  'allow-popups-to-escape-sandbox',
  'allow-presentation',
  'allow-same-origin',
  'allow-scripts',
  'allow-storage-access-by-user-activation',
  'allow-top-navigation',
  'allow-top-navigation-by-user-activation',
] as const;

export type SandboxFlag = (typeof SANDBOX_FLAGS)[number];

/** 默认策略：能交互、能弹层、能放媒体，但不同源、不能导航顶层 */
export const DEFAULT_SANDBOX_FLAGS: SandboxFlag[] = [
  'allow-forms',
  'allow-popups',
  'allow-presentation',
  'allow-scripts',
];

/**
 * 声明式开关，键名去掉 `allow` 前缀后的能力名。
 * 只列常用能力；需要更冷门的标志时用 `extra` 直接给关键字。
 */
export interface IframeSandboxOptions {
  /** 允许框架内脚本执行（关掉它基本只剩一张静态截图） */
  scripts?: boolean;
  /** 允许框架脚本访问自身同源存储/DOM —— 与 scripts 同时开就是逃逸组合 */
  sameOrigin?: boolean;
  /** 允许表单提交 */
  forms?: boolean;
  /** 允许 window.open / target=_blank */
  popups?: boolean;
  /** 允许投屏（Presentation API） */
  presentation?: boolean;
  /** 允许下载 */
  downloads?: boolean;
  /** 允许 alert / confirm / 全屏等模态 */
  modals?: boolean;
  /** 允许框架导航顶层页面 */
  topNavigation?: boolean;
  /** 追加的原始关键字，用于上面没覆盖的能力 */
  extra?: string[];
}

/** 选项键 → sandbox 关键字 */
const KEY_TO_FLAG: Record<string, SandboxFlag> = {
  downloads: 'allow-downloads',
  forms: 'allow-forms',
  modals: 'allow-modals',
  popups: 'allow-popups',
  presentation: 'allow-presentation',
  sameOrigin: 'allow-same-origin',
  scripts: 'allow-scripts',
  topNavigation: 'allow-top-navigation',
};

/** 固定输出顺序，保证同配置同字符串 */
const OUTPUT_ORDER: SandboxFlag[] = [...SANDBOX_FLAGS];

/**
 * 生成 `sandbox` 属性值。
 *
 * @returns 空格分隔的关键字串；全部关闭时返回空串——
 * `sandbox=""` 是"最严格"而不是"不限制"，这点与直觉相反，调用方要清楚。
 */
export function buildIframeSandbox(options: IframeSandboxOptions = {}): string {
  const flags = new Set<SandboxFlag>(DEFAULT_SANDBOX_FLAGS);

  for (const [key, enabled] of Object.entries(options)) {
    if (key === 'extra') continue;
    const flag = KEY_TO_FLAG[key];
    if (!flag) continue;
    if (enabled) flags.add(flag);
    else flags.delete(flag);
  }

  const extra = (options.extra ?? [])
    .map((item) => item.trim())
    .filter((item) => item.startsWith('allow-'));

  const known = new Set<string>(SANDBOX_FLAGS);
  const merged: string[] = [...flags];
  for (const flag of extra) {
    if (!merged.includes(flag)) merged.push(flag);
  }

  // 规范内的关键字按固定顺序输出；`extra` 里超出规范的排在末尾（sort 稳定，保持传入顺序）
  return merged
    .sort((a, b) => rank(a) - rank(b))
    .join(' ');

  function rank(flag: string): number {
    if (!known.has(flag)) return SANDBOX_FLAGS.length + merged.indexOf(flag);
    return OUTPUT_ORDER.indexOf(flag as SandboxFlag);
  }
}

/**
 * 是否构成"sandbox 逃逸"组合：脚本 + 同源身份同时给。
 * 用它决定界面上的风险提示，而不是把结论写死在注释里。
 */
export function canEscapeSandbox(sandbox: string): boolean {
  const flags = new Set(sandbox.split(/\s+/).filter(Boolean));
  return flags.has('allow-scripts') && flags.has('allow-same-origin');
}
