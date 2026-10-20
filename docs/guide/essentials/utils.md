# 工具

工具的分工只有一条判据：**换一个项目还能不能用**。能 → 放 `packages/`；需要 store、路由实例或应用内组件类型才能工作 → 留在 `apps/web/src/` 做薄壳。找现成实现也是这个顺序：先在 `@antdv/shared` 里搜，再在 `@antdv/hooks` / `@antdv/request` 里搜，最后才在应用目录里新建。

## 三层各放什么

| 层 | 位置 | 内容 | 为什么在这层 |
| --- | --- | --- | --- |
| 纯工具 | `packages/core/base/shared/src/**`、`packages/utils/src/**`、`packages/enums/src/**` | 缓存、加密、色值、日期、下载、Excel、脱敏、XSS、事件总线；菜单树与主题模式解析；缓存键与字典枚举 | 无框架状态，纯函数或自建单例 |
| 组合式 | `packages/core/hooks/src/**`、`packages/request/src/**` | 分片上传、文件读取、打印、水印、路由 Loading、ECharts、权限判定、CRUD 骨架、响应式缓存；HTTP / SSE / WebSocket | 只用 Vue 响应式 API，应用能力靠参数注入 |
| 应用薄壳 | `apps/web/src/utils/**`、`apps/web/src/composables/**`、`apps/web/src/components/common/**` | 需要 store / api / 应用内类型的接线 | 例 `utils/ws.ts:6`（拼 `eventBus`）、`utils/securityInit.ts:9`（启动 CSRF）、`composables/useLocale.ts:4`（写偏好里的 locale） |

::: tip

自动导入不负责本仓库的包 `internal/vite-config/src/plugins/auto-import.ts` 只注入框架 API。`import { cn } from '@antdv/shared/utils/cn'` 这类写法必须自己写（同[基础概念](/guide/essentials/concepts)）。
:::

## 子路径即模块

`packages/core/base/shared/package.json:21-55` 的 `exports` 用了 `"./*"` 通配符（`:50-53`，`*` 可以含斜杠，`utils/cn` 这种两段路径照样命中），配合 `packages/core/base/shared/tsdown.config.ts:16-22` 的 `entry: ['src/index.ts', 'src/*.ts', 'src/*/*.ts', 'src/*/index.ts', 'src/*/*/index.ts']`：**`src/` 下每个模块文件就是一个入口**，`@antdv/shared/utils/cn` → `dist/utils/cn.js`。多文件目录模块（`cache` / `color` / `constants` / `utils`，以及它们内部的 `utils/crypto` / `utils/event`）产出 `dist/<目录>/index.js`，通配符不会替它们补上 `index`，所以在那里逐个显式列出（`package.json:26-49`，注释见同文件 `:20`）。`platform: 'neutral'`（`tsdown.config.ts:24`）：产物给浏览器打包器消费，但 build 由 Node 上的 rolldown 执行，写 browser 会让部分 polyfill 判定介入。

`@antdv/hooks` 是同一套机制的第二个例子（`packages/core/hooks/package.json:21-35`，通配符 `:30-33`），独立列出的目录只有 `echarts`（`:26-29`）：它拖进整个图表库的全量注册表，放进根入口会让 `import { usePrint }` 也付出一份图表的解析成本（同文件 `:20` 的注释、`src/index.ts:7-11`）。文件名一律 kebab-case —— 子路径就是 `@antdv/hooks/use-print`，与 `@antdv/layouts` 的 hooks 目录同一套词汇。

`@antdv/request` / `@antdv/utils` / `@antdv/enums` 不发 dist，`exports` 直接指向 `.ts` 源文件，所以它们的"子路径"是源码目录的形状：`packages/request/package.json:19-25`（`./runtime`、`./sse`、`./websocket`）、`packages/utils/package.json:19-24`（`./menu`、`./theme-mode`）、`packages/enums/package.json:18-21`（只有根入口）。

```ts
import { cn } from '@antdv/shared/utils/cn'; // 单文件模块 → 子路径
import { cache } from '@antdv/shared/cache'; // 目录模块 → 显式列出
import { cache } from '@antdv/shared'; // 根 barrel 也可用（src/index.ts:12-16）
import { usePrint } from '@antdv/hooks/use-print'; // kebab-case 文件名
import { useEcharts } from '@antdv/hooks/echarts';
import { useWebSocket } from '@antdv/request/websocket';
import { menuKeyOf } from '@antdv/utils/menu';
```

::: warning

通配符入口只属于走 dist 的包 只有 `@antdv/shared` 与 `@antdv/hooks` 有 `"./*"`。给源码包加通配符会让 `import type` 的解析路径也跟着变宽，类型检查与打包器看到的不是同一张表。
:::

## `@antdv/shared` 清单

「单测」指 `packages/core/base/shared/__tests__/` 下有没有同名用例。消费者只给一个真实调用点，不代表全部。

| 模块（子路径） | 代表导出 | 消费者 | 单测 |
| --- | --- | --- | --- |
| `cache` | `cache`（`src/cache/index.ts:197`）、`createCache`（`:60`）、`buildStorageKey`（`:40`）、`encryptToken` / `decryptToken`（`src/cache/tokenCrypto.ts:77,106`） | `packages/stores/src/user.ts:7`、`apps/web/src/plugins/request-runtime.ts:3`、`packages/core/preferences/src/preferences.ts:11`（14 个文件） | 有 |
| `color` | `parseColor`（`src/color/convert.ts:32`）、`toRgbString` / `toHex`（`:41,46`）、`mixWithWhite`（`:55`） | `packages/layouts/src/widgets/setting-drawer/components/appearance-panel.vue:21`、`layout-panel.vue` | 有 |
| `constants` | `PREFERENCE_CSS_VARS`（`src/constants/css-vars.ts:37`）、`DARK_CLASS` / `COLOR_WEAK_CLASS` / `GRAY_MODE_CLASS`（`src/constants/dom-classes.ts:10,12,14`）、`DEFAULT_PRIMARY_COLOR` 与 `BORDER_RADIUS_BASE`（`src/constants/theme.ts:9,13`）、`THEME_PRESETS` / `themeKeyByColor`（`src/constants/theme-presets.ts:26,59`） | `packages/core/preferences/src/update-css-variables.ts`（写侧）、`packages/core/preferences/src/config.ts`、`apps/web/src/settings/theme/index.ts`（13 个文件） | 有 |
| `utils/cn` | `cn()`（`src/utils/cn.ts:6`） | 全仓 459 个文件，如 `packages/layouts/src/widgets/breadcrumb.vue` | 有 |
| `utils/crypto` | `encrypt` / `decrypt` / `encryptObject` / `decryptObject`（`src/utils/crypto/aes.ts:14,19,24,31`）、`md5` / `md5File` / `sha256` / `hash`（`src/utils/crypto/hash.ts:3,7,32,40`） | **无调用点** | 无 |
| `utils/csrf` | `config`（`src/utils/csrf.ts:67`）、`initCsrfProtection`（`:111`）、`getCsrfToken`（`:164`） | `packages/request/src/fetcher.ts:8`、`apps/web/src/utils/securityInit.ts:9` | 有 |
| `utils/dayjs` | `dayjs`（`src/utils/dayjs.ts:136`）、`setTimezone`（`:62`）、`nowTz`（`:116`） | `packages/stores/src/app.ts:8`、`packages/layouts/src/widgets/timezone/index.vue:12`、`apps/web/src/composables/useLocale.ts:4`（8 个文件） | 有 |
| `utils/domUtils` | `getBoundingClientRect`（`src/utils/domUtils.ts:14`）、`getViewportOffset`（`:89`）、`useRafThrottle`（`:187`） | **无调用点** | 有 |
| `utils/download` | `saveBlob`（`src/utils/download.ts:159`）、`downloadFile`（`:248`）、`downloadWithAuth`（`:416`）、`downloadMultiple`（`:552`） | **无调用点**（下载走 `@antdv/request` 的响应处理） | 无 |
| `utils/env` | `configureSharedEnv`（`src/utils/env.ts:32`）、`isEnvEnabled`（`:88`）、`getCachePrefix`（`:74`） | `apps/web/src/bootstrap/env.ts:1`、`apps/web/src/mock/activate.ts`、`apps/web/src/config/micro-app.ts`（8 个文件） | 有 |
| `utils/event` | `eventBus` / `createEventBus`（`src/utils/event/bus.ts:45,5`）、`addResizeListener`（`src/utils/event/resize.ts:71`）、`useResizeListener`（`:151`） | `apps/web/src/utils/ws.ts:6`、`packages/layouts/src/basic/layout.vue:11`（根 barrel） | 有 |
| `utils/excel` | `exportToExcel`（`src/utils/excel.ts:42`） | `apps/web/src/utils/excel.ts:4`（薄壳再包一层 toast） | 无 |
| `utils/file-category` | `getExt`（`src/utils/file-category.ts:15`）、`getFileCategory`（`:98`） | **无调用点** | 有 |
| `utils/iframe` | `buildIframeSandbox`（`src/utils/iframe.ts:95`）、`canEscapeSandbox`（`:129`）、`SANDBOX_FLAGS`（`:23`） | `apps/web/src/views/micro-app/SubAppView.vue:13`、`apps/web/src/views/system/micro-app/index.vue` | 有 |
| `utils/jwt` | `isTokenExpired`（`src/utils/jwt.ts:97`）；`parseJwt`（`:70`）、`isJwtFormat`（`:138`）、`getTokenRemainingSeconds`（`:121`） | `packages/request/src/fetcher.ts:9`（只用 `isTokenExpired`） | 有 |
| `utils/masking` | `maskPhone` / `maskEmail` / `maskIdCard`（`src/utils/masking.ts:22,30,40`）、`MASKING_RULES`（`:84`） | **无调用点** | 有 |
| `utils/scroll` | `computeOverflow`（`src/utils/scroll.ts:28`）、`useHorizontalScroll`（`:72`）、`pickHorizontalDelta`（`:47`） | `packages/core/ui-kit/menu-ui/src/BasicMenu.vue:10`、`tabs-ui/src/TabsBar.vue:17` | 有 |
| `utils/template` | `generateTemplate`（`src/utils/template.ts:30`） | `apps/web/src/components/business/ImportExport.vue:11` | 有 |
| `utils/xss` | `safeHtmlDirective`（`src/utils/xss.ts:446`）、`escapeDirective`（`:463`）、`escapeHtml`（`:179`） | `apps/web/src/directives/index.ts:17` → `main.ts:122,126`；`packages/core/hooks/src/use-print.ts:2`；`packages/core/ui-kit/common-ui/src/components/markdown-editor/MarkdownEditor.vue:24` | 有 |
| `store` | `src/store.ts:12` 整包转发 `@tanstack/vue-store` | 暂无调用点：共享状态的写法统一从这里取，不再各建 ref 单例 | 由 `__tests__/structure.test.ts` 覆盖 |

::: warning

两件事已经从 shared 搬走了 菜单树与 key 体系（`menuKeyOf`、`attachMenuPaths`、`MenuPathRouter`）现在在 `packages/utils/src/menu.ts:28,258,393`，同包的 `theme-mode.ts` 管主题模式解析与系统深色探测 —— 因为 `@antdv/shared` 不许依赖 `@antdv/types` 之外的菜单词汇表，而 `@antdv/utils` 只吃这两个包。`utils/welcome.ts`（登录欢迎提示）整个文件已经不存在，别按名字找。
:::

## `@antdv/hooks` 清单

这一层的用例（`packages/core/hooks/__tests__/`）比 shared 还全 —— 八个 hook 加 `echarts` 都有对应测试，另外还有一份 `boundary.test.ts` 守包边界。

| 导出 | 入口 | 消费者 | 单测 |
| --- | --- | --- | --- |
| `useChunkUpload` | `@antdv/hooks/use-chunk-upload`（`src/use-chunk-upload.ts:76`） | `apps/web/src/views/components/upload/index.vue` | 有 |
| `useFileReader` | `.../use-file-reader`（`src/use-file-reader.ts:3`） | `apps/web/src/components/common/AvatarUploader.vue` | 有 |
| `usePrint` | `.../use-print`（`src/use-print.ts:47`） | `apps/web/src/views/system/user/index.vue` 等 3 页 | 有 |
| `useRouteLoading` | `.../use-route-loading`（`src/use-route-loading.ts:24`） | `packages/layouts/src/basic/layout.vue` | 有 |
| `useWatermark` | `.../use-watermark`（`src/use-watermark.ts:48`） | `packages/layouts/src/basic/layout.vue` | 有 |
| `useCache` | `.../use-cache`（`src/use-cache.ts:41`） | **应用侧无调用点**（只有它自己的测试） | 有 |
| `useCRUD` | `.../use-crud`（`src/use-crud.ts:134`） | `apps/web/src/views/components/table/crud/index.vue:34` | 有 |
| `usePermission` | `.../use-permission`（`src/use-permission.ts:68`） | `apps/web/src/directives/index.ts:13`、`apps/web/src/plugins/table-runtime.ts:1` | 有 |
| `useEcharts` / `setupEcharts` / `theme` / `constants` | `@antdv/hooks/echarts`（`src/echarts/use-echarts.ts:91`、`setup.ts:39`） | **无调用点**：图表页走的是 `@antdv/common-ui/charts`（`packages/core/ui-kit/common-ui/src/components/charts/ECharts.vue`） | 有 |

SSE 与 WebSocket 不在这里。实时通信的代码统一收在 `@antdv/request`（`@antdv/request/sse` 的 `useSSE` 与三个管理器、`@antdv/request/websocket` 的 `useWebSocket` 与四个管理器），与 HTTP 共用一套重连语义 —— 依据见 `packages/core/hooks/src/index.ts:13-14`。

## 应用侧薄壳

| 文件 | 导出 | 状态 |
| --- | --- | --- |
| `apps/web/src/utils/ws.ts:340` | `useWebSocket`（薄壳）、`WS_EVENTS`（`:75`）、`noticeTypeConfig`（`:51`） | 在用：`packages/layouts` 的通知小部件靠 `plugins/layouts-host.ts:9` 注入进来 |
| `apps/web/src/utils/securityInit.ts:16` | `initSecuritySystem` | 在用（`main.ts:39,114`） |
| `apps/web/src/utils/excel.ts:10` | `exportToExcel` | 在用：把 `@antdv/shared/utils/excel` 的返回值接上 `@antdv/popup-ui` 的 toast |
| `apps/web/src/composables/index.ts:6` | `export * from '@antdv/request'` | 请求层在用（`api/request.ts`、`api/query.ts` 等）；`useCRUD`、`usePermission` 已迁进 `@antdv/hooks`，页面与指令都从包里引 |
| `apps/web/src/composables/useLocale.ts` | `useLocale` / `useLocaleSync` / `localeLabels` | 在用（`App.vue:9`、`plugins/layouts-host.ts:6`、`views/login/index.vue:34`） |
| `apps/web/src/composables/useNotice.ts` | `useNotice` | **无调用点** —— 通知逻辑已随小部件进 `packages/layouts`，靠 host 注入 |
| `apps/web/src/composables/usePasswordPolicy.ts` | `usePasswordPolicy` | **无调用点** |

`apps/web/src/utils/**` 与应用侧薄壳**没有单元测试**：`apps/web/src/` 下已经没有 `__tests__` 里的 utils 用例（逻辑搬进包后就有了对应用例：请求层在 `packages/request/__tests__/`，组合式函数在 `packages/core/hooks/__tests__/`）。这正是"包里有测试、应用薄壳没测试"的分工结果 —— 逻辑应该在包里。

::: warning

包里的组件不能反向 import 应用 通知、全局搜索这类小部件迁进 `packages/layouts` 以后，不能再直接 `import '~/api'` / `'~/utils/ws'`（包反向依赖应用就是循环）。所有"只有应用才知道的能力"从 `apps/web/src/plugins/layouts-host.ts` 一次性注入：`:9` 拿 ws 通道、`:6` 拿语言候选、`:5` 拿通知接口；`:17-19` 解释了为什么它单独一个文件而不并进 `ui-runtime.ts`（`test/setup.ts` 会调用后者，而 setup 比用例里的 `vi.mock` 先执行，摸过的模块之后 mock 不掉）。
:::

## 硬边界：包不许碰 pinia / 应用别名 / env

这三条不是风格偏好，`packages/request/__tests__/structure.spec.ts:40-52` 用文件级断言把门守住了：`src` 下除 `index.ts` 外，出现 `from 'pinia'`、`from '~/...'`、`import.meta.env.` 或 `antdv-next` 直接失败（同一份用例还钉住了 `:26-37` 的文件清单和 `:54-79` 的导出名单）。

| 约束 | 事实 | 例外 |
| --- | --- | --- |
| 不许 import `pinia` | 全仓 `packages/**/src` 里只有 `packages/stores/src/{app,route,tabs,user}.ts` 命中 —— 那个包的职责就是放 store | 只有 `@antdv/stores` |
| 不许用 `~/` 别名 | `packages/**/src` 只剩 `packages/core/hooks/src/use-chunk-upload.ts:32` 注释里的示例 | 无 |
| 不许读 `import.meta.env` | 包源码里的命中**全在注释里**（`packages/core/base/shared/src/cache/index.ts:29-30`、`packages/core/base/shared/src/utils/env.ts:4-8`、`packages/core/preferences/src/config.ts:10-12`、`packages/core/ui-kit/common-ui/src/components/error-boundary/ErrorBoundary.vue:31`）；env 由应用入口注入 | 无 |
| 尽量不依赖 `vue-router` 运行时 | 需要路由实例的地方集中在两处：`packages/core/hooks/src/use-route-loading.ts:2` 与 `packages/layouts/src/**`（布局本来就要路由）。其余包只拿类型，例如 `packages/utils/src/menu.ts:3` 的 `import type { RouteRecordRaw }` | layouts 与那条 hook |

## 靠依赖注入拿应用能力

| 需要的能力 | 包接收什么 | 应用在哪注入 |
| --- | --- | --- |
| 持久化介质 / 前缀 / 密钥 | `createPreferences({ cache, cacheKey, matchMedia })`（`packages/core/preferences/src/preferences.ts:27-35`） | 默认实例的介质走 `configureSharedEnv` 的注入（`apps/web/src/bootstrap/env.ts`） |
| 环境信息 | `configureSharedEnv({ cachePrefix, cacheEncryptKey, minioPublicUrl, production })`（`packages/core/base/shared/src/utils/env.ts:32-42`） | `apps/web/src/bootstrap/env.ts:1-7` |
| 凭证、登录页路径、登出清理 | `configureRequest(runtime)`（`packages/request/src/runtime.ts:43`，类型 `:20`） | `apps/web/src/plugins/request-runtime.ts:2,15` |
| 权限判定 | `createPermissionDirective({ checkers, onCheck, subscribe })`（`packages/directives/src/permission/index.ts:54`） | `apps/web/src/directives/index.ts:19` |
| 文件切片处理 | `useChunkUpload({ createWorker, workerUrl })`（`packages/core/hooks/src/use-chunk-upload.ts:35-38`） | 应用提供 `apps/web/src/components/common/Upload/upload.worker.ts` |
| 顶栏小部件的接口 / 推送 / 页面 | `configureLayoutHost({ ... })`（`packages/layouts`） | `apps/web/src/plugins/layouts-host.ts:24` |

`packages/core/base/shared/src/cache/memory.ts` 的 `MemoryCache` 是这套边界下的反面教材：入口里确实编得出来（`tsdown.config.ts` 的 `src/*/*.ts` 覆盖了它，`dist/cache/memory.js` 也在，`"./*"` 通配符能让 `@antdv/shared/cache/memory` 解析成功），但 `cache/index.ts` 不导出它，全仓也**零调用点** —— 纯死代码。别按名字以为自己是它的消费者，要内存介质用 `createStorage('memory')`（`src/cache/storage.ts:56,72`）。

## `cn()` 是类名拼接的唯一口径

```ts
// packages/core/base/shared/src/utils/cn.ts:1-8
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

全仓 `from '@antdv/shared/utils/cn'` 命中 **459 个文件**：`apps/web` 62 个，`packages` 397 个 —— 其中 `ui-kit/shadcn-ui` 314 个是 shadcn 生成的原子件，剩下 `common-ui` 36、`form-ui` 13、`layouts` 12、`table-ui` 7、`tabs-ui` 4、`popup-ui` 4、`menu-ui` 3、`layout-ui` 2、`icons` 与 `hooks` 各 1。仓库里没有第二份 `cn` 实现，也没有别的类名合并库。`@antdv/shared` 因此依赖 `clsx` + `tailwind-merge`（`packages/core/base/shared/package.json:62,70`）；`apps/web` 也各自直依赖这两个包（`apps/web/package.json:72,97`），但**不要**在应用里直接 `import { twMerge }` 组类名 —— 冲突消解规则只有一份才谈得上口径。

命名规范同 `CODE_STANDARD.md` 第 2 节：Tailwind 优先，复杂/动态类名走 `cn()`。

## 改了 `packages/*/src` 要不要重新构建

看这个包发的是 dist 还是源码：

| 形态 | 包 | 改了 src 之后 |
| --- | --- | --- |
| 走 dist（6 个） | `@antdv/shared`、`@antdv/types`、`@antdv/hooks`、`@antdv/preferences`、`@antdv/directives`、`@antdv/router` | 必须重新构建 |
| 按源码消费（15 个） | `@antdv/utils`、`@antdv/request`、`@antdv/enums`、`@antdv/stores`、`@antdv/layouts`、`@antdv/design`、`@antdv/icons` 与 ui-kit 那 8 个 | 保存即生效（`main` 指 `./src/index.ts`，本来就在 Vite 的构建图里） |

```bash
pnpm --filter @antdv/shared build      # 或 @antdv/hooks / @antdv/preferences …
# 然后重启 dev：pnpm dev:web 只跑 vite，不会顺带构建子包
```

`turbo` 的 `dev` / `build` 带 `dependsOn: ["^build"]`，所以 `pnpm dev`（走 `turbo-run`）与整仓 `build` 会先把上游包出 dist；但 `pnpm dev:web`（`package.json:25`）是 `pnpm --filter @antdv/web run dev`，**只起 vite**。包各自的 `dev` 脚本是 `tsdown --watch`（`packages/core/base/shared/package.json:10`、`packages/core/hooks/package.json:10`），想要边改边生效就单独把它挂着。

::: warning

症状是"改了没反应，也不报错" 表现：改 `packages/core/base/shared/src/**` → 保存 → 页面行为与类型都纹丝不动。原因是 Vite 的依赖缓存与 `optimizeDeps` 都指向 dist。先 `build` 再重启，别在应用侧绕开包自己抄一份实现。
:::

## 相关页面

- [基础概念](/guide/essentials/concepts) —— 分层与产物形态的完整理由
- [组合式函数](/guide/in-depth/composables) —— hooks 与 request 里每个组合式函数的签名
- [缓存](/guide/essentials/cache) —— `cache` 的实现细节与前缀规则
- [状态管理](/guide/essentials/stores) —— 哪些状态该持久化、登出清理出口
- [配置](/guide/essentials/config) —— `VITE_*` 与 `configureSharedEnv` 的注入链
- [本地开发](/guide/essentials/development) —— dev server 与子包 watch
- [单元测试](/guide/project/testing) —— 包内用例怎么跑
- [第三方依赖](/guide/essentials/external) —— 包清单与依赖对账
