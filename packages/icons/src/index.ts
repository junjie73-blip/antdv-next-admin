import type { App } from 'vue';

import { IconifyIcon, IconPicker, SvgIcon } from './icon';

/**
 * 全局注册：`app.use(createIconInstaller())`。
 *
 * 边界收紧后本包只管图标 —— `Loading` 与 `Scrollbar` 已迁到 `@antdv/loading-ui`、
 * `@antdv/scrollbar-ui`，它们的 installer 各自带走（指令 `v-loading` 属于加载能力，
 * 不是图标）。应用侧多数场景走显式 import（可 tree-shaking），这里只服务历史上
 * 裸写的图标组件；名字保持与默认导出一致，避免"注册名和导入名两套"的排查成本。
 */
const COMPONENTS: Record<string, object> = {
  IconPicker,
  IconifyIcon,
  SvgIcon,
};

export function createIconInstaller(options?: {
  /** 前缀，便于接入既有项目时避让同名全局组件；默认不加前缀 */
  prefix?: string;
}) {
  const prefix = options?.prefix ?? '';
  return {
    install(app: App) {
      for (const [name, component] of Object.entries(COMPONENTS)) {
        app.component(`${prefix}${name}`, component);
      }
    },
  };
}

export * from './icon';
