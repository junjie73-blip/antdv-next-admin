# 开发规范与环境变量

## 环境变量

三个文件，按 Vite 的模式合并（`.env` 打底，`.env.development` / `.env.production` 覆盖）：

| 变量 | 位置 | 作用 |
| --- | --- | --- |
| `VITE_NAMESPACE` | `.env` | 缓存 key / localStorage 的命名空间前缀 |
| `VITE_APP_TITLE` | `.env` | 标题与 app-loading 文案 |
| `VITE_MOCK` | 三份都有 | dev 打开、生产关掉；关掉时 `/api` 不再代理到 Nitro |
| `VITE_MICRO_APP` | `.env` | 微前端开关，**默认关**（见下） |
| `VITE_WS_URL` | `.env` | 顶栏实时通知的 WebSocket 地址，留空 = 不连接 |
| `VITE_PORT` | 模式文件 | dev 6080 / prod 9080 |
| `VITE_APP_BASE_API` | `.env.development` | 接口前缀（`/api`），代码里不要写死完整域名 |
| `VITE_MOCK_SERVER` | `.env.development` | Nitro mock 地址（`http://localhost:5320`） |
| `VITE_INJECT_APP_LOADING` | 模式文件 | 首屏 app-loading 注入 |
| `VITE_DEVTOOLS` | `.env.development` | vue devtools |
| `VITE_PWA` | `.env.production` | 生成 manifest + service worker |
| `VITE_COMPRESS` / `VITE_ARCHIVER` | `.env.production` | gzip 产物 / 打 zip 包 |
| `VITE_VISUALIZER` | `.env.production` | 产物体积分析 |
| `VITE_CACHE_ENCRYPT_KEY` | `.env.production` | 本地缓存加密密钥（SM4，必须 32 字符） |

::: warning

布尔开关用 `isEnvEnabled` 判断，不要写 `=== true` `VITE_*` 从环境里拿到的是字符串。`VITE_MICRO_APP === true` 这种写法永远为 false，表现是"我明明打开了开关，微前端页还是一直报连不上"。
:::

::: warning 两个默认关掉的开关是有原因的

- `VITE_MICRO_APP=false`：子应用要真的跑在注册表配的端口上（`src/config/micro-app.ts`），否则「微前端」菜单页会去连不通的地址。
- `VITE_WS_URL=`（空）：Nitro mock 没有 `/ws` 处理器，而重连是**无限**的 —— 在没有后端的情况下发起连接，只会把控制台和端到端用例淹掉。接真实后端时填完整地址（如 `ws://localhost:8080/ws`），token 由前端自动附加。

`VITE_DEV_POLLING` 也在 `.env.development` 里注释着：仓库放在映射盘（本机是 `J:`）时 inotify 事件不送达，看起来该开。实测**开了也救不回来** —— 配置确实拿到了 `server.watch.usePolling`，用 chokidar 直接轮询同目录能收到 change，但 dev server 的模块图始终不失效（旧模块一直服务到重启）。白烧 CPU 换不到 HMR，所以保持注释，改完共享包按 [快速开始](/zh/guide/introduction/quick-start#_3-改了共享包却没生效) 的流程重新构建 + 重启。
:::

## 编码规范

细则在根目录 `CODE_STANDARD.md`（20 节：目录组织、命名、Vue 组件、Pinia、HTTP、WebSocket、样式、表格、CRUD、权限、安全、环境变量、表单 Schema 工厂、`actions.ts`、路由注册顺序、常见坑、组件复用、国际化、TypeScript、性能）。这里只提和目录/布局强相关的三条：

1. **页面按 `views/<模块>/<页面>/index.vue` 摆放**，页面私有逻辑放同目录的 `actions.ts` / `columns.ts` / `schemas.ts`；`components/`、`widgets/` 子目录里的是 **私有组件，不是路由页面** —— 文件约定路由和"根容器不许加 padding"的守卫都用这个口径排除它们。
2. **路由页面外层容器不写 padding**，内边距归布局管（见[布局、菜单与标签页](/zh/guide/in-depth/layout#内容区内边距归布局管)）。
3. **强调色只用 `@antdv/design` 的主色令牌**（`bg-primary` / `text-primary` / `var(--app-primary)`），不写 antd 兼容层的 `*-ant-*`（那组类已不再生成），也不写死 `blue-*` 或 `#1677ff`（见[主题与偏好设置](/zh/guide/in-depth/theme#用-tailwind-写主题色)）。

跑检查：

```bash
pnpm lint            # eslint（组装 internal/lint-configs 里的共享配置）
pnpm format          # oxfmt
pnpm check           # circular + dep + type + builds + cspell 五件套
pnpm publint         # 子包产物是否可发布
```

`check:type` 目前**存量 253 条错误**（`components/business/**`、`api/mock.ts`、 `security/dashboard/**`、`form/validation` 等）。CI 里它以"继续但不阻断"的方式跑，理由与收敛计划见 [CI 与部署](/zh/guide/essentials/deploy#type-check-为什么先设成非阻断)。

## 子包统一构建标准

全仓 34 个包只有两种合法形态，**不存在"某些包靠热更新、某些包才编译"的混配**：

| 形态 | 谁在用 | `build` 做什么 |
| --- | --- | --- |
| 按源码发布（`exports` 指向 `./src/**`） | `packages/**` 的组件与工具包、`@antdv/design` | `vite build`（lib 模式）：编译 SFC / TSX / 原子类 → 打包进 `dist` → 校验产物 |
| 按产物发布（`exports` 指向 `./dist/**`） | `shared`、`preferences`、`router`、`directives`、`hooks`、`types`，以及全部 `internal/*`、`scripts/*` | `tsdown`（各自 `tsdown.config.ts` 里 `clean: true`、`dts: true`） |

四条硬约束：

1. **每个包都有 `build`**。只有"配置本身没有可编译内容"的包例外（`@antdv/tsconfig`、`@antdv/stylelint-config`、`@antdv/commitlint-config` 是纯 JSON / CSS 预设），例外清单和理由就写在 `scripts/check-uniform-build.mjs` 顶部。
2. **`stub` 不能是唯一的构建方式**。tsdown 的 `stub` 只在 `dist` 里放一层跳板，产物从没真被编译过 —— 类型错误、缺依赖、SFC 编译失败全部推迟到宿主应用起 dev server 时才现形。`@antdv/node-utils` 留着 `stub` 是因为它的脚本工具链靠跳板直跑源码，但它同时有真 `build`。
3. **按源码发布的包不挂自己的 `dev` / `watch`**。它们的热更新由宿主应用（`apps/web`）的 dev server 提供：Vite 直接吃源码，改子包立刻生效。再挂一层 `vite build --watch` 只会跟宿主抢同一批目录。
4. **产物必须覆盖 `exports` 的每一个公共子路径**。`defineLibraryConfig()` 从 `package.json` 的 `exports` 推导入口（含 `./*` 通配），构建完由 `antdv:validate-dist` 逐条检查 `dist/<name>.js`（样式入口查 `.css`，开了 `dts` 再查同名 `.d.ts`）真的落盘，缺一个就让构建失败并点名是哪个子路径。

守卫是可直接跑的（`check:builds` 已排在 `pnpm check` 里，但那条链现在会在 `check:type` 那一步短路，所以实际要单跑）：

```bash
pnpm check:builds
# 子包统一构建标准检查通过：34 个包都有 build / 无 stub-only / 源码发布包不挂 watch。
```

新增子包只做三件事：`vite.config.mts` 写 `export default defineLibraryConfig();`；`package.json` 补 `build: vite build`、`clean: rimraf dist .turbo`、`files: ["dist", "src"]`；devDependencies 加 `@antdv/vite-config` 与 `vite`。剩下的漏配由守卫兜住。

::: warning 三个已经踩实的 lib 模式细节

- **别用 `build.lib.fileName`**：它是单入口的前缀选项，写成 `'[name]'` 时 CSS 资产不走同一个替换，产物落成 `dist/_name_.css`；写成函数时 JS 又被塞进 `dist/es/`。多入口的产物名一律走 `rolldownOptions.output.entryFileNames` + `assetFileNames`。
- **纯样式入口要显式 `cssCodeSplit: true`**：lib 模式默认是 `false`，而那个模式下 Vite 直接拒绝 CSS 入口（`"rolldownOptions.input" should not include CSS files`），`@antdv/design` 就是这么起来的。
- **`dts` 默认跟随 `types` 指向**：`types` 指进 `dist` 才生成声明文件。按源码发布的包（`types: ./src/index.ts`）生成的 `.d.ts` 没有读者 —— 类型面由各包自己的 `type-check` 把关，重复出一份只把构建时间翻倍（实测 `@antdv/menu-ui` 27 s → 7.5 s）。

:::

::: tip 代价与时序

全量 `pnpm build` 现在是 31 个任务、约 4 分钟，单个源码包 7–10 s。`turbo.json` 里 `dev` / `type-check` / `test:unit` 都 `dependsOn ^build`，所以冷启动的第一次 `pnpm dev` 会先补一遍依赖包的产物（约 1 分钟），之后命中缓存。这不是回归，它正是"改坏的子包在提交前就红"的价钱。

:::

## 提交信息

```bash
pnpm commit          # czg 交互式，按 internal/lint-configs/commitlint-config 校验
pnpm commit :f       # 别名直接预填 "docs: fix typos"
```

`type-enum` 的白名单是 **13 个**：`feat / fix / perf / style / docs / test / refactor / build / ci / chore / revert / types / release`。注意 czg 的**交互列表**里还多两个（`wip`、`workflow`），它们不在白名单内 —— 真选了会被 commitlint 判失败，所以那两个别当常规类型用。别名一共五个：`b` = `build: bump dependencies`、`c` = `chore: update config`、 `f` = `docs: fix typos`、`r` = `docs: update README`、`s` = `style: update code format`。

其余硬约束：`header-max-length` 108、`body-leading-blank`（正文前必须空行）、 `footer-leading-blank`（警告级）、scope 可以为空，非空时必须落在允许列表里（`function-rules/scope-enum`）。**没有**任何规则把 breaking change 限制在 `feat` / `fix`，那只是交互提示里的措辞。

::: warning

本地钩子目前是关的 `lefthook.yml` 里所有 hook 都被注释掉了（`prepare` 仍会执行 `lefthook install`，但没有实际拦截）。所以**别指望提交时自动跑 lint**，也别忘了 `pnpm exec lefthook run pre-commit` 现在等于什么都没做 ——真正的门禁在 CI 那侧，见 [CI 与部署](/zh/guide/essentials/deploy)。
:::

## changeset

改动影响已发布包时补一条：

```bash
pnpm changeset
```

`.changeset/*.md` 的 frontmatter 里列出受影响包与版本级别。因为配置了 `fixed: [["@antdv/*", "@antdv/*"]]`，任一包升版会带着全部 `@antdv/*` 一起走同一版本号。写内容时按"为什么改 + 怎么验证"来写，不要只写"改了什么文件"。

## 组件示例页是模板，不是草稿纸

`views/components/**` 会被别的项目直接抄。所以：

- 示例要真的能交互（点了要出东西），不要放"示意一下"的死代码；
- API 用错会被静态守卫抓（`views/__tests__/gallery-api-usage.spec.ts`）；
- 组件解析失败在 Vue 里**只出 warning**，表现是"那块区域空着"，巡检看不出来 ——所以断言要落在"内容真的渲染出来"上；
- 新增示例页只要进菜单，就会自动出现在[总览卡片墙](/zh/guide/in-depth/layout)里（清单直接读菜单树，不抄第二份）；
- 菜单层级只允许到二级：`组件示例 → 页面`。**只有「表单」「表格」两支例外**，它们量大，用 `组件示例 → 分组 → 页面` 的三级形态。不要再往中间塞"画廊 / 分类"这类容器 ——容器一旦多于一层，侧栏要点开两次才看到内容，面包屑也会长到没地方显示。
