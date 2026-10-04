import type { PluginOption } from 'vite'

import pkg from '../../package.json' with { type: 'json' }

export function createMetadataPlugin(): PluginOption {
  return {
    name: 'vite:inject-metadata',
    enforce: 'post',
    config() {
      try {
        const { version, name } = pkg
        return {
          define: {
            __APP_METADATA__: JSON.stringify({ name, version }),
          },
        }
      } catch (error) {
        console.warn('[viteMetadataPlugin] Failed to read metadata:', error)
        return {}
      }
    },
  }
}
