import type { PluginOption } from 'vite'
import consola from 'consola'
import colors from 'picocolors'
/**
 * 在控制台打印自定义信息
 */
export function vitePrintPlugin(
  options: Record<string, string> = {},
): PluginOption {
  const { infoMap = {} } = options

  return {
    name: 'vite:print-info',
    enforce: 'pre',
    async configureServer(server) {
      const _printUrls = server.printUrls
      // 在配置解析完成后打印
      consola.log(`\n${'═'.repeat(60)}`)
      consola.log('📦 构建信息')
      consola.log('═'.repeat(60))
      server.printUrls = () => {
        _printUrls()
        for (const [key, value] of Object.entries(infoMap)) {
          if (value) {
            consola.log(`  ${colors.green('➜')}  ${colors.bold(key)}: ${value}`)
          }
        }
      }
      consola.log(`${'═'.repeat(60)}\n`)
    },
  }
}
