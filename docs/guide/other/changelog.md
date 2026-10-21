# 更新日志

变更记录住在两个地方，各司其职：`.changeset/*.md` 是**每一条变更在写代码当天登记的原稿**，根目录 `CHANGELOG.md` 是**发版时由 changesets 汇总出来的成品**。文档站这一页只做两件事：把"现在发到哪了"说清楚，以及把"下一版会带上什么"列出来。

## 发布机制

版本跟着变更走，不是发版那天补写的。流程三步，脚本都在根 `package.json`：

| 命令 | 做什么 | 之后要做的 |
| --- | --- | --- |
| `pnpm changeset` | 交互式选受影响的包与 bump 级别，生成一条 `.changeset/xxx.md` | 把生成的文件和代码一起提交 |
| `pnpm version` | `changeset version`：消费所有 changeset，抬版本号并写进 `CHANGELOG.md`，删掉用掉的 changeset 文件；再 `pnpm install --no-frozen-lockfile` 让 lockfile 跟上新版本 | **自己提交**这次改动 |
| `pnpm release` | 先 `pnpm build`（带 `NODE_OPTIONS=--max-old-space-size=8192`），再 `changeset publish` | 打 tag、推远程 |

`.changeset/config.json` 里几个决定行为的字段：

- `"fixed": [["@antdv/*", "@antdv/*"]]` —— 让所有 workspace 包**锁步**抬到同一个版本号。代价是任何一个包的一个 patch 会把整套包一起推一格；换来的是"版本对不上"这类问题不会积累。**但它是发版那一刻才生效的机制，不是实时约束**：跑一次 `version` 才对齐一次，而 `v0.0.3` 之后一次都没跑过，所以今天的仓库并不同号（见下「版本号的真实分布」）。
- `"privatePackages": { "version": true, "tag": true }` —— 全套 `@antdv/*` 包都写着 `"private": true`（没有包发到 npm），这一项决定私有包要不要参与版本与 tag。显式写出来而不是靠依赖的默认值：changesets 在 2.x 后期改过一次这个默认行为，靠默认值就等于把发版链路挂在别人的改动上。打开之后 `@antdv/web`、`@antdv/backend-mock` 这些不发包的成员照样抬版本、照样进 tag，线上部署因此能按版本号对齐。
- `"changelog": ["@changesets/changelog-github", { "repo": "junjie73-blip/antdv-next-admin" }]` —— 生成的条目自带指向 commit 的链接，仓库地址就写在这一处；换 fork 时改这里，同时改掉文档站的 GitHub 链接（`docs/.vitepress/config.mts` 的 `socialLinks`，`:329-334`）。
- `"commit": false` —— `version` 只改文件不自动提交，提交信息留给你（惯例是 `chore(release): x.y.z`，`v0.0.3` 就是这个格式）。
- `"baseBranch": "main"` —— changesets 判断"哪些提交算这一轮"的基准分支。

## 版本历史

| 版本 | 状态 | 说明 |
| --- | --- | --- |
| 0.4.0 | 当前工作版本，**未发布** | 根包 `antdv-next-admin` 与 20 个成员的号；没有任何 tag，也没有进过 `CHANGELOG.md` |
| 0.0.3 | 已打 tag（`v0.0.3` → `de5f7b14`，2026-09-25） | 提交说明 `chore(release): 0.0.3` |
| 0.0.1 / 0.0.0 | 见根目录 `CHANGELOG.md`（2026-06-05） | 仓库早期用 standard-version 生成的历史，`CHANGELOG.md` 开头那句"See standard-version"说的就是它。改用 changesets 之后这份文件不再由那条链路更新，留着当考古（顺带一提：里面 `## 0.0.0 (2026-06-05)` 出现了两次，standard-version 的产物本来就别当权威） |

版本号从 0.0.3 跳到 0.4.0 中间没有对应的 tag：这一段是 monorepo 改造期（子包拆出去、请求层换掉、文档站建起来），期间没有走完整的 `version` + `publish`，所以只有号没有发布记录。另外仓库里还有一个误操作留下的 `vnull` tag（→ `3d54de9b`，指向一次提交说明为「📦 准备提交」的提交），它不参与任何构建或发布逻辑，看到时不必当真。

### 版本号的真实分布

`fixed` 讲的是"下一次发版会一起抬"，不是"现在同号"。改造期新建的包是手工写死版本号出厂的，而 `pnpm version` 从 `v0.0.3` 之后没跑过，于是 34 个 `@antdv/*` 成员现在摊在五个号上：

| 版本号 | 个数 | 成员 |
| --- | --- | --- |
| 0.4.0 | 20 | `web` `backend-mock` `shared` `types` `icons` `design` `hooks` `preferences` `form-ui` `table-ui` `popup-ui` `menu-ui` `layout-ui` `shadcn-ui` `tabs-ui` `router` `directives` `vite-config` `node-utils` `tsconfig` |
| 0.5.0 | 1 | `layouts` —— 拆包时手工写的号，比整套还高一格 |
| 0.1.0 | 5 | `common-ui` `enums` `request` `stores` `utils` —— 新建子包从 0.1.0 起 |
| 0.0.0 | 6 | `docs` + `internal/lint-configs/` 下 5 个 config 包 |
| 5.8.0 | 2 | `turbo-run` `vsh` —— 从上游 `vue-vben-admin` 带过来的号，一直没归零 |

后果是发版前要先看一眼：锁步组里现在最高的是 5.8.0，照着"整套抬到同一个号"的语义，第一次真跑 `pnpm version` 落点未必是 0.4.x。要么先把 `turbo-run` / `vsh` 这两个号改齐，要么在临时分支上跑一次 `version` 看结果再决定 —— 别在 `main` 上试，`version` 会改 34 个 `package.json`、`CHANGELOG.md` 并删掉 `.changeset/` 里那 25 个文件。

### 发版链路现在是断的

上面那些是"落点可能不合预期"，这一条是**跑不起来**。`pnpm changeset status` 现在就报错退出（changesets 3.0.3）：

```
Error: Found changeset monorepo-shared-packages for package @antdv/composables
which is not in the workspace
```

原因是 `.changeset/monorepo-shared-packages.md` 登记时用的包名，后来在改包里换掉了：`:4` 的 `@antdv/composables` 现在是 `@antdv/hooks`，`:5` 的 `@antdv/ui` 被拆成了 `packages/core/ui-kit/` 下的一批 `@antdv/*-ui`。正文 `:19` 那句还照旧名写着这两个包，一起改才对得上。

`assemble-release-plan` 对这种引用是**整条链路硬失败**，不是跳过：`status`、`version`、`release` 全部在同一步抛出，所以修掉之前，任何一次发版都跑不完。修法只有两种，取决于这次架构调整原来想让谁抬版本 —— 把两行改成 `@antdv/hooks` 与新 ui-kit 各包，或者删掉这两行。改完用 `pnpm changeset status` 复验（它是只读的，可以随便跑）。

顺带一句：CI 里没有任何 job 跑 changesets（`.github/workflows/` 只有 `docs.yml`），所以这条断裂不会被流水线发现，只有真发版那天才会撞上。

## 待发布

`.changeset/` 里已登记、还没被 `pnpm version` 消费的变更，共 **25 条**（登记时间 2026-10-10 ~ 10-19）。类型按 changeset 的 bump 级别归：11 条含 `minor`，14 条全是 `patch`。下面两段就按"含不含 minor"分。

**minor**

- 架构调整：把可复用能力从应用里拆成独立子包（`monorepo-shared-packages`，13 个包一起 minor）
- 新增中英双语 VitePress 文档站，并补上 CI 门禁与两条独立发布链路（`docs-site-bilingual-and-pages-ci`）
- 组件示例按分类补齐页面，并把示例里的 API 用错处一次性修掉（`gallery-example-pages`）
- 全站交互巡检收尾，并把 Ctrl+K 搜索从假功能做成真功能（`sweep-fixes-and-menu-search`）
- 生产产物自带浏览器内 mock，静态部署不需要任何后端（`prod-browser-mock`）
- 修复偏好设置抽屉与多布局的五处体验缺陷（`setting-drawer-and-layout-fixes`；minor 只给 `@antdv/types`，`layouts` / `web` 是 patch）
- common-ui 新增 `BorderBeam` 与 `Listy`；轻提示/通知去掉彩色底色，状态只留徽标（`border-beam-listy-and-neutral-toast`）
- `Listy` 加虚拟滚动模式，万级数据只渲染视口内那十几行（`listy-virtual-scroll`）
- 谷歌风格（`chrome`）标签按浏览器标签重做：选中页长出反向圆角，标签之间是让位的发丝线（`chrome-tabs-concave-feet`）
- MarkdownEditor 迁入 `@antdv/common-ui`，`FMarkdown` 字段从 textarea 换成 tiptap（`markdown-editor-into-common-ui`，common-ui + form-ui）
- `apps/web` 的通用 composables 与无业务耦合组件迁进对应子包（hooks / common-ui / table-ui），web 侧只留业务件（`web-composables-and-components-into-packages`）

::: warning 有一条的 bump 级别看着选错了

`basic-drawer-on-drawer-primitives` 正文写的是"抽屉换掉底层交互原语"，级别却只给了 popup-ui / shadcn-ui 一个 `patch`；同样换了实现的 `markdown-editor-into-common-ui` 给的是 `minor`。不影响构建，只影响版本号 —— 下一次 `pnpm version` 之前值得确认一下。:::

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
- `BasicDrawer` 改用 shadcn 的 Drawer 原语替换 Sheet，多出「甩动关闭」并补掉原语的两个无障碍缺口（`basic-drawer-on-drawer-primitives`，popup-ui + shadcn-ui 各一个 `patch` —— 见上面那条警告）
- 换主题色真的换色，不再只有 CSS 变量在动（`theme-primary-follow-through`）
- 设计规范彻底脱离 antdv-next，并修掉迁移留下的三处样式缺陷：固定列重叠、表头比数据行矮一线、浮层被抽屉压住（`design-tokens-off-antd-table-popup-fixes`，9 个包）
- 把"跨包只走包名导入"写成测试守住；`ErrorBoundary` 不再从自己的 barrel 绕路（`package-import-hygiene`）
- 清掉仓库里残留的 vben 命名，上游归属统一写成 `vue-vben-admin`（`vben-naming-purge`，10 个包）

每条的正文都写明了现象、根因、取舍和测试口径 —— 想追溯"为什么这么改"，直接读对应的 changeset 文件比读 diff 快。

## 这一页怎么维护

发版之后把「待发布」整段挪进「版本历史」的新行，再从 `.changeset/` 重新列一遍剩下的条目。「待发布」的条数别凭印象写，用命令数：

```bash
ls .changeset/*.md | wc -l
```

版本号分布同理，别照抄上一版：

```bash
for f in $(find apps packages internal docs scripts -name package.json \
  -not -path '*/node_modules/*' -not -path '*/dist/*' -not -path '*/.output/*'); do
  node -e "const p=require('./$f');if(p.name)console.log(p.version, p.name)"
done | sort
```

本页是手工维护的摘要，**权威来源始终是 `CHANGELOG.md` 与 `.changeset/`**：两者与本页冲突时，以前者为准，并顺手把这里改掉。

## 相关

- 提交信息怎么写、有哪些类型前缀：[规范](/guide/project/protocol)
- changeset 与 catalog 依赖版本的关系：[项目更新](/guide/other/project-update)
