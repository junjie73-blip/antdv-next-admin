import type { PluginOption } from 'vite'
import { join } from 'node:path'
import { AntdvNextResolver } from '@antdv-next/auto-import-resolver'
import tailwindcss from '@tailwindcss/vite'
import viteVue from '@vitejs/plugin-vue'
import viteVueJsx from '@vitejs/plugin-vue-jsx'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { getFileBasedRouteName, VueRouterAutoImports } from 'unplugin-vue-router'
import VueRouter from 'unplugin-vue-router/vite'
import viteCompressPlugin from 'vite-plugin-compression'
import viteDtsPlugin from 'vite-plugin-dts'
import { createHtmlPlugin as viteHtmlPlugin } from 'vite-plugin-html'
import { VitePWA } from 'vite-plugin-pwa'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import viteVueDevTools from 'vite-plugin-vue-devtools'
import { viteArchiverPlugin } from './archiver'
import { viteMetadataPlugin } from './inject-metadata'
import { vitePrintPlugin } from './print'

interface PluginEnv {
  VITE_APP_TITLE?: string
  VITE_DEVTOOLS?: boolean
  VITE_ARCHIVER?: boolean
  VITE_PWA?: boolean
  VITE_VISUALIZER?: boolean
  VITE_COMPRESS?: 'gzip' | 'brotli' | 'none'
  VITE_MOCK?: boolean
}

export async function createPlugin({
  isBuild,
  env,
}: {
  isBuild: boolean
  env: PluginEnv
}): Promise<PluginOption[]> {
  const plugins: PluginOption[] = [
    VueRouter({
      routesFolder: join(process.cwd(), 'src/views'),
      exclude: ['**/components/**', '**/*.test', '**/__tests__/**', '**/error/**', '**/authentication/**'],
      extensions: ['.vue'],
      dts: join(process.cwd(), '/types/router.d.ts'),
      importMode: 'async',
      routeBlockLang: 'json5',
      root: process.cwd(),
      getRouteName: routeNode => getFileBasedRouteName(routeNode),
    }),
    viteVue(),
    viteVueJsx(),
    tailwindcss(),
    viteHtmlPlugin({
      inject: {
        data: {
          title: env.VITE_APP_TITLE,
        },
      },
      minify: true,
    }),
    vitePrintPlugin(),
    viteDtsPlugin(),
    AutoImport({
      imports: [
        'vue',
        VueRouterAutoImports,
        '@vueuse/core',
        'pinia',
      ],
      dts: join(process.cwd(), '/types/auto-imports.d.ts'),
    }),
    Components({
      resolvers: [AntdvNextResolver()],
      dts: join(process.cwd(), '/types/components.d.ts'),
    }),
    createSvgIconsPlugin({
      iconDirs: [join(process.cwd(), 'src/assets/icons')],
      symbolId: 'icon-[name]',
    }),
  ]

  // 仅开发环境加载 Vue DevTools，避免生产环境请求 /@vite/client
  if (env.VITE_DEVTOOLS && !isBuild) {
    plugins.push(viteVueDevTools())
  }
  isBuild && env.VITE_ARCHIVER && plugins.push(viteArchiverPlugin({}))
  isBuild && plugins.push(await viteMetadataPlugin(process.cwd()))
  env.VITE_PWA
  && plugins.push(
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      strategies: 'generateSW',
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        clientsClaim: true,
        skipWaiting: true,
        // 设置为 20MB 以容纳大型 vendor 包（antdv-next 约 18.5MB）
        // 生产环境建议通过按需加载优化 antdv-next 来减小体积
        maximumFileSizeToCacheInBytes: 1024 * 1024 * 20,
        runtimeCaching: [
          {
            urlPattern: /\/api\/.*$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
            },
          },
        ],
      },
      includeAssets: ['favicon.ico', 'pwa-icons/*.svg'],
    }),
  )
  if (env.VITE_VISUALIZER) {
    const { visualizer: viteVisualizerPlugin } = await import('rollup-plugin-visualizer')
    plugins.push(
      viteVisualizerPlugin({
        filename: './node_modules/.cache/visualizer/stats.html',
        gzipSize: true,
        open: false,
      }) as PluginOption,
    )
  }
  env.VITE_COMPRESS
  && env.VITE_COMPRESS !== 'none'
  && plugins.push(
    viteCompressPlugin({
      deleteOriginFile: false,
      ext: env.VITE_COMPRESS === 'brotli' ? '.br' : '.gz',
    }),
  )
  return plugins
}
