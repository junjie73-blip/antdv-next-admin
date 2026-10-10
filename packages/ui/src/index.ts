import type { App, Directive } from 'vue';

import { IconifyIcon, IconPicker, SvgIcon } from './icon';
import { Loading, vLoading } from './loading';
import { Scrollbar } from './scrollbar';

/**
 * 全局注册：`app.use(createUiInstaller())`。
 *
 * 应用侧多数场景走显式 import（可 tree-shaking），这里只服务两类必须全局存在的东西：
 * - `v-loading` 指令（模板里直接写，没法按需 import）
 * - 图标组件（历史上是全局组件，页面里裸写 `<IconifyIcon />`）
 *
 * 名字保持与组件默认导出一致，避免"注册名和导入名两套"造成的排查成本。
 */
const COMPONENTS: Record<string, object> = {
  IconPicker,
  IconifyIcon,
  Loading,
  Scrollbar,
  SvgIcon,
};

const DIRECTIVES: Record<string, Directive> = {
  loading: vLoading,
};

export function createUiInstaller(options?: {
  /** 前缀，便于接入既有项目时避让同名全局组件；默认不加前缀 */
  prefix?: string;
}) {
  const prefix = options?.prefix ?? '';
  return {
    install(app: App) {
      for (const [name, component] of Object.entries(COMPONENTS)) {
        app.component(`${prefix}${name}`, component);
      }
      for (const [name, directive] of Object.entries(DIRECTIVES)) {
        app.directive(`${prefix}${name}`, directive);
      }
    },
  };
}

export * from './icon';
export * from './loading';
export * from './scrollbar';
