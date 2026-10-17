# 基础概念

这篇讲"代码为什么这么摆"。四个问题：东西放在哪一层、这一层能 import 什么、改完怎么生效、名字和路径有什么约定。答案基本都写在 `CODE_STANDARD.md` 和 `README.md` 的"关键约束"里，这里把它们和实际代码对上。

## 四层结构

```
apps/web/          @antdv/web —— 管理后台本体，唯一会被浏览器执行的入口
apps/backend-mock/ Nitro mock，dev 期在进程内拉起，接口与菜单种子数据都在这
docs/              VitePress 站点（@antdv/docs），与 apps 齐平，不参与应用构建
packages/          21 个运行时子包：会被打进浏览器产物
internal/          构建期工具：只在 Node 里跑，不进产物（vite-config / lint-configs / tsconfig / node-utils）
scripts/           仓库任务（vsh、turbo-run、clean、deploy）
```

划分标准不是"看起来像不像库"，而是**产物给谁消费**：`internal/vite-config` 的产物是 `defineApplicationConfig()`，只在 `apps/web/vite.config.ts` 里被调用一次；`packages/core/base/shared` 的产物是给 Vite 直接消费的 ESM。于是 `turbo.json` 里 `dev` / `build` 都带 `dependsOn: ["^build"]` ——上游包先出 dist，下游才构建。

## 子包有两种发布形态，改完生效方式不同

| 形态 | 包 | `main` 指向 | 改完 src 之后 |
| --- | --- | --- | --- |
| dist 发布 | `@antdv/shared`、`composables`、`directives`、`preferences`、`router`、`types` | `./dist/index.js`（tsdown 产物） | 必须 `pnpm --filter @antdv/shared build`，再重启 dev |
| 源码发布 | `@antdv/icons`、`@antdv/design`、`@antdv/ui-kit` 那八个（`common-ui` / `shadcn-ui` / `form-ui` / `table-ui` / `popup-ui` / `layout-ui` / `menu-ui` / `tabs-ui`），加上 `layouts` / `stores` / `enums` / `utils` / `request` | `./src/index.ts`（`design` 是 `./src/index.css`） | 直接热更新，没有构建步骤 |

依据：`packages/**/package.json` 的 `main` 字段（底座在 `packages/core/base/`、UI 层在 `packages/core/ui-kit/`），以及 `packages/core/base/shared/tsdown.config.ts` （`entry: ['src/index.ts', 'src/*.ts', 'src/*/index.ts']`）。dist 发布的那几个包没有 build 脚本就永远出新产物，`dev` 脚本是 `tsdown --watch`。

::: warning 改了 dist 发布包却没生效这是本仓库最常见的"我明明改了"。Vite 的依赖缓存和 `optimizeDeps` 都指向 dist， `src` 不在构建图里。表现是改代码、保存、页面毫无变化，且不报错。:::

源码发布是有代价的：这些包没有 build 脚本（`packages/core/base/icons/package.json` 只有 `clean` / `test:unit` / `type-check`），组件里的 `<script setup>` 由应用的 `@vitejs/plugin-vue` 编译，所以它们**不能**被脱离 Vite 的消费者直接用。

## 子包的边界：不碰 store、不碰 env

`packages/*` 里不许 import `pinia`、应用 store，也不许读 `import.meta.env`。这不是洁癖，有两个具体原因：

1. **包的产物在 dist 里，Vite 的 env 静态替换够不到它**。包里读 `import.meta.env` 会拿到 `undefined`，行为静默退化。所以环境变量由应用在入口注入： `apps/web/src/bootstrap/env.ts` 调 `configureSharedEnv({ cachePrefix, cacheEncryptKey, ... })`， `packages/core/base/shared/src/utils/env.ts` 保存这份显式配置；偏好的项目默认值同理，由 `apps/web/src/settings/index.ts` 传进 `createPreferences({ defaults })`。
2. **单测要能切分支**。`shouldEncrypt()` 这类"生产才加密"的判定如果直接读 env 就不可测，读注入的配置就能测（`packages/core/base/shared/__tests__/cache.test.ts` 里就是这么做的）。

"不碰 store"则靠依赖注入落实：

| 需要的能力 | 包提供什么 | 应用在哪注入 |
| --- | --- | --- |
| 权限判定 | `createPermissionDirective({ checkers, onCheck, subscribe })`（`packages/directives`） | `apps/web/src/directives/index.ts` |
| 路由守卫 | `@antdv/router` 的守卫工厂（登录态、菜单加载、进度条、标题全是入参） | `apps/web/src/router/guards/index.ts` |
| 布局形态 | `@antdv/layout-ui` 给区域渲染件与尺寸契约，`@antdv/layouts` 给装配层（`BasicLayout`、顶栏小部件、hooks） | 应用只剩 `apps/web/src/layouts/index.vue` 这层薄壳（插件约定要它）与 `apps/web/src/plugins/layouts-host.ts` 的注入 |

唯一例外是 `packages/utils/src/menu.ts:3` import 了 `vue-router` 的**类型** （`import type { RouteRecordRaw }`）——类型不进产物，不破坏边界。

::: tip 新代码该放哪只跟这个页面有关 → 页面目录里（`views/<模块>/<页面>/`）。跨页面但只服务应用（store、api、ws） → `apps/web/src/` 对应目录。纯函数、不依赖应用状态、换个项目还想用 → `packages/core/base/shared` 或 `packages/core/composables`。需要 pinia / router / 后端数据才能工作 → 留在应用里做薄壳，包只接收注入。:::

## 路径别名与自动导入

别名只有两个，两边必须一致：

| 别名 | 指向 | 定义处 |
| --- | --- | --- |
| `~` | `apps/web/src` | `internal/vite-config/src/config/common.ts:16-25`，`apps/web/tsconfig.app.json` 的 `paths` |
| `#` | `apps/web/types` | 同上 |

两边不一致时 vite 能跑但 `vue-tsc` 报错（或反过来），所以别名只在 `createAliases()` 里定义一次。 `resolve.dedupe: ['pinia', 'vue', 'vue-router']` 也在那里——pnpm 的 peer 解析一度让依赖树里同时出现 `vue` 3.5.42 / 3.5.43 两份类型（catalog 现在把 `vue` 钉在 `3.5.43`），运行时两份 Vue 会让 inject 和响应式系统互相看不见。

自动导入的范围是**框架 API，不是本仓库的包，也不是 antdv-next**（`internal/vite-config/src/plugins/auto-import.ts:48-54`）：

- `AutoImport`（`:48-51`）：`vue`、`@vueuse/core`、`pinia`、`VueRouterAutoImports`。`antdv-next` 的 `message` / `notification` / `Modal` / `Drawer` 以前也在这里，现在**已经移除**，要用就自己 import。
- `Components`（`:52-54`）：**没有配任何 resolver**。以前是 `AntdvNextResolver`（`a-*`）+ `AntdvUiResolver`（子包组件）+ `IconifyResolver`（裸写 `<Icon>`）三个，现在这三条通道全部关掉，插件只保留它自带的"扫描应用内 `src/components` 目录、本地组件免 import"能力。
- 声明文件 `apps/web/types/auto-imports.d.ts`、`components.d.ts` 是入库的。它们由插件在构建时回写，Windows 映射盘上偶发 `UNKNOWN (errno -4094)` 直接把 dev server 带走，所以留了 `VITE_WRITE_DTS=false` 跳过写入（见同文件注释）。

结论：组件与组件库 API **一律显式 import**，应用里 100 多个文件都是这么写的：

```ts
import { Card as ACard, message } from 'antdv-next';
import { Scrollbar } from '@antdv/common-ui';
import { Icon } from '@iconify/vue';
```

`<script setup>` 里模板绑定按 `capitalize(camelize(tag))` 查找，所以模板要继续写 `<ACard>` 就得把默认导出别名成 `ACard`（`import { Card }` 只能配 `<Card>` 用）。`vue/component-name-in-template-casing` 规则会把 kebab 标签改成 Pascal，两者正好对得上。

裸写 `useRoute()`、`ref()` 才是自动导入负责的；`import { cn } from '@antdv/shared/utils/cn'` 这种子路径 import 也必须自己写。

## 命名与页面骨架

`CODE_STANDARD.md` 第 1 节规定的粒度：

```
views/system/user/
├── index.vue      页面主入口
├── actions.ts     表格行操作，无状态，副作用靠 ctx 注入
├── columns.ts     列定义
├── schemas.ts     搜索 / 弹窗表单 schema
├── constants.ts   常量与映射
├── types.ts       模块类型
├── utils.ts       模块工具
└── components/    页面私有组件
```

`components/` 与 `widgets/` 子目录是"私有组件"的判定口径，两处机制都靠它：文件约定路由用 `**/*/components/*` 把它们排除在路由表外，布局插件跳过 `**/components/**` 与 `**/widgets/**`（`internal/vite-config/src/plugins/vue.ts:21-34,52-55`），e2e 的"路由页面外层容器不许加 padding"守卫也用同一口径。把它们改名成别的目录，页面会既进路由表又被套上 padding。

## 版本与发版

根 `package.json` 的 `version`（当前 `0.4.0`）是整仓基线，具体依赖版本一律写在 `pnpm-workspace.yaml` 的 `catalog` 里，子包只写 `"xxx": "catalog:"`。所以查某个库的真实版本去看 catalog，而不是子包 package.json。

版本变更走 changesets：`pnpm changeset` 生成 `.changeset/*.md`，`pnpm version` 消费并回写 `CHANGELOG.md`，`pnpm release` 发布。`.changeset/config.json` 里的 `fixed: [["@antdv/*", "@antdv/*"]]` 意味着**任一**包升版会带着全部 `@antdv/*` 一起走同一版本号，这是子包之间互相 import 时不出现版本漂移的代价与保障。

## 继续阅读

- 目录与包的完整清单：[目录说明](/guide/project/dir)
- 环境变量怎么读、开关为什么恒 false：[本地开发](/guide/essentials/development)、[配置](/guide/essentials/config)
- 路由与菜单的四层拼装：[路由和菜单](/guide/essentials/route)
- 请求层与接口约定：[服务端交互](/guide/essentials/request)
- 工具与缓存的分工：[工具](/guide/essentials/utils)、[缓存](/guide/essentials/cache)
- 跑起来与构建：[快速开始](/guide/introduction/quick-start)、[构建与部署](/guide/essentials/deploy)
