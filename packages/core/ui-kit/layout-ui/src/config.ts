/**
 * 运行时注入点：让 layout-ui 不依赖具体应用的多语言实现。
 *
 * 折叠按钮、横向导航箭头、「退出内容全屏」这些控件只有 aria-label 与 tooltip
 * 需要文案。包内不引 vue-i18n，改成注入 `t`（与 tabs-ui / menu-ui 同一套约定）：
 * - 默认实现原样返回 key，单测与没配 i18n 的接入方仍能渲染出稳定文本；
 * - 应用启动时 `configureLayout({ t: i18n.global.t })` 换成真翻译。
 *
 * key 沿用应用既有的命名空间（`header.*` / `shell.*`），这样接入时不用改语言包，
 * 端到端用例里那句 `[aria-label="收起菜单"]` 也照旧命中。
 *
 * 读 `layoutRuntime.t` 必须是调用时才读（不要在模块顶层固化字符串），
 * 语言切换才会成为消费方 computed 的依赖。
 */

export type LayoutTranslateFn = (
  key: string,
  named?: Record<string, number | string>,
) => string;

export interface LayoutUIRuntime {
  t: LayoutTranslateFn;
}

export const layoutRuntime: LayoutUIRuntime = {
  t: (key: string) => key,
};

/** 应用启动时调用一次，注入自己的翻译函数 */
export function configureLayout(options: Partial<LayoutUIRuntime>): void {
  Object.assign(layoutRuntime, options);
}
