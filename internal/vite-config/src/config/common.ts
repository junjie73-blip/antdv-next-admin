import type { UserConfig } from 'vite';

export interface ConfigContext {
  /** `loadEnv()` 解析后的环境变量（已按类型转换） */
  envConfig: Record<string, any>;
  mode: string;
  /** 消费方工作目录，通常是 `process.cwd()` */
  root: string;
}

/**
 * 默认别名：`~` → src、`#` → types。
 * 与应用侧 `tsconfig.app.json` 的 `paths` 一一对应 —— 两边不一致时
 * vite 能跑但 vue-tsc 报错（或反过来），所以只在这里定义一次。
 */
export function createAliases(
  root: string,
  extra: Record<string, string> = {},
): Record<string, string> {
  return {
    '#': `${root}/types`,
    '~': `${root}/src`,
    ...extra,
  };
}

/**
 * 应用与库共用的基础配置。
 *
 * 只放「换哪个构建目标都不变」的部分：路径解析、缓存目录、CSS sourcemap。
 * server / build / plugins 属于 application 或 library 自己的事。
 */
export function createCommonConfig(context: ConfigContext): UserConfig {
  return {
    cacheDir: 'node_modules/.vite',
    css: {
      // dev 下 CSS 也要能定位到源文件，否则样式调试只能看编译产物
      devSourcemap: true,
    },
    envDir: context.root,
    resolve: {
      alias: createAliases(context.root),
      /**
       * 强制单例。
       *
       * pnpm 的 peer 解析会让依赖树里同时出现两份 `@vue/runtime-core`
       * （本项目就发生过 3.5.42 / 3.5.43 并存），后果不只是类型打架：
       * 运行时两个 Vue 实例会导致 inject / 响应式系统互相看不见。
       */
      dedupe: ['pinia', 'vue', 'vue-router'],
    },
    root: context.root,
  };
}
