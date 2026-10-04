/* eslint-disable @typescript-eslint/no-empty-object-type */
/// <reference types="vite/client" />
/// <reference types="vitest/globals" />
/// <reference types="vite-plugin-pwa/client" />
declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  // Auto generate by env-parse
  readonly VITE_APP_LOADING_PATH: string
  readonly VITE_APP_TITLE: string
  readonly VITE_CONFIG_NATIVE_IGNORE_WARNING: boolean
  /**
   * ==================== 日志功能配置 ====================
   * 是否启用前端日志记录（开发环境默认关闭）
   */
  readonly VITE_ENABLE_LOGGING: boolean
  /**
   * 本地日志最大存储条数
   */
  readonly VITE_LOG_MAX_ENTRIES: number
  /**
   * 操作日志是否记录路由跳转
   */
  readonly VITE_LOG_ROUTE_CHANGE: boolean
  readonly VITE_MOCK: boolean
  readonly VITE_NAMESPACE: string
  readonly VITE_APP_BASE_API: string
  readonly VITE_APP_BASE_URL: string
  readonly VITE_DEVTOOLS: boolean
  readonly VITE_INJECT_APP_LOADING: boolean
  readonly VITE_PORT: number
  readonly VITE_PROXY: any[]
  readonly VITE_PWA: boolean
  readonly VITE_TURBO_CONSOLE: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test'
    [key: string]: string | undefined
  }
}

declare module 'virtual:pwa-register/vue' {
  import type { RegisterSWOptions } from 'vite-plugin-pwa/types'
  import type { Ref } from 'vue'

  export type { RegisterSWOptions }

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: Ref<boolean>
    offlineReady: Ref<boolean>
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>
  }
}
