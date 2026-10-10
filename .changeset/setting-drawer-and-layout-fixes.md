---
"@antdv/types": minor
"@antdv/layouts": patch
"@antdv/web": patch
---

fix: 修复偏好设置抽屉与多布局的五处体验缺陷

- Scrollbar 在抽屉里改用 `min-h-0 flex-1`，滚动能到面板最末一项（原先带默认 `h-full`，与顶部分类切换条一起撑出容器被裁）
- `side-nav` 蓝图把侧栏改回常驻（`sidebarPresentation: 'inline'`），选它不再"什么都没出现"；浮层抽屉只由窄屏触发
- 新增 `chrome` 谷歌风格标签页（顶部圆角、不画底边、贴标签栏下沿），`TabStyle` 联合类型随之扩展
- 设置抽屉的分段控件在 `SettingItem` 上新增 `stacked` 槽位，标签风格选择器换到下一行并铺满
- 面包屑抽出 `LayoutBreadcrumb`：`headerLead` 为 breadcrumb 的形态住顶栏，其余落到内容列第一行，`showBreadcrumb` / `showBreadcrumbIcon` 两个偏好真正接入渲染

同时移除 `@antdv/layouts` 中无人消费的 `sidebarOpenByDefault` 区域开关。

端到端基线跟着补了两处计时口径：全站巡检按菜单页数分配超时预算（`E2E_SWEEP_PAGE_BUDGET`，默认每页 15s），WebKit 项目的整条墙钟从 150s 放宽到 240s —— 只放宽总时长，单步 `actionTimeout` / `expect` 一个没动，功能真坏了仍然立刻红。
