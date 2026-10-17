/* ============================================================
 * 国际化：antd locale 按需动态加载
 *
 * 这一段从 `@antdv/preferences` 搬进应用：语言包本身就是 antd 的东西，
 * 偏好包只存 `locale` 这个字符串，不该知道 `antdv-next/locale/zh_CN` 在哪。
 * ============================================================ */
export const DEFAULT_LOCALE = 'zh-CN';

/** locale 模块的运行时形状：默认导出即 antd 的 locale 对象 */
export type LocaleModule = { default: unknown };

const LOCALE_LOADERS: Record<string, () => Promise<LocaleModule>> = {
  'en-US': () => import('antdv-next/locale/en_US'),
  'zh-CN': () => import('antdv-next/locale/zh_CN'),
  'zh-TW': () => import('antdv-next/locale/zh_TW'),
};

export const SUPPORTED_LOCALES = Object.keys(LOCALE_LOADERS);

/** 取 loader 而不是直接取模块：调用方可以自己决定何时触发网络/分包加载 */
export function getLocaleModule(locale: string): () => Promise<LocaleModule> {
  return LOCALE_LOADERS[locale] ?? LOCALE_LOADERS[DEFAULT_LOCALE]!;
}

/** 直接拿到 locale 对象，供 `ConfigProvider :locale` 用 */
export async function loadLocale(
  locale: string,
): Promise<null | undefined | unknown> {
  const loader = getLocaleModule(locale);
  try {
    const module = await loader();
    return module.default;
  } catch {
    // 语言包加载失败不该白屏：退回默认语言
    if (locale === DEFAULT_LOCALE) return null;
    return loadLocale(DEFAULT_LOCALE);
  }
}
