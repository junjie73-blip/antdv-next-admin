# AGENTS.md

本文件为 AI 编码助手提供本仓库的入口说明。适用于 Codex、Claude Code 以及遵循 `AGENTS.md` 约定的通用 Agent。**动手前先读完「子包职责」与「编码规范」两节**——本仓库的包边界是硬约束，越界改动能通过编译但会被 `pnpm check:dep` 拦下。

## 仓库概览

`antdv-next-admin`：Vue 3 + shadcn-vue + reka-ui 的 pnpm/turbo monorepo，包名统一以 `@antdv/` 开头。

- 包管理器：**pnpm 10.12.4**（`preinstall` 用 `only-allow pnpm` 强制，npm/yarn 会直接失败）
- Node：`>=22`；TypeScript `~6.0.3`
- 构建：turbo 分发；依赖版本集中在 `pnpm-workspace.yaml` 的 `catalog:`，子包写 `"catalog:"` 而非手写版本号
- Lint：格式化与静态检查走 **oxlint + oxfmt**（`vsh lint`），ESLint / Stylelint / cspell 作为补充门禁

## 目录结构

```
apps/
├── web/            # 前端应用 @antdv/web（唯一的应用产物）
└── backend-mock/   # Nitro Mock 服务 @antdv/backend-mock（SQLite）
docs/               # VitePress 文档站 @antdv/docs（独立部署 Pages，不参与应用构建）
packages/
├── core/
│   ├── base/       # design / graph / icons / shared / typings —— 无 UI 的底座
│   ├── hooks/      # @antdv/hooks —— 通用组合式函数
│   ├── preferences/# @antdv/preferences —— 用户偏好
│   └── ui-kit/     # shadcn-ui / form-ui / table-ui / popup-ui / layout-ui / menu-ui / tabs-ui / common-ui
├── directives/  enums/  layouts/  request/  router/  stores/  utils/
internal/           # 构建与规范工具（vite-config / tsconfig / node-utils / 五种 lint-config）
scripts/            # 仓库任务脚本（vsh / turbo-run）
test/               # 跨包共享的测试工具
```

> `docs/` 在**仓库根目录**，不是 `apps/docs`。`pnpm docs:dev` 的 filter 是 `@antdv/docs`。

## 子包职责

每一节都是「作用 → 允许 → 禁止」。**禁止项不是建议，是构建门禁**：`pnpm check:dep` 校验依赖方向、`pnpm check:circular` 找环、`turbo build` 建图失败会整体报错。

### 基础层 `packages/core/base`

**@antdv/types**（`typings/`）

- 作用：Monorepo 共享类型契约——布局设置、菜单、标签页、Mock 响应信封。
- 允许：只放 `interface` / `type` / 纯字面量常量。
- 禁止：禁止写运行时逻辑、禁止 import 任何包（含 vue）、禁止放业务实体的字段定义（业务类型留在用它的包里）。

**@antdv/shared**

- 作用：浏览器侧通用能力——缓存、色值换算、跨层常量、工具方法（`cn` / 日期 / 下载 / Excel / 脱敏 / XSS / 事件）、`@tanstack/vue-store` 出口。
- 允许：依赖 `@antdv/types`、`@antdv/enums`。按子路径引入（`@antdv/shared/utils/cn`），不要从根入口一把梭，否则整包都进依赖图。
- 禁止：禁止依赖任何 `ui-kit`、`stores`、`router`、`request`；禁止出现 Vue 组件或 `defineStore`；禁止把业务请求封装成「通用工具」。

**@antdv/utils**

- 作用：与框架无关的纯函数——菜单树 / key 体系（`menu`）、主题模式解析与系统深色探测（`theme-mode`）。
- 允许：纯入参纯出参，可被服务端与测试直接调用。
- 禁止：禁止依赖 vue / pinia / vue-router / DOM API（`window` 判定也要靠入参传入）；禁止放 `@antdv/shared` 已有的能力（避免两套 `cn`）。

**@antdv/enums**

- 作用：跨层枚举——缓存 Key、字典 TypeCode 等只含字面量的取值集合。
- 允许：`enum` 与 `as const` 对象。
- 禁止：禁止 import vue / pinia / 应用配置；禁止在这里做本地化文案（枚举只存值，展示文案由调用方按 locale 映射）。

**@antdv/design**

- 作用：设计规范单一来源——`token/`（shadcn-vue CSS 变量，default/dark 两套基础主题，各带 13 套 `[data-theme]` 预设）与 `css/`（Tailwind v4 入口的公共样式：基础层、NProgress、无障碍、权限降级、滚动条兜底）。
- 允许：只写 CSS 变量与样式，入口 `src/index.css` 引齐两侧。
- 禁止：**禁止依赖任何组件库**（不引 antdv-next 兼容层、不读 `--ant-*` 变量）；禁止在这里写组件样式——组件自身样式随组件放在 `packages/core/ui-kit/*`，本包只登记它们的 Tailwind 扫描路径。

**@antdv/graph**

- 作用：图内核（纯 TS，无 vue、无模板）——DAG 索引与拓扑、Tarjan 找环、结构体检，以及一套**不 eval** 的受限表达式求值器；工作流引擎与 AI 编排共用它的顶点/边语义。
- 允许：纯函数 + 纯 TS 类型。
- 禁止：禁止 import vue / 任何 UI 包；**禁止引入 `eval` / `new Function` / `with`**（表达式求值必须走受限解析器）；禁止在这里写具体业务的节点语义。

**@antdv/icons**

- 作用：图标子包——Iconify 图标、SVG 雪碧图图标与图标选择器。
- 允许：只组合 `@antdv/shadcn-ui` 原语。
- 禁止：**禁止引 `ui-kit` 上层包**（否则 `icons ↔ common-ui` 成环）；禁止把加载遮罩、滚动条这类容器封装塞进来（它们属于 `@antdv/common-ui`）。

### Hook 与偏好

**@antdv/hooks**

- 作用：通用组合式函数——缓存、文件读取、分片上传、打印、路由 Loading、水印、权限判定（`usePermission`）、增删改查骨架（`useCRUD`）、语言同步、ECharts 封装。
- 允许：依赖 `@antdv/stores` 的会话状态；按子路径引入（`@antdv/hooks/use-print`）。
- 禁止：禁止 import `vue-router` 实例（路由 Loading 由调用方注入）；禁止发业务请求（`useCRUD` 只收 `onCreate` / `onUpdate` / `onDelete` 回调，不认 `~/api`）；禁止把 SSE / WebSocket 塞这里——它们在 `@antdv/request`。

**@antdv/preferences**

- 作用：用户偏好设置——默认值、持久化、CSS 变量落地与组件侧读写入口。
- 允许：纯 TS + 可选 `@antdv/shared` 缓存。
- 禁止：禁止依赖 pinia、vue-router 与任何具体 UI 库；禁止在这里读 `import.meta.env` 决定偏好默认值（宿主注入）。

### UI 层 `packages/core/ui-kit`

**@antdv/shadcn-ui**

- 作用：shadcn-vue 原语层——Button / Dialog / Select / Form 控件等无业务语义的基础组件，是整套 UI 的地基。
- 允许：只依赖 `@antdv/shared`、reka-ui、class-variance-authority 等通用库。
- 禁止：禁止依赖任何上层 `ui-kit` 包（会成环）；禁止在本包出现业务字段、权限判断、请求；禁止绕过 `cn()` 直接拼 class 字符串。

**@antdv/form-ui**

- 作用：schema 驱动的表单——`BasicForm` / `useForm`，基于 `@tanstack/vue-form` 与 shadcn-ui 控件。
- 允许：依赖 `shadcn-ui`、`@antdv/shared`、`form-ui` 自有类型。
- 禁止：禁止依赖 `table-ui` / `common-ui`；禁止把具体业务的 schema 常量放在本包（schema 属于页面）；禁止在这里引 store。

**@antdv/table-ui**

- 作用：schema / config 驱动的表格——`BasicTable` / `useTable`，基于 `@tanstack/vue-table`，搜索表单接 `@antdv/form-ui`。
- 允许：依赖 `form-ui`、`shadcn-ui`、`@antdv/shared`。
- 禁止：禁止依赖 `common-ui` / `popup-ui`；禁止在表格里内置请求——数据由 `api` prop 注入；禁止引 store 或 `~/api`。

**@antdv/popup-ui**

- 作用：弹层——`BasicModal` / `BasicDrawer` / `confirm` / `alert`（AlertDialog）与 `useModal` / `useDrawer`。
- 允许：依赖 `shadcn-ui`、`@antdv/shared`。
- 禁止：禁止依赖 `table-ui` / `form-ui`（`useCRUD` 需要弹层时由调用方把自己的 modal/drawer 方法注入）；禁止在弹层里内置业务提交逻辑。

**@antdv/layout-ui**

- 作用：布局渲染层——布局壳与六个区域（Header / Sidebar / NavRail / Tabbar / Content / Footer）+ 侧栏折叠按钮与拖拽 hook + 外壳尺寸与文案注入契约，纯表现层。
- 允许：只做渲染与交互，依赖 `shadcn-ui`。
- 禁止：禁止依赖 pinia、vue-router、业务 store；禁止在本包做菜单形态蓝图、面包屑或示意图（那些在 `@antdv/layouts`）。

**@antdv/menu-ui**

- 作用：菜单渲染——`BasicMenu`（侧栏内联菜单 / 水平菜单），数据取自 `@antdv/shared/menu` 模型。
- 允许：依赖 `shadcn-ui`、`@antdv/shared`。
- 禁止：禁止依赖 pinia、vue-router；禁止在菜单里读路由实例来判断激活项（激活 key 由调用方传入）。

**@antdv/tabs-ui**

- 作用：多标签页——`TabList` / `TabItem` / `TabActions` / `TabContextMenu` 与标签宿主条。
- 允许：纯受控组件，数据与回调由使用方注入。
- 禁止：禁止依赖任何 store（标签页状态在 `@antdv/stores` 的 `useTabsStore`）；禁止依赖 vue-router。

**@antdv/common-ui**

- 作用：公共组件层——通用展示件（Card / PageHeader / Tag / Tree 等）+ AI 对话 / 数据工作台封装 + 五个业务域能力：`ai-flow`（AI 编排）、`im`（即时通讯）、`lowcode`（低代码）、`report`（报表）、`workflow`（工作流）。重依赖按域走独立子路径导出，宿主只为自己用到的域付解析成本。
- 允许：依赖全部下层 `ui-kit`、`@antdv/shared`、`@antdv/graph`。
- 禁止：**禁止依赖 pinia / vue-router / 应用配置**，宿主能力一律走注入或 props；禁止把五个业务域的实现细节从一个域的入口导出（域之间互不 import，共享能力下沉到 `shared`）。

### 装配层

**@antdv/stores**

- 作用：会话状态——偏好派生视图（`app`）、标签页（`tabs`）、菜单即权限（`route`）、凭证与用户信息（`user`）、页面缓存登记表。
- 允许：可以使用 pinia。
- 禁止：禁止 import vue-router 实例（路由与后端地址由调用方注入）；禁止 import 任何 UI 库；禁止在这里发请求——store 只存状态，取数由页面或 `@antdv/hooks` 完成。

**@antdv/request**

- 作用：实时通信层——HTTP（CSRF / 令牌刷新 / 401 收尾 / 缓存与去重 / 超时 / qs 序列化 / `useRequest`）+ SSE + WebSocket + vue-query 客户端（`./vue-query`）。
- 允许：纯 TS + `@antdv/shared`、`@antdv/enums`。
- 禁止：**禁止碰 pinia**（凭证存储由应用 `configureRequest()` 注入）、禁止读 `import.meta.env`、禁止写死登录页路径；禁止在这里定义业务接口。

**@antdv/router**

- 作用：路由守卫与工具——登录校验、动态菜单注册、标题、进度条、权限过滤。
- 允许：依赖 vue-router 的组合式 API。
- 禁止：**禁止 import store / api**（状态与跳转目标全部依赖注入）；禁止在这里写具体页面的路由表（路由表在 `apps/web/src/router`）。

**@antdv/layouts**

- 作用：布局装配层——外壳装配（`basic`）、菜单与标签页的行为 hook（`hooks`）、顶栏小部件（`widgets`）、页面缓存（`route-cached`）与 7 种菜单形态的区域蓝图。
- 允许：读 `@antdv/stores`，用 vue-router 组合式 API，组合 `@antdv/layout-ui`。
- 禁止：禁止在这里写业务页面；禁止在组件里直连后端（文案与品牌资源由宿主注入）。

**@antdv/directives**

- 作用：可复用 Vue 指令——`v-permission` 权限控制、`v-lazy` 图片懒加载。
- 允许：指令工厂形式，判定逻辑与浏览器 API 通过依赖注入拿。
- 禁止：**禁止 import store / pinia / vueuse**；禁止在指令内部直接读 `useUserStore()`（`apps/web/src/directives/index.ts` 负责注入）。

### 应用与工具

**@antdv/web**（`apps/web`）

- 作用：唯一的前端应用——页面（`views/`）、接口定义（`api/`）、宿主接线（`plugins/`、`bootstrap/`）、路由表（`router/`）。
- 允许：依赖上述全部 `packages/*`；`~` 指向 `src`，`#` 指向 `types`。
- 禁止：禁止在 `views/` 里直接 `new WebSocket` 或直接 `http.get`（见编码规范）；禁止在 `packages/*` 里反向 import `~/`（`pnpm check:dep` 会拦）。

**@antdv/backend-mock**（`apps/backend-mock`）

- 作用：Nitro Mock 服务——业务接口 + 运行时控制面（供 Mock 数据中心面板消费）。
- 允许：`better-sqlite3` + `sqlite`；`MOCK_ENV`（优先）/ `NODE_ENV` 判定环境。
- 禁止：禁止内存存储与 faker 等模拟数据生成；禁止在 production 播种或开放重置类运维接口。

**@antdv/docs**（根目录 `docs/`）

- 作用：VitePress 站点文档（默认中文、中英双语），独立走 GitHub Actions 部署 Pages。
- 禁止：禁止参与应用构建，禁止被 `apps/*` 或 `packages/*` import。

**internal/**

- `@antdv/vite-config`：共享 Vite 配置（插件装配、分包、env 解析、dev proxy 含 Nitro Mock 转发）。应用侧只写 `defineApplicationConfig()`，偏离时用 `overrides` 深合并。
- `@antdv/tsconfig`：共享 TS 配置。
- `@antdv/node-utils`：Node 侧工具（fs / path / git / hash / date / formatter / workspace 解析 / 终端日志）。
- `@antdv/{oxlint,oxfmt,eslint,stylelint,commitlint}-config`：五套规范预设。**改规则改这里，不要在子包或应用里本地覆盖**。
- `scripts/vsh`：仓库任务入口（`lint` / `check-circular` / `check-dep` / `publint`）。`scripts/turbo-run`：交互式跑 turbo 任务。

## 编码规范（摘要）

完整规范见 `CODE_STANDARD.md`。以下几条是本仓库最容易踩、且 AI 最常犯的：

1. **显式 import**：`unplugin-auto-import` 只配了 `vue` / `@vueuse/core` / `pinia` / `vue-router`，**没有配 `dirs`**，所以本仓库的 `use*` 一个都不自动导入；`unplugin-vue-components` 只扫 `src/components`。项目代码统一显式 import，请照做，不要依赖自动导入。
2. **请求只走 `api/*.ts`**：`apps/web/src/api/` 集中定义接口，用 `~/api/request` 的 `get` / `post`；组件里只 import 函数。不要臆测 HTTP 方法（本仓库更新用 `POST`、删除用 `DELETE /remove/:id`，以 `api/system.ts` 为准）。
3. **WebSocket 只走单例**：`import { useWebSocket } from '~/utils/ws'`，订阅函数返回解订函数并在 `onUnmounted` 调用。不要自己 `new WebSocket`，不要在多个组件里各自建连。
4. **CRUD 骨架用 `useCRUD`**（`@antdv/hooks`）+ `useTable`（`@antdv/table-ui`）+ `useForm`（`@antdv/form-ui`），不要手写一套增删改查状态。
5. **样式优先级**：Tailwind 原子类 → `cn()` 合并（来自 `@antdv/shared/utils/cn`）→ `:deep()` → `<style scoped>`（仅最后手段）。复杂 class 抽到 `constants.ts`。
6. **类型**：禁止 `any`，用 `unknown` + 类型守卫；跨包共享类型放 `@antdv/types`。
7. **注释解释为什么**：本仓库的注释密度较高且解释设计取舍，新增代码保持同一风格——写「为什么不那样做」，不写「这行在做什么」。
8. **提交信息符合 Angular 规范**：`pnpm commit`（cz-git）交互式生成；type 用 `feat` / `fix` / `docs` / `refactor` / `chore` 等。
9. **ai-flow 相关改动**：先读 `packages/core/ui-kit/common-ui/src/ai-flow/`。`core/` 纯 TS 不 import vue；Provider 模型无关、由宿主注入 `fetcher`、不碰密钥；节点走注册表，运行器里不许出现 `if (node.type === 'llm')`。
10. **新增依赖先审计**：引入新包必须执行 `pnpm audit` 检查安全漏洞，有漏洞先修再用。

## Skills

本仓库的 AI skills 以 `.agents/skills/` 为**单一事实来源**，请勿在多个平台目录手工分别维护。当前落地：

- `shadcn-vue`（`.agents/skills/shadcn-vue/SKILL.md`）—— shadcn-vue 组件的添加/检索/修复/调试/样式/组合；CLI 与项目上下文。涉及 shadcn-vue、组件注册表、preset 或 `components.json` 时，先读该 `SKILL.md`。`.trae/skills/shadcn-vue` 是指向它的软链，不要直接修改软链目标的内容以外的副本。

`skills-lock.json` 仅声明 `antdv` / `shadcn-vue` 两个上游。历史条目 `antdv-next`、`antdv-next-cli-create-pr` 已移除。

## 关键命令

```bash
pnpm install                         # 安装依赖（仅 pnpm）
pnpm dev:web                         # 启动 web 开发服务
pnpm test:unit                       # 单测（turbo 分发）
pnpm test:e2e                        # e2e（chromium/firefox/webkit 三引擎）
pnpm check:type                      # 类型检查
pnpm lint                            # 代码检查（vsh lint，oxlint）
pnpm format                          # 格式化（oxfmt）
pnpm check                           # 全量门禁：循环依赖 + 依赖方向 + 类型 + 构建 + 拼写
pnpm check:circular                  # 循环依赖
pnpm check:dep                       # 依赖方向（子包不许反向引用应用）
pnpm check:builds                    # 子包统一构建标准
pnpm changeset                       # 版本变更说明
pnpm commit                          # 交互式提交（cz-git，Angular 规范）
pnpm mock:seed | mock:reset | mock:db:info   # SQLite 运维（生产执行 seed/reset 需追加 -- --force）
```

> 单测需要串行时用 `pnpm exec turbo run test:unit --concurrency=1`。

## 交付要求

- 任何改动完成后，`pnpm test:unit`、`pnpm check:type`、`pnpm test:e2e` 全绿再汇报；改了包边界或构建配置还要跑 `pnpm check`。
- 状态 / 数据模型变更须同步更新 `apps/backend-mock` 的数据与测试。
- 只改完成当前任务所必需的文件，不要顺手重构无关代码。
