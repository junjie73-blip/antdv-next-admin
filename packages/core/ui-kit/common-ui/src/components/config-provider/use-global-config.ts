import { inject } from 'vue';

import type { ResolvedGlobalConfig } from './types';

import { DEFAULT_GLOBAL_CONFIG, GLOBAL_CONFIG_KEY } from './types';

/**
 * 读全局配置：组件内部用它拿"这个项目定过的默认文案 / 尺寸档位"。
 *
 * 没挂 `ConfigProvider` 也能调——退回 `DEFAULT_GLOBAL_CONFIG`，
 * 于是组件不会因为宿主少一层包裹而渲染出 `undefined`。
 * 返回的是 reactive 对象，解构会丢响应性，取值请写 `config.okText`。
 *
 * 主题与样式变量不要在这里读给组件用：`theme` / `cssVars` 已经由 provider
 * 写成容器上的 CSS 变量与 class，组件继续用 `var(--app-*)` / `bg-primary` 即可，
 * 再按 JS 值分支就出现"样式走 CSS 变量、逻辑走 JS 值"两套口径。
 */
export function useGlobalConfig(): ResolvedGlobalConfig {
  return inject(GLOBAL_CONFIG_KEY, null) ?? DEFAULT_GLOBAL_CONFIG;
}
