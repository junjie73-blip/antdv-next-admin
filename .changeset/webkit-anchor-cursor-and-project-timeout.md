---
'@antdv/design': patch
'@antdv/web': patch
---

fix: 链接的光标不再靠浏览器内建样式表（WebKit 静止态算 `auto`），并修好 WebKit 专属墙钟其实从未生效这件事

背景：本轮 `BasicTable` / `BasicForm` 重构按"三引擎都绿才算绿"的口径整跑端到端时，`e2e/cursor.spec.ts` 在 webkit 上红了两条。两条都不是这次改动带进来的，但都归到这一条 changeset 里，因为它们会一直制造"看起来像重构改坏了"的假红。

- **链接光标（真缺陷，只在 Safari 内核现形）**：全站兜底扫描报 `/system/user` 的面包屑"系统管理"与顶栏的 GitHub 链接算出来是 `cursor: auto`。用一份最小页面探针复跑两个引擎：同一个裸 `<a href>`，Chromium 的 UA 样式表给 `pointer`，WebKit 静止态给 `auto`（`class="cursor-pointer"` 那种显式声明两边都是 `pointer`，差异纯粹来自内建样式表）。所以这不是"Safari 抽风"，而是**我们只在 Chromium 上验过**。修法按 `design/css/base.css` 的既有主张来 —— 能点的元素自己在样式层写死，不赌 UA 默认：新增 `@layer base { a[href] { @apply cursor-pointer; } }`。**必须待在 `@layer base` 里**：这个文件其余光标规则是无层级的，层外规则压过全部工具类，链接要是也写层外，`<a class="cursor-not-allowed">`（禁用态下载链接这类显式表态）就会被盖掉。守门断言同步进 `design/__tests__/design.test.ts` 的光标那条。
- **WebKit 的 240s 墙钟从来没生效（假红发生器）**：`playwright.config.ts` 里 WebKit 的 `timeout: 240_000` 写在 `use` 里 —— `use` 装的是 fixture 选项，`timeout` 不在其中，于是它既不报错也不生效，实际执行的仍是顶层 `timeout: 90 * 1000`。失败信息里的 `Test timeout of 90000ms exceeded` 就是证据：注释里"webkit 单跑立刻绿、只放宽墙钟不动单步超时"这条经验一直没落地。改成项目级字段（`TestProject.timeout`），`actionTimeout: 45_000` 保持在 `use` 里不动 —— 它是真的 fixture 选项，各步 15s/45s 的判据一个没改，功能真坏了仍然立刻红。

验证：`@antdv/design` 单测 `__tests__/design.test.ts` 32/32（含新断言：`a[href]` 的 `@apply cursor-pointer` 必须在 `@layer base` 块内）；`e2e/cursor.spec.ts` 单跑 `--project=webkit` 4/4 绿（此前 2 红），首条用例 54.5s —— 在旧配置下就是被 90s 墙钟咬死的那条；chromium / firefox 复跑结果见下。
