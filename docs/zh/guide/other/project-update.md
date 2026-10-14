# 项目更新

克隆下来它就是你的仓库了 —— 没有人会给你推送更新。这篇讲清楚**版本钉在哪里**、 **哪些更新工具真的装了**、**一次升级要跑哪些检查**，以及 antdv-next 跨版本升级时最先出问题的是哪几处。所有版本号都对着 `pnpm-workspace.yaml` 与 `pnpm-lock.yaml` 读过。

## 版本的三处落点

| 位置 | 内容 | 说明 |
| --- | --- | --- |
| `pnpm-workspace.yaml` 的 `catalog:` | 254 条 | 全仓唯一的版本来源；`apps/web/package.json` 的 170 条依赖全是 `catalog:` 或 `workspace:*`，没有一条写字面量 |
| `pnpm-workspace.yaml` 的 `overrides` | `vue` / `clsx` / `pinia` / `@ctrl/tinycolor` / `@ast-grep/napi` → `catalog:` | 强制这些包只有一份实例，防止第三方 peer 树各装各的 |
| 根 `package.json` | `packageManager: pnpm@10.12.4`、`engines.node: ">=22"`；`.node-version` 写 24.0.0 | `preinstall` 挂了 `only-allow pnpm`，用 npm/yarn 装出来的 workspace 是假的 |

**整个工作区只有 3 个依赖没走 catalog**：`apps/web` 的 `clsx@^2.1.1`、`pinia@^3.0.4`、 `vue@^3.5.43`。前两个是历史遗留（`overrides` 已经把它们按回 catalog 口径），`vue` 那行即使写了范围号也会被 `overrides` 顶成 `3.5.43`。改版本就改 `catalog:` 那一行，别在子包补字面量。

::: warning 一处死配置 `pnpm-workspace.yaml` 末尾还有个具名 catalog `catalogs.conflicts_vue_h3_5_43`（`vue: ^3.5.43`），但全仓没有任何 package.json 写 `catalog(conflicts_vue_h3_5_43)` —— 它不参与解析，别指望它生效。:::

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
| `pnpm check:cspell` | `cspell lint ...` | **必失败**：没有任何 package.json 依赖 cspell，见[常见问题](/zh/guide/other/faq) |
| `pnpm check` | circular + dep + type + cspell 串起来 | 最后一环是断的，日常用前三条 |
| Git 钩子 | `lefthook`（`prepare` 时 `lefthook install`） | `.git/hooks` 里确实装了，但 `lefthook.yml` 的 `pre-commit` / `post-merge` / `commit-msg` **整段被注释**，等于没有强制门禁。也没有 `simple-git-hooks` / `lint-staged` |

## changesets：版本跳了，但没人替你发

```bash
pnpm changeset                    # 生成 .changeset/*.md（工作区里当前有 15 份待发布）
pnpm version                      # changeset version && pnpm install --no-frozen-lockfile
pnpm release                      # pnpm build && changeset publish
```

`.changeset/config.json` 里三个决定值得注意：`fixed: [["@antdv/*", "@antdv/*"]]` 让所有 `@antdv/*` 包**永远同版本号一起跳**（所以各包 package.json 都是 0.4.0，包括 `scripts/turbo-run` 与 `scripts/vsh` 这两个还是 5.8.0 的）；`privatePackages: { version: true, tag: true }` 允许给私有包写版本和打标签； `updateInternalDependencies: "patch"`。changelog 走 `@changesets/changelog-github`，仓库名写死为 `junjie73-blip/antdv-next-admin`。

::: danger 别把 `pnpm release` 当成"发 npm" `packages/*`、`apps/*` 与根包的 package.json **全部是 `"private": true`**，也没有 `publishConfig`。changesets 在这里只产出 CHANGELOG 与 git tag，不会往 registry 推任何东西。发布历史也确实薄： `git tag` 现在只有 `v0.0.3` 和一个 `vnull`，而版本号已经走到 0.4.0；`.github/workflows/` 里只有 `docs.yml`（它的注释还引用了一个不存在的 `ci.yml`）。**升级与发版目前是一次纯本地动作**，要打标签得自己 `git tag && git push --tags`。:::

## 一次 antdv-next 升级怎么跑

`antdv-next` 只在 catalog 里出现一次（`^1.6.0`），但它是 4 个包的直接依赖（`composables`、 `preferences`、`shared`、`types`）加 `apps/web`，改一行全仓生效。配套还要看 `@antdv-next/*` 四个卫星包（`cssinjs`、`icons`、`tailwind`、`happy-work-theme`）与 `@iconify-json/*`。`ui-kit` 那十个包一个都不引 antdv-next —— 表单/表格/弹窗/标签页/菜单/布局的实现已经换成 TanStack + shadcn-vue，所以升级 antdv-next 不会碰到它们。

```bash
# 1. 改 pnpm-workspace.yaml 里 catalog 的那一行
pnpm install --no-frozen-lockfile
# 2. 先构建"产物发布"的那批包（shared、composables、directives、layouts、
#    preferences、router、types）—— 应用吃的是它们的 dist；而 icons、styles 与
#    ui-kit 九包是"源码发布"，直接从 src 读，不需要构建
pnpm build
# 3. 类型 + 单测（turbo 会按依赖图先跑 ^build）
pnpm check:type
pnpm test:unit
# 4. 端到端：先在单引擎上验，别一上来就三引擎并行
cd apps/web && pnpm exec playwright test --project=chromium --reporter=line
```

端到端这一层的三个前提别搞错（`apps/web/playwright.config.ts`）：baseURL 是 `http://localhost:6080` （来自 `apps/web/.env.development` 的 `VITE_PORT`），**dev server 进程内还挂着 5320 的 Nitro mock**，所以只起一个 `pnpm dev` 就前后端齐活；`workers` 本地压到 3、CI 串行 1，因为默认并发会把"同时扛着 Vite 按需编译 + 进程内 mock"的单个 dev 进程打满，结果是一堆纯超时的假红（见[测试策略](/zh/guide/project/testing)）。 `pnpm test:e2e:install` 首次要装三个内核。

`pnpm build` 也值得知道两件事：它带 `NODE_OPTIONS=--max-old-space-size=8192`（全仓构建会顶满默认堆），而 `turbo.json` 的 `globalDependencies` 里含 `pnpm-lock.yaml` —— **任何一次 install 都会让 turbo 的全仓缓存失效**，升级那轮构建慢是预期内的。

## 破坏性升级最先敲门的五处

1. **`ConfigProvider` 的 theme 形状**（`apps/web/src/App.vue:46-62`）。`theme` 对象由 `packages/preferences/src/theme/index.ts` 组装：`algorithm`（`darkAlgorithm` / `defaultAlgorithm` / `compactAlgorithm`）、`token`（`lightToken` / `darkToken` + 预设 + 运行时覆盖）、 `components` 三层。算法字段改名不会报错，只会让深色/紧凑主题静默退回默认。同一层还要留意 `css-vars.ts` 把主色**写两遍**（`--ant-color-primary` 与旧命名 `--ant-primary-color`），主题口径见 [主题与偏好设置](/zh/guide/in-depth/theme)。
2. **子组件模板写法**。还有 4 个页面在用 antd 子组件（`views/account/center`、 `views/components/form/steps`、`views/components/table/crud`、`views/system/notice`），而 resolver 下线后它们全部走显式 import（`import { DescriptionsItem as ADescriptionsItem } from 'antdv-next'`）—— `apps/web/src` 里已经没有一个裸 `<a-descriptions-item>` 标签了。这把第一方源码的失败面堵住了，但堵不住预编译的第三方模板：`@form-create/antd-designer` 在运行时靠 `resolveComponent('a-…')` 找组件，服务它的是 `apps/web/src/plugins/vendor-antd-components.ts` 里那 36 条 kebab-case 注册 —— 新增子组件要补的是这张表。名字缺失**不会让构建失败**，只有一句 `Failed to resolve component` warning + 一块空节点，所以 `apps/web/e2e/gallery-examples.spec.ts` 既去数 `.ant-descriptions-item-label` 的条数，也顺手断言了那句 warning。
3. **Table**。`App.vue` 全开了 `virtual`，antd 因此要求 `scroll.y` 是数值，`BasicTable.vue` 用 `mergedVirtual` 兜住"业务页只写 `{ x: 1400 }`"的情况；固定表头/横向滚动又会在 `<tbody>` 前面插一行 `ant-table-measure-row`，`useDragSort.ts` 靠数 `data-row-key` 来算前导偏移。两处都有单测（`components/business/Table/__tests__/drag-sort.spec.ts`）。
4. **"用错也不报错"的 API**。`apps/web/src/views/__tests__/gallery-api-usage.spec.ts` 会先替你抓到三类：具名 `useApp`（1.6 只有 `App.useApp()`）、把权限指令的参数写成修饰符（`v-permission:role` 才对）、Tabs 绑 `@add`（1.6 只有 `@edit`）。
5. **图标**。`@antdv-next/icons` + 5 个 `@iconify-json/*` 集合 + `internal/vite-config/src/plugins/auto-import.ts` 的离线列表。写错的图标名不报错，只是空白方块，所以有 `apps/web/test/icon-names.test.ts` 扫 `apps/backend-mock/server`、`apps/web/src`、`packages` 三个根做对账。

::: tip Vue 是唯一被钉死的运行时 catalog 里 `vue: 3.5.43` 是**精确版本**，注释写明了原因：范围号会让部分第三方 peer 树停在 3.5.42，于是 `@vue/runtime-core` 出现两份类型，跨包传 Directive 直接打架。升 Vue 之前先读懂这条注释，再决定 `overrides` 要不要跟着动。:::

要把不需要的东西拆掉，看[移除代码](/zh/guide/other/remove-code)；工程侧的其它约定见 [开发规范与环境变量](/zh/guide/essentials/development)、[目录说明](/zh/guide/project/dir)。
