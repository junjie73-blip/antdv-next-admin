# @antdv/icons

## 0.1.0

### Patch Changes

- 2f1a233: fix: 补回被重排时删掉的 `@source` 名单，IconPicker 面板接住可用高度，FDatePicker 的区间占位允许数组

  三条都是"构建绿、页面也渲染，只是某样东西静默不见了 / 不定位"的同一类失效，共用这一批三引擎验证，所以并成一个 changeset。

  - **`@source` 整块没了（`packages/core/base/design/src/index.css:46-55`）**：071dad02 重排这个文件时把十行 `@source` 一起删掉了。构建根的自动内容检测只扫得到 `apps/web`，`@antdv/*` 全在软链后面，所以少登记不等于报错 —— 消费方读的还是上一轮 `dist` 里的 CSS，构建、类型检查、页面渲染全部照常，只有那个包模板里的工具类一条不生成（浮层不定位、圆角间距消失）。这次按 `git show f64fc3ac` 原样补回十行，并在名单上方写清"必须与 `packages/core/ui-kit/*` 目录一一对上"。守门测试本来就在（`design/__tests__/design.test.ts` 的「每个子包的源码目录都登记了 @source，且登记路径解析得到真实目录」、`hooks/__tests__/boundary.test.ts` 的「@source 名单只属于 design」），漏网的原因是那一轮没有按仓库口径单文件复跑守卫测试。
  - **IconPicker 面板高度（`packages/core/base/icons/src/icon/IconPicker.vue:281-289`）**：面板原本是"净高 360 + 工具栏 + 分页"的固定高度，`PopoverContent` 没有接 reka 挂在 `--reka-popover-content-available-height` 上的可用高度，从别的页面跳进来时（触发器到视口底只剩 400 出头）底边顶出视口，多出来那截看不见也点不到，常规视口下的用例碰不到它。改成 `max-h-(--reka-popover-content-available-height)` 并把面板排成 `flex-col`：工具栏与分页 `shrink-0`、网格 `min-h-0 shrink`。
  - **FDatePicker 的 `placeholder`（`packages/core/ui-kit/form-ui/src/fields/FDatePicker.vue`）**：prop 声明的是 `string`，而全站四处区间用法（表单示例页、操作日志、登录日志）实际都传 `['开始时间', '结束时间']`。运行时只有一条 `Invalid prop: type check failed` 告警，文字照旧显示，所以构建与类型检查都不拦。放开成 `placeholder?: string | string[]`，数组按两端用 `-` 合成，空串与空数组才回落到内置文案（区间是 `开始日期 - 结束日期`）。合成串与两侧默认串互不相同，判据本身就是反证：传入被忽略会掉回默认串，拼接写错也不会等于任何一侧。

  验证：

  - 守卫测试：`design.test.ts` 32 条、`boundary.test.ts` 8 条全绿（含上面两条 `@source` 判据）；`npx turbo run test:unit --filter=@antdv/{icons,form-ui,design,hooks} --concurrency=1` 20/20 任务绿，其中 `hooks` 10 文件 / 106 条、`form-ui/__tests__/fields.test.ts` 31 条（新增 `fDatePicker` 5 条：数组合成、空数组回落、空串回落、单值字符串原样、传数组不再打 prop 告警）、`icons/__tests__/icons.test.ts` 6 条。
  - 端到端三引擎各 10/10：`icon-picker` 6 条（新增「矮视口下面板完整落在视口内」：560 高视口下量面板盒子，上下都必须在视口内且高度 > 120、网格仍是整页 108 格）、`popup-anchor` 2 条、`f-date-picker` 2 条（新增 spec，钉住数组占位的合成文案与"控制台没有 `Invalid prop` 告警"）。chromium 是四次定向跑合起来的 10/10，firefox 与 webkit 各一次整跑。
  - 新用例都过了反证。矮视口那条：临时把面板的 `max-height` 剥成 `none`，实测 `y=136 h=479 bottom=615` —— 判据在没修复的版本上会真的报溢出，不是一条永远绿的空检查（探针 spec 跑完即删）。`popup-anchor` 的浮层判据自带反向对照（剥掉 `z-50` / `bg-popover` / `shadow-md` 必须三条都报）。
  - e2e 侧顺手修掉一条假红：菜单是模态层，打开后 reka 会给层外的一切（含触发器本体）挂 `aria-hidden`，可访问名字随之消失，`getByRole('button', { name: '标签页操作' })` 在"点得到"之后到了"量不到"。测量改锚在组件自己的钩子类 `button.tab-actions-trigger` 上，名字对不对仍由 `tabs.spec.ts` 那条负责；同文件 `CHECK` 的参数类型改成 `page.evaluate` 真正传进去的 `(HTMLElement | SVGElement)[]`。`pnpm exec tsc -p e2e/tsconfig.json --noEmit` 本轮三个 spec 零错（`layout.spec.ts:628` 的 `row.dataset` 是存量类型错，不在本轮改动面上，未动）。

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

- Updated dependencies [f64fc3a]
- Updated dependencies [54d880b]
- Updated dependencies [5194446]
- Updated dependencies [f740d13]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [54d880b]
- Updated dependencies [d8fa761]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
  - @antdv/shadcn-ui@0.1.0
  - @antdv/shared@0.1.0
