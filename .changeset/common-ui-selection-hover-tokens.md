---
'@antdv/common-ui': minor
---

feat: common-ui 的选中态与 hover 态改吃 primary 主题色，不再写死调色板

现象（用户归纳）：`common-ui` 里组件的"选中"和"悬停"全是硬编码的具体颜色 —— cron 编辑器的模式按钮写死 `bg-blue-500`、预设按钮写死 `border-blue-500 / text-blue-600`，标签页选中面写死 `bg-gray-50 dark:bg-gray-800/60`。换主题预设（`[data-theme]`）只换得到宿主与 token 化的组件，这批盒子在紫色主题上依然是蓝色，选中态跟着主题走这件事从来没成立过。

- **映射按"这个颜色在说什么"分三族，不是一律染成主色**：
  1. **品牌色 / 选中 / 强调** → `primary` 家族。`bg-blue-500 text-white` → `bg-primary text-primary-foreground`，选中预设的 `border-blue-500 bg-blue-50 text-blue-600` → `border-primary bg-primary/10 text-primary`，未选中那侧的悬停 `hover:border-blue-300 hover:bg-blue-50/50` → `hover:border-primary/50 hover:bg-primary/5`。淡染一律用 `/10`、`/5` 这种透明度档，不再另配一支浅蓝 —— 主色换了淡染才会跟着换。
  2. **语义状态** → `destructive` / `warning` / `success` / `info`。错误边界与导入失败的 `red-*` → `destructive`，分片上传的暂停与"校验中" → `warning`，成功与哈希进度 → `success` / `info`。这几族跟主色无关，染成主色反而是回归。
  3. **中性面与文字** → `muted` / `accent` / `border` / `input` / `card` / `muted-foreground`。**没有跟着染成 primary**：把每一处灰色 hover 都涂蓝，本身就是一次看得见的改版；中性层只负责在暗色档位下给出正确的对比度。
- **`dark:` 分支成批删掉**：`dark:bg-gray-800/60`、`dark:border-gray-600` 这类补偿值，在 `--muted` / `--border` 走 `[data-theme]` 暗色预设后是多余的，留着会让暗色档吃两套不同的算法。
- **落点（9 个组件、178 处字面量）**：`CronEditor`（选中 + 悬停，主案）、`Tabs`（卡片式页签的 `data-[state=active]` 面）、`ChunkUpload`（28 个站点：按钮、图标键、链接、进度条填充与轨道、错误面）、`ReloadPrompt`（13 个站点：描边、渐变高亮、徽标、光晕、进度轨道、关闭键）、`Badge`（状态点五色）、`UploadList`（行 hover 与状态文字）、`Upload`（拖拽区 hover 描边）、`Transfer`、`ErrorBoundary`（含加载圈 `border-blue-600` → `border-primary`）。**这 178 处里只有 38 处带着交互前缀**（`ChunkUpload` 24、`ReloadPrompt` 6、`UploadList` 3、`CronEditor` 3、`ErrorBoundary` 2 —— 改前 HEAD 上正好也是这 38 处），其余 140 处是被一起 token 化的静态面与 `dark:` 补偿值（`Transfer.vue:214,243,259,265`、`CronEditor.vue:304,344`、`Badge.vue:39-43`、`UploadList.vue:101` 等）。按"选中/hover"这条需求本身只需要动 38 处，多出来的 140 处是"同一个组件里两套颜色体系并存"没法只改一半的结果 —— 只把 hover 换成 token、静态面仍写死 `gray-*`，暗色档就会出现一块跟主题走、一块不跟的拼贴。这一条写在现象里，不偷偷做。
- **`@antdv/design` 那条链没动**：变量仍只存 HSL 通道、颜色由 `hsl(var(--x))` 组合，组件侧只是开始读它。

色差是按预期存在的，需要点明：默认 `--primary` 是 `215.02 100% 54.31%` = **#1677FF**（照搬 antd 的蓝），而原先写死的 `blue-500` 是 **#3B82F6**（Tailwind 的蓝）。默认主题下这批组件会**变蓝一点点**，这是把两套蓝收敛成一套的必然结果 —— 留着 `blue-500` 才是"换主题选中态不跟"的根因。反过来，`#1677FF` 与 Tailwind 调色板不同号也让"视觉与原有设计保持一致"只能按家族对齐，不能按十六进制逐位对齐。

另有四处**明暗档位**上的实际差异，逐条摊开（都是 token 表本身的形状造成的，不是笔误）：

- **hover 由"变深"改成"变淡"**：`hover:bg-destructive/90`（`ErrorBoundary.vue:88`）、`hover:bg-warning/90` / `hover:bg-primary/90`（`ChunkUpload.vue:284,292,300`）。原先是 `red-600 → red-700` 这种加深档，现在按 shadcn 自家按钮的写法走"降不透明度"，而 `/90` 是往**背后**混色 —— 浅底页面上 hover 会显得更淡。选它是因为整站的 `Button` 就是这个档位，组件里再自派一套"更深"只会让同类按钮有两种手感。
- **实色状态底上的白字只能保持 `text-white`**：`ChunkUpload.vue:292` 的"暂停全部"。token 表里**没有** `--warning-foreground`（只有 `--primary/destructive/…-foreground` 那几支），而暗色档 `--warning` 是 `42.06 100% 61.96%`（`dark.css:47`）、比浅色档 `39.91 95.83% 52.94%`（`default.css:64`）**更浅**，所以白字在暗色档的对比度是往下走的。要修得先给 token 表补 `--success/warning/info-foreground` 三支，那是 `@antdv/design` 的改动、要另开一轮，本轮不动。
- **静态错误/成功文字的对比度掉档**：`text-destructive`（`359.33 100% 65.1%`）替掉 `red-600`（`ErrorBoundary.vue:78,81`、`ChunkUpload.vue:427,432,520,525`），约 5.0:1 → 3.3:1；`text-success` 替掉 `green-600`（`ChunkUpload.vue:468,536`），约 3.0:1 → 2.3:1。同一条链上的问题：`--success/-warning` 没有配套的深色档文字变体，改完只能吃单档。这两处按 AA 口径是**已知不合格**，登记给 token 补档那一轮。
- **进度条"等待/取消"档位在暗色档几乎看不见**：轨道 `bg-muted`、填充 `bg-muted-foreground/30`（`ChunkUpload.vue:459,496-497`）。`--muted-foreground` 在默认档（`default.css:40` = `0 0% 0% / 0.45`）和暗色档（`dark.css:27` = `0 0% 100% / 0.45`）**自身就带 alpha**，再叠 `/30` 等于 45%×30% ≈ 13.5%，而暗色档轨道是 8% —— 差 5.5 个点，肉眼几乎分不出填充到哪。改前是 `bg-gray-700` 压在 `bg-gray-800` 上（≈26% vs 15%）。本轮把填充改成 `bg-muted-foreground/60`，与 `Badge.vue:39` 的状态点、`Scrollbar.vue:138` 的滑块同档，两个档位下的间距都回到改前的量级。

`ReloadPrompt.vue:208` 还留着一对写死的 `rgba(15,23,42,…)` / 暗色 `rgba(0,0,0,…)` 阴影 —— 它是 `box-shadow` 不是颜色类，本轮那两条 grep 判据都抓不到它，属于"换了个类名不等于换完颜色"的残留，按存量登记。

未纳入本轮（属"静态面"，不是选中/hover）：`Tag` 72 处预设色板、`TableSkeleton` 13、`Alert` 12、`TimelineItem` 10、`Divider` 9、`PageSkeleton` 8、`Result` 7、`ImportExport` 5、`AvatarUploader` 5、`ChunkUpload` 的 `purple-500` 4（"计算哈希/合并中"没有对应语义 token）、`Statistic` 2、`DescriptionsItem` 2、`Description` 1，共 **150 处**（改前 328 处，本轮删掉 178 处；328 − 178 = 150 自洽）；全仓 `common-ui` 的 `hover:` / `focus:` / `data-[state=active]:` 前缀里已**一处调色板字面量都不剩**，这条是本轮的收口判据。计数口径固定为下面这条可复现命令，本文所有数字都按它给（同一条命令跑 `git archive HEAD` 解出来的改前快照 = 328，跑 `git diff -U0 … | grep '^-'` = 178）：

```bash
# 剩余静态字面量（含 dark: 分支）——在 packages/core/ui-kit/common-ui/src 下执行
grep -rnoE "(text|bg|border|ring|fill|stroke|from|via|to|outline)-(slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-[0-9]+" --include="*.vue" . | wc -l
# 交互前缀里的字面量（期望 0）：在上式前面加上 [a-z0-9:.\[\]%=-]*(hover|focus|focus-visible|active|data-\[state=(active|checked|selected|open)\])[a-z0-9:.\[\]%=-]*
```

同一条"交互前缀 + 调色板"判据扫到 `common-ui` 之外，还有 **55 处**同类缺陷没被本轮覆盖（519 个 `.vue`，按包：`@antdv/layouts` 35、`table-ui` 7、`tabs-ui` 6、`layout-ui` 3、`form-ui` 2、`menu-ui` 2）：`table-ui/TableAction.vue:83,212-213,431-432`、`tabs-ui/TabsBar.vue:152,194` + `TabContextMenu.vue:120`、`layout-ui/layout-footer/index.vue:44,60`、`menu-ui/BasicMenu.vue:158-159`、`form-ui/form-label.vue:63`，其余在 `layouts` 的 `widgets/notification`（10）、`setting-drawer`（9）、`basic/content/route-loading-bar`（4）等。口径是 **`packages/` 内**的 519 个 `.vue`；`apps/web/src` 自己还有 37 处同判据命中，属于宿主页面改版的事，不在这条数字里。这些位置在包外或另属一次改版，按"报告不偷改"处理。

验证：`npx turbo run test:unit --concurrency=1` 48/48 EXIT=0（本轮末尾为复核 `bg-muted-foreground/60` 那一处，又 `--force` 单跑了 `@antdv/common-ui`：32 files / 352 tests 全绿）。`theme-primary.spec.ts` 新增两条真实浏览器用例 —— cron 编辑器读**算出来的**颜色（`getComputedStyle`）而不是类名：选中模式按钮的 `backgroundColor` 与页面 `--primary` 解析值逐位相等，点"每分钟"后字色与上边框色变为主色，悬停"每天 12 点"的底色不再是 `rgb(239, 246, 255)`（blue-50），切到橙黄预设后同一批断言改吃 `rgb(250, 84, 28)` 且淡染也随之改变；上传拖拽区的 hover 上边框同样等于当刻主色。三引擎（独占 CPU 的口径）：**chromium 全量 250/250 EXIT=0**；**webkit 14 份相关 spec 子集 118/118 EXIT=0**；**firefox 同一子集 117/118** —— 唯一那条红是 `preference-effects.spec.ts:537`「两条通道共用同一份停留与关闭实现」，它量的是两个 toast 各自的墙钟停留时长（报 3332ms / 3883ms），单独立跑同一份 spec 10/10 绿，判为整机负载下的计时漂移而不是行为差异，**没有为此放宽阈值**。`design.test.ts` 32/32（含 token 命名空间与 `@source` 覆盖两条守门，另一条在 `boundary.test.ts:255`）。`check-repo.mjs` 的 imports / owners / paths / @source / tokens / catalog 六项 PASS，hygiene 仍是 3 条既有项（仓库根 `.sync-state.json`、`dist.zip`、一个名字长得像 `console.log(...)` 的 0 字节已跟踪空文件），与本轮无关。`ChunkUpload.vue` 的那两处档位调整**没有任何运行时用例覆盖**（该组件在 `apps/web` 零引用、也没有测试挂载它），依据只是上面那段 alpha 叠加的算术。
