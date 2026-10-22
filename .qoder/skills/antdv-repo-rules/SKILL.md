---
name: antdv-repo-rules
description: 本仓库（Vue 3 + shadcn-vue + reka-ui 的 pnpm/turbo monorepo，包名以 @antdv/ 开头）专属的护栏与交付标准。在本仓库改动、迁移、新增依赖、提交或验收前使用：它给出禁止修改的核心模块/配置项/关键逻辑/固定资源清单及原因与边界、允许操作的范围与权限分级、开发/代码/命名/提交/测试/部署规范、第三方组件库的准入范围与版本约束、Windows/macOS/Linux 与 Chromium/Firefox/WebKit 的跨平台适配要求，以及最终交付验收标准与上线检查清单。触发场景：跨包迁移或重构、新增子包/组件、改 design token 与主色链路、写单测与 e2e、提交前自检、构建发布与部署。
---

# antdv 仓库护栏与交付标准

## 适用对象

`@antdv/*` 子包 + `apps/web` 宿主 + `apps/backend-mock`（进程内 Nitro）+ `docs`（VitePress）的 pnpm/turbo monorepo。认出这个仓库靠工作区标记，不靠安装位置：根上有 `pnpm-workspace.yaml` + `turbo.json`，工作区里的子包名以 `@antdv/` 开头。凡是本仓库的改动型工作（迁移、重构、加组件、修缺陷、写测试、发布）都先按本技能定边界，再动手。

## 本技能自身的可移植性

- 文中路径只有两种：**仓库根相对**（`packages/…`、`apps/web/…`、`.changeset/…`）与**技能目录相对**（`references/…`、`scripts/…`）；不写盘符、绝对路径、用户主目录或某个 IDE 的专属目录。
- 命令一律 `node` / `pnpm` / `npx`，在仓库根执行，用 `<skill-dir>` 代表本技能目录（项目级安装时是 `.qoder/skills/antdv-repo-rules`，其它平台按实际安装位置替换）。
- 体检脚本从自身 `import.meta.url` 向上找带工作区标记的目录当根，找不到时退回当前工作目录继续向上找；因此项目级、用户级、被别的 Agent 平台加载都能跑。
- 脚本的依赖面只有 `node:*` 内置模块 + `git`（`git` 缺失时那一维会打印"提示"而不是静默通过）；不联网、不读用户主目录、不依赖某个 IDE 的专属命令。
- 行号只作定位辅助，判据一律写成"某测试文件里的某条用例标题"，测试挪动行号不会让规则失效。

## 一分钟版：十条硬约束

1. `packages/**` 源码**永不**出现组件库导入（`antdv-next` / `@antdv-next/*`）—— 守门人 `packages/core/hooks/__tests__/boundary.test.ts` 的「子包不依赖 antdv-next」。
2. 包与包之间**只走包名导入**：不许 `../../../<别包>/src/...`，不许盘符/绝对路径（同文件「跨包只走包名导入」，判据是常量 `ABSOLUTE_SPECIFIER`）。
3. 只有 `apps/web/src/plugins/**` 可以碰 `~/stores`、`~/api`、`~/views`、`~/locales`；子包要宿主能力就暴露可变 runtime + `configureX()`，反向 import 会造成 turbo 建不了的环。
4. design token 只有 shadcn **裸规范名**一套（`--primary`、`--radius`…），变量里存**颜色通道**、颜色由 `hsl(var(--x))` 组合；`--app-*` 与 `--ant-*` 一律不许出现在声明里（`packages/core/base/design/__tests__/design.test.ts` 的「规范名单一事实来源」）。
5. Tailwind 内容登记 `@source` 只住在 `packages/core/base/design/src/index.css:46-55`；新增带 `.vue` 的子包必须同批登记，漏一个包就是那个包全部工具类静默不生成。
6. 外部依赖版本一律从 `pnpm-workspace.yaml` 的 `catalog:` 取（`"vue": "catalog:"`），禁止在子包 `package.json` 里写死区间。
7. 样式覆写不得落在 `@antdv/shadcn-ui` 源文件里；改外观只能在 `common-ui` 或 CSS 层做（主题变量 / 自定义类名 / 覆盖规则）。
8. 单测口径是 `npx turbo run test:unit --concurrency=1`，**且慢用例要单文件复跑再判**；`pnpm exec vitest run` 在仓库根直接崩，别用。
9. 端到端只有三引擎都绿才算绿：`--project=chromium` 单跑不构成证据（`apps/web/playwright.config.ts` 的 projects）。
10. 每个用户可见变更配一条 changeset（`.changeset/*.md`）；`lefthook.yml` 的 pre-commit 全是注释状态，**没有任何钩子会替你把关**，检查必须自己跑。

## 干活顺序

1. **定范围**：这次要动的文件在「禁止改动」还是「允许改动」清单里？越界就先向用户确认。→ `references/forbidden.md`、`references/allowed.md`
2. **写之前查约束**：命名/目录/提交信息/测试怎么写。→ `references/standards.md`
3. **要引第三方库**：先过准入判定与版本约束。→ `references/third-party.md`
4. **改到平台/引擎相关的东西**（路径、动画、浮层、滚动、字号、端口）：按跨平台清单补适配与用例。→ `references/compatibility.md`
5. **收尾**：跑体检脚本 + 按验收清单逐项取得证据，绿了再汇报。→ `references/acceptance.md`

## 快速体检（确定性、只读）

```bash
# 在仓库根执行；<skill-dir> 见"本技能自身的可移植性"一节
node <skill-dir>/scripts/check-repo.mjs          # 全量
node <skill-dir>/scripts/check-repo.mjs --only tokens,@source,catalog,hygiene
```

它只做机器能判的事：组件库导入、`vue-sonner` 与 `new WebSocket(` 的归属、跨包相对/盘符路径、 `@source` 覆盖与失效路径、`--app-*`/`--ant-*` 声明与圆角 px、写死版本号的依赖、遗留的 `tmp-*` 探针与仓库根日志/压缩包/可疑已跟踪文件名。`EXIT=1` 就代表有条硬约束被破， `--json` 可拿结构化结果。`hygiene` 报的历史遗留（别人的日志以外的大文件、来源不明的状态文件） **先问再删**，不要顺手 `rm`。它**不能**替代单测、类型检查与三引擎 e2e。

## 规则与守门测试对照

改这些行为时，对应测试会先红；不要靠改测试让它不红，除非同时改实现口径并在 changeset 里写清理由。

| 约束 | 守门人 |
| --- | --- |
| 包不认组件库、跨包只走包名、toast 与 WS 的归属 | `packages/core/hooks/__tests__/boundary.test.ts` |
| token 命名空间、预设明暗对齐、`@theme inline`、`@source` 覆盖 | `packages/core/base/design/__tests__/design.test.ts` |
| `common-ui` 每组件一目录且必须有 `index.ts` | `packages/core/ui-kit/common-ui/__tests__/structure.test.ts` |
| 偏好变量名单一事实来源 | `packages/core/base/shared/__tests__/constants.test.ts` |
| 示例页静默失效 API（`v-permission` 的 arg 写成 modifier） | `apps/web/src/views/__tests__/gallery-api-usage.spec.ts` |
| 构建口径统一（每包都有 `build`） | `pnpm check:builds`（`scripts/check-uniform-build.mjs`） |
| 浮层定位与工具类真的生成 | `apps/web/e2e/popup-anchor.spec.ts` |
| 光标即"能不能点" | `apps/web/e2e/cursor.spec.ts` |

## 边界与升级

- 用户级要求冲突时以用户当轮指令为准，但要在汇报里点明"这与 `references/forbidden.md` 第 N 条冲突"。
- 需要动「禁止改动」清单里的文件（例如改 `apps/web/index.html` 的首屏 Loading 模板、改 `@source` 名单、改 `.gitattributes`），先说明影响面并取得确认。
- 删除类操作（`rm`、`git stash`、目录改名）在本仓库有实测代价：见 `references/compatibility.md` 的 Windows 一节。

## Resources

- `references/forbidden.md` — 禁止修改清单：模块 / 配置项 / 关键逻辑 / 固定资源，每条带原因与边界。
- `references/allowed.md` — 允许操作范围、可自定义配置、可扩展模块与权限分级。
- `references/standards.md` — 开发、代码、命名、提交、测试、部署规范与各环节质量标准。
- `references/third-party.md` — 第三方组件库使用规则、准入范围、版本约束、引入方式、二开限制与合规。
- `references/compatibility.md` — 操作系统与浏览器矩阵的适配要求、差异化处理、兼容性测试标准与验证流程。
- `references/acceptance.md` — 交付验收标准、功能校验要求与上线前检查清单。
- `scripts/check-repo.mjs` — 只读静态体检脚本。
