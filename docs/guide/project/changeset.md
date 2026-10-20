# Changeset

一句话：**发布链路是 changesets（`pnpm changeset → version → release`），所有 `@antdv/*` 包被钉成 fixed 组锁步发版；私有包也参与版本号递增与打 tag。根目录 `CHANGELOG.md` 是 standard-version 时代的遗留文件，不再有人维护它。**

## 配置逐项读（`.changeset/config.json`）

| 键 | 值 | 对本仓库的意义 |
| --- | --- | --- |
| `changelog` | `["@changesets/changelog-github", { repo: "junjie73-blip/antdv-next-admin" }]` | 生成的 CHANGELOG 带 commit 的 GitHub 链接 |
| `fixed` | `[["@antdv/*", "@antdv/*"]]` | **锁步版本**：任何一个包 minor bump，`@antdv/*` 全家（含 `@antdv/web`、`@antdv/backend-mock`）一起升到同一版本。这正是 monorepo 的正确口径 —— workspace 内部依赖全用 `workspace:*`，跨包类型互引（如 `@antdv/types`）版本不一致会直接对不上 |
| `privatePackages` | `{ version: true, tag: true }` | `@antdv/web` 等 `private: true` 的包照样递增版本并打 tag，不发 npm |
| `baseBranch` | `main` | changeset 以 main 为基线判断哪些包变了 |
| `updateInternalDependencies` | `patch` | 内部依赖范围跟随 patch 级更新 |
| `snapshot.prereleaseTemplate` | `{tag}-{datetime}` | `changeset version --snapshot` 出的预发布号带时间戳 |
| `commit` / `access` / `linked` / `ignore` | `false` / `public` / `[]` / `[]` | 没装 `@changesets/cli` 的 commit 辅助；无 linked 组、无忽略包 |

## 三条命令的接线（根 `package.json`）

```bash
pnpm changeset   # pnpm exec changeset —— 交互式选包 + bump 级别，生成 .changeset/*.md
pnpm version     # pnpm exec changeset version && pnpm install --no-frozen-lockfile
pnpm release     # pnpm run build && pnpm exec changeset publish
```

顺序不能省：**改动合入时带 changeset 文件**（`.changeset/` 下现存 25 个待发布的条目，如 `monorepo-shared-packages.md` 把 13 个包全列成 minor）； `version` 把摘要吃进各包 CHANGELOG、写版本号、删掉 changeset 文件并重算 lockfile； `release` 先全量构建再 publish。`version` 后必须跟一次 `pnpm install --no-frozen-lockfile` —— 脚本里已经这么写了，手工拆步时别漏。

::: danger 这条链路今天跑不动

`changeset version` 在组装 release plan 时会校验每个 changeset 的包名是否还在 workspace 里，而 `.changeset/monorepo-shared-packages.md:4-5` 里的 `@antdv/composables`（现在是 `@antdv/hooks`）与 `@antdv/ui`（现在是 ui-kit 那批 `@antdv/*-ui`）都不在了，于是 `pnpm changeset status` / `version` / `release` 全部硬失败 —— 不是跳过那一条，是整条中断。修法与复验口径见[更新日志](/guide/other/changelog)的「发版链路现在是断的」。CI 里没有 job 跑 changesets，所以这个问题只在真要发版时才现形。
:::

## catalog 与 workspace 版本策略

- 外部依赖：版本只写在 `pnpm-workspace.yaml` 的 `catalog:`（如 `@changesets/cli: ^3.0.3`、`antdv-next: ^1.6.0`），各包 `package.json` 里写 `catalog:`。`pnpm catalog`（`codemod pnpm/catalog`）用于批量对齐。
- 内部依赖：一律 `workspace:*`，发布时 changesets 按 fixed 组改写为真实版本号。
- 子包发布前用 `pnpm publint`（`vsh publint`）检查导出面，避免"publish 了个解析不了的包"。

## 历史包袱：CHANGELOG.md 与两个旧 tag

读 `git log` / CHANGELOG 时会被误导的地方，先说清：

- 根 `CHANGELOG.md` 头部是 standard-version 生成的 `0.0.1 (2026-06-05)`，与现在 changesets 链路无关；`monorepo-shared-packages.md` 那条摘要明确写了 "发布链路改为 changesets（移除 standard-version）"。
- 现存 tag 只有 `v0.0.3` 和 `vnull`（后者是迁移前的一次坏发布产物）。当前根版本号已是 `0.4.0`，这两个 tag 既对不上也不该用 —— 首次 `changeset publish` 之后，检索发布历史应以各包 CHANGELOG 与 changesets 打的包级 tag 为准。

## 写 changeset 的口径

- 现存条目正文是中文，按"新增/修复/迁移"分点，写的是**用户可感知的行为变化** （例：`theme-primary-follow-through.md`、`login-page-theme-aware.md`），不是文件清单。
- 会进 `.changeset/*.md` 的拼写检查范围（`pnpm check` 的 `check:cspell` 扫它），生造词会被拦，术语尽量复用现有条目写法。
- 改到 `packages/*` 的对外行为却没补 changeset，等于把该条 CHANGELOG 永久丢了 ——这是[测试](/guide/project/testing)文末清单里那条"值得记版本的改动补了changeset"的由来。

## 相关页面

- 全量脚本清单：[CLI](/guide/project/cli)
- 发布与构建命令：[CLI](/guide/project/cli)
