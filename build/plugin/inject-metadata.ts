import type { PluginOption } from 'vite'
import { join } from 'node:path'

/**
 * 注入项目元数据到全局变量
 */
export async function viteMetadataPlugin(root: string): Promise<PluginOption> {
  return {
    name: 'vite:inject-metadata',
    enforce: 'post',
    async config() {
      try {
        const { version, name } = await import(join(root, 'package.json'))
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
