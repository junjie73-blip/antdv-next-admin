import type { PluginOption } from 'vite';

import { join } from 'node:path';

import { createSvgIconsPlugin as createViteSvgIconsPlugin } from 'vite-plugin-svg-icons';

export function createSvgIconsPlugin(): PluginOption {
  return createViteSvgIconsPlugin({
    iconDirs: [join(process.cwd(), 'src/assets/icons')],
    symbolId: 'icon-[name]',
  });
}
