# 外部模块

"外部模块"有两个方向，这篇都讲：**把外面的依赖装进这个仓库**，以及**把仓库里的模块给别的项目用**。中间夹一条容易搞混的线 —— 一个外部模块到底进不进浏览器产物，以及它的组件是靠编译期的显式 `import`，还是只有一份扫描出来的类型声明。

| 你要做的事 | 真实链路 | 关键出处 |
| --- | --- | --- |
| 加一个第三方依赖 | 根 `pnpm-workspace.yaml` 的 `catalog:` + 子包 `package.json` 的 `catalog:` | `pnpm-workspace.yaml:21-263` |
| 判断它进不进产物 | 看它在 `dependencies` 还是 `devDependencies`，再看分包规则 | `apps/web/package.json:17-168`、`internal/vite-config/src/optimize.ts:1-36` |
| 用它的组件 | 只有显式 `import` 一条路（运行期 `app.component` 那条已经拆了） | `internal/vite-config/src/plugins/auto-import.ts:16-38` |
| 把内部包给外部项目 | `exports` 子路径 + `files: ["dist"]` + 包边界 + 锁步版本 | `packages/core/base/shared/package.json:14-56`、`.changeset/config.json:10-17` |
| 接一个外部子应用 | 注册表 + `VITE_MICRO_APP` + iframe 兜底 | `apps/web/src/config/micro-app.ts:5-92` |

## 一、加一个第三方依赖要动哪几处

### 顺序与落点

| 步骤 | 位置 | 做什么 | 依据 |
| --- | --- | --- | --- |
| 1 | `pnpm-workspace.yaml` 的 `catalog:` | 加一行 `some-lib: ^1.2.3`，这是全仓唯一的版本来源 | `pnpm-workspace.yaml:21-263`（当前 241 条） |
| 2 | 消费方 `package.json` | 在对应包里写 `"some-lib": "catalog:"`，**不要写字面量版本** | `apps/web/package.json:17-104` 全是 `catalog:` / `workspace:*` |
| 3 | 判断篮子 | 只在 Node 里用（vite 插件、CLI）→ `devDependencies`；要进浏览器 → `dependencies` | `apps/web/package.json:106-168` |
| 4 | 仓库根 `pnpm install` | 重算 `pnpm-lock.yaml`；文档站的 CI 跑的是裸 `pnpm install`（`.github/workflows/docs.yml:47`），锁文件没跟上不会当场红，装出来的树就和别人不一样 | `.github/workflows/docs.yml:35-49` |
| 5 | 只在需要时用 `overrides` | 出现"两份实例"（同名包被不同 peer 树各装一遍）才加，见下 | `pnpm-workspace.yaml:292-297` |

::: warning

`pnpm add` 不会替你写 `catalog:` `pnpm-workspace.yaml` 里**没有** `useCatalog` 这个键（全文的键：`packages` / `allowBuilds` / `autoInstallPeers` / `catalog` / `catalogs` / `dedupePeerDependents` / `ignoredBuiltDependencies` / `minimumReleaseAge` / `onlyBuiltDependencies` / `overrides` / `publicHoistPattern` / `strictPeerDependencies` / `verifyDepsBeforeRun`）。所以 `pnpm add some-lib` 落进 `package.json` 的是字面范围号，第 2 步得手工补：先在 `catalog:` 加行，再把子包那行改成 `"catalog:"`。已经漏网的三条见下面警告。:::

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

内部包之间一律 `workspace:*`（如 `apps/web/package.json:18-35`），装出来是软链。新包要落在 `packages/*`、`packages/core/*`、`packages/core/base/*`、`packages/core/ui-kit/*` 或 `internal/*` 这些 glob 里才会成为 workspace 成员（`pnpm-workspace.yaml:1-10`，`docs` 是单独一行的例外，`:9`）。

### catalog 之外还有两张收敛名单

| 名单 | 条目 | 作用 |
| --- | --- | --- |
| `overrides`（`:292-297`） | `@ast-grep/napi`、`@ctrl/tinycolor`、`clsx`、`pinia`、`vue` → `catalog:` | 连第三方 peer 树里的同名包一起按回单版本 |
| `dedupePeerDependents` / `autoInstallPeers` / `strictPeerDependencies` | `true` / `true` / `false`（`:268`、`:19`、`:309`） | peer 去重、自动补 peer、不因 peer 冲突报错停下 |
| 版本钉 | `packageManager: pnpm@10.12.4`（根 `package.json:82`）、`.node-version` = `24.0.0`、`engines.node >= 22.0.0`（`:80`） | 工具链版本，改依赖时不要顺手改它 |

`catalog:` 里的 `vue` 是**不带范围号的精确值** `3.5.43`（`pnpm-workspace.yaml:229`）：留 caret 会让部分第三方 peer 树停在旧 3.5.x，`@vue/runtime-core` 出现两份类型，所以这里钉死。

::: tip

分组 catalog 是干什么的，以及本仓库确实在用它具名 catalog 的语义是"同一依赖的第二套版本"：在 `catalogs.<名字>` 里定义，消费方写 `"catalog:<名字>"` 才生效，用于某个包确实必须钉在另一个版本的场合。本仓库声明了一个 `catalogs.conflicts_vue_h3_5_43`（`pnpm-workspace.yaml:264-267`，值是 `vue: ^3.5.43`），而 `apps/web/package.json:95` 写的正是 `"vue": "catalog:conflicts_vue_h3_5_43"` —— 它是**活的**：应用自己那份 vue 走 caret 范围，根 catalog 的精确 `3.5.43` 继续管住其余所有包，`overrides` 再把第三方 peer 树按回 catalog。三层叠出来的结果还是一份 vue 实例（`resolve.dedupe` 兜运行时，见第二节）。:::

::: warning

别在子包里写裸范围号整个工作区今天只有这一处不指向根 `catalog:` —— `apps/web` 的 `vue` 走具名 catalog。`clsx` 与 `pinia` 已经改回 `"catalog:"`（`apps/web/package.json:67`、`:85`），历史上那三条字面量范围号的写法都没了。新依赖直接写 `"catalog:"`，只有"这个包必须跟别人用不同版本"时才考虑具名 catalog，并且要同时定义和引用。:::

## 二、外部模块进浏览器产物的代价

### 先看它在哪个篮子里

| 篮子 | 代表 | 进不进产物 |
| --- | --- | --- |
| `apps/web` 的 `dependencies`（87 条，`:17` 起） | `echarts`、`xlsx`、`pdfjs-dist`、`@antdv/*` | 进，按需被 chunk 收走 |
| `apps/web` 的 `devDependencies`（61 条，`:106` 起） | `vite`、`unplugin-auto-import`、`unplugin-vue-components`、`@antdv/vite-config` | 只在 Node 里跑，不进产物 |
| `internal/*` | `@antdv/vite-config`、`@antdv/node-utils`、lint 配置包 | 构建期依赖，产物里只有它们生成的代码 |

出处：`apps/web/package.json:146`、`:149`（两个 unplugin）、`:108`（`@antdv/vite-config`）、`:150`（`vite`）都在 devDependencies；`:97` 的 `vue-cropper` 在 dependencies。以前这里还有 `antdv-next` 与 `@antdv-next/auto-import-resolver` 两条：组件库改由 `reka-ui` + `@antdv/*` 自己承担，resolver 也随自动导入方案下线，两条依赖和 catalog（`pnpm-workspace.yaml`）里的对应条目一起删了。 **一个包会不会进产物，取决于它在哪个篮子 + 有没有被真实 import，而不是名字像不像库。**

### 分包：这里没有 `manualChunks`，是 rolldown 的 `codeSplitting.groups`

全仓 `grep manualChunks` 命中 0 处。分包策略单独放在 `internal/vite-config/src/optimize.ts:1-36`，由 `createApplicationBuildConfig()` 挂到 `build.rolldownOptions.output.codeSplitting.groups`（`internal/vite-config/src/config/application.ts:40-43`）， `minSize` 是 20 KB（`:42`），入口/分片命名 `js/[name]-[hash].js`（`:39`、`:44`）。

| 命中条件（按源码顺序） | chunk 名 | 行号 |
| --- | --- | --- |
| `vue` / `pinia` / `vue-router` | `vendor-vue` | `optimize.ts:9-14` |
| `echarts` | `vendor-echarts` | `:15` |
| `@vueuse` / `es-toolkit` / `dayjs` / `xlsx` | `vendor-utils` | `:16-22` |
| `@vue-office` | `vendor-office` | `:23` |
| `pdfjs-dist` | `vendor-pdfjs` | `:24` |
| `@intlify` / `vue-i18n` | `vendor-i18n` | `:25-26` |
| `highlight.js` | `vendor-highlight` | `:27` |
| `prosemirror` / `marked` | `vendor-editor` | `:28-29` |
| 其余 `node_modules` | `vendor`（兜底） | `:30` |

::: warning 四条值得知道的细节

- 这些规则是 `id.includes(...)` 的**字符串包含**判断，且外层还要求 id 在 `node_modules` 里（`optimize.ts:8`），顺序即优先级。于是 `vue` 这条（`:9-14`）会把所有路径含 `vue` 的第三方包一起收进 `vendor-vue`：`@vueuse/*`、`@vue-office/*`、`vue-i18n` 都在到达 `vendor-utils` / `vendor-office` / `vendor-i18n` 之前就被截走，那三条规则实际只对不含 `vue` 的名字生效（`es-toolkit` / `dayjs` / `xlsx`、`@intlify/*`）。`packages/*` 自己的代码也不按这条切分 —— 它们的模块 id 不在 `node_modules` 下。
- `debugName` 是给产物体积报告看的（`:5-6`）：`name` 是函数，报告里默认显示匿名。
- 规则表会留孤儿：`vendor-office` 还在，但 `@vue-office/*` 四个包今天没有任何 import（见第六节）。规则本身不影响体积，只是别再以为产物里有 office 分片。
- 表里以前第一条是 `antdv-next` → `vendor-ui`，组件库下线后整条删掉了；同一批下线的是 `@form-create/*`，所以 `vendor-editor` 如今只剩 `prosemirror` 与 `marked`（`:28-29`）。改名后的兜底逻辑没变：凡是命中不了具名规则的第三方代码都进 `vendor`（`:30`）。:::

### `optimizeDeps` 的两个特例

`createOptimizeDeps()`（`internal/vite-config/src/config/application.ts:59-66`，挂在 `:97`）：

```ts
// internal/vite-config/src/config/application.ts:60-65
return {
  exclude: ['vue'],
  // 必须是真实包名：写成裸的 '@vueuse' 会报
  // "Failed to resolve dependency: @vueuse, present in optimizeDeps.include"
  include: ['@vueuse/core', 'es-toolkit'],
};
```

- `exclude: ['vue']`：vue 不预打包，交给 `resolve.dedupe` 保证单例。
- `include` 两个包名是显式预热，免得首屏冷启动时现扫现打包。
- 注释里那条报错是真实踩过的：include 写作用域前缀（裸 `@vueuse`）会直接解析失败。

### 单例与"两份 Vue"

`createCommonConfig()` 的 `resolve.dedupe: ['pinia', 'vue', 'vue-router']` （`internal/vite-config/src/config/common.ts:50`）是运行时的保险：pnpm 的 peer 解析曾让依赖树里同时存在 `@vue/runtime-core` 3.5.42 / 3.5.43，后果不只是类型打架，两份 Vue 的 inject 与响应式系统互相看不见。**装新依赖后如果出现"provide 拿不到值""响应式失效"，先怀疑有没有第二份 vue。**

### 顺手一条：`__APP_INFO__` 会把两张依赖表打进产物

`defineApplicationConfig()` 默认注入 `__APP_INFO__`，内容是构建时间加上 `package.json` 的 `dependencies` 与 `devDependencies` 两张表原样序列化（`internal/vite-config/src/config/application.ts:90-93`、 `internal/vite-config/src/utils/package-json.ts:43-54`）。 `appInfo: false` 可以关掉。

::: warning

它现在没人读全仓 `grep APP_INFO` 的命中全在注入侧、注释与一处测试用例名里：`application.ts:14`（选项文档）、`application.ts:93`（注入）、`package-json.ts:27`、`package-json.ts:42`（注释）、`apps/web/vite.config.ts:10`（注释）、`internal/vite-config/__tests__/package-json.test.ts:33`（测试用例名）。应用代码里没有任何消费者 —— `package-json.ts:42` 注释里说的"关于页展示版本与构建时间"并没有接上。也就是说：产物里目前白带了一份依赖清单。:::

### 没接线的通道：CDN externals

`vite-plugin-cdn-import` 在 `apps/web/package.json:152` 的 devDependencies 里，但 `internal/vite-config` 与应用侧都没有 import 它（grep 命中 0）。所以"外部模块走 CDN + `rollupOptions.external`"这条路在本仓库**不存在**， `base: './'` 的产物是自包含的静态目录，见[构建与部署](/guide/essentials/deploy)。

## 三、显式引入与类型声明是两层

以前这里写的是三层（编译期 import / 运行期 `app.component` / 类型层 dts），中间那层是给 `@form-create/antd-designer` 那类**发布时已编译好**的第三方模板准备的 —— 它在运行时用 `resolveComponent('a-layout-sider')` 找组件，源码里的显式 import 帮不到它，所以要 36 个 `a-*` 全局注册加 1 个 `a-form-item-rest` 透传占位。设计器整体下线后，`apps/web/src/plugins/vendor-antd-components.ts` 这个文件也删了，注册表与 `registerVendorAntdComponents()` 一起没了。于是只剩两层：

| 层 | 机制 | 作用时机 | 覆盖谁 | 出处 |
| --- | --- | --- | --- | --- |
| 编译期 | 写 `import { FButton } from '@antdv/common-ui'` | SFC 编译时把局部绑定接进模板 | **本仓库源码**里的每一个组件标签 | 守卫测试 `apps/web/src/views/__tests__/gallery-api-usage.spec.ts:122` 同时禁止示例页 import 第三方组件库 |
| 类型层 | `components.d.ts` / `auto-imports.d.ts` | 构建/dev 时被插件回写 | 只影响 TS 与 IDE，不代表任何东西被用到 | `internal/vite-config/src/plugins/index.ts:77-81` |

::: tip 运行期注册还剩一条，但目的完全不同

`apps/web/src/main.ts:120` 的 `app.component('PdfViewer', VuePdfEmbed)` 是今天全站唯一一次 `app.component`。它注册的不是 UI 原子件，而是一个体积大、只在少数页面出现的查看器；`vue-pdf-embed` 自身是预编译产物，注册成全局名后各处 `<PdfViewer>` 直接可用，不必每个页面 import 一次。紧随其后的 `:121` 把 worker 路径指到本地打包的 `pdfjs-dist/build/pdf.worker.min.mjs?url`（`main.ts:13`），所以这条依赖在产物里是自带 worker 分片的，对应 `optimize.ts:24` 的 `vendor-pdfjs`。:::

### 编译期：没有 resolver 了，组件全靠 import

`createAutoImportPlugins()`（`internal/vite-config/src/plugins/auto-import.ts:16-38`）过去注册过三个 resolver：`AntdvNextResolver`（`a-*` → `antdv-next`）、`AntdvUiResolver`（子包组件）、`IconifyResolver`（裸写 `<Icon>`）。**现在三个都删掉了**（文件只剩 39 行，解释性注释也已经跟着清走，删除动机记在提交历史与[核心概念](/guide/essentials/concepts)里）：

- 裸标签在编译期没人注入，运行期只留一条 `Failed to resolve component` 警告，页面却整块变空白 —— 图标静默消失、设计器外壳塌成空白标签，这类事故排查都要从编译配置倒推。
- 显式 import 让"谁在用、从哪来"在文件头部一眼可见，`import { cn } from '@antdv/shared/utils/cn'` 这种子路径写法也终于和组件写法统一。
- 子包不再假设宿主带着自动导入配置，别的应用直接引 `@antdv/common-ui`、`@antdv/icons` 也能跑。

`Components` 插件本身还留着（`:27-29`），但它只剩自带的能力：扫应用内 `src/components` 目录做本地组件注册，不涉及任何 npm 包 —— `apps/web` 的组件都已迁进 `@antdv/*`，dev 启动时那行 `[unplugin-vue-components] no components found` 就是这件事的直接证据。`AutoImport` 侧（`:23-26`）自动导入的仍然只有框架 API：`vue`、`@vueuse/core`、`pinia`、`VueRouterAutoImports` —— `antdv-next` 的 `message` / `notification` / `Modal` / `Drawer` 四个函数式入口也一起移除了，用它们得自己 import。

一个容易踩的细节：`<script setup>` 编译模板时按 `capitalize(camelize(tag))` 找局部绑定，所以 `<a-card>` 要命中别名 `ACard`、`<Card>` 要命中 `Card`。删 resolver 之后应用里的写法统一成显式 `import` + 保留 kebab 标签，配 ESLint 的 `vue/component-name-in-template-casing` 正好自洽。今天应用侧已经没有模板里的 `a-*` 标签了，业务页面与布局一律走 `@antdv/*` 组件。

### 类型层：`components.d.ts` 是扫描产物，条目数不作数

`apps/web/types/components.d.ts` 头部第 6 行写着 `Generated by unplugin-vue-components`， `@ts-nocheck` 在第 2 行。它是**扫到的本地标签清单**，两个含义要分清：

- 现在它里面**只剩 `RouterLink` / `RouterView` 两条**（来自 vue-router 的类型）：resolver 删掉之后插件不再认识任何第三方标签，而本地目录也是空的。看到 `typeof import('antdv-next')[...]` 说明你连的是还没重启的 dev server（旧配置还在内存里）。
- 没条目 ≠ 不能用：`VITE_WRITE_DTS=false` 时插件不回写这两个文件（开关在 `internal/vite-config/src/plugins/index.ts:77-81`，把 `dts` 传给 `createAutoImportPlugins()`），文件就停留在上次构建的状态；而 `main.ts:120` 那个全局注册也不靠它，走的是 `vue` 的 `GlobalComponents` 接口。

这两个文件是入库的（`git ls-files` 能看到），会随构建反复变动 —— 看 diff 时别把它们当语义变更。想知道某个标签到底有没有被用，只有一条路：在 `apps/web/src` 里搜标签本身。

## 四、把 packages/* 当模块给别的项目用

### 子路径即模块

`@antdv/shared` 的 `exports` 用了"通配符 + 目录模块显式列出"的组合（`packages/core/base/shared/package.json:21-55`，理由写在同文件 `//exports` 注释 `:20`）：

| 写法 | 解析到 | 本仓引用文件数 |
| --- | --- | --- |
| `@antdv/shared/utils/cn` | `dist/utils/cn.js`（走 `"./*"` 通配符，`:50-53`，`*` 可含斜杠） | 462 |
| `@antdv/shared/cache` | `dist/cache/index.js`（显式列出，`:26-29`） | 14 |
| `@antdv/shared/utils/env` | `dist/utils/env.js` | 10 |
| `@antdv/request/websocket` | `src/websocket/index.ts`（显式列出，`packages/request/package.json:26`） | 3 个文件，但只有 1 处真实 import（`apps/web/src/utils/ws.ts:5`），另两处是注释（`packages/core/hooks/src/index.ts:17`、`packages/request/src/index.ts:4`） |

对应构建侧：`packages/core/base/shared/tsdown.config.ts:16-22` 的 `entry: ['src/index.ts', 'src/*.ts', 'src/*/*.ts', 'src/*/index.ts', 'src/*/*/index.ts']` 与 `platform: 'neutral'`（`:24`）；`files: ["dist"]`（`package.json:14-16`）决定打包出去只带 `dist`。

为什么要分入口而不是塞一个 barrel：只 import 一个 `cn` 时不该把 `xlsx` / `dompurify` 的初始化一起拖进依赖图（`tsdown.config.ts:7-8` 的注释）。`@antdv/request` 同理，`sse / websocket` 各带一组管理器类、刻意不进 barrel（`packages/request/package.json:21-28`，注释 `:20`），HTTP 侧只额外开一个 `./runtime` 给应用接注入点（`:23`）。`@antdv/common-ui` 也一样：barrel 之外只开 `./charts`（`packages/core/ui-kit/common-ui/package.json:24`），ECharts 不进主入口。

::: tip

通配符入口只属于 `shared` `@antdv/request`、`@antdv/utils`、`@antdv/common-ui` 的 `exports` 都是**逐个列出**的白名单，没有 `"./*"`。也就是说在 `packages/request` 里新加一个 `src/foo.ts` 并不会自动变成 `@antdv/request/foo`，必须同时改 `exports` —— 只有 `shared` 那批目录模块享受通配符。:::

### 两种形态，能不能脱离 Vite 是关键差别

| 形态 | 包 | `main` | 改完 `src` | 外部可用吗 |
| --- | --- | --- | --- | --- |
| dist 发布 | `shared`、`types`、`hooks`、`preferences`、`directives`、`router` | `./dist/index.js`（`types` 是 `./dist/index.mjs`） | 必须重新 `build` | 只要装到 `dist` 就能被解析 |
| 源码发布 | `@antdv/icons`（`./src/index.ts`）、`@antdv/design`（`./src/index.css`）、`@antdv/enums`、`@antdv/layouts`、`@antdv/request`、`@antdv/stores`、`@antdv/utils`，以及 ui-kit 目录下那八个（`common-ui` / `shadcn-ui` / `form-ui` / `table-ui` / `popup-ui` / `layout-ui` / `menu-ui` / `tabs-ui`） | 直指 `src`（如 `packages/core/ui-kit/common-ui/package.json:17-19`：`main/module/types` 全指 `./src/index.ts`，`files: ["dist", "src"]` 在 `:13-16`；`packages/utils/package.json` 同形） | 直接热更新 | 编译产物有了，入口还没切过去：这十五个包都有 `build`（`vite build` + `defineLibraryConfig()`）并真的产出 `dist`，但 `exports["."]` 仍然指 `./src/index.ts` —— 外部宿主解析到的是 `.vue` 与 Tailwind 入口源文件，得自己带编译链，或把入口改指 `dist` |

`loading-ui` 与 `scrollbar-ui` 已经并进 `common-ui`（分别是 `src/components/loading/`、`src/components/scrollbar/`），ui-kit 顶层 `package.json` 从十个收敛到八个；`@antdv/composables` 这个包名也不存在了，HTTP / SSE / WebSocket 现在是 `@antdv/request`。

### 包边界是它们能被单点复用的唯一原因

`packages/*` 里不许 import `pinia` / `vue-router` 实例 / 应用 store，也不许读 `import.meta.env`；需要这些能力时由应用**注入**（守卫工厂、指令工厂、偏好 defaults、`@antdv/request` 的 `configureRequest()`）。细则与注入示例见[基础概念](/guide/essentials/concepts)与[目录说明](/guide/project/dir)，这里只补一句产物角度的后果：**包一旦被 store 绑住，脱离这个应用就装不起来**， `exports` 写得再漂亮也没用。类型例外（`packages/utils/src/menu.ts:3` 只 `import type { RouteRecordRaw } from 'vue-router'`）不进产物，不算破边界。

### 版本是锁步的 —— 但今天没有任何包发得出去

`.changeset/config.json:10` 的 `fixed: [["@antdv/*", "@antdv/*"]]` 让任何一个 `@antdv/*` 升版时全家跟着跳到同一个版本号；`:14-17` 的 `privatePackages: { version: true, tag: true }` 让私有包照样参与递增与打 tag。**对外部项目的含义是：你拿到的是一起跳的版本号，不能只钉其中一个包**（这也是内部互引一律 `workspace:*` 的另一面，见 [Changeset](/guide/project/changeset)）。

::: warning

现在没有 npm 这条路 `packages/*`、`internal/*`、`apps/*`、`docs`、`scripts/*` **全部** `"private": true` （逐个文件验证过，例如 `packages/core/base/shared/package.json:5`）。 `changeset publish` 不会发私有包；`pnpm publint`（`vsh publint`）在 `scripts/vsh/src/publint/index.ts:166` 明确对私有包直接放行 ——也就是说这条发布面检查当前覆盖 0 个包。所以"给别的项目用"目前只有把包目录（含 `dist`）带出去、或自己改成非私有再发这两类做法， `exports` / `files` 是为这两类做法准备的。:::

改 `packages/*/src` 之后应用看不看得到变化，取决于上面那张表里的形态：dist 发布的六个包（`shared` / `types` / `hooks` / `preferences` / `directives` / `router`）读的是 `dist`，必须重新 `build`；源码发布的那十五个直接热更新。`turbo.json:16-19` 的 `build.dependsOn: ["^build"]` 保证重建时按依赖顺序先把上游 `dist` 出来，`dev` / `type-check` / `test:unit` / `test:e2e` 同样挂着 `^build`（`:20-34`）—— 具体命令见[快速开始](/guide/introduction/quick-start)。

### 库形态的构建链已经接上，发布面还没接

`internal/vite-config/src/config/library.ts:215` 导出 `defineLibraryConfig()`，external 清单取 `dependencies + peerDependencies` 全量排除（`internal/vite-config/src/utils/package-json.ts:63-71`，注释 `:57-62` 说明打进来会带第二份 vue、体积爆炸且响应式系统会分裂）。今天上面那十五个 `vite build` 形态的包（`@antdv/icons`、ui-kit 那八个、`layouts` / `request` / `stores` / `utils` / `enums` / `design`）用的都是它 —— 一个 `vite.config.mts` 里就 `import { defineLibraryConfig } from '@antdv/vite-config'` + `export default defineLibraryConfig()` 两行，SFC 与 Tailwind 入口由包自己的构建链编译进 `dist`；另外六个纯 TS 包走 tsdown。判据是 `packages/**/package.json` 的 `scripts.build`，21 个 `@antdv/*` 包一个不缺。

还差的一步是入口切换：`exports["."]` 指 `src` 是为了保住本仓 dev 的 HMR（见上面那张表），真要对外发组件库时得把它改指 `dist` 并把 `dist` 的产物形状校验接进 `vsh publint` —— 那条检查现在因为全部包都是私有而覆盖 0 个。

## 五、反过来：外部子应用与外部仓库

### 微前端注册表

`apps/web/src/config/micro-app.ts:5-92` 是一份 6 条的子应用注册表（`:10`、`:24`、`:38`、`:51`、`:65`、`:78` 各一个 `name`，字段有 `url` / `baseroute` / `icon` / `loader` / `healthUrl` …），总开关 `enabled` 用 `isEnvEnabled(import.meta.env.VITE_MICRO_APP)` （`:7`，写成 `=== true` 会恒为 false）。文件尾部另挂了 `getMicroAppByName()`（`:94-96`）与 `getAllMicroApps()`（`:98-100`）两个只读出口。类型契约在 `packages/core/base/typings/src/micro-app.ts`， `loader` 只有 `'iframe' | 'webcomponent'` 两种（`:21`）。路由侧怎么按 `baseroute` 匹配见 [路由和菜单](/guide/essentials/route)。

`<micro-app>` 这个标签不会被 Vue 当成"没注册的组件"：编译期通过 `compilerOptions.isCustomElement` 把它交给浏览器当原生元素（`internal/vite-config/src/plugins/vue.ts:43` 装配 `createIsCustomElement()`）。规则只认显式登记的 `micro-app`（`custom-elements.ts:21`）与前缀 `micro-` 且必须含连字符（`:24`、判定体 `:47-55`），否则会把真实的注册失败吞成空标签 —— 这个取舍写在同文件头部注释 `:15-17`。

::: warning

本仓库没有装任何微前端 SDK `@micro-zoe/micro-app` / `wujie` / `qiankun` 在全部 `package.json` 里搜不到（0 命中）。 `<micro-app>` 是靠 SDK 在运行时 `customElements.define()` 注册的标签，而 `apps/web/src/views/micro-app/SubAppView.vue:73` 用 `!!window.microApp` 判断就绪、`:76` 得出 `useIframe = isExternalUrl || !isMicroAppReady` —— 当前依赖状态下这个表达式**恒为 true**，实际每条路都走 `<iframe>`（`:272-283`），`<micro-app>` 分支（`:286-305`）是留给"以后接 SDK"的。iframe 的 `sandbox` 由 `buildIframeSandbox()`（`packages/core/base/shared/src/utils/iframe.ts`）拼装，默认不含 `allow-same-origin`（`:82-89`）；注册表的类型里有 `sameOrigin?: boolean`（`packages/core/base/typings/src/micro-app.ts:26`），但今天 6 条配置**没有一个**写它，所以放开同源身份的路径实际是关闭的；一旦有人打开，`:90` 的 `canEscapeSandbox()` 会让右上角挂出"同源预览"标签（`:316-322`）。:::

### 上游同步

`sync-upstream.json` 记录上游是 `vbenjs/vue-vben-admin`，同步目录只有 `internal/lint-configs`（`syncDirs`），并且 `previewMode: true`； `.sync-state.json` 里留着已同步文件的 upstream OID 清单。

::: warning

`pnpm sync-upstream` 这条命令是断的根 `package.json` 的 `"sync-upstream": " sync-upstream"` 只写了同名命令，但 `node_modules/.bin` 里没有它、`pnpm-lock.yaml` 里也没有对应包（两处都 grep 过 0 命中）。别指望跑它拉上游代码。:::

## 六、这些外部模块其实没人用了

本节只做盘点，不动任何东西。判定口径：在 `apps/web/src`、`packages/**`、 `internal/**`、`apps/backend-mock` 里（`*.ts` / `*.vue` / `*.mts`，排除 `dist`）搜包名字符串，0 命中即"没有直接 import"。

| 依赖 | 声明处（`apps/web/package.json`） | 状态 |
| --- | --- | --- |
| `@videojs-player/vue`、`@videojs/http-streaming`、`video.js` | `:51`、`:52`、`:93` | 唯一用过它们的 `views/components/video/` 已经删掉（HEAD 里搜不到该目录，`git log -- apps/web/src/views/components/video` 有历史提交） |
| `@vue-flow/background`、`/controls`、`/core`、`/minimap` | `:53-56` | 全仓只在 `apps/web/package.json` 出现，历史上也没有页面 |
| `bpmn-js`、`bpmn-js-i18n-zh`、`bpmn-js-properties-panel`、`camunda-bpmn-moddle` | `:63-66` | 同上，0 命中 |
| `@vue-office/docx`、`/excel`、`/pdf`、`/pptx` | `:57-60` | `docx`/`excel` 只剩 `views/components/upload/index.vue:671`、`:1131-1166` 的注释与"如未显示请确认已安装"占位文案；`pdf`/`pptx` 连注释都没有。而 `internal/vite-config/src/optimize.ts:23` 的 `vendor-office` 分片规则还在 |
| `codemirror`、`vue-codemirror`、`@codemirror/commands`、`/lang-javascript`、`/lang-sql`、`/lang-vue`、`/theme-one-dark` | `:39-43`、`:68`、`:96` | 0 命中（编辑器现在是 tiptap，不是 CodeMirror） |
| `nanoid`、`qrcode`、`resize-observer-polyfill`、`vue-demi`、`vue-virtual-scroller` | `:82`、`:86`、`:88`、`:98`、`:103` | 0 命中 |
| `vite-plugin-cdn-import`、`@vitejs/plugin-legacy`、`vite-plugin-iconify-offline` | `:152`、`:129`、`:157` | devDependencies 里的构建插件，没有任何 import（`@vitejs/plugin-legacy` 在 `internal/vite-config/package.json:37` 也挂了一份，同样没人用）。与[配置](/guide/essentials/config)末尾那条警告是同一批 |

::: warning 别把 `vite-plugin-iconify-offline` 当成在用的那个 离线图标插件真正 import 的是 **`@tomjs/vite-plugin-iconify`**（`internal/vite-config/src/plugins/auto-import.ts:7`，用法 `:30-32`），它在 `apps/web/package.json:115` 有独立声明。名字更像的 `vite-plugin-iconify-offline`（`:157`）是另一回事 —— 0 命中。同理 `@tiptap/*` 已经从应用挪进 `packages/core/ui-kit/common-ui/package.json:38-46`，那 9 条**全都有 import**（`src/components/markdown-editor/**`），不在本表里。:::

### 工具怎么把它们抓出来

| 命令 | 实际执行 | 关键细节 |
| --- | --- | --- |
| `pnpm check:dep` | `vsh check-dep` → knip（`pnpm-workspace.yaml:170` 钉 `knip: ^6.40.0`） | 配置不落盘，内联在 `scripts/vsh/src/check-dep/index.ts:14-31`，运行时写到 `os.tmpdir()` 再跑（`:92-98`）。参数是 `--include dependencies --reporter json`（`:100-109`）——**只看 `dependencies` 侧的未使用**，devDependencies 那一侧不在它的报告范围里 |
| `pnpm publint` | `vsh publint` → publint | 遍历所有 workspace 包的 `package.json`（`scripts/vsh/src/publint/index.ts:39-52`），但私有包直接 `return null`（`:166-168`）—— 本仓全是私有包，所以现在报不出东西 |
| `pnpm check:circular` | `vsh check-circular` | 包与包之间的环，跟"未使用"是两回事 |
| `pnpm check` | circular + dep + type + cspell 串起来 | 最后一环必失败（`cspell` 不在任何依赖里），见[常见问题](/guide/other/faq) |

::: warning

"报未使用"不等于"可以删" `check:dep` 的内置配置里有一串 `ignoreDependencies` （`scripts/vsh/src/check-dep/index.ts:17-29`：`playwright`、`rimraf`、`tailwindcss`、`@iconify/json`，以及 `@antdv/{commitlint,eslint,oxfmt,oxlint,stylelint}-config` 与 `@antdv/{design,vite-config}` 这些只在构建期被配置引用的包内件），`ignore` 排掉 `dist/**`、`docs/**`、`node_modules/**`、`public/**`（`:15`）， `ignoreWorkspaces` 排掉 `internal/lint-configs/*` 与 `scripts/*`（`:30`）。另一方面，被别的包的 peer 拖住的依赖在源码里本来就搜不到 import。所以每一条都要回到"谁 import 它 / 谁的 peer 需要它"再定，升级侧的同类提醒见[项目更新](/guide/other/project-update)。:::

## 相关页面

- [基础概念](/guide/essentials/concepts)：分层、包边界与自动导入的完整清单
- [目录说明](/guide/project/dir)：包清单、catalog 的动机、tsdown + turbo
- [Vite Config](/guide/project/vite)：三层合并、插件装配、构建开关
- [配置](/guide/essentials/config)：`VITE_*` 的两条读取路径与变量清单
- [本地开发](/guide/essentials/development)：环境变量与日常脚本
- [快速开始](/guide/introduction/quick-start)：安装、启动、改了共享包不生效怎么办
- [项目更新](/guide/other/project-update)：升级依赖时的版本落点与安装期开关
- [Changeset](/guide/project/changeset)：`fixed` / `privatePackages` 的发版链路
- [图标](/guide/essentials/icons)：离线图标插件 `@tomjs/vite-plugin-iconify` 装配在哪、图标名怎么对账
- [路由和菜单](/guide/essentials/route)：子应用怎么按 `baseroute` 匹配进路由表
