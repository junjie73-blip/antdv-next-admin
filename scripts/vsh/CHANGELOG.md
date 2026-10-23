# @antdv/vsh

## 0.1.0

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

- f64fc3a: refactor: 清掉仓库里残留的 vben 命名，上游归属统一写成 `vue-vben-admin`

  用户提的"全面清理 vben 相关的关键字、引用和依赖"。口径是**代码 + 文件名 + 文档措辞都改，外部事实保留**：仓库现在 34 个包全在 `@antdv/*` 下，`vben` 这个词既不是包名也不是标识符，留着只会让人以为还有一套 `@vben/*` 依赖。

  - **标识符与文件名**：`form-ui` 的 `use-vben-form.ts` → `use-antdv-form.ts`（`src/index.ts`、`types.ts`、`useForm.test.ts` 三处引用一起改）；`@antdv/oxlint-config` 的类型 `VbenOxlintConfig` → `AntdvOxlintConfig`；`@antdv/vite-config` 注入的应用元数据键 `__VBEN_APP_METADATA__` → `__ANTDV_APP_METADATA__`；`vsh` 的 `code-workspace` 产物名、`check-dep` 的忽略名单（原来按 `@vben/*`、`@vben-core/*` 匹配，本仓库根本不存在这两个 scope，等于空转）、pnpm catalog 用例的临时目录前缀、`build-local-docker-image.sh` 的镜像名全部换成 antdv。
  - **eslint 的包边界规则**：三条按 `@vben/*` / `@vben-core/*` 写的 `no-restricted-imports` 从来匹配不到本仓库的任何 import，替换成一条真正生效的规则 —— `files` 是 base 层（`packages/core/base/**`、`packages/enums/**`、`packages/utils/**`），forbidden 分组逐个点名 ui-kit / effects / app 的包（因为只有一个 scope，没法用 scope glob 划边界），并显式放行 `@antdv/shadcn-ui`。`sort-interfaces` 的豁免 glob 也顺手收窄到实际需要的三个目录。
  - **`perfectionist.ts` 只做删除**：把两组从来没用上的 `antdv` / `antdv-type` 自定义分组去掉。留着的代价是 `newlinesBetween: 1` 会要求每个新分组两侧都空一行，一改就牵动全站 570 个文件的 import 排版；核对方式是把 config 改动前后的 `eslint .` 结果对拉 —— 1627 = 1627，逐条规则计数差 0，证明这次删除是行为等价的。
  - **`turbo-run`**：删掉两段死代码（`findApps` 和写死 `@vben/website` 的分支）。
  - **文档与注释**：README（中英）、`docs/components/form.md`、`docs/*/guide/in-depth/{composables,common,check-update}.md` 里的 `vben` 措辞改成 `vue-vben-admin`，源码里作为上游归属的注释同理（`vite-config`、`tabs-ui/constants`、`useDataSource`、`permission/utils`、`LayoutSider`）。**保留不动的外部事实**：`doc.vben.pro` 链接、`.sync-state.json` 里的 `vbenjs/vue-vben-admin` 同步配置、历史 changeset 里引述用户原话的那两处。
  - **`shared`/`utils` 的注释纠偏**：`--ant-color-primary` 那句"组件里 39 处在用"已经不成立（全站 `var(--ant-*)` 读取点为 0，仅剩写侧兼容），改成如实描述。

  顺带一个类型层修复：`apps/web/tsconfig.app.json` 显式抬高 `lib` 到 `ESNext`。`@vue/tsconfig/tsconfig.dom.json` 的 lib 停在 ES2020，比本仓库 `@antdv/tsconfig`（ES2022）低，`replaceAll` / `Array.prototype.at` 会被判成不存在 —— 而这些 API 正是子包源码在用的。应用 type-check 从 109 条降到 98 条，且没有新增错误类别（剩余是存量，见 #61）。

  验证：`grep -rI vben`（排除 node_modules/dist）剩 34 处，逐条确认都是 `vue-vben-admin` 归属或外部事实；重跑 `@antdv/{eslint-config,oxlint-config,vite-config,shared,utils}` 的 tsdown 产物并确认 dist 内无 `vben`；`turbo run type-check` 与相关包单测绿。

- Updated dependencies [abfe730]
  - @antdv/node-utils@0.1.0
  - @antdv/tsconfig@0.1.0
