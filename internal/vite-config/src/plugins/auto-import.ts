import type { ComponentResolver } from 'unplugin-vue-components/types';
import type { PluginOption } from 'vite';

import { join } from 'node:path';

import { VueRouterAutoImports } from 'vue-router/unplugin';

import { AntdvNextResolver } from '@antdv-next/auto-import-resolver';
import iconifyOffline from '@tomjs/vite-plugin-iconify';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { envParse } from 'vite-plugin-env-parse';

/**
 * `@antdv/ui` 里可以被裸标签使用的组件。
 *
 * 组件从 `src/components` 抽进包以后，`unplugin-vue-components` 默认只扫应用目录，
 * 扫不到就退化成"未注册标签"——不报错，只是图标/遮罩静默消失，排查成本很高。
 * 这里补一个 resolver，把这四个组件重新接回自动导入，
 * 应用侧写 `<IconifyIcon />` 时会被编译成 `import { IconifyIcon } from '@antdv/ui'`。
 */
const UI_COMPONENTS = new Set([
  'IconifyIcon',
  'IconPicker',
  'Loading',
  'Scrollbar',
  'SvgIcon',
]);

function AntdvUiResolver(): ComponentResolver {
  return {
    type: 'component',
    resolve: (name: string) =>
      UI_COMPONENTS.has(name) ? { from: '@antdv/ui', name } : undefined,
  };
}

/**
 * `<Icon>` 在历史版本里是全局组件，页面与布局里大量裸写。
 * 抽包子化后没有人再注册它，运行期只会有一句 "Failed to resolve component: Icon"，
 * 图标静默消失——这里把它接回 `@iconify/vue` 的同名组件。
 * 已经显式 import 的文件不受影响（编译器优先用局部绑定）。
 */
function IconifyResolver(): ComponentResolver {
  return {
    type: 'component',
    resolve: (name: string) =>
      name === 'Icon' ? { from: '@iconify/vue', name: 'Icon' } : undefined,
  };
}

export interface AutoImportPluginOptions {
  /**
   * 是否让 `unplugin-auto-import` / `unplugin-vue-components` 回写 `.d.ts`。
   *
   * 默认 true。可以关掉是因为这两个插件的 dts 写入**没有兜异常**：
   * Windows + 映射盘（本项目在 `J:`）上偶发 `UNKNOWN (errno -4094)` 的
   * `open()` 失败会一路抛出未捕获 rejection，把整个 dev server 进程带走 ——
   * 现象是"扫到一批新页面、组件清单第一次变大 → 服务静默死掉"。
   * 这两个文件是入库的（`apps/web/types/*.d.ts`），构建时照常刷新，
   * 需要临时稳定跑 dev（例如全站巡检）时用 `VITE_WRITE_DTS=false` 跳过写入。
   */
  dts?: boolean;
}

export function createAutoImportPlugins(
  options: AutoImportPluginOptions = {},
): PluginOption[] {
  const root = process.cwd();
  const dts = options.dts !== false;

  return [
    AutoImport({
      imports: [
        'vue',
        '@vueuse/core',
        'pinia',
        {
          'antdv-next': ['message', 'notification', 'Modal', 'Drawer'],
        },
        VueRouterAutoImports,
      ],
      dts: dts ? join(root, '/types/auto-imports.d.ts') : false,
    }),
    Components({
      resolvers: [
        AntdvNextResolver({
          resolveIcons: false,
        }),
        AntdvUiResolver(),
        IconifyResolver(),
      ],
      dts: dts ? join(root, '/types/components.d.ts') : false,
    }),
    iconifyOffline({
      local: ['carbon', 'ant-design', 'lucide', 'fa6-regular', 'mdi'],
    }),
    envParse({
      dtsPath: join(root, 'types/env.d.ts'),
      parseJson: true,
      // exclude: ["VITE_APP_TITLE"], // 根据实际情况排除不需要解析的变量
    }),
  ];
}
