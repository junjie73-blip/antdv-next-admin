import dayjs from 'dayjs'
import { join } from 'node:path'
import { defineConfig } from 'vite'

import { createChunkGroups, createPlugins, createProxy, loadEnv } from './build'
import pkg from './package.json' with { type: 'json' }

export default defineConfig(({ mode }) => {
  const isProd = mode === 'production'
  const envConfig = loadEnv(mode)
  const __APP_INFO__ = {
    pkg: {
      dependencies: pkg.dependencies,
      devDependencies: pkg.devDependencies,
      name: pkg.name,
      version: pkg.version,
    },
    lastBuildTime: dayjs().format('YYYY-MM-DD HH:mm:ss'),
  }
  return {
    base: './',
    resolve: {
      alias: {
        '~': join(import.meta.dirname, './src'),
        '#': join(import.meta.dirname, './types'),
      },
    },
    define: {
      __APP_INFO__: JSON.stringify(__APP_INFO__),
    },
    server: {
      port: envConfig.VITE_PORT,
      host: '0.0.0.0',
      cors: true,
      hot: true,
      proxy: createProxy(envConfig.VITE_PROXY),
    },
    plugins: createPlugins(mode),
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rolldownOptions: {
        output: {
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          entryFileNames: 'js/[name]-[hash].js',
          codeSplitting: {
            minSize: 20 * 1024,
            ...createChunkGroups(),
          },
          minify: {
            compress: {
              dropConsole: isProd,
              dropDebuggerger: isProd,
            },
          },
        },
      },
    },
    optimizeDeps: {
      exclude: ['vue'],
      include: ['@vueuse', 'es-toolkit', 'antdv-next'],
    },
  }
})
