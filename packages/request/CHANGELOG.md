# @antdv/request

## 0.1.0

### Minor Changes

- d8fa761: refactor: `apps/web/src/plugins` 逐个梳理，vue-query 客户端下沉为 `@antdv/request/vue-query`

  诉求（用户归纳）：把 `apps/web/src/plugins` 下所有插件梳理清楚（文件、配置项、依赖、调用链），按新架构规范适配，保留原有导出与调用参数，逐个补功能验证与单测，同步依赖声明与文档，最后无残留、无控制台报错。

  **先划清范围**：`internal/vite-config/src/plugins/` 那 20 个是构建期 Vite 插件，跟这次的"运行时装配模块"不是一回事。`apps/web/src/plugins/` 是应用入口的**五个装配模块**，每个都只做一件事——把"只有应用才知道的能力"注进包里。调用链在 `apps/web/src/main.ts`，全部早于挂载：`configureRequestRuntime()` `:50` → `configureUiKitRuntimes()` `:56` → `configureLayoutsHost()` `:61` → `configureTableRuntime()` `:63` → `getPreferences()` `:69` → `setupVueQuery(app)` `:71`。

  - **`query.ts` 是唯一该搬走的那个**：它只读 `import.meta.env.VITE_APP_BASE_API`？不，它连 store 和路由都不碰，内容就是一个 `QueryClient` 加 `app.use(VueQueryPlugin)`，跟应用没有任何耦合，而它的重试策略又必须和 `@antdv/request` 的 executor 对齐（传输层重试归 executor 的 `withRetry` + 401 重放，vue-query 这边 `retry: false`，两层不能叠加）。于是整模块下沉为 `packages/request/src/vue-query.ts`，走**子路径导出** `@antdv/request/vue-query`，与 `./sse`、`./websocket` 同口径不进根 barrel。导出名（`queryClientConfig` / `queryClient` / `setupVueQuery`）、参数与默认值一字未改；`package.json` 加 `@tanstack/vue-query`（catalog `^5.104.2`）与 `./vue-query` 出口，`//exports` 注释同步改成"四档"。全仓 `queryClient` 只有 `main.ts` 一个 importer，所以不存在"两个 QueryClient"的风险；`apps/web` 仍保留 `@tanstack/vue-query` 依赖，因为 `src/api/query.ts` 直接用它。
  - **另外四个留在应用，不是没梳理完，是搬不动**：`ui-runtime.ts` 注 `t` / `translateMenu` 给 `@antdv/layout-ui`、`menu-ui`、`tabs-ui`；`request-runtime.ts` 注 baseUrl / loginPath / 凭证读写 / `onLogout` 给 `@antdv/request`；`table-runtime.ts` 注权限判定与错误文案给 `@antdv/table-ui`；`layouts-host.ts` 注接口、推送通道、账户页、语言候选与滚动条偏好给 `@antdv/layouts`。这四个各自 import `~/locales`、`~/config/*`、`~/api/system`、`~/utils/ws`、`~/views/account/*`，包反向依赖应用就是循环，turbo 直接编不过。**它们的导出名、函数签名、调用参数与配置读取口径全部保持原样**，逐个核对后不需要改造（连 import 顺序都不动：文档里有 5 处按行号引用 `request-runtime.ts:16/22/24`，挪一行就断一次）。
  - **单测按每个模块的实际情况分两种写法**：新增 `packages/request/__tests__/vue-query.spec.ts`（3 条）钉住 `retry: false` 这套默认策略、`queryClient` 是按它建出来的同一个实例、`setupVueQuery` 挂的是它而不是新建一个。四个应用侧模块只能写成"注入完再读包那边的 runtime"：`test/setup.ts` 会先 `configureUiKitRuntimes()` 并 import `~/locales`，setup 比用例里的 `vi.mock` 先执行，被它摸过的模块之后替换不掉，所以 mock 模块这条路对 `ui-runtime` 根本走不通。`apps/web/src/plugins/__tests__/` 共 18 条：`ui-runtime`（4）断言三个包的 `t` 拿到的是译文、能插值、`translateMenu` 能区分"没这个键"与"值和键同名"、切语言后现取现算；`request-runtime`（4）断言前缀与登录页交给包、access 走 user store 而不读缓存里那串密文、refresh 走缓存、`onLogout` 收的是 `logout()`；`table-runtime`（5）断言配置阶段不取 store（入口在 pinia 就绪前也能调）、权限跟着 store 变、未登录一律判否、错误文案复用请求层解析、提示走应用的 `message`；`layouts-host`（5）断言语言候选与标签、滚动条偏好、账户页是两个独立异步块、通知三个接口接到应用 api、推送载荷原样交给包且退订用的是 ws 返回的那个函数。`packages/request/__tests__/structure.spec.ts` 的"src 根目录只有约定的这些文件"清单补 `vue-query.ts`。
  - **文档同步**：`docs/guide/essentials/request.md` 与 en 镜像加"数据请求客户端：`@antdv/request/vue-query`"一节（默认策略三条 + 为什么走子路径），顺手改掉一处写错的约束——原文把 `ui-runtime.ts` 和 `request-runtime.ts`、`table-runtime.ts` 并列为"测试 setup 不能碰"，实际 `test/setup.ts` 调的正是 `ui-runtime`（它只注入文案，不碰 store），现在按真实边界重写。`docs/guide/essentials/utils.md` 与 en 镜像的"靠依赖注入拿应用能力"表加一行说明客户端与安装已在包里、入口装一次。`docs/zh/**` 那份副本按 `docs/.vitepress/config.mts:14-15` 的口径**不再写入**。

  验证：`npx turbo run test:unit --concurrency=1` 48/48 成功（含 `@antdv/request` 9 个文件、`@antdv/web` 20 个文件 119 条）。`turbo run type-check` 47/48，唯一红的仍是 `@antdv/web#type-check` 的 90 条存量错，全部落在 `src/views/**`、`src/api/mock.ts`、`stores/modules/dict.ts`、`composables/usePasswordPolicy.ts` 这些历史文件，`src/plugins/**` 与 `main.ts` 一条没有；`tsconfig.vitest.json` 那个项目单跑 66 条（同样不含新增用例，`vite/client` 那条修复记在 `.changeset/toast-close-button-per-item.md`）。:6080 按重启配方清 `.vite` 后重起，入口装配与顶栏铃铛、语言切换在浏览器端复核，`preference-effects` 三引擎整跑无控制台报错。

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

- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [5194446]
- Updated dependencies [f740d13]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [54d880b]
- Updated dependencies [d8fa761]
- Updated dependencies [d8fa761]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
  - @antdv/popup-ui@0.1.0
  - @antdv/shared@0.1.0
