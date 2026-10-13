# Vite Config

一句话：**`apps/web/vite.config.ts` 只有两行有效代码 —— `defineApplicationConfig({ base: './' })`；其余全在 `internal/vite-config` （`@antdv/vite-config`）里按 common → application → overrides 三层合并。环境变量经过类型转换，**所有开关判定必须走 `isEnvEnabled()`，裸 `=== 'true'` 是已知 bug 源。**

## 分层

| 层 | 文件 | 管什么 |
| --- | --- | --- |
| common | `src/config/common.ts` | 别名 `~`→src、`#`→types（与 `tsconfig.app.json` 的 paths 一一对应，两边不一致会出现"vite 能跑 vue-tsc 报错"）；`cacheDir`、`css.devSourcemap`、`envDir`；`resolve.dedupe: ['pinia','vue','vue-router']` —— pnpm peer 解析曾让两份 `@vue/runtime-core` 并存（3.5.42/3.5.43），inject 与响应式互相看不见 |
| application | `src/config/application.ts` | 构建、server、define、插件装配 |
| overrides | 应用自己 | 最后一层深合并；`plugins` 数组拼接不覆盖，加插件不会顶掉共享插件 |

## 插件清单（`src/plugins/index.ts`，`kind: 'application'`）

**无条件**：`createVuePlugins()`（@vitejs/plugin-vue + jsx、unplugin-vue-router、 `@tailwindcss/vite`、vite-plugin-vue-layouts-next、@intlify/unplugin-vue-i18n、vite-plugin-inspect）→ `createAutoImportPlugins()`（unplugin-auto-import 只喂 `vue` / `@vueuse/core` / `pinia` / `vue-router`，unplugin-vue-components 只扫本应用 `src/components`，**没有任何组件解析器**，另有 iconify 离线集合、vite-plugin-env-parse）→ svg-icons、imagemin、dayjs。

**按产物形态**：application 才有 HTML 注入（vite-plugin-html）与首屏 Loading、PWA、archiver、metadata、extra-app-config、print、mock；library 形态只留编译链 + vite-plugin-dts（`kind` 的注释写了混用症状）。

**按环境变量（全部经 `isEnvEnabled`）**：

| 开关 | 插件 |
| --- | --- |
| `VITE_WRITE_DTS`（默认开） | auto-import/components 的 `.d.ts` 回写；Windows 映射盘上这写入偶发 `errno -4094` 直接带走 dev 进程，所以留了关闭口 |
| `VITE_DEVTOOLS` / `VITE_VISUALIZER` / `VITE_TURBO_CONSOLE` | vue-devtools / vite-bundle-analyzer / 控制台增强 |
| `VITE_ARCHIVER` / `VITE_COMPRESS` / `VITE_PWA` / `VITE_EXTRA_APP` / `VITE_PRINT` | 归档、压缩、PWA（见[检查更新](/zh/guide/in-depth/check-update)）、运行时配置、打印 |
| `VITE_MOCK` | `vite:mock-server`（`nitro-mock.ts`）：dev 时在进程内起 `@antdv/backend-mock`（端口 `resolveMockPort`，默认 5320，占用则跳过），同时 `utils/proxy.ts` 把 `/api` 原样代理过去 —— 两处判定用同一个 `isEnvEnabled(VITE_MOCK)`，防止"代理开着 mock 没起"的半开状态 |
| `VITE_INJECT_APP_LOADING` | 只决定首屏遮罩注不注入，虚拟模块永远注册 |

## 约定式路由的 exclude 是有故事的

```ts
routesFolder: ['src/views'],
dts: './types/router.d.ts',
exclude: ['**/*/components/*', 'account/**/*', 'login/**/*', 'register/**/*'],
```

`**/components/**` 这种写法会把 `views/components/` 下 26 个组件示例页一起排掉（`**/` 匹配零层目录），表现是全站示例路由命中 404 兜底。改成"中间必须多一段目录"的 `**/*/components/*` 后，页面私有组件继续排除、示例页恢复真实路由 —— 改这行前读注释。登录/注册在 exclude 里是因为它们走 `constantRoutes`（见[路由](/zh/guide/essentials/route)）。dev 下约定路由 HMR 与布局/权限裁剪的互搏由守卫里的 `syncRoutes()` 自愈（见[权限与菜单](/zh/guide/in-depth/access)）。

## dev server 与代理

`server`: `host 0.0.0.0`、`cors: true`、端口 `Number(VITE_PORT) || DEFAULT_PORT(5173)` （`.env.development` 实配 6080）；`proxy` = 自定义 `VITE_PROXY` 列表 + mock 代理合并。 `VITE_DEV_POLLING=true` 开轮询监听（映射盘/容器卷上 inotify 收不到事件的自救，默认关，大仓 CPU 开销明显）。

## 构建

`build.rolldownOptions`（是的，用 rolldown）：入口/分片命名 `js/[name]-[hash].js`， `codeSplitting.groups` 按包名切 vendor（ui/vue/echarts/utils/office/pdfjs/i18n/ editor，`optimize.ts`），`minSize 20KB`；生产 `minify.compress` 开 `dropConsole/dropDebugger`（字段名就是 `dropDebugger`，写错会被 schema 拒）； `sourcemap: false`、`chunkSizeWarningLimit: 1000`。`__APP_INFO__`（构建时间+依赖清单）默认注入，`appInfo: false` 可关。`optimizeDeps`：`exclude: ['vue']`（交给 dedupe），include `@vueuse/core / antdv-next / es-toolkit` 保首屏冷启动。

## 环境变量：唯一的坑与唯一的解法

`loadEnv(mode)` 用 vite 的 `loadEnv`（第三参 `""`，加载全部变量）再过 `vite-plugin-env-parse` 的 `parseLoadedEnv`：**`'true'` 变成布尔、`'6080'` 变成数字**。于是 `envConfig.VITE_X === 'true'` 恒为 false —— 本仓库真的因此让 `VITE_DEV_POLLING` 当了很久的死配置，且 `Record<string, any>` 下 TS 连报错都给不出。反过来真值判断也不对（`'0'` 不被转换、`'abc'` 也算真）。口径：Node 侧一律 `isEnvEnabled(value)` （认 `true/1/'true'/'1'/'on'/'yes'`），浏览器侧同名函数在 `@antdv/shared/env` （来源 `import.meta.env` 恒为字符串，不认数字）。两侧各有一份是刻意的： `internal/vite-config` 不依赖浏览器包。

## 相关页面

- 各开关的实际取值：`apps/web/.env*`（dev/prod 两份）
- 检查更新链路：[检查更新](/zh/guide/in-depth/check-update)
