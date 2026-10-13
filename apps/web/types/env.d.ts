// / <reference types="vite/client" />
// / <reference types="vitest/globals" />
// / <reference types="vite-plugin-pwa/client" />
// / <reference types="vue-router/auto" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';

  const component: DefineComponent<{}, {}, any>;
  export default component;
}

/**
 * 下面这些 `boolean` 只是 env-parse 按 `.env` 里的字面量推出来的"看起来的类型"：
 * Vite 运行时注入的值**一律是字符串**（`'true'` / `'false'` / `''`）。
 * 所以不要写 `import.meta.env.VITE_X === true` —— 它恒为 false，开关看着配了却永远不生效。
 * 判断开关统一用 `isEnvEnabled(import.meta.env.VITE_X)`（来自 `@antdv/shared/env`）。
 */
interface ImportMetaEnv {
  // Auto generate by env-parse
  readonly VITE_APP_TITLE: string
  /**
   * 微前端：需要子应用真的跑在注册表配的端口上（见 src/config/micro-app.ts）再打开，
   * 否则「微前端」菜单页会去连不通的地址。用 isEnvEnabled 判断，不要写 === true。
   */
  readonly VITE_MICRO_APP: boolean
  readonly VITE_MOCK: boolean
  readonly VITE_NAMESPACE: string
  /**
   * 实时通知推送（顶栏铃铛）的 WebSocket 端点，见 src/utils/ws.ts。
   * 留空 = 不连接：mock（Nitro）没有 /ws 处理器，而重连是无限的，
   * 在没有后端的情况下发起连接只会把控制台与端到端用例淹掉。
   * 接真实后端时填完整地址，例如 ws://localhost:8080/ws，token 由前端自动附加。
   */
  readonly VITE_WS_URL: string
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

/**
 * `vite-plugin-svg-icons` 只导出运行时虚拟模块，包里没带 client 类型声明，
 * main.ts 的 `import 'virtual:svg-icons-register'` 因此需要一个显式声明。
 */
declare module 'virtual:svg-icons-register' {
  const register: () => void;
  export default register;
}

/**
 * 首屏 Loading 遮罩（internal/vite-config 的 vite-plugin-app-loading）。
 * 遮罩注入在 `#app` 之外，插件默认 `autoRemove: false`，
 * 所以入口必须显式调用一次 `loadingFadeOut()`，否则它永远盖着页面。
 * 约定：关掉 VITE_INJECT_APP_LOADING 时插件依然注册虚拟模块，
 * 这些函数变成找不到容器的空操作 —— 因此这里不需要条件导入。
 */
declare module 'virtual:app-loading' {
  /** 立即移除 loading 容器（无动画） */
  export function removeAppLoading(): void;
  /** 带淡出动画移除 loading 容器 */
  export function loadingFadeOut(): void;
  export function useAppLoading(): {
    element: Element | null;
    fadeOut: typeof loadingFadeOut;
    remove: typeof removeAppLoading;
  };
  export default loadingFadeOut;
}
