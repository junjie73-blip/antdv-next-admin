# @antdv/layouts

## 0.1.0

### Minor Changes

- abfe730: 架构升级：把可复用能力从应用层抽成独立子包，重排 monorepo。

  - 新增 `@antdv/shared`（通用方法、菜单树工具、请求封装）、`@antdv/preferences`（用户偏好设置与持久化）、`@antdv/composables`（自定义 hooks）、`@antdv/ui`（公共组件）、`@antdv/layouts`（多布局形态：vertical / two-column / horizontal / side-nav / mixed-vertical / mixed-two-column / full-content）、`@antdv/router`（鉴权与动态菜单守卫，依赖注入式，不绑定 store）、`@antdv/directives`（通用指令）、`@antdv/design`（设计令牌与基础样式）、`internal/vite-config`（可组合的 Vite 配置）、`internal/node-utils`（缺失的 Node 工具包）。
  - 子包统一用 tsdown 产出 dist，由 turborepo 编排 build / dev / type-check / test:unit；依赖版本走 pnpm `catalog`。
  - mock 服务迁移到 Nitro（`apps/backend-mock`）：业务接口走 `/api`，控制面走 `/api/mock-center/**`。
  - 菜单与标签页：混合布局下两级联动、精准单选高亮、横向导航溢出滚动 + 拖拽；标签页支持拖拽排序、四种风格、放大还原、关闭其他、固定与刷新。
  - 接通标签页页面缓存：`apps/web` 新增 `usePageCache`，用归一化 path 生成 KeepAlive 缓存名，`include` 只收"标签还开着且菜单允许缓存"的页面；刷新标签会推进缓存代号，退出登录清空缓存。
  - e2e：`apps/web/e2e` 从上游模板的失效用例改为可跑的真实链路（冒烟、页面缓存、XSS 安全基线），`playwright.config.ts` 对齐项目实际端口 6080 并支持 `E2E_BASE_URL` / `E2E_HEADED` / `E2E_WORKERS`，turbo 补上 `test:e2e` 任务；Chromium / Firefox / WebKit 三引擎 81 条用例全绿。
  - 跨浏览器兼容修掉两处真问题（都不是"调超时能糊过去"的那种）：
    - `@antdv/shared` 的 CSRF Double Submit Cookie 原来写 `HttpOnly=false`。Cookie 属性是"出现即为真"的标记，浏览器据此把 cookie 存成 HttpOnly，脚本第二次写同名 cookie 就被拒绝 —— Chromium 只在 DevTools 的 Security 面板提示，Firefox 直接往 console 打 error。现在按 `path=/; SameSite=Lax` 写入，`Secure` 只在 https 下追加。
    - `apps/web/index.html` 的 CSP 原来恒定带 `upgrade-insecure-requests`。WebKit 不豁免 `http://localhost`，会把每个模块请求升级成 https 并握手失败，页面只剩首屏 Loading 的白屏（Chromium / Firefox 无症状）。该指令改由 `@antdv/vite-config` 按构建模式注入：生产保留，开发留空。
  - e2e 基建收尾：`watchErrors` 忽略 `ResizeObserver loop …`（观察者规范里的正常收敛状态，WebKit 抛成 pageerror、Firefox 抛成 console error）；本地并发压到 `E2E_WORKERS`（默认 3，一个引擎一个 worker）并只给 WebKit 放宽计时，避免"纯超时"的假红；`.gitignore` 用不带路径的 `.mock-state.json`，覆盖 Nitro mock 落在 `apps/web/` 的运行时状态文件。
  - 退出登录的会话态收口：`useUserStore().logout()` 现在除了凭证与页面缓存，还会 `resetRoutes()`（把 `isLoaded` 打回 false，守卫下次导航重新拉菜单）并清空标签页；`forceLogout()` 改为复用这一个出口，并把回登录页从 `location.href = '/login'` 换成改 hash —— 本应用是 hash 路由，写 pathname 会触发整页重载，打断进行中的导航还把 `redirect` 参数弄丢了。修前：换个账号在同一次页面会话里登录，会沿用上一个账号的菜单与授权集合。
  - 发布链路改为 changesets（移除 `docs/` 与 standard-version），根脚本新增 `release`。

### Patch Changes

- abfe730: fix: 导航与面包屑这一轮 —— 把"菜单里画的"和"顶栏里显示的"接回同一份数据

  用户这三句话是同一件事的三个切面："面包屑的图标和菜单栏的图标对应不上"、"菜单的样式有点问题"、"第一次进入页面，面包屑不会自动加载上去"。根子都在**渲染侧各自去不同的地方取数**：面包屑读路由 `meta`，菜单读后端菜单树，图标名又散在两边写死。这一轮把真相收敛成一份，并给每处补了能钉住契约的测试。

  - **面包屑的数据源换成"菜单链优先"**：原先只从 `route.matched` 取 `meta.title`，而文件约定路由只有**叶子**声明了 meta，父级布局记录没有标题 —— 链被砍成一格，再撞上"仅一级时隐藏"这条默认偏好，整条面包屑就不渲染了。表现正是"第一次进页面没加载出来"：登录后落地的那一屏、以及任何页面刷新后的第一帧都是空的，要到别处再回来才有。现在先按 `name`（再按 `path`，容忍约定路由的尾斜杠）在菜单树里反查祖先链，查不到才退回 `matched`，菜单里画了几级就显示几级，隐藏页也能反查到归属。
  - **图标逐节点取，删掉两处兜底**：`LayoutBreadcrumb` 曾给第 0 级画"房子"、其余无图标时画"文件夹"，等于渲染侧替数据编故事 —— 导航根节点是 `carbon:dashboard`，面包屑却是房子，看到的"对不上"就是这么来的。现在每一级只用自己的 `icon`，没有就不占位。配套把页面标题与菜单标题对账（`分析面板` / `实时监控大屏`），两边名字不同源时"对不上"会以另一种形式复现。
  - **面包屑每一级的链接指向自己那一页**：antd 的 `items[].path` 语义是 "把前面每一级的 path 拼到当前这一级"（库注释原话 `It will concat all prev path to the current one`），而我们的菜单 path 本来就是完整路径，于是"系统管理 / 用户管理"被渲染成 `#/system` 与 `#/system/system/user` —— 中键、右键新开、状态栏预览指向一个不存在的地址。改成传 `href`（`router.resolve` 生成，hash / history 模式都不用改），外链原样交给浏览器，顺带把 `isExternalPath` 抽成 `@antdv/shared/menu` 的单一判定入口（归一化与拼接都改问它）。
  - **侧边菜单的层级缩进与图标对齐**：antd 的 inline 缩进是**内联** `padding-left`，类选择器压不过内联样式，原先那条 `[&_.ant-menu-sub_.ant-menu-item]:pl-12` 从写下起就没生效过（已删）；层级现在统一由 `inlineIndent = 16` 决定。图标占位另有一处死代码：针对 `.anticon` 的规则对本项目 `<Icon>`（`@iconify/vue` 渲染 span，不带 anticon 类）永不命中，改成 `.ant-menu-item-icon`。 `buildMenuItems` 新增 `keepIconSlot`：侧栏里没图标的项也补一个空槽，宽度由 antd 的 icon token 托管（与真图标严格等宽），整列文字左边缘因此在同一条竖线上；顶栏横向导航不开这个开关 —— 那里白留一格会挤掉一个菜单项，溢出时更明显。
  - **折叠入口挪到侧栏底部**：放在顶栏时要点到屏幕右上角才能收起"左边这一列"，动作和目标隔着整个屏幕。现在是贴着这一列底边的一条横杠（带 `aria-expanded` / `aria-label`），浮层形态（窄屏抽屉）不渲染，抽屉没有"折叠"可言、开合由抽屉负责；侧栏常驻的形态顶栏就此不再重复给按钮（两个按钮管同一个状态必然漂移）。
  - **图标名对账**：`<Icon icon="carbon:xxx" />` 写错名字**不报任何错** —— 构建期查不到就渲染成空 span，运行时取图则变成一次常被 CORS 挡掉的网络请求，于是"有的项有图标、有的整格空白"。本轮巡检前仓库里有 45 个不存在的图标名。新增 `test/icon-names.test.ts` 静态扫描源码与 mock 菜单种子数据里的每个 `collection:name` 字面量，逐个核对是否真在已装的图标集里。

  测试口径（这一轮的验收都指向"两边同源"而不是"看起来还行"）：

  - `packages/shared/__tests__/menu.test.ts` 45 条：新增 `keepIconSlot` 正反两向契约（空槽必须是裸 span、有图标的不能被覆盖），以及 `isExternalPath` 的内外链判定。
  - `packages/layouts/__tests__/breadcrumb.test.ts` 12 条：菜单链优先、"只有叶子声明 meta.title 时不许砍掉父级"、菜单未加载时才退回 `meta.title`、按 path 反查（容忍尾斜杠）、隐藏页反查、无名字节点不占一格。
  - `apps/web/test/menu-icon-slot.test.ts`：把 antd `Menu` 真挂起来数 DOM —— "空 span 会被打上 `.ant-menu-item-icon` 并取得等宽"这条前提属于 antd 的实现，只看"我传了个渲染函数"的单测盖不住。
  - `apps/web/e2e/layout.spec.ts` 32 条（原 25 条）：登录落地首屏与刷新后首帧的完整链、面包屑 href 与"点父级不掉进拼错的地址"、按标题把面包屑图标与菜单图标逐项比对（比 `svg` 字形而不是图标名），同层菜单文字左边缘对齐、底部折叠条的收起/展开与宽度回弹、常驻形态顶栏无重复入口而窄屏抽屉仍然有。
  - 其中两处断言按**等稳**而不是"加延时"写：折叠后的宽度在 CSS 过渡里会连续变， `settledWidth()` 要连续两次采样相等才读值；同层文字对齐必须先把不可见副本（`width === 0`）滤掉 ——这两条单独跑常常躲得过、全量并发跑就红，属于时序假绿，判定条件因此写成"停住了才读"。
  - Chromium 全量 87 条 e2e 与仓库单测在收尾时复跑，结果见交付说明。

- abfe730: fix: 修复偏好设置抽屉与多布局的五处体验缺陷

  - Scrollbar 在抽屉里改用 `min-h-0 flex-1`，滚动能到面板最末一项（原先带默认 `h-full`，与顶部分类切换条一起撑出容器被裁）
  - `side-nav` 蓝图把侧栏改回常驻（`sidebarPresentation: 'inline'`），选它不再"什么都没出现"；浮层抽屉只由窄屏触发
  - 新增 `chrome` 谷歌风格标签页（顶部圆角、不画底边、贴标签栏下沿），`TabStyle` 联合类型随之扩展
  - 设置抽屉的分段控件在 `SettingItem` 上新增 `stacked` 槽位，标签风格选择器换到下一行并铺满
  - 面包屑抽出 `LayoutBreadcrumb`：`headerLead` 为 breadcrumb 的形态住顶栏，其余落到内容列第一行，`showBreadcrumb` / `showBreadcrumbIcon` 两个偏好真正接入渲染

  同时移除 `@antdv/layouts` 中无人消费的 `sidebarOpenByDefault` 区域开关。

  端到端基线跟着补了两处计时口径：全站巡检按菜单页数分配超时预算（`E2E_SWEEP_PAGE_BUDGET`，默认每页 15s），WebKit 项目的整条墙钟从 150s 放宽到 240s —— 只放宽总时长，单步 `actionTimeout` / `expect` 一个没动，功能真坏了仍然立刻红。

- d8fa761: fix: 设计变量对齐 shadcn-vue 的格式契约 —— 裸规范名 + HSL 三段，别名层与 `--app-*` 整套撤掉

  诉求（用户原话）：`index.css` 的变量格式对齐 shadcn-vue。给的选项是「加规范名别名层（推荐）」，实施到一半发现这条路走不通，**最终落成了"裸规范名就是唯一事实来源"**，比别名层少一层。偏离的缘由记在下面，不是偷偷改口径。

  - **别名层和通道格式互斥**：shadcn-vue 的读侧是 `hsl(var(--primary))`，要求变量里存的是 `215.02 100% 54.31%` 这种**三段通道**；而 `--app-*` 那套历史命名存的是整色（`#1677ff` / `rgb(22 119 255)`）。加一层 `--primary: var(--app-primary)` 只是把整色换个名字，`hsl()` 一拼还是非法值。要让规范名能用，值必须先变成通道 —— 那时候别名和来源就是同一个形状、同一个语义，剩下两个名字反而成了"两份事实"，一条链路要同时维护前缀名与裸名，任何一处写错都是静默丢样式。
  - **撤掉别名层的代价验证过，不是靠推理**：子树覆盖（`ConfigProvider` 的 `theme.primary`）之所以还能生效，靠的是 `@theme inline { --color-primary: hsl(var(--primary)) }` 把工具类编译成 `hsl(var(--primary))` **表达式本身**，在使用点而非 `:root` 求值。所以 `<html>` 上的一份裸名声明 + 容器上的内联覆盖，各自都在最近元素上解析 —— 原来那个专门为此存在的 `THEME_SCOPE_CLASS = 'app-theme-scope'` 已经没有作用，删（`shared/src/constants/dom-classes.ts`）。同理 `CSS_VAR_*` 全部改成裸名（`--primary` / `--radius` / `--font-size` / `--filter`），写侧统一走 `convertToHslCssVar()`，读侧统一 `hsl(var(--x))`。
  - **`--radius` 只留 rem 一档口径**：`--app-border-radius` 时代 px 与 rem 混写过，根字号一缩放就出现"文字变了圆角没变"，默认字号下量不出来。现在 `--radius: 1rem`，`--radius-*` 全部按倍率派生（`--radius-lg: var(--radius)`），单位口径由 `design.test.ts` 钉住而不是靠人记。
  - **顺带修掉一条静默回归**：`@antdv/design` 入口的 10 行 `@source`（登记 `packages/**` 里的组件包源码）在 `071dad02` 被删了。Tailwind v4 的自动内容检测从**构建根** `apps/web` 起扫，`@antdv/*` 全在仓库根的 `packages/` 下（软链进 node_modules 也在检测范围外），少登记一个包 = 那个包模板里的工具类一条都不生成。症状不是"样式丑"而是"弹窗/抽屉不定位"：`fixed top-[50%] left-[50%] translate-y-[-50%]` 这些任意值类不存在，元素退回静态位置（top:auto 落到文档流里），6 条 e2e 报 `element is outside of the viewport`，构建全程零报错。恢复登记 + 浏览器复核（modal 包围盒回到 top≈43/left≈380，提交按钮 hit-test 命中自己）。

  测试口径：

  - `design/__tests__/design.test.ts` 32 条整页重写口径：不比"看着有这条变量"，而是逐条断言**值必须是通道形状**（`/^[\d.]+ [\d.]+% [\d.]+%(?: \/ [\d.]+)?$/`）、明暗两套不许同值、`--color-*` 一律导出成 `hsl(var(--x))`、全站源码不再出现 `--app-`。别名层那条用例换成这条更强的一致不变式。
  - `apps/web/e2e/preference-effects.spec.ts` 里原来那条"规范名与别名同源"的用例，在改名后会退化成 `--primary` 和 `--primary` 自己比（恒真）。改成钉两件事：`<html>` 上的计算值是通道串，而 `bg-primary` 这类工具类**画出来的颜色**等于当场用 `hsl(var(--primary))` 算出来的颜色 —— 后者只有在工具类生成的是表达式而非常量时才成立，所以换预设、切深色之后各比一次才有效。浅色→橙黄→深色三段分别钉 `rgb(250, 84, 28)` 与 `rgb(251, 146, 60)`，正是"`.dark` 里抄了字面量"这种回归的探测器。

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
- Updated dependencies [abfe730]
- Updated dependencies [d8fa761]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
  - @antdv/common-ui@0.1.0
  - @antdv/popup-ui@0.1.0
  - @antdv/shadcn-ui@0.1.0
  - @antdv/tabs-ui@0.1.0
  - @antdv/shared@0.1.0
  - @antdv/utils@0.1.0
  - @antdv/preferences@0.1.0
  - @antdv/hooks@0.1.0
  - @antdv/types@0.1.0
  - @antdv/icons@0.1.0
  - @antdv/stores@0.1.0
  - @antdv/layout-ui@0.1.0
  - @antdv/menu-ui@0.1.0
