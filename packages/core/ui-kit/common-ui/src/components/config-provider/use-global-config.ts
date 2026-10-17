import { inject } from 'vue';

import type { ResolvedGlobalConfig } from './types';

import { DEFAULT_GLOBAL_CONFIG, GLOBAL_CONFIG_KEY } from './types';

/**
 * 读全局配置：组件内部用它拿"这个项目定过的默认文案/尺寸"。
 *
 * 没挂 `ConfigProvider` 也能调——退回 `DEFAULT_GLOBAL_CONFIG`，
 * 于是组件不会因为宿主少一层包裹而渲染出 `undefined`。
 * 返回的是 reactive 对象，解构会丢响应性，取值请写 `config.okText`。
 */
export function useGlobalConfig(): ResolvedGlobalConfig {
  return inject(GLOBAL_CONFIG_KEY, null) ?? DEFAULT_GLOBAL_CONFIG;
}
