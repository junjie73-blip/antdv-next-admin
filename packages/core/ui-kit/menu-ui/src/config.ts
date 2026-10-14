/**
 * 运行时注入点：菜单包不认具体应用的多语言实现。
 *
 * 需要文案的只有两处非业务文本：横向滚动的箭头（aria-label / title）和
 * 展开箭头的屏幕阅读器标签。菜单标题本身在进包前已由应用翻译完，
 * 所以这里不提供标题级的翻译能力，只兜住控件的可访问性名称。
 *
 * 与 `configureTabs` 同一套约定：默认实现原样返回 key（单测与未接 i18n 的
 * 接入方渲染稳定），应用启动时注入真 `t`；读取必须在调用时发生（`menuRuntime.t(...)`），
 * 不能在模块顶层固化字符串，否则切换语言不会重渲染。
 */

export type MenuTranslateFn = (
  key: string,
  named?: Record<string, number | string>,
) => string;

export interface MenuUIRuntime {
  t: MenuTranslateFn;
}

export const menuRuntime: MenuUIRuntime = {
  t: (key: string) => key,
};

/** 应用启动时调用一次，注入自己的翻译函数 */
export function configureMenu(options: Partial<MenuUIRuntime>): void {
  Object.assign(menuRuntime, options);
}
