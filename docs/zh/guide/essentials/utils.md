# 工具

工具的分工只有一条判据：**换一个项目还能不能用**。能 → 放 `packages/`；需要 store、路由实例或应用内组件类型才能工作 → 留在 `apps/web/src/` 做薄壳。找现成实现也是这个顺序：先在 `@antdv/shared` 里搜，再在 `@antdv/composables` 里搜，最后才在应用目录里新建。

## 三层各放什么

| 层 | 位置 | 内容 | 为什么在这层 |
| --- | --- | --- | --- |
| 纯工具 | `packages/shared/src/**` | 缓存、加密、日期、下载、Excel、脱敏、XSS、CSRF、事件总线、菜单辅助 | 无框架状态，纯函数或自建单例 |
| 组合式 | `packages/composables/src/**` | 分片上传、打印、水印、ECharts、SSE、WebSocket、响应式缓存、路由 Loading、文件读取 | 只用 Vue 响应式 API，不碰 pinia / 业务 store |
| 应用薄壳 | `apps/web/src/utils/**`、`apps/web/src/composables/**` | 需要 store / api / 应用内类型的接线 | 例 `utils/dict.ts:2`（读字典 store）、`utils/ws.ts:8`（拿 user store 的 token）、`utils/routePreload.ts:19,66`（`useRouter`） |

::: tip 自动导入不负责本仓库的包 `internal/vite-config/src/plugins/auto-import.ts` 只注入框架 API。`import { cn } from '@antdv/shared/utils/cn'` 这类写法必须自己写（同 [基础概念](/zh/guide/essentials/concepts)）。:::

## 子路径即模块

`packages/core/base/shared/package.json:21-55` 的 `exports` 用了 `"./*"` 通配符（`*` 可以含斜杠，`utils/cn` 这种两段路径照样命中），配合 `packages/core/base/shared/tsdown.config.ts:16-22` 的 `entry: ['src/index.ts', 'src/*.ts', 'src/*/*.ts', 'src/*/index.ts', 'src/*/*/index.ts']`：**`src/` 下每个模块文件就是一个入口**，`@antdv/shared/utils/cn` → `dist/utils/cn.js`。多文件目录模块（`cache` / `color` / `constants` / `utils`，以及它们内部的 `utils/crypto` / `utils/event`）产出 `dist/<目录>/index.js`，通配符不会替它们补上 `index`，所以在那里逐个显式列出（`package.json:26-49`，注释见同文件 `:20`）。

`@antdv/composables` 同一套机制，独立列出的目录是 `echarts` / `sse` / `websocket` （`packages/composables/package.json:26-37`）：重型依赖（echarts 全量注册表、`watermark-plus`）刻意留在独立入口，不让 `import { usePrint }` 也付出一份图表的解析成本（同文件 `:20` 的注释、`src/index.ts:2-12`）。

```ts
import { cn } from '@antdv/shared/utils/cn'; // 单文件模块 → 子路径
import { cache } from '@antdv/shared/cache'; // 目录模块 → 显式列出
import { cache } from '@antdv/shared'; // 根 barrel 也可用（src/index.ts:11-15 显式 export *）
import { useWebSocket } from '@antdv/composables/websocket';
```

## `@antdv/shared` 清单

「单测」指 `packages/core/base/shared/__tests__/` 下有没有同名用例。消费者给一个真实调用点即可，不代表全部。

| 模块（子路径） | 代表导出 | 消费者 | 单测 |
| --- | --- | --- | --- |
| `cache` | `cache`（`src/cache/index.ts:196`）、`createCache`（`:60`）、`buildStorageKey`（`:40`）、`encryptToken` / `decryptToken`（`src/cache/tokenCrypto.ts:77,106`） | `stores/modules/user.ts:5` | 有 |
| `cn` | `cn()`（`src/utils/cn.ts:6`） | 全仓 460 个文件，如 `packages/ui-kit/layout-ui/src/components/LayoutBreadcrumb.vue:14` | 有 |
| `color` | `parseColor`（`src/color/convert.ts:23`）、`toRgbString` / `toHex`（`:45,50`）、`mixWithWhite`（`:60`） | `layouts/components/SettingDrawer/components/AppearancePanel.vue:22`、`LayoutPanel.vue:32` | 有 |
| `constants` | `PREFERENCE_CSS_VARS`（`src/constants/css-vars.ts:36`）、`DARK_CLASS` / `COLOR_WEAK_CLASS` / `GRAY_MODE_CLASS`（`src/constants/dom-classes.ts:10,12,14`）、`DEFAULT_PRIMARY_COLOR` 与 `BORDER_RADIUS_BASE`（`src/constants/theme.ts:9,13`）、`THEME_PRESETS` / `themeKeyByColor`（`src/constants/theme-presets.ts:26,63`） | `packages/utils/src/css-vars.ts:3`（写侧）、`packages/core/preferences/src/defaults.ts:3` | 有 |
| `crypto` | `encrypt` / `decrypt` / `encryptObject` / `decryptObject`（`src/utils/crypto/aes.ts:14,19,24,31`）、`md5` / `md5File` / `sha256` / `hash`（`src/utils/crypto/hash.ts:3,7,32,40`） | **无调用点** | 无 |
| `csrf` | `config`（`src/utils/csrf.ts:67`）、`initCsrfProtection`（`:111`）、`getCsrfToken`（`:164`） | `packages/request/src/fetcher.ts:4-8`、`utils/securityInit.ts:9` | 有 |
| `dayjs` | `dayjs`（`src/utils/dayjs.ts:136`）、`setTimezone`（`:62`）、`nowTz`（`:116`） | `stores/modules/app.ts:7,130`、`layouts/widgets/WidgetTimezone.vue:8`、`composables/web/useLocale.ts:4` | 有 |
| `domUtils` | `getBoundingClientRect`（`src/utils/domUtils.ts:14`）、`getViewportOffset`（`:89`）、`useRafThrottle`（`:187`） | **无调用点** | 有 |
| `download` | `saveBlob`（`src/utils/download.ts:159`）、`downloadFile`（`:248`）、`downloadWithAuth`（`:416`）、`downloadMultiple`（`:552`） | **无调用点** | 无 |
| `env` | `configureSharedEnv`（`src/utils/env.ts:32`）、`isEnvEnabled`（`:86`）、`getCachePrefix`（`:72`） | `bootstrap/env.ts:1`、`mock/activate.ts:1`、`config/micro-app.ts:3` | 有 |
| `event` | `eventBus` / `createEventBus`（`src/utils/event/bus.ts:45,5`）、`addResizeListener`（`src/utils/event/resize.ts:71`）、`useResizeListener`（`:151`） | `utils/ws.ts:4,118`、`layouts/components/LayoutHeader.vue:8` | 有（bus + `triggerWindowResize`） |
| `excel` | `exportToExcel`（`src/utils/excel.ts:40`） | `views/system/role/index.vue:8` 等 5 个列表页 | 无 |
| `file-category` | `getExt`（`src/utils/file-category.ts:15`）、`getFileCategory`（`:98`） | **无调用点** | 有 |
| `iframe` | `buildIframeSandbox`（`src/utils/iframe.ts:95`）、`canEscapeSandbox`（`:131`）、`SANDBOX_FLAGS`（`:23`） | `views/micro-app/SubAppView.vue:8` | 有 |
| `jwt` | `isTokenExpired`（`src/utils/jwt.ts:97`）；`parseJwt`（`:70`）、`isJwtFormat`（`:138`）、`getTokenRemainingSeconds`（`:121`） | `packages/request/src/fetcher.ts:9,214`（只用 `isTokenExpired`） | 有 |
| `masking` | `maskPhone` / `maskEmail` / `maskIdCard`（`src/utils/masking.ts:22,30,40`）、`MASKING_RULES`（`:84`） | **无调用点** | 有 |
| `menu` | `menuKeyOf`（`src/utils/menu.ts:32`）、`attachMenuPaths`（`:258`）、`buildMenuItems`（`:561`）、`MenuPathRouter`（`:393`） | `stores/modules/route.ts:1-15`、`layouts/composables/useSidebarMenu.ts:10`、`packages/layouts/src/menu-source.ts:18` | 有 |
| `scroll` | `computeOverflow`（`src/utils/scroll.ts:28`）、`useHorizontalScroll`（`:72`）、`pickHorizontalDelta`（`:47`） | `packages/core/ui-kit/menu-ui/src/BasicMenu.vue`、`tabs-ui/src/TabsBar.vue` | 有 |
| `store` | `useStore` / `useAtom` / `useSelector`（`src/store.ts:12`，整包转发 `@tanstack/vue-store`） | 暂无调用点：共享状态的写法统一从这里取，不再各建 ref 单例 | 由 `__tests__/structure.test.ts` 覆盖 |
| `template` | `generateTemplate`（`src/utils/template.ts:30`） | `components/business/ImportExport.vue:7,194` | 有 |
| `welcome` | `showLoginWelcome`（`src/utils/welcome.ts:114`）、`getPersonalizedWelcome`（`:66`） | **无调用点** | 有 |
| `xss` | `safeHtmlDirective`（`src/utils/xss.ts:437`）、`escapeDirective`（`:454`）、`escapeHtml`（`:173`） | `directives/index.ts:17` → `main.ts:103,107`；`escapeHtml` 被 `packages/core/composables/src/usePrint.ts:2` | 有 |

## `@antdv/composables` 清单

这一层的用例（`packages/composables/__tests__/`）比 shared 还全 —— 九个入口都有对应测试。

| 导出 | 入口 | 消费者 | 单测 |
| --- | --- | --- | --- |
| `useChunkUpload` | `@antdv/composables/useChunkUpload`（`src/useChunkUpload.ts:76`） | `views/components/upload/index.vue:7,356` | 有 |
| `useFileReader` | `.../useFileReader`（`src/useFileReader.ts:3`） | `components/common/AvatarUploader.vue:6` | 有 |
| `usePrint` | `.../usePrint`（`src/usePrint.ts:47`） | `views/system/user/index.vue:7,344` 等 3 页 | 有 |
| `useRouteLoading` | `.../useRouteLoading`（`src/useRouteLoading.ts:24`） | `layouts/index.vue:8,164` | 有 |
| `useWatermark` | `.../useWatermark`（`src/useWatermark.ts:48`） | `layouts/index.vue:9,169` | 有 |
| `useCache` | `.../useCache`（`src/useCache.ts:41`） | **应用侧无调用点**（只有它自己的测试） | 有 |
| `useEcharts` / `setupEcharts` / `theme` / `constants` | `@antdv/composables/echarts`（`src/echarts/useEcharts.ts:91`、`setup.ts:39`） | **无调用点**，页面仍直接 `import * as echarts from 'echarts'`（`components/common/ECharts/index.vue:4`） | 有 |
| `useSSE` + 三个管理器 | `@antdv/composables/sse`（`src/sse/useSSE.ts:23`） | **无调用点**（`apps/web/src/composables/web/sse/` 是个空目录） | 有 |
| `useWebSocket` + `EventManager` / `HeartbeatManager` / `ReconnectManager` / `WebSocketStateManager` | `@antdv/composables/websocket`（`src/websocket/useWebSocket.ts:44`） | `apps/web/src/utils/ws.ts:3`（薄壳再导出 `useWebSocket`） | 有 |

::: warning 空目录不是"还没写"，是"搬走了" `apps/web/src/composables/web/sse/` 与 `apps/web/src/composables/web/websocket/` 已经空了 —— 实现迁到了 `packages/composables`。应用侧保留的是需要 store 的那一层（`utils/ws.ts` 里拼通知、发 `eventBus`、拿 token）。在里面新建文件之前，先确认这个能力是不是已经在包里。:::

## 应用侧薄壳

| 文件 | 导出 | 状态 |
| --- | --- | --- |
| `apps/web/src/utils/dict.ts:7,18` | `getDictLabel` / `getDictLabels` | 在用（`components/business/Description/Description.vue:19`） |
| `apps/web/src/utils/ws.ts:338` | `useWebSocket`、`WS_EVENTS`（`:76`）、`noticeTypeConfig`（`:52`） | 在用（`composables/useNotice.ts:11`、`layouts/widgets/WidgetNotice.vue:15`） |
| `apps/web/src/utils/securityInit.ts:16` | `initSecuritySystem` | 在用（`main.ts:35,95`） |
| `apps/web/src/utils/crud-actions.ts:15` | `createCrudActions` | **无调用点** |
| `apps/web/src/utils/routePreload.ts:38,110,130` | `preloadRoute` / `preloadRoutes` / `useRoutePreloader` | **无调用点**（只被 `utils/index.ts:3` re-export） |
| `apps/web/src/composables/index.ts:6` | 只剩 `@antdv/request` 整包（`http` / `request` / `ExecuteOptions`） | 请求层在用（`api/request.ts:3`、`api/query.ts:10`、`components/common/AvatarUploader.vue:13` 等 6 处）；`useCRUD`、`usePermission` 已迁进 `@antdv/hooks`，页面与指令都从包里引（`views/components/table/crud/index.vue:34`、`directives/index.ts:13`）；stores 不绕这层，直接 `import { http } from '@antdv/request'`（`packages/stores/src/user.ts:6`、`route.ts:8`） |
| `apps/web/src/composables/useNotice.ts:62` | `useNotice` | **无调用点** |
| `apps/web/src/composables/usePasswordPolicy.ts:24` | `usePasswordPolicy` | **无调用点** |

`utils/**` 与应用侧薄壳**没有单元测试**：`apps/web/src/` 下的 `__tests__` 目录里没有 utils（逻辑搬进包后就有了对应用例：请求层在 `packages/request/__tests__/`，通用组合式函数在 `packages/core/hooks/__tests__/`，`useCRUD`、`usePermission` 各一份）。这正是"包里有测试、应用薄壳没测试"的分工结果 —— 逻辑应该在包里。

## 硬边界：包不许碰 pinia / store / env

这三条是仓库的边界，不是风格偏好，验证方式很便宜：

| 约束 | 事实 | 例外 |
| --- | --- | --- |
| 不许 import `pinia` | `packages/*/src` 里 `from 'pinia'` **零命中** | 无 |
| 不许 import 应用 store / 用 `~/` 别名 | `packages/*/src` 里 `from '~/...'` 零命中（只剩 `useChunkUpload.ts:32` 注释里的示例） | 无 |
| 不许读 `import.meta.env` | 包源码里**没有一处运行时**读它（只有注释提到）；env 由应用入口注入（`packages/shared/src/utils/env.ts:1-10`、`apps/web/src/bootstrap/env.ts:1-7`） | 无 |
| 尽量不依赖 `vue-router` 运行时 | 全仓包源码只有一处运行时 import：`packages/composables/src/useRouteLoading.ts:2`（`useRouter`，本来就要路由实例）；其余全是类型（如 `packages/shared/src/utils/menu.ts:4` 的 `import type { RouteRecordRaw }`） | 就是那一处 |

需要应用状态时靠**依赖注入**传进来，所以这些包能被别的项目单点复用、能脱离应用做单测：

| 需要的能力 | 包接收什么 | 应用在哪注入 |
| --- | --- | --- |
| 持久化介质 / 前缀 / 密钥 | `createPreferences({ cache, cacheKey, expire })`（`packages/preferences/src/store.ts:26-31`） | 默认实例走 `configureSharedEnv` 的注入（`apps/web/src/bootstrap/env.ts`） |
| 环境信息 | `configureSharedEnv({ cachePrefix, cacheEncryptKey, minioPublicUrl, production })`（`packages/shared/src/utils/env.ts:32-42`） | `apps/web/src/bootstrap/env.ts:2-7` |
| 权限判定 | `createPermissionDirective({ checkers, onCheck, subscribe })` | `apps/web/src/directives/index.ts:19` |
| 文件切片处理 | `useChunkUpload({ createWorker, workerUrl })`（`packages/composables/src/useChunkUpload.ts:35-37`） | 应用提供 `upload.worker` |

`packages/shared/src/cache/memory.ts` 的 `MemoryCache` 类是这套边界的反面教材：它既没被 `cache/index.ts` 导出，也不在 tsdown 的入口里（entry 只到 `src/*/index.ts`），**外部拿不到** —— 纯死代码，别按名字以为自己能 import 它。

## `cn()` 是类名拼接的唯一口径

```ts
// packages/shared/src/utils/cn.ts:1-8
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

全仓 `from '@antdv/shared/utils/cn'` 命中 **460 个文件**（`apps/web` 82 个，`packages` 378 个 —— 其中 `ui-kit/shadcn-ui` 314 个是 shadcn 生成的原子件，剩下 `common-ui` 28、`form-ui` 14、`table-ui` 7、`popup-ui` 4、`tabs-ui` 4、`menu-ui` 3、`layout-ui` 2、`icons`、`composables` 各 1），仓库里没有第二份 `cn` 实现，也没有别的类名合并库。`@antdv/shared` 因此依赖 `clsx` + `tailwind-merge` （`packages/core/base/shared/package.json:62,70`）；`apps/web` 也各自直依赖这两个包（`apps/web/package.json:85,110`），但**不要**在应用里直接 `import { twMerge }` 组类名 —— 冲突消解规则只有一份才谈得上口径。

命名规范同 `CODE_STANDARD.md` 第 2 节：Tailwind 优先，复杂/动态类名走 `cn()`。

## 改了 `packages/*/src` 必须重新构建

`apps/web` 读的是子包 `dist`（`packages/shared/package.json:17` 的 `main`，以及 `exports` 全表指向 `./dist/*`）， `src` 不在 Vite 的构建图里。所以：

```bash
pnpm --filter @antdv/shared build      # 或 @antdv/composables
# 然后重启 dev：pnpm dev:web 只跑 vite，不会顺带构建子包
```

`turbo` 的 `dev` / `build` 带 `dependsOn: ["^build"]`，所以 `pnpm dev`（走 `turbo-run`）与整仓 `build` 会先把上游包出 dist；但 `pnpm dev:web`（`package.json:25`）是 `pnpm --filter @antdv/web run dev`，**只起 vite**。包各自的 `dev` 脚本是 `tsdown --watch`（`packages/shared/package.json:10`），想要边改边生效就单独把它挂着。

::: warning 症状是"改了没反应，也不报错" 表现：改 `packages/shared/src/**` → 保存 → 页面行为与类型都纹丝不动。原因是 Vite 的依赖缓存与 `optimizeDeps` 都指向 dist。先 `build` 再重启，别在应用侧绕开包自己抄一份实现。:::

## 相关页面

- [基础概念](/zh/guide/essentials/concepts) —— 分层与产物形态的完整理由
- [缓存](/zh/guide/essentials/cache) —— `cache` 的实现细节与前缀规则
- [状态管理](/zh/guide/essentials/stores) —— 哪些状态该持久化、登出清理出口
- [配置](/zh/guide/essentials/config) —— `VITE_*` 与 `configureSharedEnv` 的注入链
- [本地开发](/zh/guide/essentials/development) —— dev server 与子包 watch
- [单元测试](/zh/guide/project/testing) —— 包内用例怎么跑
