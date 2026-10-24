---
'@antdv/design': patch
'@antdv/web': patch
---

fix: 找回被重构提交删掉的 `@source` 名单，漏登记的包不再"渲染出来但没样式"

现象：设置抽屉打开后落在视口之外（`data-state=open` 与 `data-swipe-direction=right` 都在，`getBoundingClientRect()` 却是 `{x: 0, y: 720, height: 1474.5}`），端到端报"element is outside of the viewport"。同一次改动里，标签栏挤成一行、侧栏白底不缩进、圆角与间距消失 —— 组件全部挂载成功、控制台 0 条错误、构建全绿。

- **根因**：`c1e90202`（BasicForm 重构）把 `packages/core/base/design/src/index.css` 里整段 `@source` 名单删了 —— 45 行连带头部注释一起消失，而那次重构跟样式登记毫无关系，是编辑器整文件回写造成的误删。Tailwind v4 的自动内容检测从**构建根**（`apps/web`）开始扫，`@antdv/*` 全在仓库根的 `packages/` 下、且以软链进 `node_modules`，两种形式都在检测范围之外；`@source` 一走，那 10 个包模板里的工具类**一条都不生成**，静默、无错、构建绿。
- **这是同一个错误第二次发生**，所以从 `c1e90202^` 原样取回而不是手敲一遍：10 条 `@source`（`layouts` / `icons` / `common-ui` / `form-ui` / `layout-ui` / `menu-ui` / `popup-ui` / `shadcn-ui` / `table-ui` / `tabs-ui`）+ 说清"漏登记的症状长什么样"的头部注释 + `@plugin` / `@custom-variant` 的原有顺序。
- **诊断口径记下来，下次别再绕**：抓 dev server 吐出的 CSS 去 grep `hover\:` 是无效判据 —— 响应体是 JS 模块，反斜杠被双写， grep 结论永远含糊。直接开一次浏览器量几何（抽屉的 `inset` 该是 `0px 0px 0px 900px`）一次就定性。改完全局 CSS 要清掉 `apps/web/node_modules/.vite` 再重启 dev，否则旧缓存会继续吐出缺工具类的 CSS。
- **守门人本来就在，是这轮没跑**：钉这件事的用例有两条，且**分属两个包** —— `design.test.ts:637-669` 的「每个子包的源码目录都登记了 @source」（这是 `design.test.ts` 里唯一一条 @source 用例，别以为两条都在），以及 `packages/core/hooks/__tests__/boundary.test.ts:255` 的「@source 名单只属于 design」。单看 `design.test.ts` 会误判成"守门不全"。本轮两条都跑到了（`design.test.ts` 32 条全绿、`check-repo.mjs --only @source` PASS），并把它列为交付必跑项。

顺带（仅测试口径，第二条）：`gallery-examples.spec.ts:897-902`「第 2 步手机号格式拦在本步」也是同一类缺陷 —— 点完"下一步"后紧跟的那条 `expect(meta).toContainText('第 2/3 步')` **本来就成立**（这一步的标题在进第 2 步时就写进了 meta），它同步不了任何东西，于是下一行的 `allTextContents()` 抢在异步校验落地前读，拿到空数组。改成先 `await expect(phoneErrors).toHaveCount(1)` 再读文案（与第 1 步那两条同形）。反向验证过：把期望改成 `toHaveCount(2)` 会稳定报 `Received: 1` 并失败，所以这条等待确实咬得住；改前 `--repeat-each=3` 三跑一红，改后 `--repeat-each=6` 12/12 绿。

顺带（仅测试口径，第一条）：`listy-virtual.spec.ts:173` 在全量并跑时假红。用例只轮询到 `clientHeight` 变成 200 —— 那是 CSS 立刻给出的几何值 —— 然后一次读行数列数；行数要等 ResizeObserver 回调 → 重算窗口 → 重新渲染才跟着变，这一跳在三引擎并跑的重负载下被调度挤掉，实测 webkit 读到 12/12。改成对 `rows().count()` 轮询；反向验证过：把阈值改成不可能满足的 `< 1` 会超时失败，所以组件真的不重算时这条照样红，不会把缺陷等成绿灯。

验证：`theme-primary.spec.ts` 里原先失败的抽屉用例恢复通过。三引擎按独占 CPU 的口径实测：**chromium 全量 250/250 EXIT=0**、**webkit 相关 14 份 spec 子集 118/118 EXIT=0**、**firefox 同一子集 117/118**（唯一那条是 `preference-effects.spec.ts:537` 量两个 toast 各自墙钟停留时长的用例，报 3332ms / 3883ms；单独立跑该 spec 10/10 绿，判为负载下的计时漂移，没有放宽阈值）。`node .qoder/skills/antdv-repo-rules/scripts/check-repo.mjs` 的 `imports / owners / paths / @source / tokens / catalog` 六项 PASS（hygiene 的 3 条是仓库根既有遗留物，与本轮无关）；`npx turbo run test:unit --concurrency=1` 48/48 EXIT=0；`npx turbo run type-check --concurrency=1 --continue` 只剩 `@antdv/web` 一条红（见 `type-check-gate-chain.md`）。
