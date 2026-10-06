import type { PluginOption } from 'vite'

import tailwindcss from '@tailwindcss/vite'
import viteVue from '@vitejs/plugin-vue'
import viteVueJsx from '@vitejs/plugin-vue-jsx'
import Inspect from 'vite-plugin-inspect'
import { wrapPlugin } from 'vite-plugin-performance'
import Layouts from 'vite-plugin-vue-layouts-next'
import { getFileBasedRouteName } from 'vue-router/unplugin'
import VueRouter from 'vue-router/vite'
import viteVueI18nPlugin from '@intlify/unplugin-vue-i18n/vite';
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
    // 该插件的 Options 里没有 dts 字段（它不生成布局声明文件），
    // 布局类型由 apps/web/src/types/layout.d.ts 手工声明，这里不要留一个被忽略的配置
    Layouts({
      exclude: ['**/components/**', '**/widgets/**'],
      defaultLayout: 'index',
    }),
    viteVueI18nPlugin({
      compositionOnly: true,
      fullInstall: true,
      runtimeOnly: true,
    }),
  ]

  // Vue DevTools 按需启用（从环境变量读取，此处由 index.ts 控制传入或在此处读取）
  // 为保持独立性，此处需结合环境变量判断，实际可提取到 index.ts 中
  return plugins
}
