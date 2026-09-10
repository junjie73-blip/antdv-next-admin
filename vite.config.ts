import { createWriteStream, existsSync, readFileSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import dayjs from 'dayjs'
import { defineConfig, PluginOption } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import viteVue from '@vitejs/plugin-vue'
import viteVueJsx from '@vitejs/plugin-vue-jsx'
import viteCompressPlugin from 'vite-plugin-compression'
import { AntdvNextResolver } from '@antdv-next/auto-import-resolver'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import viteDtsPlugin from 'vite-plugin-dts'
import { createSvgIconsPlugin } from 'vite-plugin-svg-icons'
import viteVueDevTools from 'vite-plugin-vue-devtools'
import packageJson from './package.json' with { type: 'json' }
import { analyzer } from "vite-bundle-analyzer";
import viteImagemin from 'vite-plugin-imagemin'
import { createHtmlPlugin as viteHtmlPlugin } from 'vite-plugin-html'
import Inspect from 'vite-plugin-inspect'
import { wrapPlugin } from 'vite-plugin-performance'
import pkg from './package.json' with { type: 'json' }
import archiver from 'archiver'
type ProxyList = [string, string][]
type AppEnv = ReturnType<typeof loadEnv>
interface ProxyTarget {
  target: string
  changeOrigin: boolean
  ws: boolean
  rewrite: (path: string) => string
  secure?: boolean
}

type ProxyTargetList = Record<string, ProxyTarget>
function findConfigFile(confFile: string) {
  const filePath = join(process.cwd(), confFile)
  return existsSync(filePath) ? filePath : null
}

function getConfFiles() {
  const mode
    = process.env.NODE_ENV
    || process.env.npm_lifecycle_script?.match(/--mode ([\d_a-z]+)/)?.[1]
    || 'development' // 默认为 development，更符合开发习惯
  return ['.env', `.env.${mode}`]
}
/**
 * 智能解析 .env 中的值：
 * - 数字、布尔值、null 直接转换类型
 * - JSON 数组或对象（支持双引号或单引号）转换为对应结构
 * - 被引号包裹的字符串去除引号后返回
 * - 其他情况返回去除空白后的原始字符串
 */
function parseValue(value: string): any {
  const trimmed = value.trim()
  if (trimmed === '')
    return ''

  // 双引号字符串
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    try {
      return JSON.parse(trimmed)
    }
    catch {
      return trimmed.slice(1, -1)
    }
  }

  // 单引号字符串
  if (trimmed.startsWith('\'') && trimmed.endsWith('\'')) {
    return trimmed.slice(1, -1)
  }

  // 尝试直接 JSON.parse（数字、布尔、null、标准 JSON 数组/对象）
  try {
    return JSON.parse(trimmed)
  }
  catch {
    // 如果看起来像数组或对象，将单引号替换为双引号再尝试一次
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      const normalized = trimmed.replace(/'/g, '"')
      try {
        return JSON.parse(normalized)
      }
      catch {
        // 解析失败，按原样返回字符串
      }
    }
    return trimmed
  }
}
function loadEnv(): Record<string, any> {
  const env: Record<string, any> = {}
  const confFiles = getConfFiles()

  for (const confFile of confFiles) {
    try {
      const filePath = findConfigFile(confFile)
      if (!filePath)
        continue

      const content = readFileSync(filePath, 'utf-8')
      const lines = content.split(/\r?\n/)

      for (const line of lines) {
        const trimmedLine = line.trim()
        if (!trimmedLine || trimmedLine.startsWith('#'))
          continue

        const match = trimmedLine.match(/^([^=]+)=([\s\S]*)$/)
        if (!match)
          continue

        const key = match[1].trim()
        const value = parseValue(match[2])
        env[key] = value
      }
    }
    catch (error) {
      console.warn(`Failed to load env file: ${confFile}`, error)
    }
  }

  return env
}
function createProxy(list: ProxyList = []): ProxyTargetList {
  const ret: ProxyTargetList = {}
  for (const [prefix, target] of list) {
    console.log(prefix, target, 'prefix, target')
    const httpsRE = /^https:\/\//
    const isHttps = httpsRE.test(target)

    ret[prefix] = {
      target,
      changeOrigin: true,
      ws: target.startsWith('ws'),
      rewrite: (path: string) => path.replace(new RegExp(`^${prefix}`), ''),
      ...(isHttps ? { secure: false } : {}),
    }
  }
  return ret
}
async function zipFolder(
  folderPath: string,
  outputPath: string,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const output = createWriteStream(outputPath)
    const archive = archiver('zip', {
      zlib: { level: 9 },
    })

    output.on('close', () => {
      console.log(
        `ZIP file created: ${outputPath} (${archive.pointer()} total bytes)`,
      )
      resolve()
    })

    archive.on('error', err => reject(err))
    archive.pipe(output)
    archive.directory(folderPath, false)
    archive.finalize()
  })
}
function viteArchiverPlugin(
  options: Record<string, string>,
): PluginOption {
  return {
    name: 'vite:archiver',
    apply: 'build',
    enforce: 'post',
    closeBundle: {
      order: 'post',
      handler() {
        setTimeout(async () => {
          const { name = 'dist', outputDir = '.' } = options
          const zipOutputDir = join(process.cwd(), outputDir)
          const zipOutputPath = join(zipOutputDir, `${name}.zip`)

          try {
            await mkdir(zipOutputDir, { recursive: true })
            await zipFolder('dist', zipOutputPath)
            console.log(`✨ Folder has been zipped to: ${zipOutputPath}`)
          }
          catch (error) {
            console.error('Error zipping folder:', error)
          }
        }, 0)
      },
    },
  }
}
function viteMetadataPlugin(root: string): PluginOption {
  return {
    name: 'vite:inject-metadata',
    enforce: 'post',
     config() {
      try {
        const { version, name } = packageJson
        return {
          define: {
            __APP_METADATA__: JSON.stringify({
              name,
              version,
            }),
          },
        }
      }
      catch (error) {
        console.warn('[viteMetadataPlugin] Failed to read metadata:', error)
        return {}
      }
    },
  }
}

export default defineConfig(async ({ mode }) => {
  const isProd = mode === 'production'
  const envConfig = loadEnv()

  const createPlugin = () => {
    const plugins = [
      viteVue(),
      viteVueJsx(),
      tailwindcss(),
      wrapPlugin(
        Inspect(),{
      threshold: 50
    }
      ),
      viteHtmlPlugin({
        inject: {
          data: {
            title: envConfig.VITE_APP_TITLE,
          },
        },
        minify: true,
      }),
      viteDtsPlugin(),
      AutoImport({
        imports: [
          'vue',
          '@vueuse/core',
          'pinia',
          {
            'antdv-next': [
              'message',
              'notification',
              'Modal',
              'Drawer',
            ],
          },
          'vue-router'
        ],
        dts: join(process.cwd(), '/types/auto-imports.d.ts'),
      }),
      Components({
        resolvers: [
          AntdvNextResolver({
            // 启用图标自动导入
            resolveIcons: true,
          }),
        ],
        dts: join(process.cwd(), '/types/components.d.ts'),
      }),
      createSvgIconsPlugin({
        iconDirs: [join(process.cwd(), 'src/assets/icons')],
        symbolId: 'icon-[name]',
      }),
      viteVueDevTools(),
       viteImagemin({
        gifsicle: {
          optimizationLevel: 7,
          interlaced: false,
        },
        optipng: {
          optimizationLevel: 7,
        },
        mozjpeg: {
          quality: 20,
        },
        pngquant: {
          quality: [0.8, 0.9],
          speed: 4,
        },
        svgo: {
          plugins: [
            {
              name: 'removeViewBox',
            },
            {
              name: 'removeEmptyAttrs',
              active: false,
            },
          ],
        },
      }),
    ]
    envConfig.VITE_ARCHIVER && plugins.push(viteArchiverPlugin({}))
    isProd && plugins.push(viteMetadataPlugin(process.cwd()))
    envConfig.VITE_VISUALIZER && plugins.push(analyzer({
      fileName: "stats.html",
    }))
    envConfig.VITE_COMPRESS && envConfig.VITE_COMPRESS !== 'none' && plugins.push(viteCompressPlugin({
      deleteOriginFile: false,
      ext: envConfig.VITE_COMPRESS === 'brotli' ? '.br' : '.gz',
    }))
    return plugins
  }
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
    base: '/',
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
      port: envConfig.VITE_PORT,
      host: '0.0.0.0',
      cors: true,
      proxy: createProxy(envConfig.VITE_PROXY as unknown as ProxyList),
      https: false,
    },
    plugins: createPlugin(),
    build: {
      sourcemap: false,
      chunkSizeWarningLimit: 1000,
      rolldownOptions: {
        output: {
          chunkFileNames: 'js/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]',
          entryFileNames: 'js/index-[name]-[hash].js',
          codeSplitting: {
            groups: [{
              name(id:string) {
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
            }],
          },
        },
      },
    },
  }
})
