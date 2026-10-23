# @antdv/preferences

## 0.1.0

### Minor Changes

- abfe730: 架构升级：把可复用能力从应用层抽成独立子包，重排 monorepo。

  - 新增 `@antdv/shared`（通用方法、菜单树工具、请求封装）、`@antdv/preferences`（用户偏好设置与持久化）、`@antdv/composables`（自定义 hooks）、`@antdv/ui`（公共组件）、`@antdv/layouts`（多布局形态：vertical / two-column / horizontal / side-nav / mixed-vertical / mixed-two-column / full-content）、`@antdv/router`（鉴权与动态菜单守卫，依赖注入式，不绑定 store）、`@antdv/directives`（通用指令）、`@antdv/design`（设计令牌与基础样式）、`internal/vite-config`（可组合的 Vite 配置）、`internal/node-utils`（缺失的 Node 工具包）。
  - 子包统一用 tsdown 产出 dist，由 turborepo 编排 build / dev / type-check / test:unit；依赖版本走 pnpm `catalog`。
  - mock 服务迁移到 Nitro（`apps/backend-mock`）：业务接口走 `/api`，控制面走 `/api/mock-center/**`。
  - 菜单与标签页：混合布局下两级联动、精准单选高亮、横向导航溢出滚动 + 拖拽；标签页支持拖拽排序、四种风格、放大还原、关闭其他、固定与刷新。
  - 接通标签页页面缓存：`apps/web` 新增 `usePageCache`，用归一化 path 生成 KeepAlive 缓存名，`include` 只收"标签还开着且菜单允许缓存"的页面；刷新标签会推进缓存代号，退出登录清空缓存。
  - e2e：`apps/web/e2e` 从上游模板的失效用例改为可跑的真实链路（冒烟、页面缓存、XSS 安全基线），`playwright.config.ts` 对齐项目实际端口 6080 并支持 `E2E_BASE_URL` / `E2E_HEADED` / `E2E_WORKERS`，turbo 补上 `test:e2e` 任务；Chromium / Firefox / WebKit 三引擎 81 条用例全绿。
  - 跨浏览器兼容修掉两处真问题（都不是"调超时能糊过去"的那种）：
    - `@antdv/shared` 的 CSRF Double Submit Cookie 原来写 `HttpOnly=false`。Cookie 属性是"出现即为真"的标记，浏览器据此把 cookie 存成 HttpOnly，脚本第二次写同名 cookie 就被拒绝 —— Chromium 只在 DevTools 的 Security 面板提示，Firefox 直接往 console 打 error。现在按 `path=/; SameSite=Lax` 写入，`Secure` 只在 https 下追加。
    - `apps/web/index.html` 的 CSP 原来恒定带 `upgrade-insecure-requests`。WebKit 不豁免 `http://localhost`，会把每个模块请求升级成 https 并握手失败，页面只剩首屏 Loading 的白屏（Chromium / Firefox 无症状）。该指令改由 `@antdv/vite-config` 按构建模式注入：生产保留，开发留空。
  - e2e 基建收尾：`watchErrors` 忽略 `ResizeObserver loop …`（观察者规范里的正常收敛状态，WebKit 抛成 pageerror、Firefox 抛成 console error）；本地并发压到 `E2E_WORKERS`（默认 3，一个引擎一个 worker）并只给 WebKit 放宽计时，避免"纯超时"的假红；`.gitignore` 用不带路径的 `.mock-state.json`，覆盖 Nitro mock 落在 `apps/web/` 的运行时状态文件。
  - 退出登录的会话态收口：`useUserStore().logout()` 现在除了凭证与页面缓存，还会 `resetRoutes()`（把 `isLoaded` 打回 false，守卫下次导航重新拉菜单）并清空标签页；`forceLogout()` 改为复用这一个出口，并把回登录页从 `location.href = '/login'` 换成改 hash —— 本应用是 hash 路由，写 pathname 会触发整页重载，打断进行中的导航还把 `redirect` 参数弄丢了。修前：换个账号在同一次页面会话里登录，会沿用上一个账号的菜单与授权集合。
  - 发布链路改为 changesets（移除 `docs/` 与 standard-version），根脚本新增 `release`。

### Patch Changes

- 5194446: fix: 设计规范彻底脱离 antdv-next，并修掉迁移留下的三处样式缺陷（固定列重叠、表头比数据行矮一线、浮层被抽屉压住）

  现象（用户归纳）：`@antdv/design` 还在引 antd 的 Tailwind 兼容层，主题色事实上依赖组件库；换主题只换一颗主色，画布色温不动；固定右侧的操作列会跟横向滚动内容叠在一起；表头比数据行差一小截；抽屉里点开自定义主色的取色器，色块弹层出现在抽屉**底下**。

  - **`@antdv/design` 的包边界收成"只有变量与 CSS"**：删掉 `@import '@antdv-next/tailwind/compat.css'` 与 `@antdv-next/tailwind` 依赖，`package.json` 不再声明任何组件库。这不是"换个变量名"——compat 层一走，`*-ant-primary` 那组工具类**整条不生成**（Tailwind v4 只为 `@theme` 里声明过的 token 出类），所以页面侧必须一起迁到本包令牌。`__tests__/design.test.ts` 里加了两条钉死边界的用例：全包不出现 `--ant-*` 读取、`package.json` 不含组件库依赖。
  - **每个主题改成"一份完整色板"**：`token/default.css` 与 `token/dark.css` 各写 13 套 `[data-theme]` 预设（`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`），每套 27 条语义色一条不少、各套签名互不相同、明暗两版真的换值（三条都由用例反查名单，不是抽查）。缺一条的后果不是"退回默认色"而是它继续吃 `:root` 的亮色值 —— 暗色预设上浮出一块白底。
  - **档位由 DOM 说话，主色只留一条链**：`@antdv/shared/constants` 新增 `THEME_PRESETS` / `themeKeyByColor` / `CUSTOM_THEME_KEY`；`applyPreferencesToDom()` 把选中的色反查成 `<html data-theme="…">`，**只有取色器选的颜色**才额外内联 `--app-primary`（预设档内联反而会把暗色档辛苦提亮的主色压回亮色值）。给 antdv-next 的桥 `--ant-color-primary` + `--ant-primary-color` 两个名字继续都写，因为页面里还有 antd 的 DOM 在读旧名。
  - **固定列不再与滚动内容重叠**（`table-ui`）：粘性单元格的 `z-index` 与底色一起给（`bg-inherit` 而不是透明底），横向滚动时内容从固定格下面穿过去而不再是盖在上面。用几何断言核对（`boundingBox()` 与滚动容器右边缘），只看 `toBeVisible()` 会放过这个缺陷。
  - **表头与数据行同高**（`table-ui`）：表头与单元格共用一套盒模型 `px-3 py-2 text-sm leading-6 align-middle`。行高用 `leading-6`（24px 行盒）而不是 `h-6` —— Tailwind 预置的 `box-sizing: border-box` 会把内边距一起算进 24px，小于"内边距 16 + 内容 20"，等于没设；实测 41/41 行等高。
  - **浮层回到 shadcn 的同一档刻度**（`popup-ui`）：抽屉/弹窗的内联 `zIndex: 1000` 是 antd 时代的遗产，而 reka-ui 的 Popover / Select / Tooltip 全在 `z-50` 且 portal 到 `body` 末尾，于是"抽屉里打开的取色器被抽屉本身盖住"。现在默认不覆盖层级，靠挂载顺序叠放；只有要钉死先后关系时才显式传 `zIndex`。这条缺陷 Playwright 只会报 hit-test 重试（"subtree intercepts pointer events"），`toBeVisible()` 一路放行 —— 加了两条单测断言"默认内联 zIndex 为空、显式传入才写"。
  - **`BasicDrawer` 标题区补齐内边距**（`popup-ui`）：内置 header 与 `#header` 插槽两条分支都走 `px-6 py-4`，标题文字不再贴着头部边缘与分割线。
  - **表单与组件的默认色/间距规范**（`form-ui`）：label 与行距统一走 token 化刻度，校验只在提交时触发（去掉初始校验导致的"一进页面满屏红"），组件默认边框由黑色改成 `border` 令牌色。
  - **包源码不再读 `import.meta.env`**（`common-ui`）：`ErrorBoundary` 的开发态判定原先写死 `import.meta.env.DEV`，而包里 tsconfig 有意不带 `vite/client`（免得 vite 变成隐式依赖）。包自己的 type-check 靠一份手写 `vite-env.d.ts` 兜住，但 `tabs-ui` 按源码消费本包时那份环境声明不在它的 program 里，直接报 TS2339。现在改用 `@antdv/shared` 注入的 `isProduction()` —— 这也是 `shared/utils/env.ts` 一开始立这条规矩的理由：包读 env 既拿不到静态替换，也没法在单测里切分支。新增两条用例把"开发态给调用栈详情、生产态收起"钉住，收尾复位共享状态。
  - **CSS 副作用导入的类型声明要跟着模块图走**（`popup-ui`）：`message/index.ts` 的 `import 'vue-sonner/style.css'` 只有本包的 `src/types/css.d.ts` 声明，下游包（`table-ui`）一视同仁报 TS2882。改成在导入处补一行 `/// <reference path="../types/css.d.ts" />`，声明随模块被一起纳入，不用每个消费方复制一份 shim。

  验证：`npx turbo run test:unit` 全绿 —— 22 个套件共 1861 条（`design` 29、`table-ui` 214、`popup-ui` 46、`common-ui` 192、`apps/web` 282）；`common-ui` 在并发整跑里出现过一条 5s 超时假红，单独复跑 192/192 绿。`npx turbo run type-check` 里 **31 个包全绿**，只剩 `@antdv/web` 一条红：109 条报错分布在 38 个本轮没碰过的文件上（`~/api/notice` 等指向不存在模块的死引用、`@vue/tsconfig/tsconfig.dom.json` 的 `lib` 没有 ES2021/ES2023 导致 `replaceAll` 与包源码里的 `.toSorted()` 报 TS2550、以及一批响应体类型对不上的 `res.data`），报错行号均不在本轮 diff 的 hunk 内 —— CI 只跑 docs，这条链从未被门禁挡住过，属于迁移期存量债，另开一轮清理（见待办 P7）。它此前被 `tabs-ui` 的失败掩盖（依赖任务失败会让它不执行），所以第一次露脸。chromium 端到端全量跑 151 条，4 条红 —— 逐条缩小复跑后，3 条（登录框 `fill` 超时、拖拽用例 execution context destroyed、IconPicker 点击超时）是 Vite 依赖重优化把正在跑的页面重载了一次造成的假红（`gallery-examples` 单跑 26/26 绿、`icon-picker` 单跑 7/7 绿），1 条是用例自身的缺陷：`theme-primary` 把主色断言写成大写字面量 `#FA541C`，而色板实际拼作 `#fa541c`，大小写不该是契约，已在读取处归一化并复跑绿。主题侧另有浏览器实测：14 档 × 明暗画布逐档不同、`data-theme` 正确、预设不写内联、刷新后偏好仍在、0 条 console error，且全仓不再有 `*-ant-*` 工具类的使用点；固定列/表头同高/抽屉内取色器都用几何断言（`boundingBox()` / `elementFromPoint()`）而不是 `toBeVisible()`；`ErrorBoundary` 的调用栈详情在真实页面（`/components/loading` → 模拟一次崩溃）实测仍会出现。顺带修掉一处只在 CI 全量跑才暴露的既有问题：`backend-mock` 在 `noUncheckedIndexedAccess` 下的 `accounts[0]` 类型。文档侧 `npx turbo run build --filter=@antdv/docs` 通过，zh 正文 / `docs/zh` 副本 / en 镜像三份口径一致，代码引用逐条对回当前行号。

- 54d880b: feat: 圆角基准固定 16px 并由它单点派生全站刻度；自绘滚动条默认改成"只在滚动时亮"

  两条 UI 适配口径：

  - **圆角只剩一个基准**。`BORDER_RADIUS_BASE` 从 8 固定成 **16**（`packages/core/base/shared/src/constants/theme.ts:12-13`），`--app-border-radius` 在 `design/src/token/default.css` 与 `dark.css` 两处同步写成 `16px`。`--radius-*` 那套乘法刻度（`design/src/token/index.css`，xs/sm/md/lg/xl/2xl/3xl = 基准的 0.25/0.5/0.75/1/1.5/2/3）一个字没动，所以基准一动整条刻度按比例一起放大：默认偏好（倍率 1）下 `rounded-sm..3xl` 是 8/12/16/24/32/48px。偏好里存的仍是 0~1 的倍率，`writeThemeCssVars()` 那条换算链与 antd 侧的 `borderRadius` 都从同一个基准取数，因此不会出现"卡片圆角变了、按钮没变"那种两套尺度；`typings/src/app.ts` 的注释、`preferences/src/config.ts`、`update-css-variables.ts:96` 的口径说明一起改到 16。
  - **侧边栏没有手写滚动条样式**（审计结论，无需改动）：菜单区从一开始就包在 `@antdv/common-ui` 的 `<Scrollbar>` 里（`layout-ui/src/components/layout-sidebar/index.vue:155-157`），全仓库再无侧边栏专属的滚动条皮肤；`tabs-ui/TabsBar.vue` 那串历史 `::-webkit-scrollbar` 工具类也早已删除。唯一还在写原生条的是 `design/src/css/scrollbar.css`，它在 `@layer base` 里只兜第三方组件内部的原生滚动元素（textarea、pre、虚拟列表），放在 base 层正是为了让 reka 注入的隐藏规则能盖过它 —— 端到端用例把"reka 滚动盒上 `scrollbar-width: none`"与"页面里没有自绘条之外的可滚元素"钉成了断言。
  - **默认显示行为改掉**：`Scrollbar.vue:133` 把 `ScrollArea` 的 `type` 从 `hover` 换成 `scroll`。`hover` 的显隐只看指针，鼠标停在侧栏上轨道就一直亮，`hideDelay` 形同虚设；`scroll` 只在真正产生滚动位移时出现，停止后（reka 先 100ms 防抖判定滚动结束）按 `hideDelay`（默认 800ms）收起，指针留在原地也一样。`always` 保持为唯一的常驻开关，`native` 分支不受影响；`scroll` 态机在 idle 仍响应 POINTER_ENTER，所以条亮着时滑块照样可拖。

  验证：单测 `common-ui` 290/290（其中 `scrollbar.test.ts` 12/12，新增"滚动时轨道出现、停止后按 hideDelay 自动收起"一条用假定时器覆盖 100ms 防抖 + 500ms 收起两段）、`shared` 182/182（`constants.test.ts` 把基准钉成 16）、`preferences` 64/64（倍率 0.5 → `8px`、倍率 1 → `16px`）、`design` 30/30。浏览器端到端新增 `apps/web/e2e/ui-adapt-radius-scrollbar.spec.ts`（3 条，chromium / firefox / webkit 各跑一遍，9/9 绿）：七档圆角的计算样式逐项等于 16px 基准的对应倍率、`[data-slot="card"]`（`rounded-xl`）量到 24px；侧边栏在 1280×300 视口下必然溢出（滚动盒 180px / 内容 308px），空闲时轨道不在 DOM 里、滚轮滚动时 `data-state="visible"`、指针不挪动 1.5s 后自动收起且滚动位置不回弹、反向再滚又亮；页面里没有自绘条之外的可滚元素。`preference-effects.spec.ts`（7/7）复跑覆盖倍率换算那半程。`npx tsc --noEmit -p apps/web/e2e/tsconfig.json` 对新增用例干净，另有 3 处存量报错（`app-loading-theme.spec.ts:85`、`ops-sweep.spec.ts:341,344`、`screen-fit.spec.ts:64`）与本次无关。文档同步：`docs/guide/in-depth/theme.md`、`docs/en/guide/in-depth/theme.md`、`docs/zh/guide/in-depth/theme.md` 改成 16px 基准；`docs/components/display.md` 与 en 镜像补写默认显隐并重对全部裸行号引用；`docs/guide/in-depth/layout.md`（含 `docs/zh` 副本）与 en 镜像的「滚动条」小节新增侧边栏落点、`scrollbar-width: none` 判据与端到端锚点。

- d8fa761: fix: 设计变量对齐 shadcn-vue 的格式契约 —— 裸规范名 + HSL 三段，别名层与 `--app-*` 整套撤掉

  诉求（用户原话）：`index.css` 的变量格式对齐 shadcn-vue。给的选项是「加规范名别名层（推荐）」，实施到一半发现这条路走不通，**最终落成了"裸规范名就是唯一事实来源"**，比别名层少一层。偏离的缘由记在下面，不是偷偷改口径。

  - **别名层和通道格式互斥**：shadcn-vue 的读侧是 `hsl(var(--primary))`，要求变量里存的是 `215.02 100% 54.31%` 这种**三段通道**；而 `--app-*` 那套历史命名存的是整色（`#1677ff` / `rgb(22 119 255)`）。加一层 `--primary: var(--app-primary)` 只是把整色换个名字，`hsl()` 一拼还是非法值。要让规范名能用，值必须先变成通道 —— 那时候别名和来源就是同一个形状、同一个语义，剩下两个名字反而成了"两份事实"，一条链路要同时维护前缀名与裸名，任何一处写错都是静默丢样式。
  - **撤掉别名层的代价验证过，不是靠推理**：子树覆盖（`ConfigProvider` 的 `theme.primary`）之所以还能生效，靠的是 `@theme inline { --color-primary: hsl(var(--primary)) }` 把工具类编译成 `hsl(var(--primary))` **表达式本身**，在使用点而非 `:root` 求值。所以 `<html>` 上的一份裸名声明 + 容器上的内联覆盖，各自都在最近元素上解析 —— 原来那个专门为此存在的 `THEME_SCOPE_CLASS = 'app-theme-scope'` 已经没有作用，删（`shared/src/constants/dom-classes.ts`）。同理 `CSS_VAR_*` 全部改成裸名（`--primary` / `--radius` / `--font-size` / `--filter`），写侧统一走 `convertToHslCssVar()`，读侧统一 `hsl(var(--x))`。
  - **`--radius` 只留 rem 一档口径**：`--app-border-radius` 时代 px 与 rem 混写过，根字号一缩放就出现"文字变了圆角没变"，默认字号下量不出来。现在 `--radius: 1rem`，`--radius-*` 全部按倍率派生（`--radius-lg: var(--radius)`），单位口径由 `design.test.ts` 钉住而不是靠人记。
  - **顺带修掉一条静默回归**：`@antdv/design` 入口的 10 行 `@source`（登记 `packages/**` 里的组件包源码）在 `071dad02` 被删了。Tailwind v4 的自动内容检测从**构建根** `apps/web` 起扫，`@antdv/*` 全在仓库根的 `packages/` 下（软链进 node_modules 也在检测范围外），少登记一个包 = 那个包模板里的工具类一条都不生成。症状不是"样式丑"而是"弹窗/抽屉不定位"：`fixed top-[50%] left-[50%] translate-y-[-50%]` 这些任意值类不存在，元素退回静态位置（top:auto 落到文档流里），6 条 e2e 报 `element is outside of the viewport`，构建全程零报错。恢复登记 + 浏览器复核（modal 包围盒回到 top≈43/left≈380，提交按钮 hit-test 命中自己）。

  测试口径：

  - `design/__tests__/design.test.ts` 32 条整页重写口径：不比"看着有这条变量"，而是逐条断言**值必须是通道形状**（`/^[\d.]+ [\d.]+% [\d.]+%(?: \/ [\d.]+)?$/`）、明暗两套不许同值、`--color-*` 一律导出成 `hsl(var(--x))`、全站源码不再出现 `--app-`。别名层那条用例换成这条更强的一致不变式。
  - `apps/web/e2e/preference-effects.spec.ts` 里原来那条"规范名与别名同源"的用例，在改名后会退化成 `--primary` 和 `--primary` 自己比（恒真）。改成钉两件事：`<html>` 上的计算值是通道串，而 `bg-primary` 这类工具类**画出来的颜色**等于当场用 `hsl(var(--primary))` 算出来的颜色 —— 后者只有在工具类生成的是表达式而非常量时才成立，所以换预设、切深色之后各比一次才有效。浅色→橙黄→深色三段分别钉 `rgb(250, 84, 28)` 与 `rgb(251, 146, 60)`，正是"`.dark` 里抄了字面量"这种回归的探测器。

- abfe730: fix: 换主题色真的换色，不再只有 CSS 变量在动

  现象：设置面板 → 外观里点橙黄色，`--ant-color-primary` 变了（所以 Tailwind 的 `*-ant-primary` 那批类跟着变，标签页选中态、欢迎页文字是新的），但侧栏**选中的父级菜单**、表格里 `type="link"` 的操作按钮、输入框聚焦光晕**全还是蓝的**。用户看到的就是"主题色只生效一半"。

  - **根因不在设置面板，在主题常量**：`packages/preferences/src/theme/` 里约 78 处按 Tailwind 蓝写死的颜色，钉住的恰好是**本该由算法从种子色派生**的那些键 —— `colorPrimaryHover/Active/Bg/Border/Text*`、`colorLink*`、`controlItemBgActive(+Hover)`、 `controlOutline`，以及组件层的 `Menu.itemSelectedColor/itemSelectedBg/subMenuItemSelectedColor`、 `Tabs.inkBarColor`、`Button.defaultHoverColor`、`Select/Cascader.optionSelectedBg`、 `Pagination.itemActiveColor`。alias token 一旦被显式赋值，`defaultAlgorithm` 就不再生成，用户选的颜色被覆盖在下面 —— 换多少个主题色都是徒劳。
  - **修法是把派生权交还 antd，而不是再算一套色阶**：这些键从 token/组件常量里删掉，由 `defaultAlgorithm` 按种子生成十档色板再取用。比"写个 primaryRamp 自己派生"好在三点：零颜色数学、hover/active/outline 等十来个状态自动齐、以后换 antd 版本不会跟我算的不一样。改动只留 `colorPrimary` 与 `colorLink` 两个种子键（暗色同理，`darkAlgorithm` 会替深底另挑一档，不需要我手工调色）。
  - **`colorLink` 是唯一必须自己接上的**：antd 把它绑在自己的 `#1677ff` 上而不是 `colorPrimary`，所以 `getAntdTheme()` 收到 `primaryColor` 覆盖时同时写 `colorPrimary + colorLink`，否则 `type="link"` 按钮、超链接、Typography 可点文字永远不跟主题—— 正是用户点名的第二个失效点。

  测试口径：

  - 单测（`packages/preferences/__tests__/theme.test.ts`）不只是断言"传进去的值等于返回的值"，而是用 `theme.getDesignToken()` 把返回配置喂给算法，断言**解析后的派生色真的变了**，并且与"只给种子、不写任何覆盖"的算法答案一致；再加两条回归网：token 常量与组件常量里都不许再出现这批主色键（列出 14 + 16 项），防止以后有人图省事又钉回去。
  - 端到端（新增 `apps/web/e2e/theme-primary.spec.ts`，三引擎各跑一遍）只认**浏览器算出来的颜色**：计算样式是唯一能同时穿过 token、CSS 变量、组件样式三层说话的判据。选中父级取 `.ant-menu-submenu-selected > .ant-menu-submenu-title`，link 按钮显式点名「详情」而不用 `.ant-btn-link.first()` —— 同一操作列里的「删除」是 danger，走 colorError 派生链，拿它当主色判据会假红。第二条用例选完颜色刷新，验证"持久化"不止是存进 store。
  - 顺带补了 `utils/app.ts` 的跨引擎噪音分类（详见上一条 changeset 语境）：firefox/webkit 的"请求被中止"措辞与 Chromium 不同，`page.reload()` 掐断在飞的懒加载 chunk 会被当成页面错误。新增 `requestCancelled()` 按各家措辞丢弃，并把"外站资源加载失败" 与"本站请求中止"分开判，不再靠猜。

- Updated dependencies [5194446]
- Updated dependencies [f740d13]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [54d880b]
- Updated dependencies [abfe730]
- Updated dependencies [d8fa761]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
  - @antdv/shared@0.1.0
  - @antdv/utils@0.1.0
  - @antdv/types@0.1.0
