import type { PluginOption } from 'vite'

import { AntdvNextResolver } from '@antdv-next/auto-import-resolver'
import iconifyOffline from '@tomjs/vite-plugin-iconify'
import { join } from 'node:path'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
import { envParse } from 'vite-plugin-env-parse'
import { VueRouterAutoImports } from 'vue-router/unplugin'
export function createAutoImportPlugins(): PluginOption[] {
  const root = process.cwd()

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
      dts: join(root, '/types/auto-imports.d.ts'),
    }),
    Components({
      resolvers: [
        AntdvNextResolver({
          resolveIcons: false,
        }),
      ],
      dts: join(root, '/types/components.d.ts'),
    }),
    iconifyOffline({
      local: ['carbon', 'ant-design', 'lucide', 'fa6-regular', 'mdi'],
    }),
    envParse({
      dtsPath: join(root, 'types/env.d.ts'),
      parseJson: true,
      // exclude: ["VITE_APP_TITLE"], // 根据实际情况排除不需要解析的变量
    }),
  ]
}
