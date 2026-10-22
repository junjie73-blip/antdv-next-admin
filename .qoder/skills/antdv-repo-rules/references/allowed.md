# 允许操作的范围、可自定义的配置与可扩展点

## 权限分级

| 标记 | 含义 | 判断标准 |
| --- | --- | --- |
| 🟢 | 直接做，不用问 | 单文件内的实现细节、补测试、改注释、按现有模式加字段 |
| 🟡 | 做完在汇报里说明 | 新增文件/新增目录、改包内公共出口、加一条 e2e 用例 |
| 🟠 | 必须同批改另一处，否则算没做完 | 改到守门测试覆盖的口径（token、`@source`、目录结构、断点、预设表） |
| 🔴 | 先取用户确认 | `references/forbidden.md` 里标 🔴 的对象、删除类操作、跨包搬迁、改工程配置（node/pnpm/turbo/lefthook） |

## 1. 可以改动的目录（按职责）

包名与目录**不同名**的唯一一例：`@antdv/types` 住在 `packages/core/base/typings`。

| 目录 | 包名 | 放什么 | 典型改动 |
| --- | --- | --- | --- |
| `apps/web/src/views/**` | `@antdv/web` | 业务页面，按 `CODE_STANDARD.md` §1 拆 `index.vue / actions.ts / columns.ts / schemas.ts / constants.ts / types.ts / utils.ts / components/` | 加页面、加列、加搜索项、改交互 |
| `apps/web/src/plugins/**` | `@antdv/web` | **唯一的运行时装配层**（`layouts-host.ts`、`request-runtime.ts`、`table-runtime.ts`、`ui-runtime.ts` + `__tests__`） | 把宿主能力（stores/api/views/locales）注入子包 |
| `apps/web/src/{router,stores,api,locales,config,composables,directives,utils,mock,layouts,bootstrap}` | `@antdv/web` | 宿主自己的横切层 | 加接口函数、加路由、加翻译 key |
| `apps/web/e2e/**` | `@antdv/web` | Playwright 用例（33 个 spec）与 `utils/app.ts` 公共动作 | 加用例、修定位器、按判据纪律改断言 |
| `apps/backend-mock/server/**` | `@antdv/backend-mock` | 进程内 Nitro mock（dev 5320） | 加接口、改 fixtures、造菜单 |
| `packages/core/base/icons` | `@antdv/icons` | 图标封装 + `IconPicker` | 加集合、改面板交互 |
| `packages/core/base/shared` | `@antdv/shared` | 常量 / `cn` / 工具级共享代码，**预设名单的单一事实来源** | 加常量（同步 `constants.test.ts`） |
| `packages/core/base/typings` | `@antdv/types` | 纯类型 | 加类型，不写运行时值 |
| `packages/core/base/design` | `@antdv/design` | token（`token/`）与公共样式（`css/`） | 改取值可以，改结构按 🟠 |
| `packages/core/hooks`、`packages/core/preferences` | `@antdv/hooks`、`@antdv/preferences` | 组合式函数、偏好系统与 DOM 落盘 | 加 hook（配 `__tests__/<name>.spec.ts`） |
| `packages/core/ui-kit/*`（除 `shadcn-ui`） | `@antdv/{common,form,layout,menu,popup,table,tabs}-ui` | 业务组件与字段实现 | 加组件、修缺陷 |
| `packages/{directives,enums,layouts,request,router,stores,utils}` | 同名 `@antdv/*` | 指令、枚举、布局外壳、请求与 vue-query、路由、store、工具 | 同上 |
| `docs/**` | `@antdv/docs` | VitePress 文档站 | 改文档、补示例说明 |
| `.qoder/skills/**`、`CODE_STANDARD.md`、`.changeset/**` | — | 规范与变更声明 | 随手维护，属 🟢 |

## 2. 可自定义的配置项

**环境变量**（`.env` 基座 + `.env.development` / `.env.production`；只有 `VITE_` 前缀进产物，密钥不许进 `VITE_*`）：

| 变量 | 作用 | 默认 |
| --- | --- | --- |
| `VITE_NAMESPACE` / `VITE_APP_TITLE` | 缓存命名空间、标题与水印文案 | `antdv` / `Antdv Admin` |
| `VITE_PORT` | dev 6080 / prod 9080；e2e 的 `baseURL` 跟着它 | 见文件 |
| `VITE_MOCK` | 开关注入 Nitro mock（dev）或浏览器内 fixtures 拦截（prod） | dev/prod 均为 `true` |
| `VITE_APP_BASE_API` | 接口前缀；**产物里这个值就是 `/api`，别按"生产为空串"假设写用例** | `/api` |
| `VITE_MOCK_SERVER` | `/api` 透传目标 | `http://localhost:5320` |
| `VITE_WS_URL` | 通知 WS 端点，**留空=不连**（mock 无 `/ws`，重连无限会淹掉控制台与 e2e） | 空 |
| `VITE_INJECT_APP_LOADING` / `VITE_DEVTOOLS` / `VITE_MICRO_APP` | 首屏遮罩、DevTools、微前端开关 | `true`/`true`/`false` |
| `VITE_COMPRESS` / `VITE_ARCHIVER` / `VITE_PWA` / `VITE_VISUALIZER` | 产物压缩、打包 zip、PWA、体积分析 | 仅 prod |
| `VITE_CACHE_ENCRYPT_KEY` | SM4 缓存密钥（32 字符）—— **仓库里那份示例值必须换掉** | 见文件 |

**运行时偏好**（`packages/core/preferences/src/config.ts` 的 `DEFAULT_PREFERENCES`，约 45 项，是主题/布局/小部件/底栏/通用的默认值；名单变动由 `shared/__tests__/constants.test.ts` 钉住）。项目级覆盖只写在 `apps/web/src/settings/index.ts` 的 `APP_DEFAULTS`——`import.meta.env` 只允许在应用源码里出现，包的产物拿不到 Vite 的静态替换。

**主题预设**：`@antdv/shared/constants` 的 `THEME_PRESETS`（14 条，`theme-presets.ts:26`）+ `custom` 兜底，明暗两侧各自写满 27 条语义色。

**e2e 的外部旋钮**（不改代码就能调）：`E2E_BASE_URL`、`E2E_WORKERS`、`E2E_HEADED=1`。

## 3. 可扩展的功能模块 —— 每处新增都必须同步登记的东西

| 要加什么 | 加在哪 | 必须同步 |
| --- | --- | --- |
| 一个 shadcn 风格的原子组件 | `packages/core/ui-kit/shadcn-ui/src/**`（优先 `pnpm shadcn add`） | 不写业务逻辑；`@source` 已覆盖本包 |
| 一个业务组件 | `common-ui/src/components/<PascalName>/`（**一组件一目录 + `index.ts`**） | `structure.test.ts` 会查目录；从包出口 re-export；用到的工具类若来自新包→补 `@source` |
| 一个表单字段 | `form-ui/src/fields/F<Name>.vue` + `fields` 注册表 | props 用泛型 `defineProps<Props>()`；补 `__tests__/fields.test.ts` |
| 一个子包 | `packages/core/{base,ui-kit}/<name>`，`exports` 指向 `./src/**` | ① `package.json` 必须有 `build`（`pnpm check:builds`）② `design/src/index.css` 补 `@source` ③ 依赖写 `workspace:*` / `catalog:` ④ 加 `vitest.config.ts` 与 `__tests__` |
| 一个页面 | `apps/web/src/views/<模块>/<页面>/{index.vue,actions.ts,columns.ts,schemas.ts,constants.ts,types.ts}` | 路由（`router/`）+ 菜单：mock 走 `apps/backend-mock/server/api/menus.get.ts`（最深三级，只有「组件示例→表单/表格」用到三级）+ `locales` 两份 key 同步 |
| 一个接口 | `apps/web/src/api/*.ts` 里导出函数，组件只 import 函数 | mock 侧同名路由与 fixtures；路径口径照 `CODE_STANDARD.md` §5.2，**具体路径排在 `/:id` 前** |
| 一个 store | `packages/stores/src/**`（跨页共享）或 `apps/web/src/stores/**`（宿主专属） | 持久化只点名需要的 key，不用 `pinia-plugin-persistedstate` 全量落盘 |
| 一个组合式函数 | `packages/core/hooks/src/**` | 同目录 `__tests__/<name>.spec.ts`；模块级单例要在注释里写明由谁清理 |
| 一个运行时能力（要读 stores/api/locales） | 子包暴露可变 runtime + `configureX()`，在 `apps/web/src/plugins/**` 注入 | `main.ts` 注册顺序；插件有 `__tests__` |
| 一条 e2e 判据 | `apps/web/e2e/<主题>.spec.ts` | 首访重型页要留够编译时间；静态扫描类判据要配**反向对照**（自己造一个坏样本，证明判据抓得住） |
| 一个 lint/format 规则 | `internal/lint-configs/*` | 全站跑 `pnpm lint` 确认没有大面积红 |

## 4. 命令权限

| 级别 | 命令 |
| --- | --- |
| 🟢 | `turbo run test:unit --concurrency=1`、包内 `npx vitest run <file>`、`npx playwright test <spec> --project=chromium --workers=1`、`pnpm check:builds`、`pnpm lint`、`vue-tsc --noEmit`、`node scripts/check-uniform-build.mjs`、本技能体检脚本 |
| 🟡 | `pnpm build` / `turbo build`（耗时，改完 `packages/**` 后必须重跑受影响包）、`pnpm docs:build`、`node apps/web/scripts/verify-prod-mock.mjs` |
| 🟠 | 重启 dev server 前先看端口归属：`netstat -ano \| grep :6080` 拿到 PID，确认是自己拉起的那个再 `taskkill //PID <pid> //T //F`；清 `apps/web/node_modules/.vite` |
| 🔴 | `pnpm install`（会动 lockfile）、`pnpm update:deps`/`taze`、`changeset version`/`publish`、`git push`、`git reset --hard`、`rm -rf`、目录改名/移动（Windows 侧禁用 `robocopy /MOVE`，会顺着 pnpm junction 删掉真实包） |
