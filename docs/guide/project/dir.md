# 目录说明

## 三层结构

```
apps/       可部署的东西：web（管理后台）、backend-mock（Nitro）、docs（本站点）
packages/   运行时子包：会被打进浏览器产物
internal/   构建期工具：只在 Node 里跑，不进产物
```

`pnpm-workspace.yaml` 的 glob 是 `internal/*`、`internal/lint-configs/*`、`packages/*`、`packages/ui-kit/*`、`apps/*`、`docs`、`scripts/*`。 **新增包要落在这几个目录里**，否则不会被识别为 workspace 成员（`docs/` 这种根目录就不会，`packages/ui-kit/foo` 在加进 glob 之前也不会）。

## 18 个运行时子包

原先的 `@antdv/ui` 一拆为三（`icons` / `loading-ui` / `scrollbar-ui`），TanStack 化的封装层与 shadcn 原子件都在 `packages/ui-kit/` 下独立成包：

| 包 | 职责 | 边界（包内不许 import） |
| --- | --- | --- |
| `@antdv/types` | 共享类型契约：布局设置、菜单、标签页、Mock 信封 | 纯类型，无运行时代码 |
| `@antdv/shared` | 缓存、加密、日期、下载、Excel、脱敏、XSS、事件总线、菜单辅助、`cn()` | store / api |
| `@antdv/preferences` | 偏好默认值、持久化、CSS 变量落地、antdv-next 主题配置 | pinia / store |
| `@antdv/composables` | 组合式函数：分片上传、打印、水印、ECharts、SSE、WebSocket… | store / api / 路由实例 |
| `@antdv/icons` | 只管图标：Iconify 包装、SVG 雪碧图图标、图标选择器（shadcn 实现） | pinia / vue-router / 业务 store / 应用配置 / antdv-next |
| `@antdv/loading-ui` | `Loading` 遮罩 + `useLoading` + `createLoading` 系列 + `v-loading` 指令 | 同上（依赖只到 `shadcn-ui` / `shared`） |
| `@antdv/scrollbar-ui` | 自绘 `Scrollbar` + `Bar`，样式随组件走，不依赖宿主 Tailwind | 同上 |
| `@antdv/shadcn-ui` | shadcn-vue 原子件（Dialog / Popover / Select / Spinner…），上面几包的实现底座 | 业务逻辑 |
| `@antdv/form-ui` | `@tanstack/vue-form` 之上的 schema 表单：`BasicForm` / `useForm` / `componentMap` | 应用 store |
| `@antdv/table-ui` | `@tanstack/vue-table` 之上的 `BasicTable` / `useTable` + hooks | 应用 store |
| `@antdv/popup-ui` | Dialog / Drawer / AlertDialog 封装与 `useModal` / `useDrawer` | 应用 store |
| `@antdv/tabs-ui` | 标签页：`TabList` / `TabItem` / `TabActions` / 右键菜单 + 布局壳 | pinia / vue-router |
| `@antdv/menu-ui` | 菜单树渲染与折叠状态 | pinia / vue-router |
| `@antdv/layout-ui` | 7 种布局形态的区域组件（侧栏、图标栏、顶栏…） | pinia / vue-router |
| `@antdv/layouts` | 7 种菜单形态的区域蓝图、内容区宽度策略、菜单树状态源、面包屑派生 | pinia / vue-router |
| `@antdv/router` | 路由守卫：登录校验、动态菜单注册、标题、进度条、权限过滤 | store / api |
| `@antdv/directives` | `v-permission`、`v-lazy` | store / pinia / vueuse |
| `@antdv/styles` | Tailwind v4 入口、基础层、NProgress、无障碍与权限降级样式 | 只写 CSS，不含组件逻辑 |

::: tip 为什么每张表都多一列"不许 import" 这是这些包能被客户项目单独复用的唯一原因。凡是"要读用户权限 / 要拿菜单 / 要看偏好"的地方，一律通过**依赖注入**把函数或 ref 传进来，包自己不认识 pinia。于是包能保持纯 TS + Vue 组合式、能脱离应用做单测，也不会出现"store 引包、包又反过来引 store"的环。新增能力时先想清楚这条边界，再决定放应用里还是放子包里 —— 需要 store 的薄壳留在 `apps/web`。:::

## 依赖方向

```
internal/*  ──►  只在构建期被 apps/packages 用
apps/web    ──►  packages/*、packages/ui-kit/*（运行时）
packages/*  ──►  packages/*，且必须单向（types ← 其他所有包）
```

环由 CI 里的 `pnpm check:circular`（`vsh check-circular`，底层 `circular-dependency-scanner`）钉住； `pnpm check:dep` 检查依赖声明规范，`pnpm publint` 检查包发布产物，`knip` 找未使用的依赖与导出。

## 版本从哪来：catalog

依赖版本统一写在 `pnpm-workspace.yaml` 的 `catalog:` 里，子包一律写 `"vue": "catalog:"`：

- 升级一个第三方库只改一处，不会出现"A 包 vue 3.5.40、B 包 3.5.43"这种类型打架；
- `vue` 是**精确锁定**的（`3.5.43`，不带 `^`）：留 caret 时部分第三方 peer 树会停在旧 3.5.x， `@vue/runtime-core` 出现两份类型，跨包传 `Directive` 直接冲突；
- 确有例外用 `catalogs.conflicts_vue_h3_5_43` 这样的分组目录；
- `overrides` 把 `@ctrl/tinycolor`、`clsx`、`pinia`、`vue` 强制收敛到 catalog 版本。

内部包之间用 `workspace:*`，装出来是软链，改完立刻生效 —— 但"生效"到哪一层取决于对面包是 dist 发布还是源码发布（见下）。

## 构建：tsdown + turbo（两类包不一样）

- **dist 发布的包**（`shared` / `composables` / `directives` / `layouts` / `preferences` / `router` / `types` / `node-utils` / `vite-config`）：`build` 就是 `tsdown`（Rolldown 系），产物在 `dist/`，`files` 只带 `dist`；`exports` 支持**子路径即模块**：`@antdv/shared/cn` → `dist/cn.js`（`./*` 通配符），多文件目录模块（`cache` / `crypto` / `event`）显式列出。 `apps/web` 读的是这些包的 `dist`，所以改 `packages/*/src` 必须重新构建 + 重启 dev 才看得见。
- **源码发布的包**（`icons` / `styles` / `ui-kit` 那九个）：`files: ["src"]`、`main`/`types` 直指 `./src/index.ts`，**没有 build 脚本**，由宿主 Vite 直接编译。改这类包保存即热更，不需要重新构建 —— 但也意味着宿主必须能编译 `.vue` 与 Tailwind 入口。口径见[外部模块](/guide/essentials/external)。
- `turbo.json` 的任务图：`build` / `type-check` / `test:unit` / `test:e2e` 全部 `dependsOn: ["^build"]`，即"先构建我的依赖"；`dev` 是 `persistent` 且不吃缓存，同样先 `^build`（没有 build 脚本的包这一步直接跳过）。

## 发布：changesets

```bash
pnpm changeset          # 声明本次改动影响哪些包、什么级别的版本
pnpm version            # 消耗 changeset，升版本号并写 CHANGELOG.md，再 install 同步锁文件
pnpm release            # build + changeset publish
```

`.changeset/config.json` 里三个字段决定了实际行为：

- `changelog: @changesets/changelog-github` + `repo` —— CHANGELOG 每条带 PR 链接；
- `fixed: [["@antdv/*", "@antdv/*"]]` —— **所有 `@antdv/*` 锁步升版**，任一包 patch 会带着大家一起走同一版本号（所以现在每个包都是 `0.4.0`）。这是刻意的：内部包互相引用，版本分散会让 "装哪几个版本能一起跑"变成谜题；
- `privatePackages: { version: true, tag: true }` —— `private: true` 的 `@antdv/web` / `docs` / `backend-mock` 也一起升版打 tag，虽然不发布到 npm。

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
