---
"@antdv/web": patch
---

fix: 路由页面不再重复加内边距（内边距归布局管）

诉求：**"所有路由页面，在布局组件中增加了 padding，那么路由页面外层容器不需要添加 padding"**。

布局在内容区外面已经套了一层 `<Scrollbar view-class="p-4">`（`src/layouts/index.vue:239`，
注释里写明了"内边距挪进 view，挂在滚动元素上会让滚动条盖住内容"）。
页面再给自己加一份，表现是内容离边缘 40px、跟别的页面对不齐、卡片阴影被顶出可视区。

## 被修掉的五个页面

| 页面 | 原来根容器 |
| --- | --- |
| `/components/editor/markdown` | `flex h-full flex-col p-4` |
| `/security/dashboard` | `cn('space-y-4 p-5')` |
| `/demo/table-pagination-test` | `p-6` |
| `/micro-app/SubAppView` | 两个空状态根 `... gap-2 p-6 text-center` |
| `/system/micro-app` | `flex h-full flex-col gap-4 p-4` |

页面**内部**的卡片、代码块、抽屉内容该有内边距照旧有 —— 只动根容器。

## 门禁

新增两份互补的检查，因为单靠一种都有盲区：

- 源码侧 `src/views/__tests__/page-root-padding.spec.ts`：遍历 `src/views` 下所有页面文件，
  解析模板的**顶层元素**（多根 `v-if` 分支逐个看），断言 class 里没有
  `p-*/px-*/py-*/pt-*/pb-*/pl-*/pr-*`，也没有行内 `padding:`；同时钉住"布局那层
  `view-class="p-4"` 还在"，哪天把 padding 从布局挪走，这条会逼着回来改口径。
  遍历口径按**文件**而不是按路由表：页面有三种来源（文件约定式路由、`routes.ts` 的静态路由、
  菜单接口动态注册的 `account/*`），只有按文件扫才覆盖得全；排除的私有组件目录
  （`views/<页>/components/**`、`widgets/**`）与 vite-config 里 VueRouter 的
  `**/*/components/*` 排除规则对齐。
- 渲染侧 `e2e/page-padding.spec.ts`（chromium / firefox / webkit 各 4 条）：进页面量
  `getComputedStyle`，断言布局 view 是 16px、页面根容器是 0px。
  源码扫描看不到 `cn()` 最终拼出什么，计算样式看不到没渲染的分支，两边各补一半。

## 写门禁时踩到的两个坑（都记在测试注释里）

1. **计算属性根容器**：`/security/dashboard` 的 padding 藏在 `const containerClassName =
   cn('space-y-4 p-5')` 里，模板上只有 `:class="containerClassName"`。只读字面量等于给它
   开后门，所以按 `xxxClassName` 这条命名约定回到脚本里取定义原文再匹配。
2. **定义块的边界**：一开始拿"下一个空行"当结束，结果 prettier 把连续的一行式
   `const xxxClassName = cn(...)` 挤成不留空行的一整块，于是
   `btnClassName = cn('px-0.5!')` 这种**别的元素**的 padding 被算到根容器头上，
   一次误报 20 多个页面。改成"下一条顶格语句之前"（`(?=\n\S|\s*$)`）。
   另一个坑是 Windows checkout 出来是 CRLF，`\n\n` 永远匹配不上，必须先归一成 LF。

## 验证

- 单测：`pnpm test:unit` 21/21 任务通过（web 包 27 文件 / 250 条）。
- 端到端：`page-padding.spec.ts` 三引擎 12 条全绿；回归跑 `shell-scroll.spec.ts`（同样
  路过 `/demo/table-pagination-test` 与内容区滚动）2 条绿。
- 真实浏览器截图复核：Markdown 编辑器、安全看板、子应用空状态三张改动页 + 分析面板基线，
  内容左边缘与标签栏/面包屑对齐，`h-full` 页面（编辑器）高度链没被拆坏。
