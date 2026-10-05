import type { PluginOption } from 'vite'

import TurboConsole from 'unplugin-turbo-console/vite'

export function createTurboConsolePlugin(): PluginOption {
  return TurboConsole({
    prefix: '👇👇👇👇👇',
    suffix: '👆👆👆👆👆',
    highlight: {
      extendedPathFileNames: ['index'],
      themeDetect: true,
    },
  })
}
