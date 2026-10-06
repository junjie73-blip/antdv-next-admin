import type { PluginOption } from 'vite';

import { analyzer } from 'vite-bundle-analyzer';

export function createVisualizerPlugin(): PluginOption {
  return analyzer({
    fileName: 'stats.html',
  });
}
