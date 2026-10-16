# 外部模块

"外部模块"有两个方向，这篇都讲：**把外面的依赖装进这个仓库**，以及**把仓库里的模块给别的项目用**。中间夹一条容易搞混的线 —— 一个外部模块到底进不进浏览器产物，以及它的组件是靠编译期注入、运行期注册，还是只有一份扫描出来的类型声明。

| 你要做的事 | 真实链路 | 关键出处 |
| --- | --- | --- |
| 加一个第三方依赖 | 根 `pnpm-workspace.yaml` 的 `catalog:` + 子包 `package.json` 的 `catalog:` | `pnpm-workspace.yaml:19-273` |
| 判断它进不进产物 | 看它在 `dependencies` 还是 `devDependencies`，再看分包规则 | `apps/web/package.json:17-125`、`internal/vite-config/src/optimize.ts:1-41` |
| 用它的组件 | 显式 `import` / 运行期 `app.component` / 生成的 `.d.ts`，三件事 | `apps/web/src/plugins/vendor-antd-components.ts:59-118` |
| 把内部包给外部项目 | `exports` 子路径 + `files: ["dist"]` + 包边界 + 锁步版本 | `packages/shared/package.json:14-43`、`.changeset/config.json:10-17` |
| 接一个外部子应用 | 注册表 + `VITE_MICRO_APP` + iframe 兜底 | `apps/web/src/config/micro-app.ts:5-92` |

## 一、加一个第三方依赖要动哪几处

### 顺序与落点

| 步骤 | 位置 | 做什么 | 依据 |
| --- | --- | --- | --- |
| 1 | `pnpm-workspace.yaml` 的 `catalog:` | 加一行 `some-lib: ^1.2.3`，这是全仓唯一的版本来源 | `pnpm-workspace.yaml:19-273`（当前 254 条） |
| 2 | 消费方 `package.json` | 在对应包里写 `"some-lib": "catalog:"`，**不要写字面量版本** | `apps/web/package.json:17-125` 全是 `catalog:` / `workspace:*` |
| 3 | 判断篮子 | 只在 Node 里用（vite 插件、CLI）→ `devDependencies`；要进浏览器 → `dependencies` | `apps/web/package.json:126-190` |
| 4 | 仓库根 `pnpm install` | 重算 `pnpm-lock.yaml`；CI 用 `--frozen-lockfile`，锁文件没跟上就直接红 | `.github/workflows/docs.yml:56` |
| 5 | 只在需要时用 `overrides` | 出现"两份实例"（同名包被不同 peer 树各装一遍）才加，见下 | `pnpm-workspace.yaml:303-308` |

::: warning `pnpm add` 不会替你写 `catalog:` `pnpm-workspace.yaml` 里**没有** `useCatalog` 这个键（全文的键：`packages` / `allowBuilds` / `autoInstallPeers` / `catalog` / `catalogs` / `dedupePeerDependents` / `ignoredBuiltDependencies` / `minimumReleaseAge` / `onlyBuiltDependencies` / `overrides` / `publicHoistPattern` / `strictPeerDependencies` / `verifyDepsBeforeRun`）。所以 `pnpm add some-lib` 落进 `package.json` 的是字面范围号，第 2 步得手工补：先在 `catalog:` 加行，再把子包那行改成 `"catalog:"`。已经漏网的三条见下面警告。:::

### 最短可照做的步骤

```bash
# 都在仓库根执行
# 1) 编辑 pnpm-workspace.yaml：catalog 段加 `some-lib: ^1.2.3`
# 2) 编辑 apps/web/package.json：dependencies 加 `"some-lib": "catalog:"`
pnpm install                    # 触发根 postinstall 的 `pnpm -r run --if-present stub`
pnpm --filter @antdv/web type-check
pnpm check:dep                  # knip：确认它真的被 import 了（也确认没白装）
```

为什么第 4 步要在**仓库根**跑：`catalog:`、`overrides`、`pnpm-lock.yaml` 都是 workspace 级的东西，在 `apps/web/` 里单独装只会拿到一份和根 catalog 不同步的树。另外 `verifyDepsBeforeRun: false`（`pnpm-workspace.yaml:311`）关掉了"跑脚本前校验 node_modules 与lockfile 是否同步"，改完 `catalog:` 忘记 install 就直接跑，用的还是旧树，而且不会报错。

内部包之间一律 `workspace:*`（如 `apps/web/package.json:21-38`），装出来是软链。新包要落在 `packages/*` 或 `internal/*` 等 glob 里才会成为 workspace 成员（`pnpm-workspace.yaml:1-8`，`docs` 是单独一行的例外）。

### catalog 之外还有两张收敛名单

| 名单 | 条目 | 作用 |
| --- | --- | --- |
| `overrides` | `@ast-grep/napi`、`@ctrl/tinycolor`、`clsx`、`pinia`、`vue` → `catalog:`（`pnpm-workspace.yaml:293-297`） | 连第三方 peer 树里的同名包一起按回单版本 |
| `dedupePeerDependents` / `autoInstallPeers` / `strictPeerDependencies` | `true` / `true` / `false`（`:268`、`:17`、`:309`） | peer 去重、自动补 peer、不因 peer 冲突报错停下 |
| 版本钉 | `packageManager: pnpm@10.12.4`（根 `package.json`）、`.node-version` = `24.0.0`、`engines.node >= 22.0.0` | 工具链版本，改依赖时不要顺手改它 |

`catalog:` 里的 `vue` 是**不带范围号的精确值** `3.5.43`（`pnpm-workspace.yaml:212`，理由写在 `:210-211` 的注释里：留 caret 会让部分第三方 peer 树停在旧 3.5.x，`@vue/runtime-core` 出现两份类型）。

::: tip 分组 catalog 是干什么的，以及本仓库的这条是死的具名 catalog 的语义是"同一依赖的第二套版本"：在 `catalogs.<名字>` 里定义，消费方写 `catalog(<名字>)` 才生效，用于某个包确实必须钉在另一个版本的场合。本仓库只声明了一个 `catalogs.conflicts_vue_h3_5_43`（`pnpm-workspace.yaml:312-315`，值是 `vue: ^3.5.43`），但**全仓没有任何 `package.json` 写 `catalog(conflicts_vue_h3_5_43)`** —— 它不参与解析。真要出现"某个包必须用另一份 vue"时，才需要既定义又引用。:::

::: warning 别照抄这三行整个工作区只有 3 个依赖没走 catalog：`apps/web/package.json` 的 `clsx: ^2.1.1`、`pinia: ^3.0.4`、`vue: ^3.5.43`（历史遗留）。它们现在靠 `overrides` 顶回 catalog 口径，属于"看着是范围号、装的其实是钉住的版本"。新依赖不要复制这种写法。:::

## 二、外部模块进浏览器产物的代价

### 先看它在哪个篮子里

| 篮子 | 代表 | 进不进产物 |
| --- | --- | --- |
| `apps/web` 的 `dependencies`（107 条） | `antdv-next`、`echarts`、`xlsx`、`pdfjs-dist`、`@antdv/*` | 进，按需被 chunk 收走 |
| `apps/web` 的 `devDependencies`（63 条） | `vite`、`unplugin-auto-import`、`unplugin-vue-components`、`@antdv/vite-config` | 只在 Node 里跑，不进产物 |
| `internal/*` | `@antdv/vite-config`、`@antdv/node-utils`、lint 配置包 | 构建期依赖，产物里只有它们生成的代码 |

出处：`apps/web/package.json:168`、`:171`（两个 unplugin）、`:129`（`@antdv/vite-config`）都写在 devDependencies （`:126` 起）；`:81` 的 `antdv-next`、`:117` 的 `vue-cropper` 在 dependencies（`:17` 起）。 以前这里还有一条 `@antdv-next/auto-import-resolver`，resolver 下线后它已经没有引用点了， catalog（`pnpm-workspace.yaml`）里的对应条目也一起删了。 **一个包会不会进产物，取决于它在哪个篮子 + 有没有被真实 import，而不是名字像不像库。**

### 分包：这里没有 `manualChunks`，是 rolldown 的 `codeSplitting.groups`

全仓 `grep manualChunks` 命中 0 处。分包策略单独放在 `internal/vite-config/src/optimize.ts:1-41`，由 `createApplicationBuildConfig()` 挂到 `build.rolldownOptions.output.codeSplitting.groups`（`internal/vite-config/src/config/application.ts:38-41`）， `minSize` 是 20 KB（`:40`），入口/分片命名 `js/[name]-[hash].js`（`:37`、`:42`）。

| 命中条件（按源码顺序） | chunk 名 | 行号 |
| --- | --- | --- |
| `antdv-next` | `vendor-ui` | `optimize.ts:9` |
| `vue` / `pinia` / `vue-router` | `vendor-vue` | `:10-15` |
| `echarts` | `vendor-echarts` | `:16` |
| `@vueuse` / `es-toolkit` / `dayjs` / `xlsx` | `vendor-utils` | `:17-23` |
| `@vue-office` | `vendor-office` | `:24` |
| `pdfjs-dist` | `vendor-pdfjs` | `:25` |
| `@intlify` / `vue-i18n` | `vendor-i18n` | `:26-27` |
| `highlight.js` | `vendor-highlight` | `:28` |
| `@form-create` / `prosemirror` / `marked` | `vendor-editor` | `:29-34` |
| 其余 `node_modules` | `vendor`（兜底） | `:35` |

::: warning 三条值得知道的细节

- 这些规则是 `id.includes(...)` 的**字符串包含**判断，且外层还要求 id 在 `node_modules` 里（`optimize.ts:8`），顺序即优先级。于是 `vue` 这条（`:10-15`）会把所有路径含 `vue` 的第三方包一起收进 `vendor-vue`：`@vueuse/*`、`@vue-office/*`、`vue-i18n` 都在到达 `vendor-utils` / `vendor-office` / `vendor-i18n` 之前就被截走，那三条规则实际只对不含 `vue` 的名字生效（`es-toolkit` / `dayjs` / `xlsx`、`@intlify/*`）。`packages/*` 自己的代码也不按这条切分 —— 它们的模块 id 不在 `node_modules` 下。
- `debugName` 是给产物体积报告看的（`:5-6`）：`name` 是函数，报告里默认显示匿名。
- 规则表会留孤儿：`vendor-office` 还在，但 `@vue-office/*` 四个包今天没有任何 import（见第六节）。规则本身不影响体积，只是别再以为产物里有 office 分片。:::

### `optimizeDeps` 的两个特例

`createOptimizeDeps()`（`internal/vite-config/src/config/application.ts:57-64`，挂在 `:97`）：

```ts
// internal/vite-config/src/config/application.ts:58-63
return {
  exclude: ['vue'],
  // 必须是真实包名：写成裸的 '@vueuse' 会报
  // "Failed to resolve dependency: @vueuse, present in optimizeDeps.include"
  include: ['@vueuse/core', 'antdv-next', 'es-toolkit'],
};
```

- `exclude: ['vue']`：vue 不预打包，交给 `resolve.dedupe` 保证单例。
- `include` 三个包名是显式预热，免得首屏冷启动时现扫现打包。
- 注释里那条报错是真实踩过的：include 写作用域前缀（裸 `@vueuse`）会直接解析失败。

### 单例与"两份 Vue"

`createCommonConfig()` 的 `resolve.dedupe: ['pinia', 'vue', 'vue-router']` （`internal/vite-config/src/config/common.ts:50`）是运行时的保险：pnpm 的 peer 解析曾让依赖树里同时存在 `@vue/runtime-core` 3.5.42 / 3.5.43，后果不只是类型打架，两份 Vue 的 inject 与响应式系统互相看不见。**装新依赖后如果出现"provide 拿不到值""响应式失效"，先怀疑有没有第二份 vue。**

### 顺手一条：`__APP_INFO__` 会把两张依赖表打进产物

`defineApplicationConfig()` 默认注入 `__APP_INFO__`，内容是构建时间加上 `package.json` 的 `dependencies` 与 `devDependencies` 两张表原样序列化（`internal/vite-config/src/config/application.ts:87-96`、 `internal/vite-config/src/utils/package-json.ts:43-54`）。 `appInfo: false` 可以关掉。

::: warning 它现在没人读全仓 `grep APP_INFO` 只有两处命中：注入侧与 `apps/web/vite.config.ts:10` 的注释。应用代码里没有消费者 —— 注释里说的"关于页展示版本与构建时间"并没有接上（`utils/package-json.ts:42`）。也就是说：产物里目前白带了一份依赖清单。:::

### 没接线的通道：CDN externals

`vite-plugin-cdn-import` 在 `apps/web/package.json:162` 的 devDependencies 里，但 `internal/vite-config` 与应用侧都没有 import 它（grep 命中 0）。所以"外部模块走 CDN + `rollupOptions.external`"这条路在本仓库**不存在**， `base: './'` 的产物是自包含的静态目录，见[构建与部署](/zh/guide/essentials/deploy)。

## 三、显式引入、运行期注册、类型声明是三层

这三件事经常被当成一件，实际作用时机和覆盖面完全不同：

| 层 | 机制 | 作用时机 | 覆盖谁 | 出处 |
| --- | --- | --- | --- | --- |
| 编译期 | 写 `import { Card as ACard } from 'antdv-next'` | SFC 编译时把局部绑定接进模板 | **本仓库源码**里的 `<ACard>` / `<a-card>` | 应用里 100 多个 `.vue` 文件各自头部 |
| 运行期 | `app.component('a-xxx', Comp)` 全局注册 | 应用启动时挂进 `app` | 只为**预编译好的第三方模板**服务 | `apps/web/src/plugins/vendor-antd-components.ts:59-118` |
| 类型层 | `components.d.ts` / `auto-imports.d.ts` | 构建/dev 时被插件回写 | 只影响 TS 与 IDE，不代表任何东西被用到 | `auto-import.ts:50`、`:53` |

### 编译期：没有 resolver 了，组件全靠 import

`createAutoImportPlugins()`（`internal/vite-config/src/plugins/auto-import.ts:41-64`）过去注册过三个 resolver：`AntdvNextResolver`（`a-*` → `antdv-next`）、`AntdvUiResolver`（子包组件）、`IconifyResolver`（裸写 `<Icon>`）。**现在三个都删掉了**（同文件 `:12-25` 的注释解释了为什么）：

- 裸标签在编译期没人注入，运行期只留一条 `Failed to resolve component` 警告，页面却整块变空白 —— 图标静默消失、设计器外壳塌成空白标签，这类事故排查都要从编译配置倒推。
- 显式 import 让"谁在用、从哪来"在文件头部一眼可见，`import { cn } from '@antdv/shared/utils/cn'` 这种子路径写法也终于和组件写法统一。
- 子包不再假设宿主带着自动导入配置，别的应用直接引 `@antdv/common-ui`、`@antdv/icons` 也能跑。

`Components` 插件本身还留着（`:52-54`），但它只剩自带的能力：扫应用内 `src/components` 目录做本地组件注册，不涉及任何 npm 包。`AutoImport` 侧（`:48-51`）自动导入的仍然只有框架 API：`vue`、`@vueuse/core`、`pinia`、`VueRouterAutoImports` —— `antdv-next` 的 `message` / `notification` / `Modal` / `Drawer` 四个函数式入口也一起移除了，用它们得自己 import。

一个容易踩的细节：`<script setup>` 编译模板时按 `capitalize(camelize(tag))` 找局部绑定，所以 `<a-card>` 要命中别名 `ACard`、`<Card>` 要命中 `Card`。删 resolver 之后应用里的写法统一成 `import { Card as ACard } from 'antdv-next'` + 保留 kebab 标签，配 ESLint 的 `vue/component-name-in-template-casing` 正好自洽。

### 运行期：36 个 + 1 个占位

`apps/web/src/plugins/vendor-antd-components.ts` 从 `antdv-next` 具名 import 了 36 个组件，`VENDOR_COMPONENTS` 表里正好 36 条 kebab-case 键（`:59-96`）， `registerVendorAntdComponents()`（`:112`）再额外注册一个 `a-form-item-rest`（`:116`），合计 **37 次 `app.component`**。入口在 `apps/web/src/main.ts:32` import、`:53` 调用（早于 `app.use(pinia)`）。

为什么只有这 36 个：`@form-create/antd-designer` 的模板**发布时就已经编译好了**，运行时才用 `resolveComponent('a-layout-sider')` 找组件，源码里的显式 import 帮不到它（文件头注释 `:44-58`）。清单来自对该包产物的静态扫描。

::: warning 不要顺手改成 `app.use(antd)` 全量注册全量注册会把 tree-shaking 的成果整体退回去（整个组件库进包），与 `vendor-ui` 这条分包规则（`optimize.ts:9`）的初衷冲突。注册名也必须是 kebab-case：`:113-114` 的注释说明 PascalCase 那条路只在 SFC 编译期生效，运行期查不到。:::

`a-form-item-rest` 是 React 版 antd 的东西，antdv-next 不提供，但设计器模板里写死了它 ——这里用一个"只渲染默认插槽"的透传组件顶上（`:98-110`）。所以"注册了 37 个"不等于 "页面用到了 37 个"：例如 `a-directory-tree` 在表里（`:64`），而 `grep -rn "<a-directory-tree" apps/web/src` 没有任何命中 —— 它是给设计器准备的，不是给业务页的。

### 类型层：`components.d.ts` 是扫描产物，条目数不作数

`apps/web/types/components.d.ts` 头部第 6 行写着 `Generated by unplugin-vue-components`， `@ts-nocheck` 在第 2 行。它是**扫到的本地标签清单**，两个含义要分清：

- 现在它里面**不该再有 `antdv-next` 的条目**：resolver 删掉之后插件不再认识任何第三方标签，只剩应用自身的本地组件。看到 `typeof import('antdv-next')[...]` 说明你连的是还没重启的 dev server（旧配置还在内存里）。
- 没条目 ≠ 不能用：`VITE_WRITE_DTS=false` 时插件不回写这两个文件（`auto-import.ts:31-36`），文件就停留在上次构建的状态；而运行期注册的 37 个组件也不靠它，全局注册走的是 `vue` 的 `GlobalComponents` 接口。

这两个文件是入库的（`git ls-files` 能看到），会随构建反复变动 —— 看 diff 时别把它们当语义变更。想知道某个 `a-*` 到底有没有被用，只有一条路：在 `apps/web/src` 里搜标签本身。

## 四、把 packages/* 当模块给别的项目用

### 子路径即模块

`@antdv/shared` 的 `exports` 用了"通配符 + 目录模块显式列出"的组合（`packages/shared/package.json:21-43`，理由写在同文件 `//exports` 注释 `:20`）：

| 写法 | 解析到 | 本仓引用次数 |
| --- | --- | --- |
| `@antdv/shared/utils/cn` | `dist/cn.js`（走 `"./*"` 通配符，`:38-41`） | 107 |
| `@antdv/shared/cache` | `dist/cache/index.js`（显式列出，`:26-29`） | 13 |
| `@antdv/shared/utils/env` | `dist/env.js` | 5 |
| `@antdv/composables/websocket` | `dist/websocket/index.js`（显式列出，`packages/composables/package.json:34-37`） | 2（`apps/web/src/utils/ws.ts:3`） |

对应构建侧：`packages/shared/tsdown.config.ts:13-20` 的 `entry: ['src/index.ts', 'src/*.ts', 'src/*/index.ts']` 与 `platform: 'neutral'`； `files: ["dist"]`（`packages/shared/package.json:14-16`）决定打包出去只带 `dist`。

为什么要分入口而不是塞一个 barrel：只 import 一个 `cn` 时不该把 `xlsx` / `dompurify` 的初始化一起拖进依赖图（`tsdown.config.ts:6-8` 的注释）。`@antdv/composables` 同理， `echarts / sse / websocket` 刻意留在独立入口（`packages/composables/src/index.ts:4-9`），其中 `./echarts` 这条入口虽然在 `exports` 里（`package.json:26-29`）并且被注释推荐，但**应用侧目前没有人从它 import** —— 通配符入口写了不等于被消费。

### 两种形态，能不能脱离 Vite 是关键差别

| 形态 | 包 | `main` | 改完 `src` | 外部可用吗 |
| --- | --- | --- | --- | --- |
| dist 发布 | `shared`、`composables`、`directives`、`layouts`、`preferences`、`router`、`types` | `./dist/index.js`（`types` 是 `./dist/index.mjs`） | 必须重新 `build` | 只要装到 `dist` 就能被解析 |
| 源码发布 | `@antdv/icons`、`@antdv/design`（`./src/index.css`）、`@antdv/ui-kit` 十个（`common-ui` / `shadcn-ui` / `form-ui` / `table-ui` / `popup-ui` / `layout-ui` / `menu-ui` / `tabs-ui` / `loading-ui` / `scrollbar-ui`，如 `packages/core/ui-kit/common-ui/src/components/scrollbar/package.json:12-19`：`files: ["src"]` + `main/types` 全指 `./src/index.ts`） | 直指 `src` | 直接热更新 | **不能**：没有 build 脚本，`.vue` 与 Tailwind 入口由应用的构建链编译 |

### 包边界是它们能被单点复用的唯一原因

`packages/*` 里不许 import `pinia` / `vue-router` 实例 / 应用 store，也不许读 `import.meta.env`；需要这些能力时由应用**注入**（守卫工厂、指令工厂、偏好 defaults）。细则与注入示例见[基础概念](/zh/guide/essentials/concepts)与[目录说明](/zh/guide/project/dir)，这里只补一句产物角度的后果：**包一旦被 store 绑住，脱离这个应用就装不起来**， `exports` 写得再漂亮也没用。类型例外（`packages/shared/src/utils/menu.ts` 只 import `vue-router` 的类型）不进产物，不算破边界。

### 版本是锁步的 —— 但今天没有任何包发得出去

`.changeset/config.json:10` 的 `fixed: [["@antdv/*", "@antdv/*"]]` 让任何一个 `@antdv/*` 升版时全家跟着跳到同一个版本号；`:14-17` 的 `privatePackages: { version: true, tag: true }` 让私有包照样参与递增与打 tag。**对外部项目的含义是：你拿到的是一起跳的版本号，不能只钉其中一个包**（这也是内部互引一律 `workspace:*` 的另一面，见 [Changeset](/zh/guide/project/changeset)）。

::: warning 现在没有 npm 这条路 `packages/*`、`internal/*`、`apps/*`、`docs`、`scripts/*` **全部** `"private": true` （逐个文件验证过，例如 `packages/shared/package.json:5`）。 `changeset publish` 不会发私有包；`pnpm publint`（`vsh publint`）在 `scripts/vsh/src/publint/index.ts:166-168` 明确 `if (pkgJson.private) return null;` ——也就是说这条发布面检查当前覆盖 0 个包。所以"给别的项目用"目前只有把包目录（含 `dist`）带出去、或自己改成非私有再发这两类做法， `exports` / `files` 是为这两类做法准备的。:::

改 `packages/*/src` 之后应用看不到变化，是因为它读的是 `dist`（`turbo.json:16-24` 的 `dependsOn: ["^build"]` 保证构建顺序）—— 具体命令见[快速开始](/zh/guide/introduction/quick-start)。

### 库形态的构建链已经备好，但没有消费者

`internal/vite-config/src/config/library.ts:39` 导出 `defineLibraryConfig()`，external 清单取 `dependencies + peerDependencies` 全量排除（`internal/vite-config/src/utils/package-json.ts:62-70`，注释 `:56-61` 说明打进来会带第二份 vue / antdv-next）。仓库里需要编译 SFC 的包（`@antdv/icons` 与 `@antdv/ui-kit` 那十个）目前**没有**用它 —— 它们连 build 脚本都没有，只有 tsdown 那批在出 `dist`。想正式对外发一个组件库，这才是接线点。

## 五、反过来：外部子应用与外部仓库

### 微前端注册表

`apps/web/src/config/micro-app.ts:5-92` 是一份 6 条的子应用注册表（`name` / `url` / `baseroute` / `icon` / `loader` …），总开关 `enabled` 用 `isEnvEnabled(import.meta.env.VITE_MICRO_APP)` （`:7`，写成 `=== true` 会恒为 false）。类型契约在 `packages/types/src/micro-app.ts`， `loader` 只有 `'iframe' | 'webcomponent'` 两种（`:21`）。路由侧怎么按 `baseroute` 匹配见 [路由和菜单](/zh/guide/essentials/route)。

`<micro-app>` 这个标签不会被 Vue 当成"没注册的组件"：编译期通过 `compilerOptions.isCustomElement` 把它交给浏览器当原生元素（`internal/vite-config/src/plugins/custom-elements.ts:21-24`、 `internal/vite-config/src/plugins/vue.ts:38-46`）。规则只认显式登记的 `micro-app` 与 `micro-` 前缀且必须含连字符（`custom-elements.ts:47-55`），否则会把真实的注册失败吞成空标签。

::: warning 本仓库没有装任何微前端 SDK `@micro-zoe/micro-app` / `wujie` / `qiankun` 在全部 `package.json` 里搜不到（0 命中）。 `<micro-app>` 是靠 SDK 在运行时 `customElements.define()` 注册的标签，而 `SubAppView.vue:67` 用 `!!window.microApp` 判断就绪、`:70` 得出 `useIframe = isExternalUrl || !isMicroAppReady` —— 当前依赖状态下这个表达式**恒为 true**，实际每条路都走 `<iframe>`（`:268-279`），`<micro-app>` 分支（`:282-301`）是留给"以后接 SDK"的。iframe 的 `sandbox` 默认不含 `allow-same-origin`，只有注册表里显式 `sameOrigin` 才放开（`:81-84`），打开了会在右上角挂"同源预览"标签（`:312-318`）。:::

### 上游同步

`sync-upstream.json` 记录上游是 `vbenjs/vue-vben-admin`，同步目录只有 `internal/lint-configs`（`syncDirs`），并且 `previewMode: true`； `.sync-state.json` 里留着已同步文件的 upstream OID 清单。

::: warning `pnpm sync-upstream` 这条命令是断的根 `package.json` 的 `"sync-upstream": " sync-upstream"` 只写了同名命令，但 `node_modules/.bin` 里没有它、`pnpm-lock.yaml` 里也没有对应包（两处都 grep 过 0 命中）。别指望跑它拉上游代码。:::

## 六、这些外部模块其实没人用了

本节只做盘点，不动任何东西。判定口径：在 `apps/web/src`、`packages/**`、 `internal/**`、`apps/backend-mock` 里（`*.ts` / `*.vue` / `*.mts`，排除 `dist`）搜包名字符串，0 命中即"没有直接 import"。

| 依赖 | 声明处（`apps/web/package.json`） | 状态 |
| --- | --- | --- |
| `@videojs-player/vue`、`@videojs/http-streaming`、`video.js` | `:58`、`:59`、`:101` | **本次删页造成的新零引用**。`git show HEAD:apps/web/src/views/components/video/index.vue` 里原本 import 了三者（`:5`、`:9`、`:11`），而 `views/components/video/` 的 3 个文件在当前工作区是删除状态 |
| `@vue-flow/background`、`/controls`、`/core`、`/minimap` | `:60-63` | 全仓只在 `apps/web/package.json` 出现，历史上也没有页面（`git log --diff-filter=D` 搜不到 flow 页面） |
| `bpmn-js`、`bpmn-js-i18n-zh`、`bpmn-js-properties-panel`、`camunda-bpmn-moddle` | `:71-74` | 同上，0 命中 |
| `@vue-office/docx`、`/excel`、`/pdf`、`/pptx` | `:64-67` | `docx`/`excel` 只剩 `views/components/upload/index.vue:1025-1064` 的注释与"组件加载中…"占位文案；`pdf`/`pptx` 连注释都没有。而 `optimize.ts:24` 的 `vendor-office` 分片规则还在 |
| `codemirror`、`vue-codemirror`、`@codemirror/commands`、`/lang-javascript`、`/lang-sql`、`/lang-vue`、`/theme-one-dark` | `:29-33`、`:76`、`:104` | 0 命中 |
| `@tiptap/core`、`/extension-document`、`/extension-highlight`、`/extension-link`、`/extension-list`、`/extension-underline`、`/markdown`、`/pm` | 声明 16 条，实际 import 7 条 | 有引用的是 `@tiptap/{extension-image,extension-table,extension-text-align,extension-text-style,extensions,starter-kit,vue-3}`；表里这几条没有任何直接 import（部分是 `starter-kit` / `extensions` 的 peer） |
| `nanoid`、`qrcode`、`resize-observer-polyfill`、`vue-demi`、`vue-virtual-scroller` | `:90`、`:94`、`:95`、`:106`、`:111` | 0 命中 |
| `vite-plugin-cdn-import`、`@vitejs/plugin-legacy`、`vite-plugin-iconify-offline` | `:139`、`:162`、`:167` | devDependencies 里的构建插件，没有任何 import（与[配置](/zh/guide/essentials/config)末尾那条警告是同一批） |

### 工具怎么把它们抓出来

| 命令 | 实际执行 | 关键细节 |
| --- | --- | --- |
| `pnpm check:dep` | `vsh check-dep` → knip（`pnpm-workspace.yaml:266` 钉 `knip: ^6.40.0`） | 配置不落盘，内联在 `scripts/vsh/src/check-dep/index.ts:14-31`，运行时写到 `os.tmpdir()` 再跑（`:92-98`）。参数是 `--include dependencies --reporter json`（`:100-109`）——**只看 `dependencies` 侧的未使用**，devDependencies 那一侧不在它的报告范围里 |
| `pnpm publint` | `vsh publint` → publint | 遍历所有 workspace 包的 `package.json`（`scripts/vsh/src/publint/index.ts:39-52`），但私有包直接 `return null`（`:166-168`）—— 本仓全是私有包，所以现在报不出东西 |
| `pnpm check:circular` | `vsh check-circular` | 包与包之间的环，跟"未使用"是两回事 |
| `pnpm check` | circular + dep + type + cspell 串起来 | 最后一环必失败（`cspell` 不在任何依赖里），见[常见问题](/zh/guide/other/faq) |

::: warning "报未使用"不等于"可以删" `check:dep` 的内置配置里有一串 `ignoreDependencies` （`scripts/vsh/src/check-dep/index.ts:17-29`：`playwright`、`rimraf`、`tailwindcss`、几个 `@vben/*` 遗留名等），`ignore` 排掉 `dist/**` 与 `docs/**`（`:15`）， `ignoreWorkspaces` 排掉 `internal/lint-configs/*` 与 `scripts/*`（`:30`）。另一方面，被别的包的 peer 拖住的依赖（上表 tiptap 那几条）在源码里本来就搜不到 import。所以每一条都要回到"谁 import 它 / 谁的 peer 需要它"再定，升级侧的同类提醒见[项目更新](/zh/guide/other/project-update)。:::

## 相关页面

- [基础概念](/zh/guide/essentials/concepts)：分层、包边界与自动导入的完整清单
- [目录说明](/zh/guide/project/dir)：包清单、catalog 的动机、tsdown + turbo
- [Vite Config](/zh/guide/project/vite)：三层合并、插件装配、构建开关
- [配置](/zh/guide/essentials/config)：`VITE_*` 的两条读取路径与变量清单
- [本地开发](/zh/guide/essentials/development)：环境变量与日常脚本
- [快速开始](/zh/guide/introduction/quick-start)：安装、启动、改了共享包不生效怎么办
- [项目更新](/zh/guide/other/project-update)：升级依赖时的版本落点与安装期开关
- [Changeset](/zh/guide/project/changeset)：`fixed` / `privatePackages` 的发版链路
- [图标](/zh/guide/essentials/icons)：`resolveIcons: false` 之后图标走的那条通道
- [路由和菜单](/zh/guide/essentials/route)：子应用怎么按 `baseroute` 匹配进路由表
