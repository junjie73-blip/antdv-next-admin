# 更新日志

变更记录住在两个地方，各司其职：`.changeset/*.md` 是**每一条变更在写代码当天登记的原稿**，根目录 `CHANGELOG.md` 是**发版时由 changesets 汇总出来的成品**。文档站这一页只做两件事：把"现在发到哪了"说清楚，以及把"下一版会带上什么"列出来。

## 发布机制

版本跟着变更走，不是发版那天补写的。流程三步，脚本都在根 `package.json`：

| 命令 | 做什么 | 之后要做的 |
| --- | --- | --- |
| `pnpm changeset` | 交互式选受影响的包与 bump 级别，生成一条 `.changeset/xxx.md` | 把生成的文件和代码一起提交 |
| `pnpm version` | `changeset version`：消费所有 changeset，抬版本号并写进 `CHANGELOG.md`，删掉用掉的 changeset 文件；再 `pnpm install --no-frozen-lockfile` 让 lockfile 跟上新版本 | **自己提交**这次改动 |
| `pnpm release` | 先 `pnpm build`，再 `changeset publish` | 打 tag、推远程 |

`.changeset/config.json` 里几个决定行为的字段：

- `"fixed": [["@antdv/*", "@antdv/*"]]` —— 所有 workspace 包**锁步**抬到同一个版本号。代价是任何一个包的一个 patch 会把整套包一起推一格；换来的是"版本对不上"这类问题不存在，读代码的人只要看一个号就知道整套东西是哪一轮。
- `"privatePackages": { "version": true, "tag": true }` —— 全套 `@antdv/*` 包都写着 `"private": true` （没有包发到 npm），这一项决定私有包要不要参与版本与 tag。显式写出来而不是靠依赖的默认值：changesets 在 2.x 后期改过一次这个默认行为，靠默认值就等于把发版链路挂在别人的改动上。打开之后 `@antdv/web`、`@antdv/backend-mock` 这些不发包的成员照样抬版本、照样进 tag，线上部署因此能按版本号对齐。
- `"changelog": ["@changesets/changelog-github", { "repo": "junjie73-blip/antdv-next-admin" }]` ——生成的条目自带指向 commit 的链接，仓库地址就写在这一处；换 fork 时改这里，同时改掉文档站的 GitHub 链接（`docs/.vitepress/config.mts` 的 `socialLinks`）。
- `"commit": false` —— `version` 只改文件不自动提交，提交信息留给你（惯例是 `chore(release): x.y.z`， `v0.0.3` 就是这个格式）。
- `"baseBranch": "main"` —— changesets 判断"哪些提交算这一轮"的基准分支。

## 版本历史

| 版本 | 状态 | 说明 |
| --- | --- | --- |
| 0.4.0 | 当前工作版本，未发布 | 根 `package.json` 与各 `@antdv/*` 包都是这个号。下面「待发布」的 15 条 changeset 一旦被 `pnpm version` 消费，就会从这里往上抬 |
| 0.0.3 | 已打 tag（`v0.0.3` → `de5f7b14`，2026-09-25） | 提交说明 `chore(release): 0.0.3` |
| 0.0.1 / 0.0.0 | 见根目录 `CHANGELOG.md`（2026-06-05） | 仓库早期用 standard-version 生成的历史，`CHANGELOG.md` 开头那句"See standard-version"说的就是它。改用 changesets 之后这份文件不再由那条链路更新，留着当考古 |

版本号从 0.0.3 跳到 0.4.0 中间没有对应的 tag：这一段是 monorepo 改造期（子包拆出去、请求层换掉、文档站建起来），期间没有走完整的 `version` + `publish`，所以只有号没有发布记录。另外仓库里还有一个误操作留下的 `vnull` tag（指向一次提交说明为「📦 准备提交」的提交），它不参与任何构建或发布逻辑，看到时不必当真。

## 待发布

`.changeset/` 里已登记、还没被 `pnpm version` 消费的变更，共 16 条。类型按 changeset 的 bump 级别归（`minor` 里含 feat 与破坏性较小的重构，`patch` 全是 fix / 体验修正）：

**minor**

- 架构调整：把可复用能力从应用里拆成独立子包（`monorepo-shared-packages`）
- 新增中英双语 VitePress 文档站，并补上 CI 门禁与两条独立发布链路（`docs-site-bilingual-and-pages-ci`）
- 组件示例按分类补齐页面，并把示例里的 API 用错处一次性修掉（`gallery-example-pages`）
- 全站交互巡检收尾，并把 Ctrl+K 搜索从假功能做成真功能（`sweep-fixes-and-menu-search`）
- 生产产物自带浏览器内 mock，静态部署不需要任何后端（`prod-browser-mock`）

**patch**

- 能点的盒子都有可点光标，禁用的不再装成能点（`cursor-for-hoverable-boxes`）
- 分析面板吸收工作台，`/dashboard/workbench` 下线（`dashboard-merge-workbench`）
- 开发态改页面文件不再把一级布局改没（`dev-route-hmr-layout`）
- 交互巡检第二轮：把"看起来能用、实际点不动"的一批缺陷清掉（`interaction-sweep-round-two`）
- 登录页改成跟随偏好主色与暗色模式（`login-page-theme-aware`）
- 导航与面包屑接回同一份数据（`navigation-breadcrumb-and-collapse-bar`）
- 路由页面不再重复加内边距，内边距归布局管（`page-root-padding-owned-by-layout`）
- 实时监控大屏的图表跟随容器自动 resize（`screen-chart-auto-resize`）
- 大屏缩放改为按内容区计算，不再按视口（`screen-fit-content-area`）
- 修复偏好设置抽屉与多布局的五处体验缺陷（`setting-drawer-and-layout-fixes`）
- 换主题色真的换色，不再只有 CSS 变量在动（`theme-primary-follow-through`）

每条的正文都写明了现象、根因、取舍和测试口径 —— 想追溯"为什么这么改"，直接读对应的 changeset 文件比读 diff 快。

## 这一页怎么维护

发版之后把「待发布」整段挪进「版本历史」的新行，再从 `.changeset/` 重新列一遍剩下的条目。本页是手工维护的摘要，**权威来源始终是 `CHANGELOG.md` 与 `.changeset/`**：两者与本页冲突时，以前者为准，并顺手把这里改掉。

## 相关

- 提交信息怎么写、有哪些类型前缀：[规范](/guide/project/protocol)
- changeset 与 catalog 依赖版本的关系：[项目更新](/guide/other/project-update)
