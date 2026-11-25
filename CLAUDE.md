# CLAUDE.md

本文件供 Claude Code 使用；约定与 `AGENTS.md` 一致，二者冲突时以 `AGENTS.md` 为准。完整编码规范见 `CODE_STANDARD.md`。

## 仓库概览

`antdv-next-admin`：Vue 3 + shadcn-vue + reka-ui 的 pnpm/turbo monorepo，包名以 `@antdv/` 开头。

- 包管理器：**pnpm 10.12.4**（`only-allow pnpm` 强制），请勿使用 npm / yarn
- Node `>=22`，TypeScript `~6.0.3`，依赖版本走 `pnpm-workspace.yaml` 的 `catalog:`
- Lint：**oxlint + oxfmt**（`vsh lint`）；ESLint / Stylelint / cspell 作为补充门禁

## 目录结构

```
apps/
├── web/            # 前端应用 @antdv/web
└── backend-mock/   # Nitro Mock 服务（SQLite）
docs/               # VitePress 文档站 @antdv/docs（根目录，独立部署，不参与应用构建）
packages/
├── core/
│   ├── base/       # design / graph / icons / shared / typings
│   ├── hooks/      # @antdv/hooks
│   ├── preferences/# @antdv/preferences
│   └── ui-kit/     # shadcn-ui / form-ui / table-ui / popup-ui / layout-ui / menu-ui / tabs-ui / common-ui
├── directives/  enums/  layouts/  request/  router/  stores/  utils/
internal/           # vite-config / tsconfig / node-utils / 五种 lint-config
scripts/            # vsh / turbo-run
test/               # 跨包共享测试工具
```

## 子包职责与禁止项

包边界是硬约束：`pnpm check:dep` 校验依赖方向，`pnpm check:circular` 找环，`turbo build` 建图失败会整体报错。

### 基础层

- **@antdv/types** —— 共享类型契约（布局设置、菜单、标签页、Mock 信封）。禁止：运行时逻辑；import 任何包；业务实体字段。
- **@antdv/shared** —— 浏览器侧通用能力（缓存、色值、常量、`cn` / 日期 / 下载 / Excel / 脱敏 / XSS / 事件、vue-store 出口）。禁止：依赖 `ui-kit` / `stores` / `router` / `request`；出现 Vue 组件或 `defineStore`。
- **@antdv/utils** —— 框架无关纯函数（菜单树 / key 体系、主题模式解析）。禁止：vue / pinia / vue-router / DOM API；重复实现 `shared` 已有能力。
- **@antdv/enums** —— 跨层枚举（缓存 Key、字典 TypeCode 等字面量集合）。禁止：import vue / pinia / 应用配置；本地化文案。
- **@antdv/design** —— 设计规范单一来源（CSS 变量 token + Tailwind v4 公共样式）。禁止：依赖任何组件库、读 `--ant-*` 变量；写组件样式（样式随组件放 `ui-kit/*`）。
- **@antdv/graph** —— 图内核（DAG 拓扑、Tarjan 找环、不 eval 的受限表达式求值）。禁止：vue / UI 包；`eval` / `new Function` / `with`；具体业务节点语义。
- **@antdv/icons** —— 图标（Iconify、SVG 雪碧图、图标选择器）。禁止：引 `ui-kit` 上层包（会与 common-ui 成环）；容器类封装（属 `common-ui`）。

### Hook 与偏好

- **@antdv/hooks** —— 通用组合式函数（缓存、分片上传、打印、路由 Loading、水印、`usePermission`、`useCRUD`、语言同步、ECharts）。禁止：import vue-router 实例；发业务请求；塞 SSE / WebSocket（属 `request`）。
- **@antdv/preferences** —— 用户偏好（默认值、持久化、CSS 变量落地、读写入口）。禁止：pinia / vue-router / 具体 UI 库；读 `import.meta.env` 定默认值。

### UI 层 `packages/core/ui-kit`

- **@antdv/shadcn-ui** —— shadcn-vue 原语层，整套 UI 的地基。禁止：依赖上层 `ui-kit`（成环）；业务字段、权限判断、请求；绕过 `cn()` 拼 class。
- **@antdv/form-ui** —— schema 驱动表单（`BasicForm` / `useForm`，基于 `@tanstack/vue-form`）。禁止：依赖 `table-ui` / `common-ui`；把业务 schema 放本包；引 store。
- **@antdv/table-ui** —— schema / config 驱动表格（`BasicTable` / `useTable`，基于 `@tanstack/vue-table`）。禁止：依赖 `common-ui` / `popup-ui`；内置请求（数据由 `api` prop 注入）；引 store 或 `~/api`。
- **@antdv/popup-ui** —— 弹层（`BasicModal` / `BasicDrawer` / `confirm` / `alert` / `useModal` / `useDrawer`）。禁止：依赖 `table-ui` / `form-ui`；内置业务提交逻辑。
- **@antdv/layout-ui** —— 布局渲染层（布局壳 + 六区域 + 折叠 / 拖拽 hook），纯表现层。禁止：pinia / vue-router / 业务 store；菜单形态蓝图与面包屑（属 `layouts`）。
- **@antdv/menu-ui** —— 菜单渲染（`BasicMenu` 内联 / 水平），数据取自 `@antdv/shared/menu`。禁止：pinia / vue-router；读路由实例判激活项。
- **@antdv/tabs-ui** —— 多标签页受控组件（`TabList` / `TabItem` / `TabActions` / `TabContextMenu`）。禁止：依赖任何 store（状态在 `useTabsStore`）；依赖 vue-router。
- **@antdv/common-ui** —— 公共组件层 + 四个业务域（`ai-flow` / `im` / `lowcode` / `report`），重依赖按域走独立子路径导出。禁止：pinia / vue-router / 应用配置（一律注入或 props）；域之间互 import。

### 装配层

- **@antdv/stores** —— 会话状态（`app` 偏好视图 / `tabs` / `route` 菜单即权限 / `user` 凭证 / 页面缓存表）。禁止：import vue-router 实例；import UI 库；发请求。
- **@antdv/request** —— 实时通信（HTTP + CSRF + 令牌刷新 + 去重 + SSE + WebSocket + vue-query）。禁止：碰 pinia（凭证由 `configureRequest()` 注入）；读 `import.meta.env`；写死登录页；定义业务接口。
- **@antdv/router** —— 路由守卫与工具（登录校验、动态菜单注册、标题、进度条、权限过滤）。禁止：import store / api（依赖注入）；写具体页面路由表。
- **@antdv/layouts** —— 布局装配（外壳、菜单与标签页 hook、顶栏小部件、页面缓存、7 种菜单形态蓝图）。禁止：写业务页面；组件内直连后端。
- **@antdv/directives** —— `v-permission` / `v-lazy` 指令。禁止：import store / pinia / vueuse；指令内部直接 `useUserStore()`（由 `apps/web/src/directives/index.ts` 注入）。

### 应用与工具

- **@antdv/web** —— 前端应用（`views/` 页面、`api/` 接口、`plugins/` 宿主接线、`router/` 路由表）。`~` → `src`，`#` → `types`。禁止：`views/` 里直接 `new WebSocket` 或直接 `http.get`；`packages/*` 反向 import `~/`。
- **web 内置 Mock 服务**（`apps/web/backend-mock`）—— Nitro Mock 服务（业务接口 + 控制面），dev 由 `nitro/vite` 同端口接管。禁止：内存存储与 faker；production 播种或开放重置类运维接口。
- **@antdv/docs** —— VitePress 文档站（根目录 `docs/`）。禁止：参与应用构建、被 `apps/*` 或 `packages/*` import。
- **internal/** —— `vite-config`（共享 Vite 配置，偏离用 `overrides` 深合并）、`tsconfig`、`node-utils`、五套 lint 预设（**改规则改这里，不要本地覆盖**）。
- **scripts/** —— `vsh`（lint / check-circular / check-dep / publint）、`turbo-run`（交互式跑 turbo 任务）。

## 编码规范（易错条目）

1. **显式 import**：`unplugin-auto-import` 没有配 `dirs`，本仓库的 `use*` 不会自动导入；`unplugin-vue-components` 只扫 `src/components`。统一显式 import。
2. **请求只走 `apps/web/src/api/*.ts`**，用 `~/api/request` 的 `get` / `post`。更新是 `POST /xxx/update/:id`、删除是 `DELETE /xxx/remove/:id`，以 `api/system.ts` 为准。
3. **WebSocket 只走单例** `~/utils/ws` 的 `useWebSocket()`；订阅返回解订函数，`onUnmounted` 调用。
4. **CRUD 用 `useCRUD` + `useTable` + `useForm`**，不要手写状态机。
5. **样式**：Tailwind → `cn()`（`@antdv/shared/utils/cn`）→ `:deep()` → `<style scoped>`（最后手段）；复杂 class 抽到 `constants.ts`。
6. **禁止 `any`**，用 `unknown` + 类型守卫；跨包类型放 `@antdv/types`。
7. **注释解释为什么**，保持仓库现有的设计取舍注释密度。
8. **提交信息符合 Angular 规范**（`pnpm commit`）。
9. **ai-flow 改动**先读 `packages/core/ui-kit/common-ui/src/ai-flow/`：`core/` 纯 TS、Provider 模型无关注入 `fetcher`、节点走注册表、运行器里不许 `if (node.type === 'llm')`。
10. **新增依赖先 `pnpm audit`**，有漏洞先修再用。

## 关键命令

```bash
pnpm test:unit                       # 单测
pnpm check:type                      # 类型检查
pnpm test:e2e                        # e2e（chromium/firefox/webkit 三引擎全绿才算通过）
pnpm lint                            # 代码检查（vsh lint，oxlint）
pnpm format                          # 格式化（oxfmt）
pnpm check                           # 全量门禁：循环依赖 + 依赖方向 + 类型 + 构建 + 拼写
pnpm check:circular                  # 循环依赖
pnpm check:dep                       # 依赖方向（子包不许反向引用应用）
pnpm check:builds                    # 子包统一构建标准
pnpm changeset                       # 版本变更说明
pnpm commit                          # 交互式提交（cz-git，Angular 规范）
pnpm mock:seed | mock:reset | mock:db:info   # SQLite 运维（生产需追加 -- --force）
```

## 交付要求

- 改动完成后单测、类型检查、e2e 全绿再汇报；改了包边界或构建配置还要跑 `pnpm check`。
- `apps/web/backend-mock` 全部走 SQLite，无内存存储与 faker；dev/prod 由 `MOCK_ENV` / `NODE_ENV` 区分。
- 状态 / 数据模型变更须同步更新后端数据与测试。
- 只改完成当前任务所必需的文件。
