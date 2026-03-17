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
      rollupOptions: {
        output: {
          assetFileNames: '[ext]/[name]-[hash].[ext]',
          chunkFileNames: 'js/[name]-[hash].js',
          entryFileNames: 'js/index-[name]-[hash].js',
        },
      },
      terserOptions: {
        mangle: true,
        compress: {
          drop_console: true,
          drop_debugger: false,
        },
      },
    },
  }
}
