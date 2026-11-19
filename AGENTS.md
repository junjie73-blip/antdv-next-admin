# AGENTS.md

本文件为 AI 编码助手提供本仓库的入口说明。适用于 Codex、Claude Code、以及遵循 `AGENTS.md` 约定的通用 Agent。

## 仓库概览

`antdv-next-admin`：Vue 3 + shadcn-vue + reka-ui 的 pnpm/turbo monorepo，内部包名以 `@antdv/` 开头。包管理器为 **pnpm 10.12.4**（`preinstall` 强制仅允许 pnpm）。

## Skills

本仓库的 AI skills 以 `.agents/skills/` 为**单一事实来源**，请勿在多个平台目录手工分别维护。当前落地：

- `shadcn-vue`（`.agents/skills/shadcn-vue/SKILL.md`）—— shadcn-vue 组件的添加/检索/修复/调试/样式/组合；CLI 与项目上下文。涉及 shadcn-vue、组件注册表、preset 或 `components.json` 时，先读该 `SKILL.md`。`.trae/skills/shadcn-vue` 是指向它的软链，不要直接修改软链目标的内容以外的副本。

`skills-lock.json` 已精简为仅 `antdv` / `shadcn-vue` 两个上游声明。历史条目 `antdv-next`、`antdv-next-cli-create-pr` 已移除。

## 快速约束

- 前端应用位于 `apps/web`，后端 Mock 服务位于 `apps/backend-mock`：基于 Nitro，接口全部走 **SQLite**（`better-sqlite3`），无内存存储与 faker 等模拟数据生成。
- 环境区分：`MOCK_ENV`（优先）/ `NODE_ENV` 判定；dev 用 `mock.sqlite` 并自动播种内置数据，production 用独立的 `mock.production.sqlite`、不播种、且拦截控制面/重置类运维接口。
- 状态/数据模型变更须同步更新对应后端数据与测试。
- 交付前确保单测、类型检查与 e2e 全绿；e2e 覆盖 chromium/firefox/webkit 三引擎。

## 关键命令

```bash
pnpm install                         # 安装依赖（仅 pnpm）
pnpm dev:web                         # 启动 web 开发服务
pnpm test:unit                       # 单测
pnpm check:type                      # 类型检查
pnpm test:e2e                        # e2e（三引擎）
pnpm lint                            # 代码检查
pnpm mock:seed | mock:reset | mock:db:info   # SQLite 运维（生产执行 seed/reset 需追加 -- --force）
```

> 单测在仓库根用 `pnpm test:unit`（turbo 分发）；如需串行可用 `pnpm exec turbo run test:unit --concurrency=1`。
