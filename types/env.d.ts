/// <reference types="vite/client" />
/// <reference types="vitest/globals" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'

  const component: DefineComponent<{}, {}, any>
  export default component
}

interface ImportMetaEnv {
  readonly VITE_NAMESPACE: string
  readonly VITE_APP_TITLE: string
  readonly VITE_PORT: number
  readonly VITE_INJECT_APP_LOADING: boolean
  readonly VITE_MOCK: boolean
  readonly VITE_DEVTOOLS: boolean
  readonly VITE_PWA: boolean
  readonly VITE_VISUALIZER: boolean
  readonly VITE_COMPRESS: 'gzip' | 'brotli' | 'none'
  readonly VITE_ARCHIVER: boolean
  readonly MODE: string
  readonly DEV: boolean
  readonly PROD: boolean
  readonly SSR: boolean
}

interface ImportMeta {
  readonly env: ImportMetaEnv
  readonly glob: (pattern: string) => Record<string, () => Promise<unknown>>
  readonly url: string
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test'
    [key: string]: string | undefined
  }
}

declare const process: NodeJS.Process
