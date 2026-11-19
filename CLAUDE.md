# CLAUDE.md

本文件供 Claude Code 使用；约定与 `AGENTS.md` 一致，二者冲突时以 `AGENTS.md` 为准。

## 仓库概览

`antdv-next-admin`：Vue 3 + shadcn-vue + reka-ui 的 pnpm/turbo monorepo，包名以 `@antdv/` 开头。包管理器为 **pnpm 10.12.4**，请勿使用 npm/yarn。

## Skills

Skills 位于 `.agents/skills/`，为全仓库单一事实来源。开始任何 shadcn-vue 相关改动前先加载：

- `.agents/skills/shadcn-vue/SKILL.md` —— shadcn-vue 组件工作流（添加/检索/修复/样式/组合、CLI、项目上下文）。

`skills-lock.json` 仅声明 `antdv` / `shadcn-vue`；`antdv-next` 与 `antdv-next-cli-create-pr` 已移除。

## 关键命令

```bash
pnpm test:unit                       # 单测
pnpm check:type                      # 类型检查
pnpm test:e2e                        # e2e（chromium/firefox/webkit 三引擎全绿才算通过）
pnpm lint                            # 代码检查
pnpm dev:web                         # web 开发服务
pnpm mock:seed | mock:reset | mock:db:info   # SQLite 运维（生产需追加 -- --force）
```

## 交付要求

- 任何改动完成后，单测、类型检查、e2e 需全绿再汇报。
- `apps/backend-mock` 接口全部走 SQLite，无内存存储与 faker；dev/prod 由 `MOCK_ENV`/`NODE_ENV` 区分（生产独立库、不播种、禁用控制面运维接口）。
- 状态/数据模型变更须同步更新后端数据与测试。
