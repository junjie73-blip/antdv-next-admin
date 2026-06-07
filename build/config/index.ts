import type { ConfigEnv, UserConfig } from 'vite'
import type { ProxyList } from '../utils/proxy'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import dayjs from 'dayjs'
import { createPlugin } from '../plugin'
import { loadEnv } from '../utils/env'
import { createProxy } from '../utils/proxy'

export async function userConfig({ mode }: ConfigEnv): Promise<UserConfig> {
  const envConfig = await loadEnv()
  const pkg = await import(
    pathToFileURL(join(process.cwd(), 'package.json')).href,
    { with: { type: 'json' } },
  )
  const __APP_INFO__ = {
    pkg: {
      dependencies: pkg.default.dependencies,
      devDependencies: pkg.default.devDependencies,
      name: pkg.default.name,
      version: pkg.default.version,
    },
    lastBuildTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }

  return {
    base: envConfig.VITE_BASE,
    resolve: {
      alias: {
        '@': join(process.cwd(), './src'),
        '#': join(process.cwd(), './types'),
      },
    },
    define: {
      __APP_INFO__: JSON.stringify(__APP_INFO__),
    },
    server: {
      port: Number(envConfig.VITE_PORT),
      host: '0.0.0.0',
      cors: true,
      proxy: createProxy(envConfig.VITE_PROXY as unknown as ProxyList),
    },
    plugins: [
      await createPlugin({
        isBuild: mode === 'production',
        env: envConfig,
      }),
    ],
    build: {
      minify: 'terser',
      sourcemap: false,
      // 增大 chunk 警告阈值，避免不必要的警告
      chunkSizeWarningLimit: 1000,
      rollupOptions: {
        output: {
          assetFileNames: '[ext]/[name]-[hash].[ext]',
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/index-[name]-[hash].js',
          // 优化代码分割策略，提高缓存命中率和加载性能
          manualChunks(id) {
            // 将 node_modules 中的依赖拆分为独立的 vendor chunk
            if (id.includes('node_modules')) {
              // antdv-next UI 框架（最大，单独拆分）
              if (id.includes('antdv-next')) {
                return 'vendor-antdv'
              }

              // Iconify 图标库（IconPicker 组件使用，体积大）
              if (id.includes('@iconify') || id.includes('iconify')) {
                return 'vendor-icons'
              }

              // Vue 生态系统
              if (id.includes('vue') || id.includes('pinia') || id.includes('vue-router')) {
                return 'vendor-vue'
              }

              // ECharts 图表库
              if (id.includes('echarts')) {
                return 'vendor-echarts'
              }

              // Excel 处理库
              if (id.includes('xlsx')) {
                return 'vendor-xlsx'
              }

              // 编辑器相关（WangEditor、Markdown）
              if (id.includes('@wangeditor') || id.includes('markdown-it') || id.includes('marked')) {
                return 'vendor-editor'
              }

              // 工具库
              if (id.includes('@vueuse') || id.includes('es-toolkit') || id.includes('dayjs')) {
                return 'vendor-utils'
              }

              // 其他第三方库统一归入 vendor
              return 'vendor'
            }
          },
        },
      },
      terserOptions: {
        mangle: true,
        compress: {
          drop_console: true,
          drop_debugger: true,
        },
      },
    },
  }
}
