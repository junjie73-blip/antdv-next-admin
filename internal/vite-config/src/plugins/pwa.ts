import type { PluginOption } from 'vite'

import { VitePWA } from 'vite-plugin-pwa'

export function createPwaPlugin(envConfig: Record<string, any>): PluginOption {
  return VitePWA({
    registerType: 'prompt',
    injectRegister: 'script-defer',
    strategies: 'generateSW',
    manifest: {
      name: envConfig.VITE_APP_TITLE,
      short_name: envConfig.VITE_APP_TITLE,
      description: '基于 Vue 3 + Antdv Next 的现代化后台管理系统',
      icons: [
        { src: 'pwa-icons/pwa-64x64.png', type: 'image/png', sizes: '64x64' },
        { src: 'pwa-icons/pwa-192x192.png', type: 'image/png', sizes: '192x192' },
        { src: 'pwa-icons/pwa-512x512.png', type: 'image/png', sizes: '512x512' },
        { src: 'pwa-icons/maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: 'pwa-icons/apple-touch-icon-180x180.png', type: 'image/png', sizes: '180x180 180x180' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      maximumFileSizeToCacheInBytes: 1024 * 1024 * 20,
      runtimeCaching: [
        {
          urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp)$/i,
          handler: 'CacheFirst',
          options: {
            cacheName: 'image-cache',
            expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
          },
        },
      ],
    },
    includeAssets: ['favicon.ico', 'pwa-icons/*.png'],
    devOptions: { enabled: true },
  })
}
