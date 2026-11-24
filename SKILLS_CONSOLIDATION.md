# AI 平台 Skills 清单与文件结构整理

> 适用对象：AGENTS.md / CLAUDE.md / Trae / Kiro 等 AI 编码平台仓库：`antdv-next-admin`（Vue 3 + shadcn-vue + reka-ui 的 pnpm/turbo monorepo，`@antdv/*`）本文回答三件事：① 整理后的 skills 清单与文件结构；② 最终落地决策；③ 平台入口文件内容。生成时间：2026-11-18。所有结论均来自仓库现状 + git 历史实证，非推测。

---

## 0. 结论摘要

1. 仓库历史上存在多套 AI 平台 skill 约定目录，但**当前唯一完整落地的是 `.agents/skills/shadcn-vue/`**。
2. `skills-lock.json` 曾声明 4 个 skill，实际只有 1 个（`shadcn-vue`）落地。本次已从锁文件**移除 `antdv-next` 与 `antdv-next-cli-create-pr`** 两个从未安装的上游条目。
3. **Qoder（`.qoder/`）已不再作为受支持平台**：该目录在提交 `74842f6b` 中被删除，本次明确保留删除状态、不再恢复或同步。
4. 平台入口采用「**单一事实来源 + 平台镜像**」：以 `.agents/skills/` 为源，`.trae/` 等目录由软链/脚本派生，避免多平台内容漂移。
5. 新增 `AGENTS.md` 与 `CLAUDE.md` 两个入口文件，使新会话能快速定位 skills 与关键命令。

---

## 1. 现状盘点（证据）

| 平台 | 约定 skill 目录 | 入口文件 | 当前状态 | skill 数 |
| --- | --- | --- | --- | --- |
| Agent Skills（通用） | `.agents/skills/` | 无 | ✅ 仅存 `shadcn-vue`（8 文件，单一事实来源） | 1 |
| Trae | `.trae/skills/` | 无 | ✅ 软链到 `.agents/skills/shadcn-vue` | 1（软链） |
| Kiro | `.kiro/skills/` | 无 | ⚠️ 未落地（如需按需从 `.agents` 同步） | 0 |
| Claude Code | `.claude/skills/` | `CLAUDE.md` | ✅ 新增入口 `CLAUDE.md`（skills 目录未建，按需同步） | 0 |
| OpenAI Codex / 通用 | — | `AGENTS.md` | ✅ 新增入口 `AGENTS.md` | — |
| ~~Qoder~~ | ~~`.qoder/skills/`~~ | — | ❌ 已删除且不再支持（本次确认） | 0 |

`skills-lock.json` 最终声明（version: 1）：

| skill        | source            | 状态                           |
| ------------ | ----------------- | ------------------------------ |
| `antdv`      | antdv-next/cli    | 保留（未落地，来源为上游 CLI） |
| `shadcn-vue` | unovue/shadcn-vue | ✅ 已落地                      |

已移除：`antdv-next`、`antdv-next-cli-create-pr`（本次）。

证据命令：

```bash
git show --stat 74842f6b -- .kiro              # Kiro 8 个文件被删
git ls-files | grep -iE 'AGENT|CLAUDE|SKILL'   # 平台 skill 文件
git ls-files -s .trae/skills/shadcn-vue         # 120000 软链，指向 .agents
```

---

## 2. 现有 skills 约定（命名 / 格式 / 元数据）

以仓库中唯一完整留存的 `.agents/skills/shadcn-vue/` 为准：

- **目录命名**：`<平台约定根>/skills/<skill-name>/`，skill 名用 kebab-case；目录名与 frontmatter `name` 必须一致。
- **入口文件**：每个 skill 必须有 `SKILL.md`；同目录可带 `cli.md`、`customization.md`、`mcp.md` 等平级文档。
- **子目录职责**：`rules/`（规则细则，Incorrect/Correct 代码对）、`references/`（按需加载的知识文档）、`scripts/`（确定性可执行脚本）。
- **frontmatter 元数据**（YAML，四字段，顺序固定）：

```yaml
---
name: <skill-name> # 必填，与目录名一致
description: <第三人称描述 + 触发场景> # 必填，决定何时被加载
user-invocable: false # 是否出现在手动调用列表；纯知识型设 false
allowed-tools: Bash(npx xxx *), ... # 允许免确认执行的命令白名单；无命令需求可省略
---
```

- **描述写法**：第三人称（"This skill should be used when…" / "在本仓库改动…时使用"），写清 **做什么 + 何时触发**；触发词要覆盖用户可能的中英文说法。
- **渐进式披露**：SKILL.md 保持精简（核心流程 + 规则摘要），细节下沉到 `references/`，脚本放 `scripts/`。

---

## 3. 整理后的 skills 清单

| # | skill | 用途 | 触发场景 | 文件构成 | 来源 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `shadcn-vue` | shadcn-vue 组件的添加/检索/修复/调试/样式/组合；CLI 与项目上下文 | 涉及 shadcn-vue、组件注册表、preset、`components.json` | `SKILL.md` + `cli.md`/`customization.md`/`mcp.md` + `rules/`×4 | 上游 unovue/shadcn-vue | ✅ 已落地（单一事实来源） |

已从锁文件移除的上游 skill（从未安装，声明与实际不符）：

| skill                      | 来源              | 处置        |
| -------------------------- | ----------------- | ----------- |
| `antdv-next`               | antdv-next/skills | ❌ 本次删除 |
| `antdv-next-cli-create-pr` | antdv-next/cli    | ❌ 本次删除 |

> Qoder 平台及其 `.qoder/skills/` 目录本次确认不再支持、不恢复、不同步。

---

## 4. 目标文件结构（单一事实来源 + 平台镜像）

```
<repo-root>/
├── AGENTS.md                          # ✅ 新增：通用 AI Agent 入口
├── CLAUDE.md                          # ✅ 新增：Claude Code 入口
├── skills-lock.json                   # ✅ 已精简：仅保留 antdv / shadcn-vue
├── .agents/skills/                    # ✅ 单一事实来源（source of truth）
│   └── shadcn-vue/
│       ├── SKILL.md
│       ├── cli.md
│       ├── customization.md
│       ├── mcp.md
│       └── rules/{styling,forms,composition,icons}.md
├── .trae/skills/
│   └── shadcn-vue -> ../../.agents/skills/shadcn-vue   # ✅ 软链，零漂移
└── .kiro/skills/                      # 可选：按需从 .agents 同步
```

镜像用脚本/软链生成，避免手工复制导致漂移。`shadcn-vue` 在 `.trae` 以软链指向 `.agents`，天然一致；若需复制到 `.kiro`/`.claude`，统一 LF 换行符。

---

## 5. 本次落地决策

| # | 决策 | 执行结果 |
| --- | --- | --- |
| 1 | 删除 `antdv-next` skill | ✅ 从 `skills-lock.json` 移除 |
| 2 | 删除 `antdv-next-cli-create-pr` skill | ✅ 从 `skills-lock.json` 移除 |
| 3 | 删除 qoder | ✅ `.qoder/` 保持删除状态；本文移除全部 qoder 支持/恢复内容，同步目标不再包含 qoder |
| 4 | 新增平台入口文件 | ✅ 新增 `AGENTS.md` 与 `CLAUDE.md` |

> 边界说明：以上均属「skills 资产整理」，不涉及 `apps/` / `packages/` 业务代码。

---

## 6. 平台入口文件内容

### 6.1 `AGENTS.md`（通用入口）

已创建于仓库根，要点：

- Skills 以 `.agents/skills/` 为单一事实来源；`shadcn-vue` 为当前唯一落地 skill。
- 任何 shadcn-vue 相关改动先读 `.agents/skills/shadcn-vue/SKILL.md`。
- 快速约束与关键命令（单测 `npx turbo run test:unit --concurrency=1`、类型 `npx turbo run type-check`、e2e 三引擎）。

### 6.2 `CLAUDE.md`（Claude Code 入口）

已创建于仓库根，要点：

- 约定与 `AGENTS.md` 一致；skills 位于 `.agents/skills/`。
- 加载 `.agents/skills/shadcn-vue/SKILL.md`。
- 关键命令与三引擎 e2e 要求。

---

## 7. 验收

```bash
cat skills-lock.json                                  # 仅 antdv / shadcn-vue
test ! -e .qoder && echo "qoder removed"              # qoder 不存在
test -f AGENTS.md && test -f CLAUDE.md && echo "entry files ok"
ls -l .trae/skills/shadcn-vue                          # 软链到 .agents
```
