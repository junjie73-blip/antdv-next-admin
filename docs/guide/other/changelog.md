# 更新日志

变更记录住在两个地方，各司其职：`.changeset/*.md` 是**每一条变更在写代码当天登记的原稿**，各包目录下的 `CHANGELOG.md` 是**发版时由 changesets 汇总出来的成品**。文档站这一页只做两件事：把"现在发到哪了"说清楚，以及把"下一版会带上什么"列出来。

## 发布机制

版本跟着变更走，不是发版那天补写的。流程四步，前三步的脚本都在根 `package.json`：

| 命令 | 做什么 | 之后要做的 |
| --- | --- | --- |
| `pnpm changeset` | 交互式选受影响的包与 bump 级别，生成一条 `.changeset/xxx.md` | 把生成的文件和代码一起提交 |
| `pnpm version` | `changeset version`：消费所有 changeset，抬各包版本号、写各包 `CHANGELOG.md`，删掉用掉的 changeset 文件；再 `pnpm install --no-frozen-lockfile` 让 lockfile 跟上新版本 | **自己提交**这次改动（惯例 `chore(release): x.y.z`） |
| `pnpm exec changeset tag` | 按各包当前版本号打 `<pkg>@<version>` tag | `git push --follow-tags`（`git push` 默认不推 tag） |
| `pnpm release` | 先 `pnpm build`（带 `NODE_OPTIONS=--max-old-space-size=8192`），再 `changeset publish` | 全套包都是 `private`，publish 现在是空操作，留着等真有包要发 npm |

`.changeset/config.json` 里几个决定行为的字段：

- `"fixed": [["@antdv/*", "@antdv/*"]]` —— 让所有 workspace 包**锁步**抬到同一个版本号。代价是任何一个包的一个 patch 会把整套包一起推一格；换来的是"版本对不上"这类问题不会积累。**它是发版那一刻才生效的机制，不是实时约束**：跑一次 `version` 才对齐一次。落点算法见下面「锁步落点是怎么算的」。
- `"privatePackages": { "version": true, "tag": true }` —— 全套 `@antdv/*` 包都写着 `"private": true`（没有包发到 npm），这一项决定私有包要不要参与版本与 tag。显式写出来而不是靠依赖的默认值：changesets 在 2.x 后期改过一次这个默认行为，靠默认值就等于把发版链路挂在别人的改动上。打开之后 `@antdv/web`、`@antdv/backend-mock` 这些不发包的成员照样抬版本、照样进 tag，线上部署因此能按版本号对齐。
- `"changelog": "@changesets/changelog-git"` —— 生成的条目自带 commit 短 SHA，不需要任何凭据。原先这里是 `["@changesets/changelog-github", { repo: "junjie73-blip/antdv-next-admin" }]`，它会把每条 changeset 对应的 commit 拿去 GitHub API 查 PR 编号，**没有 `GITHUB_TOKEN` 就整条 `version` 抛错退出**（`Please create a GitHub personal access token…`），且失败时明确"no files should have been affected"，等于发版直接卡死。全套包都不发 npm，PR 链接不是刚需，因此换成 `changelog-git`。要切回去：config 与根 devDependency（以及 catalog 条目）一起改，并给本地和 CI 配 `GITHUB_TOKEN`。
- `"commit": false` —— `version` 只改文件不自动提交，提交信息留给你（惯例是 `chore(release): x.y.z`，`v0.0.3` 就是这个格式）。
- `"baseBranch": "main"` —— changesets 判断"哪些提交算这一轮"的基准分支。

## 版本历史

| 版本 | 状态 | 说明 |
| --- | --- | --- |
| 0.1.0 | 当前版本，34 个包同号 | 2026-10-23 第一次真跑通 `version` + `tag`：消费 38 条 changeset（18 条含 `minor`、20 条纯 `patch`），34 个成员各生成一份 `CHANGELOG.md`，锁步落到 0.1.0 |
| 0.0.3 | 已打 tag（`v0.0.3` → `de5f7b14`，2026-09-25） | 提交说明 `chore(release): 0.0.3` |
| 0.0.1 / 0.0.0 | 见根目录 `CHANGELOG.md`（2026-06-05） | 仓库早期用 standard-version 生成的历史，`CHANGELOG.md` 开头那句"See standard-version"说的就是它。改用 changesets 之后根目录这份文件不再被任何链路更新（成品住在**各包**的 `CHANGELOG.md`），留着当考古（顺带一提：里面 `## 0.0.0 (2026-06-05)` 出现了两次，standard-version 的产物本来就别当权威） |

0.0.3 到 0.1.0 之间没有 tag：那一段是 monorepo 改造期（子包拆出去、请求层换掉、文档站建起来），期间没走过完整的 `version` + `tag`，只有手工写死的版本号在动。另外仓库里还有一个误操作留下的 `vnull` tag（→ `3d54de9b`，2026-09-25，提交说明为「📦 准备提交」），它不参与任何构建或发布逻辑，看到时不必当真。

根 `package.json`（`antdv-next-admin`）**不是 workspace 成员**，changesets 不碰它的 `version`，跟着整套走是手工的事；本轮已手工对齐到 0.1.0，下轮发版记得一起改。

### 锁步落点是怎么算的

`fixed` 组的落点 = 组内**当前最高版本号**叠加本轮最大的 bump 级别，不是"从 0.1.0 起"。0.1.0 之前 34 个成员摊在五个号上（`0.0.0` / `0.1.0` / `0.4.0` / `0.5.0` / `5.8.0`）：`layouts` 是拆包时手工写成 `0.5.0` 的，`scripts/turbo-run` 与 `scripts/vsh` 还带着上游 `vue-vben-admin` 的 `5.8.0`。照原样跑第一次 `version`，整套（包括当时还是 `0.0.0` 的 `docs` 与五个 lint-config）会被推到 `5.9.0` —— 凭空多出五个前置版本。

本轮的处理是**先把 34 个成员的 version 全部归零到 `0.0.0`，再跑 `version`**，落点因此是 0.1.0；同时删掉此前 `changeset tag` 打下、但从未推送也从未与 `version` 结果对应的 34 个本地 tag（远端一直是 0 个 tag），免得 HEAD 上同时挂着两代 tag。

::: warning 两条现在仍然成立的规矩

- 新建包一律从 `0.0.0` 出厂。锁步组里最高的那个号替整套决定落点，手工写一个"更像正式版"的号等于悄悄改了整套的基线。
- 包改名 / 拆分时，`.changeset/*.md` 里登记的包名也在改名范围内（见下一节）。

:::

## 包改名会把整条发版链路硬断

`assemble-release-plan` 遇到 changeset 引用不存在的包时是**整条链路硬失败**，不是跳过那一条 —— `status`、`version`、`publish` 在同一步抛出，修掉之前任何一次发版都跑不完。0.1.0 之前撞上的正是这条：

```
Error: Found changeset monorepo-shared-packages for package @antdv/composables
which is not in the workspace
```

`.changeset/monorepo-shared-packages.md` 登记时用的是改名前的包名：`@antdv/composables` 随 `packages/composables` → `packages/core/hooks` 变成了 `@antdv/hooks`；`@antdv/ui` 那批公共组件现在住在 `packages/core/ui-kit/common-ui`（`@antdv/common-ui`），同一次拆包另有一半成了 `@antdv/icons`。两行 bump 声明都已改成新名。

::: tip 这类断裂为什么没人提前发现

CI 里没有任何 job 跑 changesets（`.github/workflows/` 只有 `docs.yml`），所以它只在真发版那天暴露。`pnpm changeset status` 是只读的，可以随便跑 —— 想让它变常驻门禁，就把这条命令加进流水线。

:::

## 待发布

`.changeset/` 现在只剩 `config.json`：38 条登记已全部被 0.1.0 消费。下一轮从 `pnpm changeset` 开始重新登记。

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

tag 用 `git tag -l '@antdv/*'` 看；本页是手工维护的摘要，**权威来源始终是各包 `CHANGELOG.md` 与 `.changeset/`**：两者与本页冲突时，以前者为准，并顺手把这里改掉。

## 相关

- 提交信息怎么写、有哪些类型前缀：[规范](/guide/project/protocol)
- changeset 与 catalog 依赖版本的关系：[项目更新](/guide/other/project-update)
