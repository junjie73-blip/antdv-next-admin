# 项目更新

克隆下来它就是你的仓库了 —— 没有人会给你推送更新。这篇讲清楚**版本钉在哪里**、 **哪些更新工具真的装了**、**一次升级要跑哪些检查**，以及 antdv-next 跨版本升级时最先出问题的是哪几处。所有版本号都对着 `pnpm-workspace.yaml` 与 `pnpm-lock.yaml` 读过。

## 版本的三处落点

| 位置 | 内容 | 说明 |
| --- | --- | --- |
| `pnpm-workspace.yaml` 的 `catalog:` | 247 条 | 全仓唯一的版本来源；`apps/web` 的 155 条依赖（`dependencies` 93 + `devDependencies` 62）全是 `catalog:` 或 `workspace:*`，没有一条写字面量 |
| `pnpm-workspace.yaml` 的 `overrides` | `vue` / `clsx` / `pinia` / `@ctrl/tinycolor` / `@ast-grep/napi` → `catalog:` | 强制这些包只有一份实例，防止第三方 peer 树各装各的 |
| 根 `package.json` | `packageManager: pnpm@10.12.4`、`engines.node: ">=22"`；`.node-version` 写 24.0.0 | `preinstall` 挂了 `only-allow pnpm`，用 npm/yarn 装出来的 workspace 是假的 |

**依赖版本没有一处字面量**：所有包（含 `apps/web`）的依赖一律 `catalog:` 或 `workspace:*`。唯一的形式差异是 `apps/web` 的 `vue` 走的是**具名 catalog** —— `"vue": "catalog:conflicts_vue_h3_5_43"`（`apps/web/package.json:101`，`dependencies` 块从 `:17` 到 `:111`）。改版本就改 `pnpm-workspace.yaml` 的 `catalog:` 那一行，别在子包补字面量。

::: warning

具名 catalog 只有一条，而且被 overrides 顶住了 `catalogs.conflicts_vue_h3_5_43`（`pnpm-workspace.yaml:270-272`，`vue: ^3.5.43`）确实被 `apps/web` 引用，不是死配置；但 `overrides.vue: 'catalog:'`（`:298-303`）会把它按回默认 catalog 里的**精确** `3.5.43`（`:235`）。也就是说这条具名通道现在解析不出任何不同的版本，留着它只是历史痕迹 —— 真要升 Vue，改 `catalog:` 的 `:235` 那一行就够了。
:::

## 安装期真正生效的开关

pnpm 10 的构建脚本白名单在这里是**显式维护**的（`pnpm-workspace.yaml`）：`onlyBuiltDependencies` 只放行了 4 个 `@vue-office/*`，`ignoredBuiltDependencies` 明确跳过 `esbuild`、`core-js`、`lefthook` 和一堆 imagemin 二进制，另有 `allowBuilds` 映射。**升级到一个带 postinstall 的新依赖时，pnpm 不会问你，它直接跳过并打一行 "Ignored build scripts"** —— 表现是装完了但原生二进制没下（`vite-plugin-imagemin` 这类最容易中）。每次 `pnpm install` 后扫一眼这段输出，再决定要不要加进白名单。

同文件里还有三个会影响升级体感的值：`verifyDepsBeforeRun: false`（跑脚本前不校验 node_modules 与 lockfile 是否同步，改完 catalog 忘了 install 就直接跑，用的还是旧树）、`minimumReleaseAge: 0` （刚发布的版本立刻可被解析，没有供应链缓冲期）、`dedupePeerDependents: true` + `strictPeerDependencies: false` + `autoInstallPeers: true`。

## 仓库里真的有（与没有）的更新工具

| 命令 | 实际执行 | 状态 |
| --- | --- | --- |
| `pnpm update:deps` | `npx taze -r -w` | 可用，但 taze **不在依赖里**，每次由 npx 现拉 |
| `pnpm catalog` | `pnpm dlx codemod pnpm/catalog` | 可用；把散落的字面量版本收进 catalog 的那条路 |
| `pnpm check:dep` | `vsh check-dep` → knip 6.40.0 | 可用（knip 是 `scripts/vsh` 的依赖）。注意它的默认配置 ignore 了 `docs/**`，`ignoreDependencies` 里还写死了 `playwright`、`rimraf`、`tailwindcss` 等一串 —— 报"未使用"不等于可以删 |
| `pnpm check:circular` | `vsh check-circular` → circular-dependency-scanner | 可用 |
| `pnpm check:type` | `turbo run type-check` | 可用（脚本名是 `check:type`，**没有** `pnpm typecheck`） |
| `pnpm check:cspell` | `cspell lint ...` | **必失败**：没有任何 package.json 依赖 cspell，见[常见问题](/guide/other/faq) |
| `pnpm check` | circular + dep + type + cspell 串起来 | 最后一环是断的，日常用前三条 |
| Git 钩子 | `lefthook`（`prepare` 时 `lefthook install`） | `.git/hooks` 里确实装了，但 `lefthook.yml` 只有 `# pre-commit:`（`:1-11`）与 `# post-merge:`（`:13-16`）两段、**全部是注释**，连 `commit-msg` 都没有 —— 等于没有强制门禁（commitlint 只在手动 `pnpm commit`/`czg` 那条路上生效）。也没有 `simple-git-hooks` / `lint-staged` |

## changesets：版本跳了，但没人替你发

```bash
pnpm changeset                    # 生成 .changeset/*.md（工作区里当前有 25 份待发布）
pnpm version                      # changeset version && pnpm install --no-frozen-lockfile
pnpm release                      # pnpm build && changeset publish
```

`.changeset/config.json` 里三个决定值得注意：`fixed: [["@antdv/*", "@antdv/*"]]`（`:10`）让所有 `@antdv/*` 包**在同一次 `pnpm version` 里一起跳版本号**；`privatePackages: { version: true, tag: true }`（`:14-17`）允许给私有包写版本和打标签；`updateInternalDependencies: "patch"`（`:21`）。changelog 走 `@changesets/changelog-github`，仓库名写死为 `junjie73-blip/antdv-next-admin`（`:3-8`）。

::: warning

`fixed` 不等于"现在大家都是同一个号" 上一次 `pnpm version` 之后新建的包是**带着自己的初版号进组的**，所以当前仓库的版本号是散的：多数包 `0.4.0`（= 根包 `package.json:3`），`@antdv/layouts` 已经 `0.5.0`，`@antdv/{common-ui,enums,request,stores,utils}` 从 `0.1.0` 起步，`internal/lint-configs/*` 与 `@antdv/docs` 停在 `0.0.0`，`scripts/*` 两个（`@antdv/turbo-run`、`@antdv/vsh`）还是脚手架带来的 `5.8.0`。下一次 `pnpm version` 才会把它们拉齐 —— 别按号判断"这个包比那个包新"。
:::

::: danger

别把 `pnpm release` 当成"发 npm" `packages/*`、`apps/*`、`docs` 与根包的 package.json **全部是 `"private": true`**（唯一的 `publishConfig` 在 `packages/core/ui-kit/shadcn-ui/package.json:29`，它只是把 `src` 的 exports 原样重复一遍，那个包同样是 private）。changesets 在这里只产出 CHANGELOG 与 git tag，不会往 registry 推任何东西。发布历史也确实薄： `git tag` 现在只有 `v0.0.3` 和一个 `vnull`，而版本号已经走到 0.4.0；`.github/workflows/` 里只有 `docs.yml` 一个文件。**升级与发版目前是一次纯本地动作**，要打标签得自己 `git tag && git push --tags`。
:::

## 一次 antdv-next 升级怎么跑

`antdv-next` 只在 catalog 里出现一次（`pnpm-workspace.yaml:116`，`^1.6.0`），而现在**只有 `apps/web` 直接依赖它**（`apps/web/package.json:67`）—— `apps/web` 的 21 个运行时子包一个都不引（`shared`、`types`、`hooks`、`preferences`、`directives`、`router`、`stores`、`request`、`utils`、`enums`、`icons`、`design`、`layouts` 与 `ui-kit` 那八个都已清空）：轻提示走 `@antdv/popup-ui`（vue-sonner 的封装），表单/表格/弹窗/标签页/菜单/布局的实现是 TanStack + shadcn-vue。这条边界由 `packages/core/hooks/__tests__/boundary.test.ts` 逐文件守着（第一节 `:136-186`，含"源码里没有组件库 import"和"清单的 dependencies / peerDependencies 里没有组件库"两条），所以升级 antdv-next 只动应用，不会碰子包产物。同一个文件还有第二节「跨包只走包名导入」（`:188` 起），守的是另一类边界：相对路径不许伸进别的包（唯一例外是 `@antdv/design` 的 `@source`，Tailwind 只认文件系统路径，名单还必须覆盖所有带 `.vue` 的包）、跨包 `@antdv/*` 要写进 `dependencies`/`peerDependencies`、`src` 里不通过自己的包名绕 barrel。配套还要看 `@antdv-next/*` 卫星包：catalog 里挂着三个（`cssinjs` `:22`、`icons` `:23`、`tailwind` `:24`），实际只有 `apps/web` 引用了前两个（`apps/web/package.json:18-19`），`@antdv-next/tailwind` 已经没有消费者 —— 升级时它的 catalog 行可以不管，甚至可以顺手删。真正还会把 antd DOM 打进产物的是 `@form-create/antd-designer` + `@form-create/antdv-next`（catalog `:42`，`apps/web/package.json:46-47`），见下面第 2 条。`@iconify-json/*` 那五个图标集（catalog `:43-47`）主要住在 `@antdv/icons`（`packages/core/base/icons/package.json:27-31`），`apps/web` 另外直依赖 carbon 与四个 dev 侧集合（`apps/web/package.json:48,116-119`）。

```bash
# 1. 改 pnpm-workspace.yaml 里 catalog 的那一行
pnpm install --no-frozen-lockfile
# 2. 先构建"产物发布"的那批包（shared、types、hooks、preferences、
#    directives、router 六个，`main` 指 ./dist）—— 应用吃的是它们的 dist；
#    其余 15 个（design、icons、enums、layouts、request、stores、utils
#    与 ui-kit 八包）是"源码发布"，`main` 直指 ./src，由 web 的 Vite 直接编译
pnpm build
# 3. 类型 + 单测（turbo 会按依赖图先跑 ^build）
pnpm check:type
pnpm test:unit
# 4. 端到端：先在单引擎上验，别一上来就三引擎并行
cd apps/web && pnpm exec playwright test --project=chromium --reporter=line
```

端到端这一层的三个前提别搞错（`apps/web/playwright.config.ts`）：baseURL 是 `http://localhost:6080` （来自 `apps/web/.env.development` 的 `VITE_PORT`），**dev server 进程内还挂着 5320 的 Nitro mock**，所以只起一个 `pnpm dev` 就前后端齐活；`workers` 本地压到 3、CI 串行 1，因为默认并发会把"同时扛着 Vite 按需编译 + 进程内 mock"的单个 dev 进程打满，结果是一堆纯超时的假红（见[测试策略](/guide/project/testing)）。 `pnpm test:e2e:install` 首次要装三个内核。

`pnpm build` 也值得知道两件事：它带 `NODE_OPTIONS=--max-old-space-size=8192`（全仓构建会顶满默认堆），而 `turbo.json` 的 `globalDependencies` 里含 `pnpm-lock.yaml` —— **任何一次 install 都会让 turbo 的全仓缓存失效**，升级那轮构建慢是预期内的。

## 破坏性升级最先敲门的五处

1. **`ConfigProvider` 的 theme 形状**（`apps/web/src/App.vue:67-74`，`themeConfig` 计算在 `:21-23`）。`theme` 对象由 `apps/web/src/settings/theme/index.ts:80-122` 的 `getAntdTheme` 组装：`algorithm`（`darkAlgorithm` / `defaultAlgorithm` / `compactAlgorithm`，`:87-94`）、`token`（`lightToken` / `darkToken` + 注册式风格预设 + 运行时覆盖，`:98-116`）、`components`（`:117-120`）三层。算法字段改名不会报错，只会让深色/紧凑主题静默退回默认。另一条独立链路是偏好 → DOM：`packages/core/preferences/src/update-css-variables.ts:37-72` 的 `applyPreferencesToDom` 只写 `@antdv/design` 那套 `--app-*` / `--radius-*` 变量（主题相关的写在 `:85-115`），曾经给 antd 兼容层用的 `--ant-color-primary`、`--ant-primary-color`、`--ant-border-radius` 已经删干净，并被 `packages/core/preferences/__tests__/update-css-variables.test.ts:64-78` 反向钉住"不许再出现"。主题口径见 [主题与偏好设置](/guide/in-depth/theme)。
2. **子组件模板写法**。第一方源码已经**没有** antd 组件的使用者了：`apps/web/src` 里 `from 'antdv-next'` 只剩三处生产代码（`App.vue:8`、`plugins/vendor-antd-components.ts:5-42`、`settings/theme/index.ts:2-4`）和两个测试（`settings/__tests__/antd-theme.test.ts`、`views/__tests__/gallery-api-usage.spec.ts`），页面与布局要用组件只能引 `@antdv/*` 的封装件 —— 这条由守卫测试 `apps/web/src/views/__tests__/gallery-api-usage.spec.ts:137` 钉住。堵不住的是预编译的第三方模板：`@form-create/antd-designer` 在运行时靠 `resolveComponent('a-…')` 找组件，服务它的是 `apps/web/src/plugins/vendor-antd-components.ts` 里那 36 条 kebab-case 注册（清单 `:59-96`，登记在 `:112-119`，另加 `a-form-item-rest` 一个透传占位）—— 新增物料要补的是这张表。名字缺失**不会让构建失败**，只有一句 `Failed to resolve component` warning + 一块空节点，所以 `apps/web/e2e/gallery-examples.spec.ts` 在示例页用例末尾断言这类 warning 为空（`:968-972`、`:1394-1398`），详情列表则改数 common-ui 自己的 `[data-common-descriptions-label]`（`:937`）。
3. **Table**。`App.vue:73` 在 antd 的 `ConfigProvider` 上全开了 `virtual`，但它只影响**仍在渲染 antd 表格的地方**（设计器物料）；`@antdv/table-ui` 的 `BasicTable` 是 TanStack 实现，是否开内部滚动容器与钉住表头只看数值 `scroll.y`（`packages/core/ui-kit/table-ui/src/BasicTable.vue:151`），`types.ts:648` 那个 `virtual` 字段是表格自己的虚拟滚动开关，两者不同名同源。拖拽排序那边，`packages/core/ui-kit/table-ui/src/hooks/useDragSort.ts:26-46` 每次事件现量一次"第一条数据行前面有几行"（数据行是 `<tbody>` 里唯一带 `data-row-key` 的 `<tr>`，见 `BasicTable.vue:1364`），所以前面插测量行/占位行都不会让下标错位。两处都有单测（`packages/core/ui-kit/table-ui/__tests__/drag-sort.test.ts`）。
4. **"用错也不报错"的 API**。`apps/web/src/views/__tests__/gallery-api-usage.spec.ts` 会先替你抓到三类：具名 `useApp`（1.6 只有 `App.useApp()`）、把权限指令的参数写成修饰符（`v-permission:role` 才对）、Tabs 绑 `@add`（1.6 只有 `@edit`）。
5. **图标**。`@antdv-next/icons`（catalog `:23`，`apps/web/package.json:19`）+ 5 个 `@iconify-json/*` 集合（catalog `:43-47`）+ `internal/vite-config/src/plugins/auto-import.ts:30-32` 的离线列表（`local: ['carbon', 'ant-design', 'lucide', 'fa6-regular', 'mdi']`，名单必须与依赖同步，少一个就变成构建期现拉或直接空白）。写错的图标名不报错，只是空白方块，所以有 `apps/web/test/icon-names.test.ts` 扫 `apps/backend-mock/server`、`apps/web/src`、`packages` 三个根做对账（`SCAN_ROOTS`，`:45`）。

::: tip

Vue 是被精确钉死的运行时 默认 catalog 里 `vue: 3.5.43`（`pnpm-workspace.yaml:235`）没有范围号；catalog 里另有 11 个精确版本（`reka-ui`、`@vueuse/core`、`vee-validate` 等），但只有 `vue` 同时出现在 `overrides`（`:298-303`）里，等于强制整棵树只有一份实例。原因是范围号会让部分第三方 peer 树停在 3.5.42，于是 `@vue/runtime-core` 出现两份类型，跨包传 Directive 直接打架。升 Vue 之前先决定 `overrides` 要不要跟着动。
:::

要把不需要的东西拆掉，看[移除代码](/guide/other/remove-code)；工程侧的其它约定见 [开发规范与环境变量](/guide/essentials/development)、[目录说明](/guide/project/dir)。
