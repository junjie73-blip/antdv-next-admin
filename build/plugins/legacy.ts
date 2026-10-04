import type { PluginOption } from 'vite'

import legacy from '@vitejs/plugin-legacy'

export function createLegacyPlugin(_envConfig: Record<string, any>): PluginOption {
  return legacy({
    targets: ['defaults', 'not IE 11'],
    additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
    renderLegacyChunks: true,
    modernPolyfills: true,
  })
}
