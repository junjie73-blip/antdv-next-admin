import type { PluginOption } from 'vite';

import { join } from 'node:path';

import { VueRouterAutoImports } from 'vue-router/unplugin';

import iconifyOffline from '@tomjs/vite-plugin-iconify';
import AutoImport from 'unplugin-auto-import/vite';
import Components from 'unplugin-vue-components/vite';
import { envParse } from 'vite-plugin-env-parse';

export interface AutoImportPluginOptions {
  dts?: boolean;
}

export function createAutoImportPlugins(
  options: AutoImportPluginOptions = {},
): PluginOption[] {
  const root = process.cwd();
  const dts = options.dts !== false;

  return [
    AutoImport({
      imports: ['vue', '@vueuse/core', 'pinia', VueRouterAutoImports],
      dts: dts ? join(root, '/types/auto-imports.d.ts') : false,
    }),
    Components({
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
