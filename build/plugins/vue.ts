import type { PluginOption } from 'vite'

import tailwindcss from '@tailwindcss/vite'
import viteVue from '@vitejs/plugin-vue'
import viteVueJsx from '@vitejs/plugin-vue-jsx'
import Inspect from 'vite-plugin-inspect'
import { wrapPlugin } from 'vite-plugin-performance'
import Layouts from 'vite-plugin-vue-layouts-next'
import { getFileBasedRouteName } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'
export function createVuePlugins(): PluginOption[] {
  const plugins: PluginOption[] = [
    VueRouter({
      routesFolder: ['src/views'],
      dts: './types/router.d.ts',
      exclude: [
        '**/components/*',
        'account/**/*',
        'login/**/*',
        'register/**/*',
      ],
      extensions: ['.vue', '.tsx'],
      getRouteName: (routeNode) => getFileBasedRouteName(routeNode),
    }),
    viteVue(),
    viteVueJsx(),
    tailwindcss(),
    wrapPlugin(Inspect(), { threshold: 50 }),
    Layouts({
      dts: './types/layouts.d.ts',
      exclude: ['**/components/**', '**/widgets/**'],
      defaultLayout: 'index',
    }),
  ]

  // Vue DevTools 按需启用（从环境变量读取，此处由 index.ts 控制传入或在此处读取）
  // 为保持独立性，此处需结合环境变量判断，实际可提取到 index.ts 中
  return plugins
}
