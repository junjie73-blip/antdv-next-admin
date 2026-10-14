/**
 * 运行时注入点：让 tabs-ui 不依赖具体应用的多语言实现。
 *
 * 标签页的动作名（"关闭其他（3）"）、左右滚动箭头与操作按钮的 aria-label
 * 都要走应用的 locale。包内不引 vue-i18n，改成注入 `t`：
 * - 默认实现原样返回 key，单测与没配 i18n 的接入方仍能渲染出稳定文本；
 * - 应用启动时 `configureTabs({ t: i18n.global.t })` 换成真翻译。
 *
 * 读 `tabsRuntime.t` 必须是调用时才读（不要在模块顶层固化字符串），
 * 这样 locale 才会成为消费方 computed 的依赖，切语言时菜单才能重算。
 */

export type TabsTranslateFn = (
  key: string,
  named?: Record<string, number | string>,
) => string;

export interface TabsUIRuntime {
  t: TabsTranslateFn;
}

export const tabsRuntime: TabsUIRuntime = {
  t: (key: string) => key,
};

/** 应用启动时调用一次，注入自己的翻译函数 */
export function configureTabs(options: Partial<TabsUIRuntime>): void {
  Object.assign(tabsRuntime, options);
}
