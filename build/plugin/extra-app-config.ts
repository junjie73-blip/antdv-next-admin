import type { PluginOption } from 'vite'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import colors from 'picocolors'

interface PluginOptions {
  isBuild: boolean
  root: string
  loadEnv: () => Promise<Record<string, any>> | Record<string, any>
}

const CONFIG_FILE = '_app.config.js'
const GLOBAL_VAR = '_APP_CONF_'

/**
 * 读取 package.json 文件
 */
function readPackageJSON(root: string = process.cwd()): any {
  try {
    const packagePath = join(root, 'package.json')
    const content = readFileSync(packagePath, 'utf-8')
    return JSON.parse(content)
  }
  catch (error) {
    console.warn(`[app-config] 读取 package.json 失败: ${error}`)
    return { version: '0.0.0' }
  }
}

/**
 * 生成内容 hash
 */
function generatorContentHash(content: string, length: number = 8): string {
  return createHash('md5').update(content).digest('hex').slice(0, length)
}

/**
 * 将环境变量抽离为独立配置文件，支持热更新和防篡改
 */
export function viteExtraAppConfigPlugin({
  isBuild,
  root,
  loadEnv,
}: PluginOptions): PluginOption | undefined {
  if (!isBuild)
    return

  let publicPath = ''
  let configSource = ''
  let version = ''

  return {
    name: 'vite:extra-app-config',

    async configResolved(config) {
      // 初始化版本号
      const pkg = readPackageJSON(root)
      version = pkg.version || '0.0.0'

      // 确保路径格式正确
      publicPath = config.base.endsWith('/') ? config.base : `${config.base}/`
    },

    async generateBundle() {
      try {
        configSource = await generateConfigSource(loadEnv)

        this.emitFile({
          fileName: CONFIG_FILE,
          source: configSource,
          type: 'asset',
        })

        console.log(colors.green(`✨ 配置已生成: ${CONFIG_FILE}`))
      }
      catch (error) {
        console.error(colors.red(`❌ 配置生成失败: ${error}`))
        throw error // 中断构建
      }
    },

    async transformIndexHtml(html) {
      if (!configSource) {
        throw new Error('配置未就绪，请检查 generateBundle 钩子')
      }

      const hash = `v=${version}-${generatorContentHash(configSource, 8)}`
      const src = `${publicPath}${CONFIG_FILE}?${hash}`

      return {
        html,
        tags: [
          {
            tag: 'script',
            attrs: { src },
            injectTo: 'head-prepend',
          },
        ],
      }
    },
  }
}

async function generateConfigSource(
  loadEnv: PluginOptions['loadEnv'],
): Promise<string> {
  const config = await loadEnv()

  return `window.${GLOBAL_VAR}=${JSON.stringify(config)};
Object.freeze(window.${GLOBAL_VAR});
Object.defineProperty(window,"${GLOBAL_VAR}",{configurable:false,writable:false});`
}
