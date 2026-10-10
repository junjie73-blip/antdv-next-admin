/**
 * CSP 里 `upgrade-insecure-requests` 的开关。
 *
 * 这条指令只在"产物真的跑在 https 上"时才有意义，而且它在开发环境会打死 Safari：
 *
 * - WebKit 不认为 `http://localhost` 是可信源，于是把页面里**每一个**子请求改写成
 *   `https://localhost:<port>/...`；本地 Vite dev server 没上 TLS，握手直接失败，
 *   结果是模块一个都没加载进来，页面停在首屏 Loading 的白屏上。
 * - Chromium 与 Firefox 都按 HTML 规范把 localhost 当作 potentially trustworthy，
 *   不做升级，所以同样的 CSP 在它们那儿毫无症状 —— 这个坑只在"用 Safari 跑一遍"时暴露。
 *
 * 因此按构建模式给值，而不是把它从 `index.html` 里删掉：生产仍然保留升级策略，
 * dev 交给浏览器自身的 mixed-content 保护。
 *
 * 返回值是"直接拼进 content 尾部的片段"，dev 给空串：
 * CSP 的指令以 `;` 分隔，末尾留空会被浏览器当成空指令忽略，不影响前面的策略。
 */
export const CSP_UPGRADE_INSECURE = ' upgrade-insecure-requests;';

/** 生产产物带上升级指令，开发环境留空 */
export function cspUpgradeInsecureRequests(isProd: boolean): string {
  return isProd ? CSP_UPGRADE_INSECURE : '';
}
