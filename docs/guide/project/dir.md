# 目录说明

## 三层结构

```
apps/       可部署的东西：web（管理后台）、backend-mock（Nitro）
packages/   运行时子包：会被打进浏览器产物
internal/   构建期工具：只在 Node 里跑，不进产物
```

根目录另有三个不属于上面三层的成员：`docs`（本站点，`pnpm-workspace.yaml` 里单独列了一行）、`scripts`（`turbo-run` / `vsh` 两个自研 CLI）、`.changeset`（版本与 CHANGELOG 的来源）。

`pnpm-workspace.yaml:2-10` 的 glob 是 `internal/*`、`internal/lint-configs/*`、`packages/*`、`packages/core/*`、`packages/core/base/*`、`packages/core/ui-kit/*`、`apps/*`、`docs`、`scripts/*`。**新增包要落进这几个位置**，否则不会被识别为 workspace 成员 —— 新加一个根目录（比如 `tools/foo`）不会自动入伙，得往这九行里补一条；`packages/core/ui-kit/foo` 这种已经覆盖到的位置才不用改。

## 21 个运行时子包

原先的 `@antdv/ui` 已经拆光：图标进了 `packages/core/base/icons`，Loading 与 Scrollbar 连同公共展示件一起并进了 `packages/core/ui-kit/common-ui`；TanStack 化的封装层与 shadcn 原子件都在 `packages/core/ui-kit/` 下独立成包（8 个）。下表 21 行的"位置"列就是 `pnpm-workspace.yaml` 里那三层：

| 包 | 职责 | 边界（包内不许 import） |
| --- | --- | --- |
| `@antdv/types`（`core/base/typings`） | 共享类型契约：布局设置、菜单、标签页、Mock 信封 | 纯类型，无运行时代码 |
| `@antdv/shared`（`core/base/shared`） | 四个目录 + 一个出口：`cache` 缓存（含 SM4 加密）、`color` 色值换算、`constants` 跨层字面量（CSS 变量名 `css-vars.ts` / DOM class / 默认主色）、`utils` 一个文件一件工具（`cn`、日期、下载、Excel、脱敏、XSS、事件总线……），`store.ts` 只转发 `@tanstack/vue-store` | store / api |
| `@antdv/design`（`core/base/design`） | 两个二级目录：`token/`（default / dark 两套 shadcn 变量 + `@theme inline` 映射）与 `css/`（基础层、NProgress、无障碍、权限降级、滚动条兜底），由 Tailwind v4 入口 `src/index.css` 引齐 | 只写变量与 CSS，不含组件逻辑 |
| `@antdv/icons`（`core/base/icons`） | 只管图标：Iconify 包装、SVG 雪碧图图标、图标选择器（shadcn 实现），5 个 `@iconify-json/*` 集合声明在本包 `dependencies` | pinia / vue-router / 业务 store / 应用配置 / antdv-next |
| `@antdv/hooks`（`core/hooks`） | 组合式函数：`use-cache`、`use-chunk-upload`、`use-crud`、`use-file-reader`、`use-permission`、`use-print`、`use-route-loading`、`use-watermark` + `echarts/` 子入口 | store / api / 路由实例 |
| `@antdv/preferences`（`core/preferences`） | 偏好默认值（`src/config.ts`）、持久化、`applyPreferencesToDom()` 落 DOM（`src/update-css-variables.ts`）、启动主题快照（`src/boot-theme.ts`） | pinia / store；**不认识 antd，也不认识任何组件库** —— 偏好直接落成 `<html>` 上的 `--primary` / `--radius` / `--font-size` / `--filter`，没有"偏好 → `ThemeConfig`"这一层翻译（曾经承担这件事的 `apps/web/src/settings/theme/` 已随 antd 一起删除） |
| `@antdv/common-ui`（`core/ui-kit/common-ui`） | 公共展示件与外壳：`Loading` + `useLoading` / `createLoading`、自绘 `Scrollbar`（只有这一个组件，没有单独的 `Bar`）、`Alert`、`Badge`、`BorderBeam`、`Card`、`CountTo`、`CronEditor`、`Description(s)`、`Divider`、`Empty` / `EmptyState`、`ErrorBoundary`、`Image`、`Listy`、`MarkdownEditor`、`PageSkeleton` / `TableSkeleton`、`Popconfirm`、`Result`、`Segmented`、`Space`、`Statistic`、`StatusTag`、`Steps`、`Tabs` / `TabPane`、`Tag`、`Timeline`、`Toaster`、`Tooltip`、`Transfer`、`Tree`、`Upload`、登录页外壳 `AuthPageLayout` / `AuthFormPanel` / `AuthColorPresets`、`ConfigProvider`，全部由 `@antdv/shadcn-ui` 的原语组合出来 | 应用 store / api |
| `@antdv/shadcn-ui`（`core/ui-kit/shadcn-ui`） | shadcn-vue 原子件（Dialog / Popover / Select / Spinner…），上面几包的实现底座 | 业务逻辑 |
| `@antdv/form-ui`（`core/ui-kit/form-ui`） | `@tanstack/vue-form` 之上的 schema 表单：`BasicForm` / `useForm` / `componentMap` | 应用 store |
| `@antdv/table-ui`（`core/ui-kit/table-ui`） | `@tanstack/vue-table` 之上的 `BasicTable` / `useTable` + hooks | 应用 store |
| `@antdv/popup-ui`（`core/ui-kit/popup-ui`） | Modal / Drawer / confirm 封装与 `useModal` / `useDrawer` / `message`（vue-sonner 的桥） | 应用 store |
| `@antdv/tabs-ui`（`core/ui-kit/tabs-ui`） | 标签页：`TabList` / `TabItem` / `TabActions` / 右键菜单 | pinia / vue-router |
| `@antdv/menu-ui`（`core/ui-kit/menu-ui`） | 菜单树渲染与折叠动效 | pinia / vue-router |
| `@antdv/layout-ui`（`core/ui-kit/layout-ui`） | 7 种布局形态（`LayoutMode`：`packages/core/base/typings/src/app.ts:20-26`）的区域组件（侧栏、图标栏、顶栏…） | pinia / vue-router |
| `@antdv/layouts`（`packages/layouts`） | 7 种菜单形态的区域蓝图、内容区宽度策略、菜单树状态源（`src/hooks/use-menu-tree.ts`）、面包屑派生、顶栏小部件 | pinia / vue-router |
| `@antdv/router`（`packages/router`） | 路由守卫：登录校验、动态菜单注册、标题、进度条、权限过滤 | store / api |
| `@antdv/directives`（`packages/directives`） | `v-permission`、`v-lazy` | store / pinia / vueuse |
| `@antdv/stores`（`packages/stores`） | 4 个 setup store（`app` / `route` / `tabs` / `user`）+ `session.ts` 的会话作废登记处 | 只依赖 `@tanstack/vue-store` 之类的包，不 import 路由实例 |
| `@antdv/request`（`packages/request`） | `createFetch` 之上的请求层：Bearer / CSRF / 重试 / 401 刷新，外加 `sse/` 与 `websocket/` 两个管理器 | pinia / 应用 store |
| `@antdv/utils`（`packages/utils`） | 应用无关的纯函数：`menu.ts`（`attachMenuPaths` / `localizeMenus`）、`theme-mode.ts`（`resolveThemeMode`） | 任何有状态的依赖 |
| `@antdv/enums`（`packages/enums`） | 跨层枚举与字面量：`CacheKey`、字典相关 | 任何运行时依赖 |

::: tip

为什么每张表都多一列"不许 import" 这是这些包能被客户项目单独复用的唯一原因。凡是"要读用户权限 / 要拿菜单 / 要看偏好"的地方，一律通过**依赖注入**把函数或 ref 传进来，包自己不认识 pinia。于是包能保持纯 TS + Vue 组合式、能脱离应用做单测，也不会出现"store 引包、包又反过来引 store"的环。新增能力时先想清楚这条边界，再决定放应用里还是放子包里 —— 需要 store 的薄壳留在 `apps/web`。:::

## 依赖方向

```
internal/*  ──►  只在构建期被 apps/packages 用
apps/web    ──►  packages/*、packages/core/ui-kit/*（运行时）
packages/*  ──►  packages/*，且必须单向（types ← 其他所有包）
```

环由 `pnpm check:circular`（`vsh check-circular`，底层 `circular-dependency-scanner`）钉住 —— 注意这是**手动/本地**的门禁，`.github/workflows/` 里只有 `docs.yml` 一个 job，CI 并不跑它； `pnpm check:dep` 检查依赖声明规范，`pnpm publint` 检查包发布产物，`knip` 找未使用的依赖与导出。

## 版本从哪来：catalog

依赖版本统一写在 `pnpm-workspace.yaml` 的 `catalog:` 里，子包一律写 `"vue": "catalog:"`：

- 升级一个第三方库只改一处，不会出现"A 包 vue 3.5.40、B 包 3.5.43"这种类型打架；
- `vue` 是**精确锁定**的（`3.5.43`，不带 `^`）：留 caret 时部分第三方 peer 树会停在旧 3.5.x， `@vue/runtime-core` 出现两份类型，跨包传 `Directive` 直接冲突；
- 确有例外用 `catalogs.conflicts_vue_h3_5_43` 这样的分组目录；
- `overrides` 把 `@ast-grep/napi`、`@ctrl/tinycolor`、`clsx`、`pinia`、`vue` 强制收敛到 catalog 版本（`pnpm-workspace.yaml:298-303`）。

内部包之间用 `workspace:*`，装出来是软链，改完立刻生效 —— 但"生效"到哪一层取决于对面包是 dist 发布还是源码发布（见下）。

## 构建：tsdown + turbo（两类包不一样）

- **dist 发布的包**（运行时 6 个：`shared` / `types` / `hooks` / `preferences` / `router` / `directives`；构建期的 `node-utils` / `vite-config` 同理）：`build` 就是 `tsdown`（Rolldown 系），产物在 `dist/`，`files` 只带 `dist`；`exports` 支持**子路径即模块**：`@antdv/shared/utils/cn` → `dist/utils/cn.js`（`./*` 通配符），多文件目录模块（`cache` / `color` / `constants` / `utils` 与 `utils/crypto`、`utils/event`）显式列出。 `apps/web` 读的是这些包的 `dist`，所以改这 6 个包的 `src` 必须重新构建 + 重启 dev 才看得见。
- **源码发布的包**（运行时 15 个）：`ui-kit` 那八个、`design`、`icons`、`layouts`、`request`、`stores`、`utils`、`enums`。`files: ["src"]`、`main`/`types` 直指 `./src/index.ts`（`design` 是 `./src/index.css`），**没有 build 脚本**，由宿主 Vite 直接编译。改这类包保存即热更，不需要重新构建 —— 但也意味着宿主必须能编译 `.vue` 与 Tailwind 入口。口径见[外部模块](/guide/essentials/external)。
- `turbo.json` 的任务图：`build` / `type-check` / `test:unit` / `test:e2e` 全部 `dependsOn: ["^build"]`，即"先构建我的依赖"；`dev` 是 `persistent` 且不吃缓存，同样先 `^build`（没有 build 脚本的包这一步直接跳过）。

## 发布：changesets

```bash
pnpm changeset          # 声明本次改动影响哪些包、什么级别的版本
pnpm version            # 消耗 changeset，升各包版本号并写它们的 CHANGELOG.md，再 install 同步锁文件
pnpm exec changeset tag # 按各包当前版本打 <pkg>@<version> tag；git push 默认不带 tag，要 --follow-tags
pnpm release            # build + changeset publish（全套包 private，当前是空操作）
```

`.changeset/config.json` 里这几个字段决定了实际行为：

- `changelog: "@changesets/changelog-git"` —— 生成 CHANGELOG 时每条带 commit 短 SHA，不需要任何凭据。各包的 `CHANGELOG.md` 已经在 2026-10-23 的首次 `pnpm version` 里生成（34 份）；仓库根那个 `CHANGELOG.md` 仍是改造前 `standard-version` 留下的旧文件，changesets 不碰它。
- `fixed: [["@antdv/*", "@antdv/*"]]` —— **`@antdv/*` 锁步升版**：一次 `pnpm version` 里整套被抬到同一个号，落点取组内当前最高号叠加本轮最大 bump 级别。这是刻意的：内部包互相引用，版本分散会让"装哪几个版本能一起跑"变成谜题。首轮（0.1.0）之前各包是手工写死的、摊在五个号上（`0.0.0` / `0.1.0` / `0.4.0` / `0.5.0` / `5.8.0`），照原样跑会把整套推到 `5.9.0`，所以发版前先把全部成员归零到 `0.0.0`；现在 34 个包同号 `0.1.0`。**新建包一律从 `0.0.0` 出厂**，否则你写的号会替整套决定落点。
- `privatePackages: { version: true, tag: true }` —— 34 个 workspace 成员**全部** `private: true`（含 `@antdv/web` / `@antdv/backend-mock` / `@antdv/docs`），这个开关让它们也一起升版打 tag，虽然不会发布到 npm。
- `baseBranch: "main"`、`updateInternalDependencies: "patch"`、`linked: []`、`ignore: []`。

以前那套 `standard-version` 已随 monorepo 改造移除 —— 单个仓库版本号对多包不够用。

## 构建期工具（internal/）

| 包 | 作用 |
| --- | --- |
| `@antdv/vite-config` | `defineApplicationConfig()`：插件装配、别名、分包策略、env 解析、dev proxy（含 Nitro Mock 转发）、`__APP_INFO__` |
| `@antdv/node-utils` | Node 侧 fs / path / git / hash / workspace 解析与终端日志 |
| `@antdv/tsconfig` | 共享 TS 配置，子包 `extends` |
| `@antdv/eslint-config`、`oxlint-config`、`oxfmt-config`、`stylelint-config`、`commitlint-config` | 规范即包，根配置只做组装 |

应用侧因此只剩真正"这个项目独有"的部分：

```ts
// apps/web/vite.config.ts
import { defineApplicationConfig } from '@antdv/vite-config';

export default defineApplicationConfig({
  base: './',
});
```

`base: './'` + hash 路由 = 产物可以放在任意子路径下直接打开，这也是它能原样丢进 Vercel / nginx / 静态托管的原因。
