import type { PluginOption } from 'vite';

import { compression, defineAlgorithm } from 'vite-plugin-compression2';

export function createCompressPlugin(): PluginOption {
  return compression({
    algorithms: ['gzip', 'brotliCompress', defineAlgorithm('gzip')],
    threshold: 10_240,
  });
}
