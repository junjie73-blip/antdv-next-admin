import type { PluginOption } from 'vite'

import viteDtsPlugin from 'vite-plugin-dts'
import { createHtmlPlugin as viteHtmlPlugin } from 'vite-plugin-html'
import viteVueDevTools from 'vite-plugin-vue-devtools'

import { loadEnv } from '../utils/env'
import { vitePluginAppLoading } from './app-loading'
import { createArchiverPlugin } from './archiver'
import { createAutoImportPlugins } from './auto-import'
import { createCompressPlugin } from './compress'
import { createImageminPlugin } from './imagemin'
import { createLegacyPlugin } from './legacy'
import { createMetadataPlugin } from './metadata'
import { createMockPlugin } from './mock'
import { createPwaPlugin } from './pwa'
import { createSvgIconsPlugin } from './svg-icons'
import { createTurboConsolePlugin } from './turbo-console'
import { createVisualizerPlugin } from './visualizer'
import { createVuePlugins } from './vue'
export function createPlugins(mode: string): PluginOption[] {
  const isProd = mode === 'production'
  const envConfig = loadEnv(mode)

  const plugins: PluginOption[] = [
    ...createVuePlugins(),

    ...createAutoImportPlugins(),

    // 基础 HTML 处理插件
    viteHtmlPlugin({
      inject: {
        data: {
          VITE_APP_TITLE: envConfig.VITE_APP_TITLE,
          VITE_APP_BASE_URL: envConfig.VITE_APP_BASE_URL,
        },
      },
      minify: true,
    }),

    // TypeScript 声明文件生成
    viteDtsPlugin(),

    // 静态资源处理
    createSvgIconsPlugin(),
    createImageminPlugin(),
  ]

  // 开发环境专属插件
  if (envConfig.VITE_DEVTOOLS) {
    plugins.push(viteVueDevTools())
  }

  // 条件插件
  if (envConfig.VITE_MOCK) plugins.push(createMockPlugin(mode))
  if (envConfig.VITE_ARCHIVER) plugins.push(createArchiverPlugin())
  if (isProd) plugins.push(createMetadataPlugin())
  if (envConfig.VITE_VISUALIZER) plugins.push(createVisualizerPlugin())
  if (envConfig.VITE_PWA) plugins.push(createPwaPlugin(envConfig))
  if (envConfig.VITE_COMPRESS) {
    plugins.push(createCompressPlugin())
  }
  if (envConfig.VITE_LEGACY) plugins.push(createLegacyPlugin(envConfig))
  if (envConfig.VITE_TURBO_CONSOLE) plugins.push(createTurboConsolePlugin())

  // 自研 Loading 插件（按需启用，默认启用）
  if (envConfig.VITE_INJECT_APP_LOADING) {
    plugins.push(
      vitePluginAppLoading({
        autoTheme: true,
        cssVariableSources: ['src/**/*.css', 'src/**/*.scss', 'src/**/*.less', 'src/**/*.sass'],
        cssVariablePrefix: '--color-',
        cssVariableExclude: [
          /^--vite-/,
          /^--_/,
          /^--el-/,
          /^--un-/,
          /^--ant-/,
          /^--radix-/,
          /^--tw-/,
          /^--iconify-/,
          /-shadow/,
          /-duration/,
          /-easing/,
        ],
        themeVariables: {
          // "--color-primary": "#00b96b",
        },
        themeSelector: ':root',
        themeImportant: false,
        // 消失动画配置
        fadeDuration: 600,
        fadeProperty: 'opacity',
        autoRemove: false,
        devEnabled: true,
        buildEnabled: true,
        // 可通过 envConfig 动态调整
        loadingHtmlPath: envConfig.VITE_APP_LOADING_PATH || '',
      }),
    )
  }

  return plugins
}
