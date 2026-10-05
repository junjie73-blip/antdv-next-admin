import type { PluginOption } from 'vite'

import { vitePlugin } from 'unplugin-console-highlight'

export function createTurboConsolePlugin(): PluginOption {
  return vitePlugin({
    prefix: '👇👇👇👇👇',
    suffix: '👆👆👆👆👆',
  })
}
