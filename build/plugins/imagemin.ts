import type { PluginOption } from 'vite'

import viteImagemin from 'vite-plugin-imagemin'

export function createImageminPlugin(): PluginOption {
  return viteImagemin({
    gifsicle: { optimizationLevel: 3 },
    optipng: { optimizationLevel: 7 },
    mozjpeg: { quality: 80 },
    pngquant: { quality: [0.8, 0.9] },
    webp: { quality: 80 },
  })
}
