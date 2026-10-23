# 项目更新

克隆下来它就是你的仓库了 —— 没有人会给你推送更新。这篇讲清楚**版本钉在哪里**、 **哪些更新工具真的装了**、**一次升级要跑哪些检查**，以及这套组件栈（reka-ui + TanStack + vue-sonner）跨版本升级时最先出问题的是哪几处。所有版本号都对着 `pnpm-workspace.yaml` 与 `pnpm-lock.yaml` 读过。

## 版本的三处落点

| 位置 | 内容 | 说明 |
| --- | --- | --- |
| `pnpm-workspace.yaml` 的 `catalog:` | 241 条（`:22-262`） | 全仓唯一的版本来源；`apps/web` 的 148 条依赖（`dependencies` 87 + `devDependencies` 61）全是 `catalog:` 或 `workspace:*`，没有一条写字面量 |
| `pnpm-workspace.yaml` 的 `overrides` | `vue` / `clsx` / `pinia` / `@ctrl/tinycolor` / `@ast-grep/napi` → `catalog:` | 强制这些包只有一份实例，防止第三方 peer 树各装各的 |
| 根 `package.json` | `packageManager: pnpm@10.12.4`、`engines.node: ">=22"`；`.node-version` 写 24.0.0 | `preinstall` 挂了 `only-allow pnpm`，用 npm/yarn 装出来的 workspace 是假的 |

**依赖版本没有一处字面量**：所有包（含 `apps/web`）的依赖一律 `catalog:` 或 `workspace:*`。唯一的形式差异是 `apps/web` 的 `vue` 走的是**具名 catalog** —— `"vue": "catalog:conflicts_vue_h3_5_43"`（`apps/web/package.json:95`，`dependencies` 块从 `:17` 到 `:105`）。改版本就改 `pnpm-workspace.yaml` 的 `catalog:` 那一行，别在子包补字面量。

::: warning

具名 catalog 只有一条，而且被 overrides 顶住了 `catalogs.conflicts_vue_h3_5_43`（`pnpm-workspace.yaml:264-266`，`vue: ^3.5.43`）确实被 `apps/web` 引用，不是死配置；但 `overrides.vue: 'catalog:'`（`:292-297`）会把它按回默认 catalog 里的**精确** `3.5.43`（`:229`）。也就是说这条具名通道现在解析不出任何不同的版本，留着它只是历史痕迹 —— 真要升 Vue，改 `catalog:` 的 `:229` 那一行就够了。:::

## 安装期真正生效的开关

pnpm 10 的构建脚本白名单在这里是**显式维护**的（`pnpm-workspace.yaml`）：`onlyBuiltDependencies` 只放行了 4 个 `@vue-office/*`，`ignoredBuiltDependencies` 明确跳过 `esbuild`、`core-js`、`lefthook` 和一堆 imagemin 二进制，另有 `allowBuilds` 映射。**升级到一个带 postinstall 的新依赖时，pnpm 不会问你，它直接跳过并打一行 "Ignored build scripts"** —— 表现是装完了但原生二进制没下（`vite-plugin-imagemin` 这类最容易中）。每次 `pnpm install` 后扫一眼这段输出，再决定要不要加进白名单。

同文件里还有三个会影响升级体感的值：`verifyDepsBeforeRun: false`（跑脚本前不校验 node_modules 与 lockfile 是否同步，改完 catalog 忘了 install 就直接跑，用的还是旧树）、`minimumReleaseAge: 0` （刚发布的版本立刻可被解析，没有供应链缓冲期）、`dedupePeerDependents: true` + `strictPeerDependencies: false` + `autoInstallPeers: true`。

## 仓库里真的有（与没有）的更新工具

| 命令 | 实际执行 | 状态 |
| --- | --- | --- |
| `pnpm update:deps` | `npx taze -r -w` | 可用，但 taze **不在依赖里**，每次由 npx 现拉 |
| `pnpm catalog` | `pnpm dlx codemod pnpm/catalog` | 可用；把散落的字面量版本收进 catalog 的那条路 |
| `pnpm check:dep` | `vsh check-dep` → knip 6.40.0 | 可用（knip 是 `scripts/vsh` 的依赖）。注意它的默认配置 ignore 了 `docs/**`，`ignoreDependencies` 里还写死了 `playwright`、`rimraf`、`tailwindcss` 等一串 —— 报"未使用"不等于可以删 |
| `pnpm check:builds` | `node ./scripts/check-uniform-build.mjs` | 可用，且是**升级新包时最可能挡你的一条**。它把「子包统一构建标准」变成可执行检查（规则写在[开发规范与环境变量](/guide/essentials/development)）：每个 workspace 包都要有 `build`，只出原文件的包必须登记进 `NO_BUILD_PACKAGES`（现在是 `@antdv/{tsconfig,stylelint-config,commitlint-config}` 三个）；入口指向 `dist/` 的包要把 `dist` 写进 `files`；入口指向 `src/` 的包不得自带 `dev` / watch |
| `pnpm check:circular` | `vsh check-circular` → circular-dependency-scanner | 可用 |
| `pnpm check:type` | `turbo run type-check` | 可用（脚本名是 `check:type`，**没有** `pnpm typecheck`） |
| `pnpm check:cspell` | `cspell lint ...` | **必失败**：没有任何 package.json 依赖 cspell，见[常见问题](/guide/other/faq) |
| `pnpm check` | circular + dep + type + builds + cspell 串起来 | 最后一环是断的，日常用前面四条 |
| Git 钩子 | `lefthook`（`prepare` 时 `lefthook install`） | `.git/hooks` 里确实装了，但 `lefthook.yml` 只有 `# pre-commit:`（`:1-11`）与 `# post-merge:`（`:13-16`）两段、**全部是注释**，连 `commit-msg` 都没有 —— 等于没有强制门禁（commitlint 只在手动 `pnpm commit`/`czg` 那条路上生效）。也没有 `simple-git-hooks` / `lint-staged` |

## changesets：版本跳了，但没人替你发

```bash
pnpm changeset                    # 生成 .changeset/*.md（工作区里当前有 32 份待发布）
pnpm version                      # changeset version && pnpm install --no-frozen-lockfile
pnpm release                      # pnpm build && changeset publish
```

`.changeset/config.json` 里三个决定值得注意：`fixed: [["@antdv/*", "@antdv/*"]]`（`:5`）让所有 `@antdv/*` 包**在同一次 `pnpm version` 里一起跳版本号**；`privatePackages: { version: true, tag: true }`（`:9-12`）允许给私有包写版本和打标签；`updateInternalDependencies: "patch"`（`:16`）。changelog 走 `@changesets/changelog-git`，条目按 commit 短 SHA 生成，不需要 `GITHUB_TOKEN`（换成 `changelog-github` 的话，没配 token 会让 `version` 整条抛错退出）。

::: warning

`fixed` 讲的是"下一次发版一起抬到同一个号"，落点取组内**当前最高版本**再叠加本轮最大 bump 级别。2026-10-23 第一次真跑 `pnpm version` 之前就吃过这个亏：各包是改造期手工写死出厂的，摊在 `0.0.0` / `0.1.0` / `0.4.0` / `0.5.0` / `5.8.0` 五个号上，其中 `scripts/*`（`@antdv/turbo-run`、`@antdv/vsh`）还带着上游 `vue-vben-admin` 的 `5.8.0` —— 照原样跑会把整套推到 `5.9.0`。做法是先把全部成员归零到 `0.0.0` 再跑，于是首个统一版本落在 `0.1.0`。**所以新建包请一律从 `0.0.0` 出厂**：组里最高的那个号替整套决定落点。:::

::: danger

别把 `pnpm release` 当成"发 npm" `packages/*`、`apps/*`、`docs` 与根包的 package.json **全部是 `"private": true`**（唯一的 `publishConfig` 在 `packages/core/ui-kit/shadcn-ui/package.json:31`，它只是把 `src` 的 exports 原样重复一遍，那个包同样是 private）。changesets 在这里只产出各包的 CHANGELOG 与 git tag，不会往 registry 推任何东西。发布历史也确实薄：`.github/workflows/` 里只有 `docs.yml` 一个文件，没有 job 跑 changesets；0.1.0 之前仓库只有 `v0.0.3` 和一个误操作留下的 `vnull`。**升级与发版目前是一次纯本地动作**，`version` 之后自己提交，再 `pnpm exec changeset tag` 打 tag，推送时记得 `git push --follow-tags`（`git push` 默认不带 tag）。:::

## 一次组件栈升级怎么跑

组件库这一层现在是四组依赖，每一组都只在 catalog 里出现一次：`reka-ui` **精确钉死**（`pnpm-workspace.yaml:189`，`2.11.0`，没有范围号），TanStack 四条带范围号（`@tanstack/vue-form ^1.33.5` `:58`、`vue-query ^5.104.2` `:59`、`vue-store ^0.11.2` `:60`、`vue-table ^9.2.8` `:61`），轻提示 `vue-sonner: 2.0.9`（`:238`，也是精确值），图标集 `@iconify-json/*` 五个（`:38-42`）。**`antdv-next`、`@antdv-next/*`、`@form-create/*` 已经从 catalog 里删干净了** —— `grep -n "antdv-next\|form-create" pnpm-workspace.yaml` 零命中，`pnpm-lock.yaml` 里也一条解析记录都没有 —— 依赖链上没有它们：`apps/web` 不引，它 dependencies 里那 21 个运行时子包（`apps/web/package.json:18-38`）一个都不引。

消费面收得很窄，升级时按这份名单去找受影响的地方就够了：`reka-ui` 只被 `packages/core/ui-kit/{common-ui,form-ui,shadcn-ui}` 三个包引用；`vue-sonner` 被 `common-ui`、`popup-ui`、`shadcn-ui`、`table-ui` 四个引用；`@iconify-json/*` 主要住在 `@antdv/icons`（`packages/core/base/icons/package.json:29-33`），`apps/web` 另外直依赖 carbon（`apps/web/package.json:44`）与四个只在 dev 侧用到的集合（`:110-113`）。表单/表格/弹窗/标签页/菜单/布局的实现是 TanStack + shadcn-vue，轻提示走 `@antdv/popup-ui`（vue-sonner 的封装）。

这条边界由两个守卫钉住，所以升级组件栈不会让它们变红，但只要有人把组件库引回来就当场变红：`packages/core/hooks/__tests__/boundary.test.ts` 第一节「子包不依赖 antdv-next」（`:136-186`，含"源码里没有组件库 import"和"清单的 dependencies / peerDependencies 里没有组件库"两条）与第二节「跨包只走包名导入」（`:188` 起，守的是另一类边界 —— 相对路径不许伸进别的包，唯一例外是 `@antdv/design` 的 `@source`（Tailwind 只认文件系统路径），名单还必须覆盖所有带 `.vue` 的包；跨包 `@antdv/*` 要写进 `dependencies`/`peerDependencies`；`src` 里不通过自己的包名绕 barrel）；应用侧是 `apps/web/src/views/__tests__/gallery-api-usage.spec.ts:144`，它的正则 `:121-123` 同时拦 `antdv-next` / `@antdv-next/*` / `@form-create/*` 的 import **和** `<a-xxx>` 标签写法。结论：升 reka-ui / TanStack 的改动集中在 `packages/core/ui-kit/**`，应用侧只是被动跟随。

```bash
# 1. 改 pnpm-workspace.yaml 里 catalog 的那一行
pnpm install --no-frozen-lockfile
# 2. 先构建"产物发布"的那批包（shared、types、hooks、preferences、
#    directives、router 六个，`build` 是 tsdown、`main` 指 ./dist）——
#    应用吃的是它们的 dist；其余 15 个（design、icons、enums、layouts、
#    request、stores、utils 与 ui-kit 八包）走 `vite build`，`files` 里
#    同时带 dist 与 src，但 `main`/`exports` 还指着 ./src，所以应用直接
#    编译源码，那 15 份 dist 只是给发布面准备的。
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

1. **偏好 → DOM 的唯一出口**。`packages/core/preferences/src/update-css-variables.ts` 的 `applyPreferencesToDom()`（`:39`）与它内部的 `writeThemeCssVars()`（`:87`）把 `primaryColor / borderRadius / fontSize` 与灰度·色弱开关落成 `<html>` 上的 `--primary` / `--radius` / `--font-size` / `--filter` 加 `dark` class 与 `data-theme` 档位。两条格式纪律是升级时最容易踩的：颜色变量的值必须是 **HSL 三段**（`convertToHslCssVar()` 生成），写整色会让 `hsl(var(--x))` 整条失效；圆角必须是 **rem**（`radiusToRem()` 是唯一的 px→rem 出口）。曾经给 antd 兼容层用的 `--ant-color-primary`、`--ant-primary-color`、`--ant-border-radius` 已经删干净，并被 `packages/core/preferences/__tests__/update-css-variables.test.ts:80-82` 反向钉住"不许再出现"。主题口径见 [主题与偏好设置](/guide/in-depth/theme)。
2. **原语的受控 prop 名**。`reka-ui` 大版本最先改的就是这一类。`@antdv/shadcn-ui` 的 `Checkbox` / `Switch` 只是把 props / emits 原样 `useForwardPropsEmits` 给 reka 的 `CheckboxRoot` / `SwitchRoot`（`shadcn-ui/src/components/checkbox/Checkbox.vue:16`、`switch/Switch.vue:18`），模型名是 `modelValue` —— 页面写 `:checked` 会被忽略（勾选框永远停在初始值）、写 `@change` 收不到，**不报错，只是不动**。仓库里的正确写法 `apps/web/src/views/account/settings/index.vue:286-291`。同一形状的还有 `@antdv/common-ui` 的 `TabPane`：必填 prop 叫 `value` 不叫 `key`（`common-ui/src/components/tabs/TabPane.vue:13`），`key` 被 Vue 自己吃掉，pane 注册成 `undefined`。
3. **Table**。`@antdv/table-ui` 的 `BasicTable` 是 TanStack 实现：是否开内部滚动容器与钉住表头只看数值 `scroll.y`（`packages/core/ui-kit/table-ui/src/hooks/useMergedProps.ts:28-32`），`types.ts:648` 那个 `virtual` 字段是表格自己的虚拟滚动开关，两者不同名同源。拖拽排序的纪律和直觉相反 —— `useDragSort.ts` **不能**在事件里现量：Sortable 在 `onMove` 期间就已经把 `<tr>` 挪进新位置，兄弟行的子节点下标跟着漂移（这段说明在 `:21-31`），所以是每次拖拽开始前 `snapshotRows()` 量一次（`:44-59`），存 `leadingRowCount`（首条数据行之前有几个测量行 / 占位行，`:53`）和 `data-row-key` → 记录的 `rowByKey`（`:54-58`）；数据行是 `<tbody>` 里唯一带 `data-row-key` 的 `<tr>`（`packages/core/ui-kit/table-ui/src/BasicTable.vue:766`），所以前面插测量行/占位行都不会让下标错位。两处都有单测（`packages/core/ui-kit/table-ui/__tests__/drag-sort.test.ts`）。
4. **"用错也不报错"的 API 与组件名**。`apps/web/src/views/__tests__/gallery-api-usage.spec.ts` 现在只剩一条静默失效规则：权限指令的 `role` / `admin` 是**参数（arg）**不是修饰符 —— `v-permission:role="'auditor'"`、`v-permission:admin` 才走对应通道，写成 `.role` / `.admin` 判根不读（`resolveAccess` 只看 `binding.arg`）；规则在 `:24-37`，正/反例样本 `:72-86`。原先那两条针对 antdv-next 的检查（具名 `useApp`、Tabs 绑 `@add`）随着库一起删了，说明留在 `:15-18`。组件名写错这一类现在的口径也变了：全局 `a-*` 注册已经没有了，模板里的未知组件名会被 `pnpm check:type` 的 vue-tsc 当场抓住，抓不住的（运行期才拼出来的名字）由 `apps/web/e2e/gallery-examples.spec.ts` 在示例页用例末尾断言 `Failed to resolve component` warning 为空（`:989-992`、`:1416-1419`），详情列表则数 common-ui 自己的 `[data-common-descriptions-label]`（`:959`、`:1344`）。
5. **图标**。`@antdv/icons` + 5 个 `@iconify-json/*` 集合（catalog `:38-42`）+ `internal/vite-config/src/plugins/auto-import.ts:30-32` 的离线列表（`local: ['carbon', 'ant-design', 'lucide', 'fa6-regular', 'mdi']`，名单必须与依赖同步，少一个就变成构建期现拉或直接空白）。写错的图标名不报错，只是空白方块，所以有 `apps/web/test/icon-names.test.ts` 扫 `apps/backend-mock/server`、`apps/web/src`、`packages` 三个根做对账（`SCAN_ROOTS`，`apps/web/test/icon-names.test.ts:45`）。

::: tip

Vue 是被精确钉死的运行时 默认 catalog 里 `vue: 3.5.43`（`pnpm-workspace.yaml:229`）没有范围号；catalog 里另有 11 个精确版本（`reka-ui` `:189`、`vue-sonner` `:238`、`@vueuse/core`、`vee-validate`、`@lucide/vue`、`embla-carousel-vue`、`pdfjs-dist`、`zod` 等），但只有 `vue` 同时出现在 `overrides`（`:292-297`）里，等于强制整棵树只有一份实例。原因是范围号会让部分第三方 peer 树停在 3.5.42，于是 `@vue/runtime-core` 出现两份类型，跨包传 Directive 直接打架。升 Vue 之前先决定 `overrides` 要不要跟着动。:::

要把不需要的东西拆掉，看[移除代码](/guide/other/remove-code)；工程侧的其它约定见 [开发规范与环境变量](/guide/essentials/development)、[目录说明](/guide/project/dir)。
