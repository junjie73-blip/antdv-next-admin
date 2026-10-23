# @antdv/shadcn-ui

## 0.1.0

### Patch Changes

- f64fc3a: feat: `BasicDrawer` 改用 shadcn 的 **Drawer 原语**（不再走 Sheet），抽屉多出「甩动关闭」并补掉原语的两个无障碍缺口

  现象（用户归纳）：`basic-drawer 使用 drawer 而不是 sheet`。此前 `BasicDrawer` 建在 Sheet（Dialog 语义 + `side`）上，能力面比 Drawer 窄，抽屉在触屏上缺少"往开口方向一甩就关"这条默认预期。

  - **换原语而不换依赖**：`DrawerRoot` / `DrawerContent` / `DrawerTitle` / `DrawerDescription` 都在仓库内 vendor 的 `@antdv/shadcn-ui` 里，底层同为 reka-ui 2.11.0，不需要引入 vaul。`placement` 与原语的 `swipe-direction` 是一对一映射，只有 `top/bottom` 两档要换成原语的 `up/down` 词汇（`SWIPE_DIRECTIONS`）。对外 API 面零变化 —— `DrawerProps`、`useDrawer()` 的 `[register, methods]` 与四个方法名原样保留，`apps/web` 里 10 个消费点（系统页的编辑抽屉、布局的个人中心与偏好设置）一行没改。
  - **`modal` 取 `'trap-focus'` 这一档，而且永远不翻**：Dialog/Sheet 的 `modal` 只有布尔，Drawer 多一个中间档（收焦但不改别人的 `aria-hidden`）。不能沿用 `true`：`DrawerContent` 在 `modal === true` 时会跑 `useHideOthers`，又少了 Dialog 那层的 `present` 闸门，`destroyOnHidden: false` 的关闭态面板会把整个应用置成 `aria-hidden="true"`（键盘 Tab 出得去面板，屏幕阅读器读不到页面）。也不能开合时切成 `true`：full-modal 与非 modal 是两棵 keyed 子树，翻 `modal` 会整棵重挂载，调用方插槽里的状态全丢。
  - **代价是 pointer-events 要自己认领**：抽屉的蒙层靠 `useBodyScrollLock` 的 owner 记账把 `document.body` 置成 `pointer-events: none`，这条路不会填 `DismissableLayer` 的 `layersWithOutsidePointerEventsDisabled`，于是原语只把面板在 full-modal 分支里认领回来。我们走 `'trap-focus'`，所以面板与 9 个 vendor 的弹层内容组件（Popover / Select / DropdownMenu×2 / ContextMenu×2 / Menubar×2 / HoverCard）统一补 `data-[state=open]:pointer-events-auto`，否则抽屉里点不开的正是这些浮层。判据用 `elementFromPoint` 命中自己，`toBeVisible()` 在这条上是放行的。
  - **第五条关闭路径没有绕开拦截**：`useSwipeDismiss` 的阈值是位移过 `40px` 或释放速度高于 `0.3px/ms`，手势起点落在 `button/a/input/select/textarea/label/[role=button]` 时原语主动放弃（所以拖动区是头部空白而不是按钮）。它同样只从 `update:open(false, { reason: 'swipe' })` 出去，组件在同步过程里先 `details.cancel()` 把已经拖出屏外的面板弹回原位，关不关交给 `closeDrawer()` 里那道 `await closeFunc()` 决定 —— `cancel()` 只能同步生效，等 `await` 完再调已经来不及。`maskClosable` 同时管蒙层与甩动；与弹窗侧不同，抽屉的 `closable` 只管 X 按钮。
  - **`bodyScroll` 新增**：内容区默认由抽屉自带的 `ScrollArea class="h-full"` 负责滚动；调用方自己管滚动时关掉（偏好抽屉要"顶部切换条固定 + 面板单独滚"，两层滚动容器会让内层撑到内容高度、外层反过来把切换条一起滚走）。

  验证：`popup-ui` 单测 49/49（drawer 20 条，含"未绑 open/visible 时父组件改其他 props 不会把抽屉顶关""默认不写内联 zIndex""甩动仍过 closeFunc"）；`npx turbo run type-check --filter=@antdv/popup-ui --force` 3/3 绿；`e2e/gallery-examples.spec.ts:984` 的「弹窗与抽屉页」7 条用例 × chromium/firefox/webkit 共 21/21 绿（含三方位抽屉、footer 插槽回写、抽屉内滚动到底才能同意、closeFunc 三条拦截路径）；偏好抽屉与图标选择器那 8 条用例同样 × 三引擎 24/24 绿，抽屉内浮层用 `elementFromPoint` 与几何断言核对。文档 `npx turbo run build --filter=@antdv/docs` 通过，zh 正文与 en 镜像口径一致，逐条代码引用对回当前行号，并新增「Drawer 选型说明」一节按功能适配性 / 交互体验 / 版本兼容性三个维度记录这次换向。

- 54d880b: feat: `ConfigProvider` 按 reka-ui 的规范重做（内置文案 / 尺寸档位 / 子树主题三维补齐），并接上日期排版与档位下发两条断链

  "包一层插槽"不算实现：`@antdv/common-ui` 的 `ConfigProvider` 现在以 **reka-ui 的 `ConfigProvider` 为底座**（`common-ui/src/components/config-provider/ConfigProvider.vue:194-201`），reka 那六个参数 `dir` / `locale` / `scrollBody` / `nonce` / `teleportTo` / `useId` 全部接上并且都有真实读取点；外面套的 `display: contents` 容器（`:164-173`、`:202-213`）承载主题变量与档位。在这之上补的是 reka 不管的三件事：

  - **内置文案**：`okText` / `cancelText` / `emptyText` / `placeholder` 按 `locale` 从 `textsByLocale` 展开，读侧是 `useGlobalConfig()`（`Popconfirm`、`Empty` / `EmptyState` / `Transfer`、`Description`）。这些组件的 `size` / 文案 props 默认值一律改成 `undefined` —— 写死 `'default'` 就等于没有全局档位。
  - **尺寸档位**：`componentSize` 三档，`'middle'` 这个存量别名在解析时折成 `'medium'`（`normalizeComponentSize`），各家族按自己的词汇落地（`Loading` → `default`、`Segmented` → `middle`）。`types.ts` 把 `ComponentSizeOption` / `ResolvedComponentSize` / `Direction` / `LocaleKey` / `GlobalTheme` 一并导出，包装组件不必再自己抄一遍档位类型。
  - **子树主题**：`theme`（`mode` / `preset` / `primary` / `radius`）与 `cssVars` 只写成容器上的 CSS 变量与 `.dark` / `.light`，**不加第二个全局写侧** —— 全站主色仍然只有 `applyPreferencesToDom()` 往 `<html>` 写一次；`cssVars` 最后写入所以优先于 `theme` 派生的那两条。生效前提是 `@antdv/design` 用 `@theme inline` 声明 token，工具类编译成 `var(--app-primary)` 本身，于是 `display: contents` 这种"没有盒子"的容器也能把变量下发给子节点。留空 = 删掉声明 = 子树重新继承 `<html>`，不是"覆盖成默认值"。
  - **嵌套**：内层只覆盖自己显式给出的字段，其余继承外层的成品值（`:39-47`、`:53-96`）；注入的是 `reactive` 对象而不是 `computed` 快照，否则外层改了内层收不到。宿主自己的 `class` / `style` / 事件与容器合到同一个元素（`inheritAttrs: false` + `useAttrs()`）。

  两条链路上原来是断的，这次一并接上：

  - **日期排版（`@antdv/form-ui`）**：`FDatePicker` 在 `<Calendar>` / `<RangeCalendar>` 上写死 `locale="zh-CN"`，另外还存了一份硬编码中文月名数组，切语言时"按钮变了、日历还是中文"。现在字段壳不传 `locale`，12 个月名由 reka 的 `useLocale()` 喂给 `Intl.DateTimeFormat`（`fields/FDatePicker.vue:161-174`）。链路是 provider → reka 注入 → 各 Root 的 `useLocale(propLocale)`（显式 prop 优先，否则注入，再兜底 `en`）→ `useDateFormatter`，Root 还 watch 语言变化重设 formatter。**`useDateFormatter()` 自己不读注入**（参数是普通字符串），所以"自己 new formatter"的包装组件不在这条桥接里：`shadcn-ui/calendar/Calendar.vue:27` 的 `useDateFormatter(props.locale ?? "en")` 只服务 `layout` 的 `NativeSelect` 变体，默认分支的 `<CalendarHeading />` 与星期表头才走注入 —— 想让月/年下拉也跟语言必须显式传。
  - **档位下发（`@antdv/shadcn-ui`）**：`ToggleGroup` 往子项 `provide` 的是**普通对象**，等于 setup 那一刻的快照，切档时组自己身上的 `data-size` 变了、按钮高度不动，看起来就像"档位只写了个属性"。改成带 getter 的 `reactive()`（`toggle-group/ToggleGroup.vue:24-33`），子项每次渲染重新取。
  - **下游类型出口（`@antdv/popup-ui`）**：`message/index.ts:18` 的 CSS 副作用类型声明被 `eslint --fix` 的 `spaced-comment` 拆成了 `// / <reference …>`，指令失效，按源码消费的下游 `vue-tsc` 立刻报 TS2882。恢复成真正的三斜线指令，并给 `common-ui/components/toast/Toaster.vue` 补上同样一条（本包同样按源码发布，下游看不见包内的 tsconfig include）。

  验证：`@antdv/common-ui` 单测 308/308（27 个文件，其中 `__tests__/config-provider.test.ts` 22/22，覆盖注入合并、嵌套继承、`display: contents`、CSS 变量写入与"留空即删除声明"），`@antdv/form-ui` 90/90（6 个文件）；`turbo run type-check test:unit --filter=@antdv/shadcn-ui --filter=@antdv/form-ui` 14/14 任务通过，`turbo run type-check --filter=@antdv/common-ui --filter=@antdv/popup-ui` 11/11 任务通过。新增浏览器端到端 `apps/web/e2e/config-provider.spec.ts` 5 条 × chromium / firefox / webkit = 15/15，全程只用 `setPreference()` 这一个写侧（与用户操作偏好同一条形变）：偏好的语言与档位落到宿主 `data-config-*` 且容器 `display: contents`、宽高量到 0、根 provider 上不出现第二条 `--app-primary`；档位切档时 `Segmented` 实测行高跟着变；`Popconfirm` 的内置文案从"确定/取消"变 Cancel/OK；日历标题从 `2026年10月` 变 `Oct 2026`、星期表头从 `一 二 … 日` 变 `S M T W T F S`；子树换色量到 `.bg-primary` 探针变蓝而 body 级对照与 `<html>` 的主色不动。文档同步：`docs/components/common-ui.md` 与 en 镜像重写 ConfigProvider 小节（新增「日期排版走 reka 的注入」与档位 reactive 警告），`docs/guide/in-depth/internationalization.md`（含 `docs/zh` 副本）与 en 镜像新增「日期控件的排版另走一条链路」小节与排错行；`turbo run build --filter=@antdv/docs` 通过，`node docs/_linkcheck.mjs docs` 缺失目标 0（121 个文件），四个新增锚点在构建产物里都存在。`node scripts/check-uniform-build.mjs` 仍通过。已知噪声：`common-ui` 的 `cron-editor.test.ts` 会发起外网请求，在 turbo 并发下偶发超时（单跑 27/27 绿），与本次改动无关。

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

- Updated dependencies [5194446]
- Updated dependencies [f740d13]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [54d880b]
- Updated dependencies [d8fa761]
- Updated dependencies [f64fc3a]
  - @antdv/shared@0.1.0
