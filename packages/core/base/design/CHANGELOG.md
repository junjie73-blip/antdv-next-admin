# @antdv/design

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

### Patch Changes

- f740d13: fix: 能点的盒子都有可点光标，禁用的不再装成能点

  现象：不少地方"盒子已经亮了、鼠标还是箭头" —— 设置面板的主题色块与布局磁贴、通知面板的按钮、Markdown 工具栏、分片上传的操作键、评分星、上传拖拽区；反过来也有"已经灰掉了、光标却还是能点的样子"。用户归纳成一句话： **能 hover 的盒子都需要带上 cursor**。

  - **根因是 UA 默认值，不是谁写错了样式**：浏览器给 `<button>` 的是 `default` 光标（只有 `<a href>` 才自动 pointer），而本项目可点的"盒子"绝大多数是手写的 `<button type="button">`。以前靠逐个模板补 `cursor-pointer` —— 79 处里对的需要 35 处，漏的那些就是用户看到的。模板写法管不住新页面，所以规则搬到样式层一次接上。
  - **写在 `packages/design/src/base.css`，且不新增文件**：`@antdv/design` 的入口是**原始 CSS** （无编译步骤，`main.ts` 直接 `import '@antdv/design'`），Tailwind v4 在应用构建时处理；再加一个 `cursor.css` 就得动 `index.css` 的 `@import` 清单，而那份清单有契约用例钉着 ——不值得为四条规则引发一次包边界变更。
  - **规则按"可点性的来源"分三档**，而不是罗列 class 名：
    1. `button:not(:disabled)` / `button:disabled` → pointer / not-allowed； `input[type=checkbox|radio]`、`select` 同理（antd 的 hover 反馈做在外层盒子上，光标却归元素自己）。
    2. 带 ARIA `role` 的自定义控件（评分星的 `role="radio"` 等）→ pointer， `[aria-disabled=true]` → not-allowed。role 属性本身就是在宣布"这里能点"，antd 只把光标写在外层 `<li>` 上，鼠标真正停的那层是 `default`。
    3. antd 自己漏的上传触发区 `.ant-upload`（里面包的是 `<span>` 不是 button）， `ant-upload-disabled` 给 not-allowed。
  - **antd 已有的规则不会被盖掉**：它的选择器是 class（特异度 0,1,0），这里写的是元素/属性选择器，所以只补空位。实测 loading 按钮（`ant-btn-loading`）仍是 `default` —— 点了没意义，这是 antd 故意的，扫描也把它当已知项跳过。
  - **`Select` 不用管**：这个版本的 antdv-next 把可点的 combobox 渲染成 `<input>`，只读时 antd 已给 pointer、可搜索时是 text（该是文本光标），实测三种状态都对。

  留了两处"看着能点、其实点了没反应"的例外并写进清单，因为它们**该**是箭头：card-list 的 KPI 卡与瀑布流卡只有装饰性 hover 抬升，设置面板的开关行 hover 描边框是"帮你找到行尾那个开关"，可点的是开关本身。给它们 pointer 是在撒谎。

  测试口径（新增 `apps/web/e2e/cursor.spec.ts`，三引擎各跑一遍）：

  - 断言的是**浏览器算出来的光标**（`getComputedStyle().cursor`），不是模板里有没有写那个类 ——类名断言只能证明"有人写了字"，证明不了它生效、也证明不了没被 antd 盖掉。
  - 一张"该是指针的可点件"清单，每条先 `toBeVisible()` 再断言 pointer：选择器写错或那个控件从页面上消失了要红，不能静默跳过。
  - 禁用态单独一条，并**同页反证**可用按钮是 pointer，否则"整页都写了 not-allowed"也能让这条假绿。
  - 兜底扫描遍历可见元素：`<button>`/`<a>`/带交互 role/带 `hover:bg-*|hover:outline-*|hover:shadow` 的盒子，光标不能是 `auto|default|text`，命中就把 `outerHTML` 打出来。例外必须写进 `DECORATIVE_HOVER_ALLOWLIST`（按 class 前 4 项匹配）或带 `data-setting-label`，以后新增"装饰性 hover 盒子"要么登记、要么补上 click，不能靠扫描看不见它糊过去。
  - 红绿都验过：把 `button:not(:disabled)` 那条规则临时改名停用后，四条里立刻红三条，装回即绿。webkit 整跑时导航等待从默认 20s 提到 40s（dev 按需编译重型路由 + 前序引擎挤掉编译缓存的纯计时问题，单跑即绿），只改这一处、不动全局 expect 超时。

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

- 2f1a233: fix: 补回被重排时删掉的 `@source` 名单，IconPicker 面板接住可用高度，FDatePicker 的区间占位允许数组

  三条都是"构建绿、页面也渲染，只是某样东西静默不见了 / 不定位"的同一类失效，共用这一批三引擎验证，所以并成一个 changeset。

  - **`@source` 整块没了（`packages/core/base/design/src/index.css:46-55`）**：071dad02 重排这个文件时把十行 `@source` 一起删掉了。构建根的自动内容检测只扫得到 `apps/web`，`@antdv/*` 全在软链后面，所以少登记不等于报错 —— 消费方读的还是上一轮 `dist` 里的 CSS，构建、类型检查、页面渲染全部照常，只有那个包模板里的工具类一条不生成（浮层不定位、圆角间距消失）。这次按 `git show f64fc3ac` 原样补回十行，并在名单上方写清"必须与 `packages/core/ui-kit/*` 目录一一对上"。守门测试本来就在（`design/__tests__/design.test.ts` 的「每个子包的源码目录都登记了 @source，且登记路径解析得到真实目录」、`hooks/__tests__/boundary.test.ts` 的「@source 名单只属于 design」），漏网的原因是那一轮没有按仓库口径单文件复跑守卫测试。
  - **IconPicker 面板高度（`packages/core/base/icons/src/icon/IconPicker.vue:281-289`）**：面板原本是"净高 360 + 工具栏 + 分页"的固定高度，`PopoverContent` 没有接 reka 挂在 `--reka-popover-content-available-height` 上的可用高度，从别的页面跳进来时（触发器到视口底只剩 400 出头）底边顶出视口，多出来那截看不见也点不到，常规视口下的用例碰不到它。改成 `max-h-(--reka-popover-content-available-height)` 并把面板排成 `flex-col`：工具栏与分页 `shrink-0`、网格 `min-h-0 shrink`。
  - **FDatePicker 的 `placeholder`（`packages/core/ui-kit/form-ui/src/fields/FDatePicker.vue`）**：prop 声明的是 `string`，而全站四处区间用法（表单示例页、操作日志、登录日志）实际都传 `['开始时间', '结束时间']`。运行时只有一条 `Invalid prop: type check failed` 告警，文字照旧显示，所以构建与类型检查都不拦。放开成 `placeholder?: string | string[]`，数组按两端用 `-` 合成，空串与空数组才回落到内置文案（区间是 `开始日期 - 结束日期`）。合成串与两侧默认串互不相同，判据本身就是反证：传入被忽略会掉回默认串，拼接写错也不会等于任何一侧。

  验证：

  - 守卫测试：`design.test.ts` 32 条、`boundary.test.ts` 8 条全绿（含上面两条 `@source` 判据）；`npx turbo run test:unit --filter=@antdv/{icons,form-ui,design,hooks} --concurrency=1` 20/20 任务绿，其中 `hooks` 10 文件 / 106 条、`form-ui/__tests__/fields.test.ts` 31 条（新增 `fDatePicker` 5 条：数组合成、空数组回落、空串回落、单值字符串原样、传数组不再打 prop 告警）、`icons/__tests__/icons.test.ts` 6 条。
  - 端到端三引擎各 10/10：`icon-picker` 6 条（新增「矮视口下面板完整落在视口内」：560 高视口下量面板盒子，上下都必须在视口内且高度 > 120、网格仍是整页 108 格）、`popup-anchor` 2 条、`f-date-picker` 2 条（新增 spec，钉住数组占位的合成文案与"控制台没有 `Invalid prop` 告警"）。chromium 是四次定向跑合起来的 10/10，firefox 与 webkit 各一次整跑。
  - 新用例都过了反证。矮视口那条：临时把面板的 `max-height` 剥成 `none`，实测 `y=136 h=479 bottom=615` —— 判据在没修复的版本上会真的报溢出，不是一条永远绿的空检查（探针 spec 跑完即删）。`popup-anchor` 的浮层判据自带反向对照（剥掉 `z-50` / `bg-popover` / `shadow-md` 必须三条都报）。
  - e2e 侧顺手修掉一条假红：菜单是模态层，打开后 reka 会给层外的一切（含触发器本体）挂 `aria-hidden`，可访问名字随之消失，`getByRole('button', { name: '标签页操作' })` 在"点得到"之后到了"量不到"。测量改锚在组件自己的钩子类 `button.tab-actions-trigger` 上，名字对不对仍由 `tabs.spec.ts` 那条负责；同文件 `CHECK` 的参数类型改成 `page.evaluate` 真正传进去的 `(HTMLElement | SVGElement)[]`。`pnpm exec tsc -p e2e/tsconfig.json --noEmit` 本轮三个 spec 零错（`layout.spec.ts:628` 的 `row.dataset` 是存量类型错，不在本轮改动面上，未动）。

- 54d880b: build: 全部子包统一走完整 `build`（编译 + 打包 + 产物校验），消灭 stub-only 与热更新混配

  要求（用户原话）："所有子包必须统一采用完整构建（build）的编译打包方式，严格禁止出现部分子包使用 build 构建、部分子包使用热更新（hot reload/hmr）的混合配置情况"。落地口径按已确认的方案 —— **统一构建标准，保留源码消费**：每个包都有一份真 build 并纳入全量构建与检查，dev 期间仍由宿主应用的 dev server 直接吃源码，子包级热更新不退化。

  - **15 个按源码发布的包补上真 build**：`packages/**` 的组件与工具包（含 `@antdv/icons`）一律 `vite build`，各自的 `vite.config.mts` 只有一行 `defineLibraryConfig()`。此前它们的 `build` 是一句 `echo`，产物从没被真编译过 —— 包里的 SFC 编译错误、缺失依赖、`exports` 漏配都要等别人 import 时才现形。
  - **入口从 `exports` 推导，不再写死 `src/index.ts`**：`resolveLibraryEntries()` 读包自己的 `exports` 映射（`./*` 通配按同一模式去 glob 展开），加一个子路径导出，构建自动覆盖到它。只认 `src/` 下的源文件，指向 `dist` 的子路径（按产物发布的那批包）不进这条链路。
  - **`antdv:validate-dist` 兜住"构建绿了但产物残缺"**：`writeBundle` 逐条核对每个入口的 `dist/<name>.js`（样式入口查 `.css`，开了 `dts` 再查同名 `.d.ts`）既在产物表里也真落盘，缺一条就 `this.error` 并点名是哪个公共子路径。子包平时按源码被消费、`dist` 没人读，这层校验是标准里唯一能自动兜住的部分。
  - **库形态的插件链裁到最小编译链**：`createPlugins(mode, { kind: 'library' })` 不再挂自动导入 / iconify / svg-icons / imagemin / 文件路由 / Layouts / i18n / Inspect。这些插件都按"宿主是一个应用"的前提工作 —— 扫 `src/views`、往 `cwd/types/*.d.ts` 回写声明、要求 `@iconify-json/*` 与 `src/assets/icons` 存在；子包按自己的目录构建时前提全不成立，实测 `@antdv/enums` 在配置加载期就抛 `Please install "@iconify/json" or "@iconify-json/*" package`。两种形态现在共用 SFC / TSX / Tailwind 这一段，其余按形态分家。
  - **`dts` 默认跟随 `types` 指向**：只有 `types` 指进 `dist` 才生成声明文件。按源码发布的包（`types: ./src/index.ts`）生成那份 `.d.ts` 没有读者，类型面归各自的 `type-check`，重复出一份只把构建时间翻倍 —— 实测 `@antdv/menu-ui` 27 s → 7.5 s。
  - **`@antdv/design` 从"没有 build"变成真出产物**：纯样式包走 `entry: 'src/index.css'` 并显式 `cssCodeSplit: true`（lib 模式默认 `false`，而那个模式下 Vite 直接拒绝 CSS 入口），产出 `dist/index.css` 277 kB，顺带证明 `src/css/*.css` 里的 `@apply` 级联编译得动。
  - **5 个只有 `stub` 的包换成真 build**：`@antdv/eslint-config`、`@antdv/oxfmt-config`、`@antdv/oxlint-config`、`@antdv/vsh`、`@antdv/turbo-run` 删掉 `stub`，`build` 改为 `pnpm exec tsdown`（各自 `tsdown.config.ts` 已带 `clean: true, dts: true`）。`@antdv/node-utils` 的 `stub` 作为加速手段与真 `build` 并存。根 `postinstall` 随之从 `run stub` 改成 `--filter ./internal/** --filter ./scripts/** run --if-present build`。
  - **标准变成可跑的守卫**：`scripts/check-uniform-build.mjs`（零依赖）查四件事 —— 每个包都有 `build`（没有可编译内容的 3 个预设包写进例外清单并附理由）、`stub` 不能是唯一构建方式、`exports` 指 `dist` 的包必须把 `dist` 列进 `files`、按源码发布的包不许挂自己的 `dev` / `watch`（热更新归宿主应用）。已排进 `pnpm check`，不过那条链现在会在 `check:type` 处短路，所以日常按 `pnpm check:builds` 单跑。

  验证：`pnpm build` 全量 31/31 成功（3 m 57 s；此前只有按产物发布的包与应用参与）；`pnpm turbo run test:unit --concurrency=1` 只有 `common-ui/cron-editor` 一条红，是仓库里已记录的机器负载超时假红（整跑 5621 ms 撞 5 s 上限，空闲单跑同一用例 2054 ms 通过，同批 290 条其余全绿）；`@antdv/vite-config` 单测 70 条全绿，其中新增 `__tests__/library.test.ts` 12 条覆盖入口推导 / 产物推导 / 校验器，`__tests__/plugins.test.ts` 由"两种形态共用同一条链"改成钉住"应用形态带宿主插件、库形态只留编译链"；`node scripts/check-uniform-build.mjs` 通过；dev server 与 `apps/web` 生产构建两侧都跑通（登录 → 工作台 → 组件示例）。文档在 `docs/guide/essentials/development.md` 新增「子包统一构建标准」一节，en 镜像与 `docs/zh` 副本同步。

- c1e9020: fix: 链接的光标不再靠浏览器内建样式表（WebKit 静止态算 `auto`），并修好 WebKit 专属墙钟其实从未生效这件事

  背景：本轮 `BasicTable` / `BasicForm` 重构按"三引擎都绿才算绿"的口径整跑端到端时，`e2e/cursor.spec.ts` 在 webkit 上红了两条。两条都不是这次改动带进来的，但都归到这一条 changeset 里，因为它们会一直制造"看起来像重构改坏了"的假红。

  - **链接光标（真缺陷，只在 Safari 内核现形）**：全站兜底扫描报 `/system/user` 的面包屑"系统管理"与顶栏的 GitHub 链接算出来是 `cursor: auto`。用一份最小页面探针复跑两个引擎：同一个裸 `<a href>`，Chromium 的 UA 样式表给 `pointer`，WebKit 静止态给 `auto`（`class="cursor-pointer"` 那种显式声明两边都是 `pointer`，差异纯粹来自内建样式表）。所以这不是"Safari 抽风"，而是**我们只在 Chromium 上验过**。修法按 `design/css/base.css` 的既有主张来 —— 能点的元素自己在样式层写死，不赌 UA 默认：新增 `@layer base { a[href] { @apply cursor-pointer; } }`。**必须待在 `@layer base` 里**：这个文件其余光标规则是无层级的，层外规则压过全部工具类，链接要是也写层外，`<a class="cursor-not-allowed">`（禁用态下载链接这类显式表态）就会被盖掉。守门断言同步进 `design/__tests__/design.test.ts` 的光标那条。
  - **WebKit 的 240s 墙钟从来没生效（假红发生器）**：`playwright.config.ts` 里 WebKit 的 `timeout: 240_000` 写在 `use` 里 —— `use` 装的是 fixture 选项，`timeout` 不在其中，于是它既不报错也不生效，实际执行的仍是顶层 `timeout: 90 * 1000`。失败信息里的 `Test timeout of 90000ms exceeded` 就是证据：注释里"webkit 单跑立刻绿、只放宽墙钟不动单步超时"这条经验一直没落地。改成项目级字段（`TestProject.timeout`），`actionTimeout: 45_000` 保持在 `use` 里不动 —— 它是真的 fixture 选项，各步 15s/45s 的判据一个没改，功能真坏了仍然立刻红。

  验证：`@antdv/design` 单测 `__tests__/design.test.ts` 32/32（含新断言：`a[href]` 的 `@apply cursor-pointer` 必须在 `@layer base` 块内）；`e2e/cursor.spec.ts` 单跑 `--project=webkit` 4/4 绿（此前 2 红），首条用例 54.5s —— 在旧配置下就是被 90s 墙钟咬死的那条；chromium / firefox 复跑结果见下。
