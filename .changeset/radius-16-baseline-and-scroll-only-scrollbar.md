---
'@antdv/design': minor
'@antdv/shared': minor
'@antdv/common-ui': minor
'@antdv/preferences': patch
---

feat: 圆角基准固定 16px 并由它单点派生全站刻度；自绘滚动条默认改成"只在滚动时亮"

两条 UI 适配口径：

- **圆角只剩一个基准**。`BORDER_RADIUS_BASE` 从 8 固定成 **16**（`packages/core/base/shared/src/constants/theme.ts:12-13`），`--app-border-radius` 在 `design/src/token/default.css` 与 `dark.css` 两处同步写成 `16px`。`--radius-*` 那套乘法刻度（`design/src/token/index.css`，xs/sm/md/lg/xl/2xl/3xl = 基准的 0.25/0.5/0.75/1/1.5/2/3）一个字没动，所以基准一动整条刻度按比例一起放大：默认偏好（倍率 1）下 `rounded-sm..3xl` 是 8/12/16/24/32/48px。偏好里存的仍是 0~1 的倍率，`writeThemeCssVars()` 那条换算链与 antd 侧的 `borderRadius` 都从同一个基准取数，因此不会出现"卡片圆角变了、按钮没变"那种两套尺度；`typings/src/app.ts` 的注释、`preferences/src/config.ts`、`update-css-variables.ts:96` 的口径说明一起改到 16。
- **侧边栏没有手写滚动条样式**（审计结论，无需改动）：菜单区从一开始就包在 `@antdv/common-ui` 的 `<Scrollbar>` 里（`layout-ui/src/components/layout-sidebar/index.vue:155-157`），全仓库再无侧边栏专属的滚动条皮肤；`tabs-ui/TabsBar.vue` 那串历史 `::-webkit-scrollbar` 工具类也早已删除。唯一还在写原生条的是 `design/src/css/scrollbar.css`，它在 `@layer base` 里只兜第三方组件内部的原生滚动元素（textarea、pre、虚拟列表），放在 base 层正是为了让 reka 注入的隐藏规则能盖过它 —— 端到端用例把"reka 滚动盒上 `scrollbar-width: none`"与"页面里没有自绘条之外的可滚元素"钉成了断言。
- **默认显示行为改掉**：`Scrollbar.vue:133` 把 `ScrollArea` 的 `type` 从 `hover` 换成 `scroll`。`hover` 的显隐只看指针，鼠标停在侧栏上轨道就一直亮，`hideDelay` 形同虚设；`scroll` 只在真正产生滚动位移时出现，停止后（reka 先 100ms 防抖判定滚动结束）按 `hideDelay`（默认 800ms）收起，指针留在原地也一样。`always` 保持为唯一的常驻开关，`native` 分支不受影响；`scroll` 态机在 idle 仍响应 POINTER_ENTER，所以条亮着时滑块照样可拖。

验证：单测 `common-ui` 290/290（其中 `scrollbar.test.ts` 12/12，新增"滚动时轨道出现、停止后按 hideDelay 自动收起"一条用假定时器覆盖 100ms 防抖 + 500ms 收起两段）、`shared` 182/182（`constants.test.ts` 把基准钉成 16）、`preferences` 64/64（倍率 0.5 → `8px`、倍率 1 → `16px`）、`design` 30/30。浏览器端到端新增 `apps/web/e2e/ui-adapt-radius-scrollbar.spec.ts`（3 条，chromium / firefox / webkit 各跑一遍，9/9 绿）：七档圆角的计算样式逐项等于 16px 基准的对应倍率、`[data-slot="card"]`（`rounded-xl`）量到 24px；侧边栏在 1280×300 视口下必然溢出（滚动盒 180px / 内容 308px），空闲时轨道不在 DOM 里、滚轮滚动时 `data-state="visible"`、指针不挪动 1.5s 后自动收起且滚动位置不回弹、反向再滚又亮；页面里没有自绘条之外的可滚元素。`preference-effects.spec.ts`（7/7）复跑覆盖倍率换算那半程。`npx tsc --noEmit -p apps/web/e2e/tsconfig.json` 对新增用例干净，另有 3 处存量报错（`app-loading-theme.spec.ts:85`、`ops-sweep.spec.ts:341,344`、`screen-fit.spec.ts:64`）与本次无关。文档同步：`docs/guide/in-depth/theme.md`、`docs/en/guide/in-depth/theme.md`、`docs/zh/guide/in-depth/theme.md` 改成 16px 基准；`docs/components/display.md` 与 en 镜像补写默认显隐并重对全部裸行号引用；`docs/guide/in-depth/layout.md`（含 `docs/zh` 副本）与 en 镜像的「滚动条」小节新增侧边栏落点、`scrollbar-width: none` 判据与端到端锚点。
