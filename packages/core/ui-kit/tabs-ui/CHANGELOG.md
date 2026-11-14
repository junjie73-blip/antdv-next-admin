# @antdv/tabs-ui

## 0.2.0

### Patch Changes

- 433d922: fix: 把 `type-check` 的门禁链修通 —— 一处打错三个字符的指令连累四个包

  现象：交付口径要求 `npx turbo run type-check` 绿，实际只报一条 `@antdv/stores#type-check`（`../core/ui-kit/popup-ui/src/message/index.ts(31,8): error TS2882: Cannot find module or type declarations for side-effect import of 'vue-sonner/style.css'`）。改掉它之后红点**往下挪**，再改再挪，一路牵出四个包：`stores` → `tabs-ui`（3 条 TS2339）→ `table-ui`（1 条 TS2367）→ `layouts`（2 条 TS2448/TS2454）。

  - **根因只有三个字符**：那行本该是 `/// <reference path="../types/css.d.ts" />`，实际写作 `// / <reference … />` —— 第二个斜杠后面多了一个空格，TypeScript 就不再把它当指令，而是一句普通注释。于是"声明随模块图走"的机制整个落空：`popup-ui/src/types/css.d.ts` 从来没进过下游的 program，任何按源码消费 `popup-ui` 的包（这里是 `stores`）都在 `import 'vue-sonner/style.css'` 上报 TS2882。`common-ui/src/components/toast/Toaster.vue` 是同一处拼错，只是暂时没被下游撞上（`tabs-ui` 按源码吃 `common-ui`，但它那条链上没走到这个文件的 CSS 导入）。
  - **为什么四个包同时烂却只看得见一个**：turbo 默认在依赖任务失败时**不执行**下游任务，`--concurrency=1` 更是逐条停。所以"整跑只看 `Failed:` 那一行"永远低估债务。口径改成一趟跑到底再看计数：`npx turbo run type-check --concurrency=1 --continue`。
  - **`tabs-ui`**：`__tests__/tab-item-list.test.ts` 三处 `[...list.children].map((node) => node.dataset.scrollKey)` —— `HTMLCollection` 的迭代器类型给的是 `Element`，`.dataset` 在 `Element` 上不存在（TS2339）。文件里另外五处早就写了 `as HTMLElement[]`，这三处漏了；补上同一形状的收窄，不动测试意图。
  - **`table-ui`**：`getButtonSize()` 里有一句 `if (action.size === 0) return undefined;`，而 `ActionItem.size` 的类型是 `'large' | 'middle' | 'small'`，`0` 与它没有交集（TS2367）。这是 antd 时代 `size={0}` 表示"不接管尺寸"的残留：全仓（含 `apps/web` 与两包测试）没有任何调用点传 `0`，测试只钉 `small`/`large` 两个档位。删掉这条不可达分支，三个合法档位的映射原样保留。同包的 `useTableClasses.ts:117` 有一句注释还在写 `min-w-[var(--basic-table-min-width)]`，而上一轮重构已把类名改成 v4 的变量简写形式，注释跟着改成实际那一串（它正是本轮把 `basic-table.test.ts` 拉回断言字面量的那个形状）。
  - **`layouts`**：`lock-screen.vue` 的 `withDefaults(…, { threshold: UNLOCK_PULL_THRESHOLD })` 引用的 `const` 声明在 22 行**之后**，TS 报"used before its declaration"（TS2448）加"used before being assigned"（TS2454）。把常量提到 props 定义之前，门禁即绿。**顺手记下踩到的第二道墙**：改动中途若把同一枚 `const` 留成"上面一份、下面一份"，`@vue/compiler-sfc` 会直接编译失败，而 dev server 的失败方式是在页面上盖一层 `<vite-error-overlay>` —— 端到端表现为"`<button>登录` 解析到了、可点不动，日志里写着 `<vite-error-overlay> intercepts pointer events`"。看着像用例有问题，其实是编辑器把语法错误投影到了浏览器。判据：`curl` 那个模块的 URL 拿 200 + 产物 JS，比读测试日志快得多。
  - **`docs`**：`docs/guide/project/tailwindcss.md` 与其 `en` 镜像里，`@source` / `@plugin` / `@custom-variant` 的行号引用与被引用文件的当前行号对不上（`@plugin` 指成 `:39-40`，实际 `:57-58`；`@source` 指成 `:47-56`，实际 `:46-55`），逐条对回；守门用例的范围也从 `design.test.ts:628-660` 改成实际的 `:637-669`。

  仍然红着的一条，且**本轮不修**：`@antdv/web#type-check`。脚本是 `vue-tsc -p tsconfig.app.json && vue-tsc -p tsconfig.vitest.json`，前一段先失败 90 条，`&&` 让后一段（单独跑另有 70 条）**根本没被执行** —— 所以"90"不是全貌，全貌是 160，而日志永远只给你前 90 条。app 项目这 90 条里 81 条在 `src/views/**`（`system` 33、`screen` 30、`components` 10、`security` 6、`redirect` 1、`micro-app` 1），9 条在 `src/api/mock.ts`、`src/stores/modules/dict.ts`、`src/composables/{usePasswordPolicy,useNotice}.ts`、`src/router/index.ts`；类型以 TS2339 / TS2345 / TS2532 为主，多数是 `noUncheckedIndexedAccess` 下按下标取值没判 `undefined`。逐条核过：报错行没有一条落在本轮 diff 的 hunk 里，报错文件名也没有一条命中改动过的组件（`views/components/cron/index.vue:129` 是 `check(previewExpr.value)` 的重载问题，与本批 colour/token 改动无关）。这是重构期就登记在册的待办 P7a，CI 只跑 docs 所以从未挡过路。包侧（`packages/**`）的 `type-check` 任务整跑（`--concurrency=1 --continue`）全部通过，红的只剩这一条应用侧。

  顺带记下查这条时撞到的两处口径坑：`e2e/` 不在 type-check 覆盖范围内（`tsconfig.app.json` 只 include `types/` 与 `src/`，vitest 配置只 include `src/**/__tests__/*`），它有自己的 `apps/web/e2e/tsconfig.json`，单独跑 `vue-tsc --noEmit -p e2e/tsconfig.json` 会回 1 条 TS2339（`layout.spec.ts:628` 的 `row.dataset` —— `querySelectorAll` 给的是 `Element`），和本轮修掉的 `tabs-ui` 三处是同一形状，本轮范围外；以及 `pnpm lint`（`vsh lint`）会带 `oxlint --type-aware`，这台机器上它直接 panic（`Error running tsgolint: exit code 2`），而 `better-tailwindcss` 那组规则虽然确实挂在入口链上，却找不到自己的样式入口（`No tailwind css entry point found at …/tailwind-config/src/theme.css`，该包在 `internal/` 下并不存在），19 条诊断是在"没有基准文件"的前提下给出的。这两条都不是本轮引入，按"报告不偷改"登记。

- Updated dependencies [d77ddc4]
- Updated dependencies [433d922]
  - @antdv/common-ui@0.2.0
  - @antdv/shadcn-ui@0.2.0
  - @antdv/icons@0.2.0
  - @antdv/shared@0.2.0
  - @antdv/types@0.2.0

## 0.1.0

### Minor Changes

- 340f692: feat: 谷歌风格（`chrome`）标签按浏览器标签重做——选中页长出反向圆角，标签之间是会让位的发丝线

  原来那版只是"上圆角 + 描边 + 底色"的胶囊（`border border-b-0`、栏底 `bg-primary/10`），和真标签页差在一节：选中页与内容区之间没有过渡，整条栏还被主色染了一遍，换到深色主题尤其脏。这版按参考实现重画，两处几何用 Tailwind 表达不出来（`clip-path` 象限裁剪 + 伪元素圆扩散阴影），落在 `TabsBar.vue` 末尾的样式块里，全部按根元素的 `data-tab-style='chrome'` 生效 —— 新属性挂在 `.tab-bar` 上是为了让 CSS 认得到当前风格，其余四种风格的规则一条都不匹配。

  - **胶囊本体（`useTabStyle.ts` 的 `chrome` 槽）**：`h-8 rounded-[10px] px-3.5`、不描边；列表 `items-end gap-1 px-2.5`（两端各留 10px，否则第一个标签的左脚会被滚动容器的 `overflow` 裁掉）；栏底不再染色，未选中只留 `hover:bg-gray-100 dark:hover:bg-gray-700`；选中态只给 `text-primary`，**底色一律不写在这个槽里** —— 标签体和它的两只脚必须共用同一个颜色值，所以底色写在 `--tab-chrome-fill`（`color-mix(in oklab, var(--app-primary) 12%, var(--app-background))`），三处引同一个变量，换主题换明暗一起变，不会出现"脚"与标签不同色的接缝。
  - **反向圆角**：`::before` / `::after` 两个 20px 圆，圆心正落在标签下沿的外侧角上（`bottom: 0; left/right: -20px`），`box-shadow: 0 0 0 30px var(--tab-chrome-fill)` 把同色铺满圆外，再用 `clip-path: inset(50% -10px 0 50%)` / `inset(50% 50% 0 -10px)` 只保留靠标签那一侧的下半象限。**半径必须等于标签自己的圆角**：两条弧的圆心同在底边上、半径相同，交点处切线都是竖直的才接得上；参考稿用的 8px 圆角配 10px 弧，接缝处差的那 2px 会露出一个针尖大的缺口，所以这里统一成 10px。
  - **发丝线**：1px × 16px 垂直居中在未选中项的**左沿**，走它们的 `::after` 槽位（选中页的两只伪元素已被脚占用，用同一个槽就没有抢占之争，隐藏规则也只需同步带 `:not([data-active='true'])` —— 少写这一层判断，悬停到选中页时会把它的左脚一起 `opacity: 0` 掉）。按参考稿隐藏四种情形：整条的第一个（左边是栏边，没有邻居）、自己正被悬停、自己就是选中页、紧邻在悬停/选中页后面那一个。线带 0.3s `opacity` 过渡，是"让位"不是"删掉"。

  验证：

  - `tabs-ui` 单测 3 个文件全绿。`actions-and-style.test.ts` 里那条 chrome 用例原来是红的（断言 `bg-muted/60`，而源码早已是 `bg-primary/10`，上一轮改栏底颜色时漏了同步），按新版设计重写：断言 `rounded-[10px]`、`items-end`、`px-2.5`，并逐条检查选中项与栏底**都不含 `bg-` / `border`**（几何之外的染色一律算回归），`divider` 标志改回 `true`。`tabs-bar.test.ts` 补一条容器带 `data-tab-style` 的用例 —— jsdom 永远不应用 SFC 里的 `<style>`，几何本身只能钉到类名与属性这一层。
  - 浏览器端到端：`apps/web/e2e/tabs.spec.ts` 新增一条 chrome 用例，用 `getComputedStyle(el, '::before' | '::after')` 直接量几何 —— 上左圆角 10px、脚宽 20px、`clip-path` 落在两个象限之一、阴影色等于标签底色、选中页底边与栏底边相差不超过 1px，再逐条断言发的线（第一个不画 / 左邻是选中页时不画 / 悬停时让位 / 移开又回来，线只是隐掉不是删掉）。`apps/web` tabs spec 15/15 通过。两条时序坑值得记：`.tab-item` 上的 `transition-colors` 让刚切换风格的 `backgroundColor` 还在从旧值插值，而 Chromium 把 `color-mix(in oklab, …)` 的计算值序列化成 `oklab(L a b)`，所以读几何之前要先 poll 到"阴影色已经等于底色"；发丝线同理，直接读会拿到过渡中点上的 `0.887511`，断言必须走 `expect.poll`。
  - 明暗两色、宽窄两档与溢出态用临时截图核过（脚在深色下铺在 `--app-background` 上，与参考稿行为一致），临时 spec 与截图目录已清理。
  - 文档：`docs/guide/in-depth/layout.md`、`docs/zh/` 副本与 `docs/en/` 三份的标签页风格条目改成新形状；`_linkcheck.mjs`（121 个文件，0 缺失）与 `_sidebarcheck.mjs`（94 条链接，0 缺失）干净。

### Patch Changes

- 54d880b: build: 全部子包统一走完整 `build`（编译 + 打包 + 产物校验），消灭 stub-only 与热更新混配

  要求（用户原话）："所有子包必须统一采用完整构建（build）的编译打包方式，严格禁止出现部分子包使用 build 构建、部分子包使用热更新（hot reload/hmr）的混合配置情况"。落地口径按已确认的方案 —— **统一构建标准，保留源码消费**：每个包都有一份真 build 并纳入全量构建与检查，dev 期间仍由宿主应用的 dev server 直接吃源码，子包级热更新不退化。

  - **15 个按源码发布的包补上真 build**：`packages/**` 的组件与工具包（含 `@antdv/icons`）一律 `vite build`，各自的 `vite.config.mts` 只有一行 `defineLibraryConfig()`。此前它们的 `build` 是一句 `echo`，产物从没被真编译过 —— 包里的 SFC 编译错误、缺失依赖、`exports` 漏配都要等别人 import 时才现形。
  - **入口从 `exports` 推导，不再写死 `src/index.ts`**：`resolveLibraryEntries()` 读包自己的 `exports` 映射（`./*` 通配按同一模式去 glob 展开），加一个子路径导出，构建自动覆盖到它。只认 `src/` 下的源文件，指向 `dist` 的子路径（按产物发布的那批包）不进这条链路。
  - **`antdv:validate-dist` 兜住"构建绿了但产物残缺"**：`writeBundle` 逐条核对每个入口的 `dist/<name>.js`（样式入口查 `.css`，开了 `dts` 再查同名 `.d.ts`）既在产物表里也真落盘，缺一条就 `this.error` 并点名是哪个公共子路径。子包平时按源码被消费、`dist` 没人读，这层校验是标准里唯一能自动兜住的部分。
  - **库形态的插件链裁到最小编译链**：`createPlugins(mode, { kind: 'library' })` 不再挂自动导入 / iconify / svg-icons / imagemin / 文件路由 / Layouts / i18n / Inspect。这些插件都按"宿主是一个应用"的前提工作 —— 扫 `src/views`、往 `cwd/types/*.d.ts` 回写声明、要求 `@iconify-json/*` 与 `src/assets/icons` 存在；子包按自己的目录构建时前提全不成立，实测 `@antdv/enums` 在配置加载期就抛 `Please install "@iconify/json" or "@iconify-json/*" package`。两种形态现在共用 SFC / TSX / Tailwind 这一段，其余按形态分家。
  - **`dts` 默认跟随 `types` 指向**：只有 `types` 指进 `dist` 才生成声明文件。按源码发布的包（`types: ./src/index.ts`）生成那份 `.d.ts` 没有读者，类型面归各自的 `type-check`，重复出一份只把构建时间翻倍 —— 实测 `@antdv/menu-ui` 27 s → 7.5 s。
  - **`@antdv/design` 从"没有 build"变成真出产物**：纯样式包走 `entry: 'src/index.css'` 并显式 `cssCodeSplit: true`（lib 模式默认 `false`，而那个模式下 Vite 直接拒绝 CSS 入口），产出 `dist/index.css` 277 kB，顺带证明 `src/css/*.css` 里的 `@apply` 级联编译得动。
  - **5 个只有 `stub` 的包换成真 build**：`@antdv/eslint-config`、`@antdv/oxfmt-config`、`@antdv/oxlint-config`、`@antdv/vsh`、`@antdv/turbo-run` 删掉 `stub`，`build` 改为 `pnpm exec tsdown`（各自 `tsdown.config.ts` 已带 `clean: true, dts: true`）。`@antdv/node-utils` 的 `stub` 作为加速手段与真 `build` 并存。根 `postinstall` 随之从 `run stub` 改成 `--filter ./internal/** --filter ./scripts/** run --if-present build`。
  - **标准变成可跑的守卫**：`scripts/check-uniform-build.mjs`（零依赖）查四件事 —— 每个包都有 `build`（没有可编译内容的 3 个预设包写进例外清单并附理由）、`stub` 不能是唯一构建方式、`exports` 指 `dist` 的包必须把 `dist` 列进 `files`、按源码发布的包不许挂自己的 `dev` / `watch`（热更新归宿主应用）。已排进 `pnpm check`，不过那条链现在会在 `check:type` 处短路，所以日常按 `pnpm check:builds` 单跑。

  验证：`pnpm build` 全量 31/31 成功（3 m 57 s；此前只有按产物发布的包与应用参与）；`pnpm turbo run test:unit --concurrency=1` 只有 `common-ui/cron-editor` 一条红，是仓库里已记录的机器负载超时假红（整跑 5621 ms 撞 5 s 上限，空闲单跑同一用例 2054 ms 通过，同批 290 条其余全绿）；`@antdv/vite-config` 单测 70 条全绿，其中新增 `__tests__/library.test.ts` 12 条覆盖入口推导 / 产物推导 / 校验器，`__tests__/plugins.test.ts` 由"两种形态共用同一条链"改成钉住"应用形态带宿主插件、库形态只留编译链"；`node scripts/check-uniform-build.mjs` 通过；dev server 与 `apps/web` 生产构建两侧都跑通（登录 → 工作台 → 组件示例）。文档在 `docs/guide/essentials/development.md` 新增「子包统一构建标准」一节，en 镜像与 `docs/zh` 副本同步。

- Updated dependencies [2f1a233]
- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [5194446]
- Updated dependencies [f740d13]
- Updated dependencies [340f692]
- Updated dependencies [f64fc3a]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [abfe730]
- Updated dependencies [d8fa761]
- Updated dependencies [2f1a233]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
  - @antdv/common-ui@0.1.0
  - @antdv/shadcn-ui@0.1.0
  - @antdv/shared@0.1.0
  - @antdv/types@0.1.0
  - @antdv/icons@0.1.0
