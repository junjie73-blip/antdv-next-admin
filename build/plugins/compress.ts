import type { PluginOption } from 'vite'

import viteCompressPlugin from 'vite-plugin-compression'

export function createCompressPlugin(compressType: string): PluginOption {
  return viteCompressPlugin({
    deleteOriginFile: false,
    verbose: true,
    disable: false,
    threshold: 10240,
    ext: compressType === 'brotli' ? '.br' : '.gz',
  })
}
