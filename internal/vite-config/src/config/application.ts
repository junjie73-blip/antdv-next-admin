import type { PluginOption, UserConfig } from 'vite';

import { defineConfig, mergeConfig } from 'vite';

import { DEFAULT_PORT } from '../constants';
import { createChunkGroups } from '../optimize';
import { createPlugins } from '../plugins';
import { isEnvEnabled, loadEnv } from '../utils/env';
import { createAppInfo } from '../utils/package-json';
import { createServerProxy } from '../utils/proxy';
import { createCommonConfig } from './common';

export interface ApplicationOptions {
  /** 是否注入 `__APP_INFO__`（构建时间 + 依赖清单），默认 true */
  appInfo?: boolean;
  /** 部署基础路径，默认 `./`（哈希路由 + 静态目录直出的常见选择） */
  base?: string;
  /** 追加/覆盖 `define` 常量 */
  define?: Record<string, unknown>;
  /** dev server 端口兜底，优先级低于 `VITE_PORT` */
  port?: number;
  /** 追加插件（在共享插件之后执行） */
  plugins?: PluginOption[];
  /** 消费方根目录，默认 `process.cwd()` */
  root?: string;
  /** 最后一层深合并：项目专属配置从这里进来，优先级最高 */
  overrides?: UserConfig;
}

/** 分包策略：把体积大且低频变化的依赖切成独立 vendor chunk，命中长期缓存 */
export function createApplicationBuildConfig(isProd: boolean): UserConfig['build'] {
  return {
    chunkSizeWarningLimit: 1000,
    rolldownOptions: {
      output: {
        assetFileNames: 'assets/[name]-[hash].[ext]',
        chunkFileNames: 'js/[name]-[hash].js',
        codeSplitting: {
          groups: createChunkGroups().groups,
          minSize: 20 * 1024,
        },
        entryFileNames: 'js/[name]-[hash].js',
        minify: {
          compress: {
            dropConsole: isProd,
            // 字段名是 dropDebugger；写成 dropDebuggerger 会被 schema 判成非法对象
            dropDebugger: isProd,
          },
        },
      },
    },
    sourcemap: false,
  };
}

/** 预打包清单：vue 交给 dedupe 处理，其余常用大包显式 include 免得首屏冷启动 */
export function createOptimizeDeps(): UserConfig['optimizeDeps'] {
  return {
    exclude: ['vue'],
    // 必须是真实包名：写成裸的 '@vueuse' 会报
    // "Failed to resolve dependency: @vueuse, present in optimizeDeps.include"
    include: ['@vueuse/core', 'antdv-next', 'es-toolkit'],
  };
}

/**
 * SPA 应用配置：`vite.config.ts` 里一行搞定。
 *
 * ```ts
 * export default defineApplicationConfig({
 *   overrides: { define: { __MY_FLAG__: '1' } },
 * });
 * ```
 *
 * 合并顺序（后者覆盖前者）：common → application → overrides。
 * `plugins` 走数组拼接而不是覆盖，所以 overrides 里加插件不会顶掉共享插件。
 */
export function defineApplicationConfig(options: ApplicationOptions = {}) {
  return defineConfig(async ({ mode }) => {
    const root = options.root ?? process.cwd();
    const envConfig = loadEnv(mode);
    const isProd = mode === 'production';

    const application: UserConfig = {
      base: options.base ?? './',
      build: createApplicationBuildConfig(isProd),
      define: {
        ...(options.appInfo === false
          ? {}
          : {
              __APP_INFO__: JSON.stringify(
                createAppInfo(root, new Date()),
              ),
            }),
        ...options.define,
      },
      optimizeDeps: createOptimizeDeps(),
      plugins: [
        ...(await createPlugins(mode, { kind: 'application', root })),
        ...(options.plugins ?? []),
      ],
      server: {
        cors: true,
        host: '0.0.0.0',
        port: Number(envConfig.VITE_PORT) || options.port || DEFAULT_PORT,
        proxy: createServerProxy(envConfig, envConfig.VITE_PROXY),
        /**
         * 轮询监听开关：`VITE_DEV_POLLING=true`。
         *
         * 仓库放在映射盘 / 网络盘 / 部分容器挂载卷上时，inotify 事件根本不会到达
         * vite，改完文件模块还是旧的（表现是"我明明改了，浏览器还在跑老代码"），
         * 只能靠重启 + `--force` 兜。开轮询能解决，但大仓 CPU 开销明显，
         * 所以默认关闭，按需在 `.env.local` 里打开。
         *
         * 判定必须走 `isEnvEnabled`：`envConfig` 经过了 `parseLoadedEnv`，
         * `.env` 里写 `true` 到这里已经是布尔值，旧代码写的是
         * `envConfig.VITE_DEV_POLLING === 'true'`，恒为 false，等于这个开关从来没生效过。
         */
        watch:
          isEnvEnabled(envConfig.VITE_DEV_POLLING) ||
          isEnvEnabled(process.env.VITE_DEV_POLLING)
            ? { usePolling: true }
            : undefined,
      },
    };

    return mergeConfig(
      createCommonConfig({ envConfig, mode, root }),
      mergeConfig(application, options.overrides ?? {}),
    );
  });
}
