---
'@antdv/common-ui': minor
'@antdv/web': patch
---

feat: `AuthPageLayout` 换成整屏左右分栏版式，背景改成从主色推导的四层画布

现象（用户归纳）：「auth 组件的背景有点单调，登录页看起来不像后台系统的登录页」。原来那版是视口正中一张 `max-w` 卡片，左右两侧整片留白，只有一层 `bg-card`，跟"管理系统的门面"对不上。方向经用户选定：**全屏左右分栏** + **克制的缓慢动效**。

- **版式**：`[data-auth="card"]` 从"居中卡片"变成"铺满视口宽度的分栏行"，`lg` 以上左栏品牌 52% / 右栏表单 48%（右栏 `bg-card/70` + `backdrop-blur`，落在玻璃面上而不是又开一个颜色命名空间），`lg` 以下品牌栏整块 `hidden` 收成单列。`data-auth` 钩子一个没删，只改了 `card` 的语义 —— 依赖它的 `register-page.spec.ts`（断言 `card` 可见）不用动就还成立，但**任何按"卡片宽度 ≤ max-w"写的几何断言都会失效**，`login-page.spec.ts` 里那条已改成量两栏是否铺满、宽度比是否 ≥ 0.5 / 0.45、两栏是否等高同顶。
- **背景四层，全部只从 `--primary` 推导**：`[data-auth="canvas"]` 是 `aria-hidden` + `pointer-events: none` + `overflow: hidden` 的装饰层，含三枚 `radial-gradient` 光斑（34 / 28 / 40s 的 `alternate` 漂移）、一层 3.5rem 网格（120s 走完一格，`mask-image` 用偏心径向把网格压向左上、避免糊到表单栏）、两道蓝图圆弧与一条地平线。用 `radial-gradient` 而不是 `filter: blur()`，是因为大尺寸模糊在低端机和 Firefox 上是首屏开销；`--primary` 在 14 个预设 × 明暗两套里都不带 alpha，所以 `hsl(var(--primary) / α)` 恒可用。动效在 `prefers-reduced-motion: reduce` 下整组 `animation: none`。
- **品牌栏内容**：铭牌 + `brandBadge`（新增可选 prop，大标题上方那行引导语；分栏版式左栏是整屏高的画布，光一句标题压不住空白）+ 大标题 + 描述 + 三枚特性胶囊 + 一台界面示意（`[data-auth="slogan-visual"]`：窗口栏 / 侧边栏 / 三张卡 / 12 根柱 / 表格行，柱高是组件内写死的装饰值 —— 认证外壳刻意不认识 store，真接数据就得引入数据源）。`#sloganVisual` 插槽整块可替换，传 `sloganImage` 则换成图。
- **顺手的两处**：`AuthFormPanel` 去掉自己的 `mt-*`（垂直居中与上下留白归 `AuthPageLayout` 的栏容器管，两处都管就会在窄屏上顶出滚动条）；`AuthSocialLogin` 的三枚入口加了 hover 上浮与主色描边 —— 分栏之后表单栏是"贴屏"的，原来那圈没有反馈的灰边显得像没做完。装饰 CSS 写在组件 `<style>` 里（BEM `auth-*`），沿用 `BorderBeam` 的先例：这类规则用 Tailwind 任意值写会退化成一大串方括号，而玻璃栏的**底色**仍留在 `bg-card/70` 工具类上，自定义类不与工具类抢同一属性。
- **宿主侧**：登录 / 注册页接 `brandBadge`（新增 `auth.brandBadge` 中英文案），两个登录方式按钮补 `carbon:user` / `carbon:mobile` 图标，demo 账号提示从一行裸字改成带边框的信息条。按钮文案仍是 `账号登录` / `手机号登录` 整串，`signIn()` 用的是 `{ exact: true, name: '登录' }`，加图标不影响可访问名。

验证：`common-ui` 单测 `__tests__/auth.test.ts` 25 例（新增 3 例：canvas 是纯装饰层（`aria-hidden`、内部无 `img/a/button/input`）、`brandBadge` 有传才渲染 `[data-auth="brand-badge"]`、示意柱状条带内联高度），`pnpm exec vue-tsc --noEmit` 该包 0 错，oxlint 新增行 0 命中（该文件存量的 5 条 `no-non-null-assertion` 全在我没碰的行上）。端到端 `login-page.spec.ts` + `register-page.spec.ts` 三引擎：chromium 10/10、webkit 10/10、firefox 10/10。整跑三引擎时 firefox 的**第一条**用例撞过 90s 墙钟（`主色和深色偏好真的落到登录页上` 要登录 → 开偏好抽屉 → 改两档 → 清 storage → reload → 四轮 `expect.poll`，冷编译下就是慢），单跑该 spec 6/6 绿、第一条 41.4s，按仓库既有口径记为负载型假红而不是改 `signIn` 或放宽超时。浏览器侧另用 10 组截图核过 1440 / 1280×720 / 1024 / 390 四档与明暗、紫 / 橙预设、`prefers-reduced-motion`，全部 `scrollWidth === clientWidth`（无横向溢出），1280×720 不产生纵向滚动；光斑漂移用两次采样对比 `getComputedStyle().transform` 矩阵确认在动（这也是为什么静止态必须写 `translate3d(0, 0, 0) scale(1)` 而不是留 `none` —— webkit 内核不在 `none` 与函数列表之间插值）。文档 zh 正文与 en 镜像同步了分栏契约与 `brandBadge`。
