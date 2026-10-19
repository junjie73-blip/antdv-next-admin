---
'@antdv/tabs-ui': minor
'@antdv/web': patch
---

feat: 谷歌风格（`chrome`）标签按浏览器标签重做——选中页长出反向圆角，标签之间是会让位的发丝线

原来那版只是"上圆角 + 描边 + 底色"的胶囊（`border border-b-0`、栏底 `bg-primary/10`），和真标签页差在一节：选中页与内容区之间没有过渡，整条栏还被主色染了一遍，换到深色主题尤其脏。这版按参考实现重画，两处几何用 Tailwind 表达不出来（`clip-path` 象限裁剪 + 伪元素圆扩散阴影），落在 `TabsBar.vue` 末尾的样式块里，全部按根元素的 `data-tab-style='chrome'` 生效 —— 新属性挂在 `.tab-bar` 上是为了让 CSS 认得到当前风格，其余四种风格的规则一条都不匹配。

- **胶囊本体（`useTabStyle.ts` 的 `chrome` 槽）**：`h-8 rounded-[10px] px-3.5`、不描边；列表 `items-end gap-1 px-2.5`（两端各留 10px，否则第一个标签的左脚会被滚动容器的 `overflow` 裁掉）；栏底不再染色，未选中只留 `hover:bg-gray-100 dark:hover:bg-gray-700`；选中态只给 `text-primary`，**底色一律不写在这个槽里** —— 标签体和它的两只脚必须共用同一个颜色值，所以底色写在 `--tab-chrome-fill`（`color-mix(in oklab, var(--app-primary) 12%, var(--app-background))`），三处引同一个变量，换主题换明暗一起变，不会出现"脚"与标签不同色的接缝。
- **反向圆角**：`::before` / `::after` 两个 20px 圆，圆心正落在标签下沿的外侧角上（`bottom: 0; left/right: -20px`），`box-shadow: 0 0 0 30px var(--tab-chrome-fill)` 把同色铺满圆外，再用 `clip-path: inset(50% -10px 0 50%)` / `inset(50% 50% 0 -10px)` 只保留靠标签那一侧的下半象限。**半径必须等于标签自己的圆角**：两条弧的圆心同在底边上、半径相同，交点处切线都是竖直的才接得上；参考稿用的 8px 圆角配 10px 弧，接缝处差的那 2px 会露出一个针尖大的缺口，所以这里统一成 10px。
- **发丝线**：1px × 16px 垂直居中在未选中项的**左沿**，走它们的 `::after` 槽位（选中页的两只伪元素已被脚占用，用同一个槽就没有抢占之争，隐藏规则也只需同步带 `:not([data-active='true'])` —— 少写这一层判断，悬停到选中页时会把它的左脚一起 `opacity: 0` 掉）。按参考稿隐藏四种情形：整条的第一个（左边是栏边，没有邻居）、自己正被悬停、自己就是选中页、紧邻在悬停/选中页后面那一个。线带 0.3s `opacity` 过渡，是"让位"不是"删掉"。

验证：

- `tabs-ui` 单测 3 个文件全绿。`actions-and-style.test.ts` 里那条 chrome 用例原来是红的（断言 `bg-muted/60`，而源码早已是 `bg-primary/10`，上一轮改栏底颜色时漏了同步），按新版设计重写：断言 `rounded-[10px]`、`items-end`、`px-2.5`，并逐条检查选中项与栏底**都不含 `bg-` / `border`**（几何之外的染色一律算回归），`divider` 标志改回 `true`。`tabs-bar.test.ts` 补一条容器带 `data-tab-style` 的用例 —— jsdom 永远不应用 SFC 里的 `<style>`，几何本身只能钉到类名与属性这一层。
- 浏览器端到端：`apps/web/e2e/tabs.spec.ts` 新增一条 chrome 用例，用 `getComputedStyle(el, '::before' | '::after')` 直接量几何 —— 上左圆角 10px、脚宽 20px、`clip-path` 落在两个象限之一、阴影色等于标签底色、选中页底边与栏底边相差不超过 1px，再逐条断言发的线（第一个不画 / 左邻是选中页时不画 / 悬停时让位 / 移开又回来，线只是隐掉不是删掉）。`apps/web` tabs spec 15/15 通过。两条时序坑值得记：`.tab-item` 上的 `transition-colors` 让刚切换风格的 `backgroundColor` 还在从旧值插值，而 Chromium 把 `color-mix(in oklab, …)` 的计算值序列化成 `oklab(L a b)`，所以读几何之前要先 poll 到"阴影色已经等于底色"；发丝线同理，直接读会拿到过渡中点上的 `0.887511`，断言必须走 `expect.poll`。
- 明暗两色、宽窄两档与溢出态用临时截图核过（脚在深色下铺在 `--app-background` 上，与参考稿行为一致），临时 spec 与截图目录已清理。
- 文档：`docs/guide/in-depth/layout.md`、`docs/zh/` 副本与 `docs/en/` 三份的标签页风格条目改成新形状；`_linkcheck.mjs`（121 个文件，0 缺失）与 `_sidebarcheck.mjs`（94 条链接，0 缺失）干净。
