import type { PluginOption } from 'vite'

import { AntdvNextResolver } from '@antdv-next/auto-import-resolver'
import iconifyOffline from '@tomjs/vite-plugin-iconify'
import { join } from 'node:path'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { envParse } from 'vite-plugin-env-parse'

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
        'vue-router',
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
    // vite-plugin-env-parse 集成
    envParse({
      dtsPath: join(root, 'types/env.d.ts'),
      parseJson: true,
      // exclude: ["VITE_APP_TITLE"], // 根据实际情况排除不需要解析的变量
    }),
  ]
}
