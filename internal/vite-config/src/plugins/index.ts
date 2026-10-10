import type { PluginOption } from 'vite';

import viteDtsPlugin from 'vite-plugin-dts';
import { createHtmlPlugin as viteHtmlPlugin } from 'vite-plugin-html';
import viteVueDevTools from 'vite-plugin-vue-devtools';

import { isEnvEnabled, loadEnv } from '../utils/env';
import { resolveMockPort } from '../utils/proxy';
import { vitePluginAppLoading } from './app-loading';
import { createArchiverPlugin } from './archiver';
import { createAutoImportPlugins } from './auto-import';
import { createCompressPlugin } from './compress';
import { cspUpgradeInsecureRequests } from './csp';
import { viteDayjsPlugin } from './dayjs';
import { viteExtraAppConfigPlugin } from './extra-app-config';
import { createImageminPlugin } from './imagemin';
import { viteMetadataPlugin } from './metadata';
import { viteNitroMockPlugin } from './nitro-mock';
import { vitePrintPlugin } from './print';
import { createPwaPlugin } from './pwa';
import { createSvgIconsPlugin } from './svg-icons';
import { createTurboConsolePlugin } from './turbo-console';
import { createVisualizerPlugin } from './visualizer';
import { createVuePlugins } from './vue';

/**
 * 产物形态决定哪些插件有意义：
 *
 * - `application`：有 index.html、要跑 dev server、要出静态站点
 *   → HTML 注入、首屏 Loading、PWA、归档压缩、metadata 产物都归这里。
 * - `library`：lib 模式打包，没有 HTML，产物要能被消费方再次 tree-shake
 *   → 只留编译链（Vue / 自动导入 / 样式资源）与 .d.ts。
 *
 * 两种形态混用的典型症状：应用构建时 vite-plugin-dts 抱怨
 * "You are building a library that may not need to generate declaration files"，
 * 顺带把 public/ 与 HTML 流程也拖进库产物里。
 */
export type PluginKind = 'application' | 'library';

export interface CreatePluginsOptions {
  /** 库模式下是否生成 .d.ts，默认生成；应用模式恒不生成 */
  dts?: boolean;
  /** 默认 `application` */
  kind?: PluginKind;
  /** 消费方根目录，默认 `process.cwd()` */
  root?: string;
}

export async function createPlugins(
  mode: string,
  options: CreatePluginsOptions = {},
): Promise<PluginOption[]> {
  const kind = options.kind ?? 'application';
  const isApp = kind === 'application';
  const isProd = mode === 'production';
  const root = options.root ?? process.cwd();
  const envConfig = loadEnv(mode);

  const plugins: PluginOption[] = [
    ...createVuePlugins(),

    // dts 回写在映射盘上是"偶发但会带走进程"的失败点，见 ./auto-import 的注释；
    // 默认保留，需要时用 VITE_WRITE_DTS=false 关掉（构建产物与入库的 .d.ts 不受影响，
    // 只是 dev 期间新增的全局组件不会即时进声明文件）。
    ...createAutoImportPlugins({
      dts: isEnvEnabled(envConfig.VITE_WRITE_DTS ?? true),
    }),

    // 静态资源处理
    createSvgIconsPlugin(),
    createImageminPlugin(),
    viteDayjsPlugin(),
  ];

  /**
   * CSP 的 `upgrade-insecure-requests` 按产物形态给值，完整理由见 `./csp`：
   * 开发环境带上它，Safari/WebKit 会把 `http://localhost` 的每个模块请求升级成 https
   * 并握手失败，页面只剩首屏 Loading 的白屏 —— Chromium/Firefox 豁免 localhost，
   * 所以这个坑只在"用 Safari 跑一遍"时才暴露。
   */
  const cspUpgrade = cspUpgradeInsecureRequests(isProd);

  if (isApp) {
    // 基础 HTML 处理插件
    plugins.push(
      viteHtmlPlugin({
        inject: {
          data: {
            VITE_APP_TITLE: envConfig.VITE_APP_TITLE,
            VITE_APP_BASE_URL: envConfig.VITE_APP_BASE_URL,
            VITE_CSP_UPGRADE_INSECURE: cspUpgrade,
          },
        },
        minify: true,
      }),
    );
  } else if (options.dts !== false) {
    // TypeScript 声明文件生成：只有库模式才需要
    plugins.push(
      viteDtsPlugin({ entryRoot: `${root}/src`, insertTypesEntry: true }),
    );
  }

  // 开发环境专属插件
  if (isApp && isEnvEnabled(envConfig.VITE_DEVTOOLS)) {
    plugins.push(viteVueDevTools());
  }

  if (isApp && isProd) plugins.push(await viteMetadataPlugin());
  if (isEnvEnabled(envConfig.VITE_VISUALIZER))
    plugins.push(createVisualizerPlugin());
  if (isEnvEnabled(envConfig.VITE_TURBO_CONSOLE))
    plugins.push(createTurboConsolePlugin());

  // 以下只在应用形态有意义：Mock 转发、压缩归档、PWA、运行时配置、打印、首屏 Loading
  if (isApp) {
    // Mock 不再由 Vite 插件承担：VITE_MOCK=true 时由 dev proxy 把 /api 转发到
    // apps/backend-mock（Nitro）服务，见 utils/proxy.ts
    if (isEnvEnabled(envConfig.VITE_ARCHIVER)) plugins.push(createArchiverPlugin());
    if (isEnvEnabled(envConfig.VITE_PWA)) plugins.push(createPwaPlugin(envConfig));
    if (isEnvEnabled(envConfig.VITE_COMPRESS))
      plugins.push(createCompressPlugin());
    if (isEnvEnabled(envConfig.VITE_EXTRA_APP)) {
      plugins.push(
        await viteExtraAppConfigPlugin({ isBuild: isProd, mode, root }),
      );
    }
    if (isEnvEnabled(envConfig.VITE_MOCK)) {
      // 端口来自环境变量推导（VITE_MOCK_PORT → VITE_MOCK_SERVER → 默认），
      // 判定条件与 utils/proxy.ts 的 createMockProxy 保持一致，
      // 否则会出现"代理开着但内嵌 mock 没起"或反过来的半开状态。
      plugins.push(
        viteNitroMockPlugin({ port: resolveMockPort(envConfig) }),
      );
    }
    if (isEnvEnabled(envConfig.VITE_PRINT)) plugins.push(vitePrintPlugin());

    // 自研 Loading 插件。
    // 注意这里**不能**用 VITE_INJECT_APP_LOADING 把整个插件包在 if 里：
    // 应用入口是常驻的 `import { loadingFadeOut } from 'virtual:app-loading'`
    // （模板里只剩空的 #app，遮罩挂在 body 上，没人调用就永远不消失 —— dev 下会
    // 直接吞掉所有点击）。插件被跳过时虚拟模块无法解析，构建期就 500。
    // 所以开关只决定「注入不注入」，虚拟模块必须永远可 resolve；
    // 未注入时 loadingFadeOut() 找不到容器，自然空转。
    const appLoadingInjected = isEnvEnabled(envConfig.VITE_INJECT_APP_LOADING);
    plugins.push(
      vitePluginAppLoading({
        autoTheme: true,
        cssVariableSources: [
          'src/**/*.css',
          'src/**/*.scss',
          'src/**/*.less',
          'src/**/*.sass',
        ],
        cssVariablePrefix: '--color-',
        cssVariableExclude: [
          /^--vite-/,
          /^--_/,
          /^--el-/,
          /^--un-/,
          /^--ant-/,
          /^--radix-/,
          /^--tw-/,
          /^--iconify-/,
          /-shadow/,
          /-duration/,
          /-easing/,
        ],
        themeVariables: {
          // "--color-primary": "#00b96b",
        },
        themeSelector: ':root',
        themeImportant: false,
        // 消失动画配置
        fadeDuration:
          Number(envConfig.VITE_APP_LOADING_DURATION) || undefined,
        fadeProperty: 'opacity',
        autoRemove: false,
        // `?? true`：没配就是默认开启，和插件的 DEFAULT_OPTIONS 一致。
        // 走 isEnvEnabled 而不是直接透传，是因为 parseLoadedEnv 已经把
        // 'true' 转成布尔、把 '1' 转成数字，字符串比较会静默失效。
        devEnabled:
          appLoadingInjected &&
          isEnvEnabled(envConfig.VITE_APP_LOADING_DEV ?? true),
        buildEnabled:
          appLoadingInjected &&
          isEnvEnabled(envConfig.VITE_APP_LOADING_BUILD ?? true),
        // 可通过 envConfig 动态调整
        loadingHtmlPath: envConfig.VITE_APP_LOADING_PATH || '',
      }),
    );
  }

  return plugins;
}

export * from './csp';
export * from './custom-elements';
