# 禁止修改清单

每条给出：**对象** → **原因** → **边界（什么可以动、什么必须问）**。
分四级：`🔴 硬禁`（改了必然出事，必须先取得用户确认）、`🟠 需同步`（可以改，但同一批必须改守门人/文档）、`🟡 谨慎`（改前读注释，多数历史坑已写在原地）、`⚪ 环境`（本机事实，不属于仓库，别写进代码）。

## 1. 核心模块与依赖边界

| 级别 | 对象 | 原因 | 边界 |
| --- | --- | --- | --- |
| 🔴 | `packages/**` 源码里的组件库导入（`antdv-next`、`@antdv-next/*`） | 引一行就等于全部子包产物都背一套 UI 库；`shared`/`preferences`/`utils`/`types`/`hooks` 历史上都因此被逐个拆开。守门：`packages/core/hooks/__tests__/boundary.test.ts:136` | 只拦「导入形态」，注释与字符串字面量不算；`devDependencies` 里为对照实验装的允许存在。要新能力就在 `ui-kit/*` 里用 reka-ui 原语组合 |
| 🔴 | 跨包的相对路径导入、盘符/绝对路径 | 换一台机器或搬一次目录就失效；turbo 的依赖图只认 `package.json`，相对导入会让构建顺序与缓存全错。守门：`boundary.test.ts:188`、`:62` | 唯一例外是 `@antdv/design` 的 `@source` 名单——Tailwind 的内容登记只认文件系统路径 |
| 🔴 | 子包反向 import `apps/web/**` | 会形成 turbo 认不出的环：`Cyclic dependency detected` 时整个 `turbo run <task>` **一条都不执行** | 子包需要宿主能力就暴露可变 runtime + `configureX()`，由 `apps/web/src/plugins/**` 注入 |
| 🔴 | `apps/web/src/plugins/**` 之外触碰 `~/stores`、`~/api`、`~/views`、`~/locales` | 运行时装配只允许一个入口，否则同一个 runtime 被两处配置、偏好落盘顺序不可控 | 新增装配模块就加在 `plugins/` 里，并在 `main.ts` 注册 |
| 🟠 | `@source` 名单（`packages/core/base/design/src/index.css:46-55`） | 构建根是 `apps/web`，`@antdv/*` 走软链在自动检测之外；少登记一个包 = 该包模板里全部工具类静默不生成（页面渲染正常、就是不定位）。**已发生过一次**：071dad02 重排这个文件时把整块 `@source` 删掉了，因为消费方读的是上一轮 `dist` 里的 CSS，构建与页面都不报错，直到静态检查与浏览器复核才发现 | 名单只属于 design；新增带 `.vue` 的子包同批补登记，`design.test.ts:628` 会反查 |
| 🟠 | toast 归属：轻提示只能走 `@antdv/popup-ui` | `boundary.test.ts:157`；绕过它直接引 `vue-sonner` 会丢掉本包的主题外壳与分流 | 需要新通道就在 `popup-ui/src/message/index.ts` 里加 |
| 🟠 | 实时通信只住在 `@antdv/request` | `boundary.test.ts:166`；WS 散落到业务包后重连/鉴权口径无法统一 | — |
| 🟡 | `@antdv/shadcn-ui` 的源文件 | 它是 `pnpm shadcn add` 的产物，上游会迭代；覆写写在里面下次同步即被冲掉 | 改外观只在 `common-ui` 建外壳（`common-ui/src/components/toast/Toaster.vue`）或用主题变量 / 自定义类名 / CSS 覆盖，方案与 shadcn 实现解耦 |

## 2. 设计与主题链路

| 级别 | 对象 | 原因 | 边界 |
| --- | --- | --- | --- |
| 🔴 | 在声明里写 `--app-*`、`--ant-*`、`*-ant-*` 工具类 | 命名空间只有 shadcn 裸规范名一套；`*-ant-*` 来自已删除的兼容层，写了不是颜色不对而是**整个类不生成**。守门：`design.test.ts:335`、`:459`、`shared/__tests__/constants.test.ts:52` | 注释里讲历史可以；`apps/web/index.html` 首屏遮罩自带的 `--app-loading-*` 是页面级局部变量，不属于 token 命名空间 |
| 🔴 | 把完整颜色写回 token 变量（`#f0f0f0`、`hsl(...)`） | 工具类是 `hsl(var(--x))` 组合，变量塞完整色 → `hsl(#f0f0f0)` 解析失败 → 边框消失、背景透明且不报错 | 变量只存通道（`L a b` 形式），值校验在 `design.test.ts:335` |
| 🟠 | `@theme inline`、`.dark` 变体写法、`utilities` 排在最后 | 写成 `@theme` 不带 `inline`，`.dark` / `[data-theme]` 的覆盖不生效；层级顺序在 `design.test.ts:39`、`:55`、`:418` | 只改取值不改结构 |
| 🟠 | 14 套预设 × 明暗的色表完整性与互不相同 | 缺一条暗色声明就是"切深色白底黑字浮层"；两套取值一样就是"深色模式没变"。守门：`design.test.ts:211`、`:226`、`:244`、`:250` | 名单唯一事实来源是 `@antdv/shared/constants` 的 `THEME_PRESETS`（`packages/core/base/shared/src/constants/theme-presets.ts:26`），加预设要同时改两处 |
| 🟠 | 圆角基准写 `rem` 不写 `px` | 全站尺度按根字号缩放（`design.test.ts:366`） | — |
| 🟡 | `design/css/base.css` 里的光标规则（能点 → `pointer`，禁用 → `not-allowed`） | 浏览器不会自己给 `<button>` 指针光标；历史上逐个模板补 `cursor-pointer` 漏一处就"盒子亮了鼠标还是箭头"。守门：`design.test.ts:505` + `apps/web/e2e/cursor.spec.ts` | 新增可点盒子优先靠这条全局规则，别再往模板里塞类名 |
| 🟡 | `design` 不 `@import` 组件包、`package.json` 不声明组件库依赖 | CSS 与组件互相牵动；设计规范不能建立在某个库的主题算法上（`design.test.ts:564`、`:585`） | — |

## 3. 关键逻辑与固定行为

| 级别 | 对象 | 原因 | 边界 |
| --- | --- | --- | --- |
| 🔴 | `apps/web/index.html` 的内联首屏脚本与 `script[data-app-loading-theme-sync]` 标记 | 首屏主题回填必须发生在应用挂载前；同时任何"文档里不许有 inline script"的安全断言都靠这个标记豁免（并且要反证它恰好只有 1 枚） | 改文案/动画可以，改标记名要同批改安全用例 |
| 🔴 | 根部两只 `<Toaster />`（`apps/web/src/App.vue`）与 `NOTIFICATION_TOASTER_ID` | 轻提示与通知分两条通道堆叠；合并成一只会让 `toasterId` 分流失效、居中量到叠放偏移。裸 `[data-sonner-toast]` 选择器要按 `data-x-position` + `data-y-position` 收窄 | 两只都**不**开 `close-button`：手动关闭是单条的 `closeButton` 决定（`popup-ui/src/message/index.ts`） |
| 🔴 | `e2e/utils/app.ts` 的 `externalResourceFailure()` 分桶 | 图标 CDN 失败在 Firefox 报成 console **error**、Chromium 只报 `Failed to load resource`；分桶把"外站资源失败"从 `errors` 里摘出去。放宽这里会把本站真错误一起洗白 | 只允许加更窄的判据，不允许改成"全部忽略" |
| 🟠 | `playwright.config.ts` 里 WebKit 专属的 `actionTimeout: 45_000` / `timeout: 240_000` 与 `E2E_WORKERS=3` | 三引擎并发 × 默认 worker 会把单 dev server 打满，出现纯超时假红；只放宽**墙钟**，单步 `expect(10s)` 不动，功能真坏照样立刻红 | 别为个别假红去动全局超时或给 `submitLogin` 加重试（那是 17 个 spec 共用的"登录点不动"信号） |
| 🟠 | `layout-ui/src/layout.ts:189` 的 `MOBILE_BREAKPOINT = 768` | 窄屏判据与 `md` 档内边距共用这一档，两处口径必须同值 | 改断点要同批改 `layout-ui` 内边距分档与 `mobile-nav` 用例 |
| 🟠 | `apps/web/tsconfig.vitest.json` 的 `types` 数组 | 这里写 `types` 是**覆盖**不是追加；漏 `vite/client` 会让 `ImportMetaEnv` 失去索引签名，`import.meta.env.VITE_*` 全报 TS2339 | 追加时保留 `node`、`jsdom`、`vite/client`、`vitest/globals` |
| 🟡 | `apps/web/src/views/**` 里的 `v-permission` 写法 | `role` / `admin` 是**参数**不是修饰符（`resolveAccess` 只看 `binding.arg`），写成 `.role` 判根本不读，症状是"页面照常、点了没反应" | 由 `gallery-api-usage.spec.ts` 静态钉住，含坏样例反向对照 |
| 🟡 | `common-ui` 的目录结构 | 每组件一目录 + `index.ts`（`common-ui/__tests__/structure.test.ts`）；"随手放个 .vue"不合格 | — |
| 🟡 | `mock` 菜单层级（`apps/backend-mock/server/api/menus.get.ts`） | 用户定的口径：最深三级，且只有「组件示例 → 表单 / 表格」两支用到三级；换落点测 mixed-two-column 时第三列必不空 | 造新样例菜单按此规则 |

## 4. 固定资源与工程配置

| 级别 | 对象 | 原因 | 边界 |
| --- | --- | --- | --- |
| 🔴 | `.gitattributes`（`* text=auto eol=lf`） | 仓库统一 LF；改成 CRLF 会让每次格式化都产生整文件 diff，且 oxfmt 的行尾重写会被误判成"内容改动" | — |
| 🔴 | `.node-version`（24.0.0）与根 `package.json` 的 `engines.node` / `packageManager: pnpm@10.12.4` / `preinstall: only-allow pnpm` | 换包管理器会重写 lockfile；`internal/*` 与 `scripts/*` 的构建依赖 pnpm 的软链布局 | 升级属工程决策，先与用户确认 |
| 🟠 | `pnpm-workspace.yaml` 的 `catalog` 与 `overrides` | `overrides` 里 `vue`、`pinia`、`clsx`、`@ctrl/tinycolor` 是为了全仓单实例；放开就会多份 Vue 副本（注入失效、devtools 报错） | 新增第三方库：先在 catalog 登记，再在包内写 `"catalog:"` |
| 🟠 | `turbo.json` 的 `globalDependencies` | 覆盖 `internal/vite-config/src/**` 等路径，删掉这些边会让子包读到旧 dist 而不 cache miss | — |
| 🟠 | `lefthook.yml`（pre-commit 全部注释状态） | 注释里写了原因：串行都想避开 `check:type` 期间的内存/CPU 峰值。启用前请确认机器承受力 | 别把它当成"仓库有自动把关"，交付检查必须手跑 |
| 🟡 | `commitlint.config.mjs` 的 `types` 名单 | `pnpm commit`（czg）的可选类型；加类型要同步给评审口径 | — |
| 🟡 | `.changeset/` | 发布走 changesets，漏写就没有变更记录、版本号不动 | 每个用户可见变更一条 |
| ⚪ | 本机路径事实 | `J:` 是映射盘：Vite 的 inotify 不送达（`VITE_DEV_POLLING` 打开也救不回来），dev 验证前必须清 `apps/web/node_modules/.vite` 并重启；`/api` 前缀只在 `.env.development` 有值，生产产物里是空串 | 这些是环境事实，不要写进源码或 CI 假设 |
| ⚪ | 仓库根的未入库碎片：`dist.zip`、`dev8.log`、`e2e-p14.log`、`.sync-state.json`（已被 `*.zip` / `.tmp/*` 等规则忽略）；以及**已跟踪**的 `console.log(j.data.user.token))` | 上游模板遗留的调试碎片，文件名含 token 字样，属于凭据卫生风险。体检脚本只列名字、不读内容 | 删除需要用户确认；任何情况下不要把它贴进日志或提交信息 |
