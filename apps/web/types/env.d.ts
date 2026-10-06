/* eslint-disable @typescript-eslint/no-empty-object-type */
// / <reference types="vite/client" />
// / <reference types="vitest/globals" />
// / <reference types="vite-plugin-pwa/client" />
// / <reference types="vue-router/auto" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<{}, {}, any>;
  export default component;
}

interface ImportMetaEnv {
  // Auto generate by env-parse
  readonly VITE_APP_TITLE: string;
  readonly VITE_MOCK: boolean;
  readonly VITE_NAMESPACE: string;
  readonly VITE_DEVTOOLS: boolean;
  readonly VITE_INJECT_APP_LOADING: boolean;
  readonly VITE_PORT: number;
  /** 接口前缀，dev 下配合 vite proxy 指向 Nitro Mock 服务 */
  readonly VITE_APP_BASE_API?: string;
  /** Nitro Mock 服务地址 */
  readonly VITE_MOCK_SERVER?: string;
  readonly VITE_MICRO_APP?: boolean | string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare namespace NodeJS {
  interface ProcessEnv {
    NODE_ENV?: 'development' | 'production' | 'test';
    [key: string]: string | undefined;
  }
}

declare module 'virtual:pwa-register/vue' {
  import type { RegisterSWOptions } from 'vite-plugin-pwa/types';

  import type { Ref } from 'vue';

  export function useRegisterSW(options?: RegisterSWOptions): {
    needRefresh: Ref<boolean>;
    offlineReady: Ref<boolean>;
    updateServiceWorker: (reloadPage?: boolean) => Promise<void>;
  };
}
