# @antdv/shared

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

- f740d13: feat: 组件示例按 vben 的分类补齐四页，并把示例里的 API 用错处一次性修掉

  诉求：**"组件示例中可以参考 vben 的示例"**。范围按之前确认的口径收敛为 **"只做不引新依赖的一批"** —— 全部用本项目已有的 antdv-next / `@antdv/ui` / `@antdv/directives` / `@antdv/shared`，不新增任何依赖。

  ## 新增的四页

  | 路径 | 内容 |
  | --- | --- |
  | `/components/overview` | 卡片墙总览：清单**直接来自菜单**（不自己抄一份），可按名称/路径过滤，点卡片是真链接（走外壳标签页），无匹配给空状态 |
  | `/components/feedback` | message / modal / popconfirm / notification / progress / result / watermark / alert |
  | `/components/data-display` | descriptions / avatar / badge / segmented / tabs(editable-card + card) / collapse / timeline / steps / image / statistic / table |
  | `/components/directive` | `v-permission` 判定矩阵 / `v-loading` 三种遮罩 / `v-lazy` 图片墙 / `v-safe-html` + `v-escape` |

  菜单在 `apps/backend-mock/server/api/menus.get.ts` 里挂了「反馈与工具」这一组，所以总览页与全站巡检都会自动带上新页，不需要改第二处。

  ## 示例页本身暴露出来的真 bug（都是"页面照样渲染、点了没反应"那一类）
  1. **`import { useApp } from 'antdv-next'` 会让路由直接废掉**。1.6 的根导出是 `_default as App`（`App.useApp` 挂在它上面），**没有具名的 `useApp`**：写成具名 import 后 ESM 报 `does not provide an export named 'useApp'`，异步块加载失败 →导航中止，表现是"点了菜单没反应"，控制台之外没有任何提示。改成 `const { message, modal, notification } = App.useApp()`。
  2. **Notification 的标题字段是 `title`**，不是 React antd 那边的 `message`。写错不报错，只是标题整块空着。
  3. **`<script setup>` 会把模板表达式里的 ref 自动解包**：`@click="flashLoading(boxLoading)"` 传进函数的是 `false` 而不是 Ref，于是 `target.value = true` 抛 `Cannot create property 'value' on boolean 'false'`，遮罩永远不出现。改成「键名 + 一个 `reactive` 记录」，并把这段坑写进页面注释（示例页是别人抄的模板）。
  4. **`role` / `admin` 是参数（arg）不是修饰符**：`v-permission:role="'auditor'"`、 `v-permission:admin` 才走角色与超管通道，写成 `.role` / `.admin` 判定根本不读。 `@antdv/directives` 的 JSDoc 之前教的就是错的那一种，一并改了 —— 文档错比代码错传播得快。（`.all`、`.disabled` 才是真的修饰符。）
  5. **`v-escape` 在 html 语境下做了二次转义**（`@antdv/shared`）：`textContent` 本身就不会把内容解析成 HTML，再跑一遍 `escapeHtml` 只会让用户看见 `&lt;script&gt;` 这种字面量。现在 html 语境直接落原文，其余语境（url/js/css/attr）仍按语义变换处理。注意 `packages/*` 是**从 `dist` 消费**的，改完 `src` 必须 `pnpm --filter @antdv/shared build`，否则浏览器里跑的还是旧产物。
  6. **Tabs 1.6 没有 `add` 事件**，只有 `edit(key | MouseEvent, 'add' | 'remove')`。
  7. **三个不存在的图标名**被 `test/icon-names.test.ts` 抓出来（`carbon:voice`、 `carbon:command`、`carbon:trend-up`）—— 这类错界面上只是"图标格子空白"，单测与巡检都看不见，靠这条对账才钉住。换成 `carbon:notification-new`、 `carbon:terminal`、`carbon:arrow-up`。

  ## 顺带记下的 antdv-next 1.6 DOM 事实（写断言时踩过的）
  - Timeline 是**拿 Steps 的 DOM 实现的**：每个 `.ant-timeline-item` 同时挂着 `ant-steps-item`，所以页级 `.ant-steps-item` 数到 12 而不是 4，断言要圈进卡片。
  - 线形进度条换成 `rail / track / indicator` 三段，旧的 `.ant-progress-bg` 没了；百分比在根节点的 `aria-valuenow` 上。
  - `editable-card` 会渲染**两个** `.ant-tabs-nav-add`（常驻 + 溢出收纳区）。
  - 切换后旧面板只是 `ant-tabs-content-hidden`，仍留在 DOM 里，取内容要用 `[role=tabpanel][aria-hidden=false]`。
  - message 的 wrapper 与 notice 两层都带 `ant-message-<type>`，按类名选会命中两个。
  - 两个汉字的按钮可访问名会被写成「成 功」（中间插空格），`getByRole({ name: '成功', exact: true })` 选不中，e2e 用 `\s*` 容忍。

  ## 门禁
  - 新增 `apps/web/e2e/gallery-examples.spec.ts`：13 条，覆盖四页的交互契约（总览过滤后点进去并激活标签页、message/modal/popconfirm 真的出现又消失、进度条真的在涨、子组件写法 `<a-descriptions-item>` / `<a-collapse-panel>` / `<a-timeline-item>` 的内容真的渲染出来 —— 组件解析失败只出 warning，表现为那块是空的、巡检看不出来）、权限矩阵逐格翻正、三种遮罩、懒加载 5/6 与坏地址回退、safe-html 四类载荷进不去而白名单能收窄、四页来回切不留脏状态。
  - `site-sweep.spec.ts` 的**兜底页判定修掉一处假阳**：巡检靠"内容区文本里有没有 `页面不存在`"抓死链接，而示例页正好把 404 的 `a-result` 当素材摆在 `a-card` 里，于是把好页面判成兜底页。改为**跳过卡片内的文字**（真兜底页是裸的 h1/p），并补一条正反两例的用例同时钉住假阴与假阳。

  ## 验证
  - 单测：`pnpm test:unit` 21/21 任务、web 包 28 文件 / 258 条全绿（`packages/shared/__tests__/xss.test.ts` 跟着新口径改了断言）。
  - 端到端（三引擎，`--workers=1`）：
    - chromium：`gallery-examples` 13/13，`site-sweep` 2/2。
    - firefox：`gallery-examples` 13/13，`site-sweep` 2/2。
    - webkit：`gallery-examples` 13/13；`site-sweep` 首跑把 `/system/user` 判红—— 现场快照停在上一个页面（实时监控大屏，它自己还在跑定时器），标签页始终没冒出来，也就是**导航还在路上而不是页面坏了**。巡检是"每页都能打开"的存在性检查，不是性能闸门，所以只给这个引擎放宽一档（每页预算 25s、激活等待 60s），Chromium / Firefox 保持 15s / 20s，真退化仍然立刻红。放宽后 webkit 2/2 绿。
  - 新增 `apps/web/src/views/__tests__/gallery-api-usage.spec.ts`：静态守卫三类"静默失效"的API 写法（具名 `useApp`、`v-*.role` / `v-*.admin` 修饰符、`<a-tabs @add>`），每条规则都配"必须命中"与"不许误伤"两组样例 —— 只断言 0 命中的守卫，正则写错时同样是0 命中，会静默变成一条永远绿的空检查。
  - Lint：改动的页面、包源码与两份 spec `eslint` 干净。
  - 未处理：`pnpm type-check` 仍有 **253 条存量错误**（`components/business/**`、 `api/mock.ts`、`security/dashboard/**` 等，均非本批文件；本批四个页面与 spec 零错误）。是否把它纳入 CI 门禁，等 #54 那条一起定。

- abfe730: fix: 导航与面包屑这一轮 —— 把"菜单里画的"和"顶栏里显示的"接回同一份数据

  用户这三句话是同一件事的三个切面："面包屑的图标和菜单栏的图标对应不上"、"菜单的样式有点问题"、"第一次进入页面，面包屑不会自动加载上去"。根子都在**渲染侧各自去不同的地方取数**：面包屑读路由 `meta`，菜单读后端菜单树，图标名又散在两边写死。这一轮把真相收敛成一份，并给每处补了能钉住契约的测试。

  - **面包屑的数据源换成"菜单链优先"**：原先只从 `route.matched` 取 `meta.title`，而文件约定路由只有**叶子**声明了 meta，父级布局记录没有标题 —— 链被砍成一格，再撞上"仅一级时隐藏"这条默认偏好，整条面包屑就不渲染了。表现正是"第一次进页面没加载出来"：登录后落地的那一屏、以及任何页面刷新后的第一帧都是空的，要到别处再回来才有。现在先按 `name`（再按 `path`，容忍约定路由的尾斜杠）在菜单树里反查祖先链，查不到才退回 `matched`，菜单里画了几级就显示几级，隐藏页也能反查到归属。
  - **图标逐节点取，删掉两处兜底**：`LayoutBreadcrumb` 曾给第 0 级画"房子"、其余无图标时画"文件夹"，等于渲染侧替数据编故事 —— 导航根节点是 `carbon:dashboard`，面包屑却是房子，看到的"对不上"就是这么来的。现在每一级只用自己的 `icon`，没有就不占位。配套把页面标题与菜单标题对账（`分析面板` / `实时监控大屏`），两边名字不同源时"对不上"会以另一种形式复现。
  - **面包屑每一级的链接指向自己那一页**：antd 的 `items[].path` 语义是 "把前面每一级的 path 拼到当前这一级"（库注释原话 `It will concat all prev path to the current one`），而我们的菜单 path 本来就是完整路径，于是"系统管理 / 用户管理"被渲染成 `#/system` 与 `#/system/system/user` —— 中键、右键新开、状态栏预览指向一个不存在的地址。改成传 `href`（`router.resolve` 生成，hash / history 模式都不用改），外链原样交给浏览器，顺带把 `isExternalPath` 抽成 `@antdv/shared/menu` 的单一判定入口（归一化与拼接都改问它）。
  - **侧边菜单的层级缩进与图标对齐**：antd 的 inline 缩进是**内联** `padding-left`，类选择器压不过内联样式，原先那条 `[&_.ant-menu-sub_.ant-menu-item]:pl-12` 从写下起就没生效过（已删）；层级现在统一由 `inlineIndent = 16` 决定。图标占位另有一处死代码：针对 `.anticon` 的规则对本项目 `<Icon>`（`@iconify/vue` 渲染 span，不带 anticon 类）永不命中，改成 `.ant-menu-item-icon`。 `buildMenuItems` 新增 `keepIconSlot`：侧栏里没图标的项也补一个空槽，宽度由 antd 的 icon token 托管（与真图标严格等宽），整列文字左边缘因此在同一条竖线上；顶栏横向导航不开这个开关 —— 那里白留一格会挤掉一个菜单项，溢出时更明显。
  - **折叠入口挪到侧栏底部**：放在顶栏时要点到屏幕右上角才能收起"左边这一列"，动作和目标隔着整个屏幕。现在是贴着这一列底边的一条横杠（带 `aria-expanded` / `aria-label`），浮层形态（窄屏抽屉）不渲染，抽屉没有"折叠"可言、开合由抽屉负责；侧栏常驻的形态顶栏就此不再重复给按钮（两个按钮管同一个状态必然漂移）。
  - **图标名对账**：`<Icon icon="carbon:xxx" />` 写错名字**不报任何错** —— 构建期查不到就渲染成空 span，运行时取图则变成一次常被 CORS 挡掉的网络请求，于是"有的项有图标、有的整格空白"。本轮巡检前仓库里有 45 个不存在的图标名。新增 `test/icon-names.test.ts` 静态扫描源码与 mock 菜单种子数据里的每个 `collection:name` 字面量，逐个核对是否真在已装的图标集里。

  测试口径（这一轮的验收都指向"两边同源"而不是"看起来还行"）：

  - `packages/shared/__tests__/menu.test.ts` 45 条：新增 `keepIconSlot` 正反两向契约（空槽必须是裸 span、有图标的不能被覆盖），以及 `isExternalPath` 的内外链判定。
  - `packages/layouts/__tests__/breadcrumb.test.ts` 12 条：菜单链优先、"只有叶子声明 meta.title 时不许砍掉父级"、菜单未加载时才退回 `meta.title`、按 path 反查（容忍尾斜杠）、隐藏页反查、无名字节点不占一格。
  - `apps/web/test/menu-icon-slot.test.ts`：把 antd `Menu` 真挂起来数 DOM —— "空 span 会被打上 `.ant-menu-item-icon` 并取得等宽"这条前提属于 antd 的实现，只看"我传了个渲染函数"的单测盖不住。
  - `apps/web/e2e/layout.spec.ts` 32 条（原 25 条）：登录落地首屏与刷新后首帧的完整链、面包屑 href 与"点父级不掉进拼错的地址"、按标题把面包屑图标与菜单图标逐项比对（比 `svg` 字形而不是图标名），同层菜单文字左边缘对齐、底部折叠条的收起/展开与宽度回弹、常驻形态顶栏无重复入口而窄屏抽屉仍然有。
  - 其中两处断言按**等稳**而不是"加延时"写：折叠后的宽度在 CSS 过渡里会连续变， `settledWidth()` 要连续两次采样相等才读值；同层文字对齐必须先把不可见副本（`width === 0`）滤掉 ——这两条单独跑常常躲得过、全量并发跑就红，属于时序假绿，判定条件因此写成"停住了才读"。
  - Chromium 全量 87 条 e2e 与仓库单测在收尾时复跑，结果见交付说明。

- f64fc3a: refactor: 清掉仓库里残留的 vben 命名，上游归属统一写成 `vue-vben-admin`

  用户提的"全面清理 vben 相关的关键字、引用和依赖"。口径是**代码 + 文件名 + 文档措辞都改，外部事实保留**：仓库现在 34 个包全在 `@antdv/*` 下，`vben` 这个词既不是包名也不是标识符，留着只会让人以为还有一套 `@vben/*` 依赖。

  - **标识符与文件名**：`form-ui` 的 `use-vben-form.ts` → `use-antdv-form.ts`（`src/index.ts`、`types.ts`、`useForm.test.ts` 三处引用一起改）；`@antdv/oxlint-config` 的类型 `VbenOxlintConfig` → `AntdvOxlintConfig`；`@antdv/vite-config` 注入的应用元数据键 `__VBEN_APP_METADATA__` → `__ANTDV_APP_METADATA__`；`vsh` 的 `code-workspace` 产物名、`check-dep` 的忽略名单（原来按 `@vben/*`、`@vben-core/*` 匹配，本仓库根本不存在这两个 scope，等于空转）、pnpm catalog 用例的临时目录前缀、`build-local-docker-image.sh` 的镜像名全部换成 antdv。
  - **eslint 的包边界规则**：三条按 `@vben/*` / `@vben-core/*` 写的 `no-restricted-imports` 从来匹配不到本仓库的任何 import，替换成一条真正生效的规则 —— `files` 是 base 层（`packages/core/base/**`、`packages/enums/**`、`packages/utils/**`），forbidden 分组逐个点名 ui-kit / effects / app 的包（因为只有一个 scope，没法用 scope glob 划边界），并显式放行 `@antdv/shadcn-ui`。`sort-interfaces` 的豁免 glob 也顺手收窄到实际需要的三个目录。
  - **`perfectionist.ts` 只做删除**：把两组从来没用上的 `antdv` / `antdv-type` 自定义分组去掉。留着的代价是 `newlinesBetween: 1` 会要求每个新分组两侧都空一行，一改就牵动全站 570 个文件的 import 排版；核对方式是把 config 改动前后的 `eslint .` 结果对拉 —— 1627 = 1627，逐条规则计数差 0，证明这次删除是行为等价的。
  - **`turbo-run`**：删掉两段死代码（`findApps` 和写死 `@vben/website` 的分支）。
  - **文档与注释**：README（中英）、`docs/components/form.md`、`docs/*/guide/in-depth/{composables,common,check-update}.md` 里的 `vben` 措辞改成 `vue-vben-admin`，源码里作为上游归属的注释同理（`vite-config`、`tabs-ui/constants`、`useDataSource`、`permission/utils`、`LayoutSider`）。**保留不动的外部事实**：`doc.vben.pro` 链接、`.sync-state.json` 里的 `vbenjs/vue-vben-admin` 同步配置、历史 changeset 里引述用户原话的那两处。
  - **`shared`/`utils` 的注释纠偏**：`--ant-color-primary` 那句"组件里 39 处在用"已经不成立（全站 `var(--ant-*)` 读取点为 0，仅剩写侧兼容），改成如实描述。

  顺带一个类型层修复：`apps/web/tsconfig.app.json` 显式抬高 `lib` 到 `ESNext`。`@vue/tsconfig/tsconfig.dom.json` 的 lib 停在 ES2020，比本仓库 `@antdv/tsconfig`（ES2022）低，`replaceAll` / `Array.prototype.at` 会被判成不存在 —— 而这些 API 正是子包源码在用的。应用 type-check 从 109 条降到 98 条，且没有新增错误类别（剩余是存量，见 #61）。

  验证：`grep -rI vben`（排除 node_modules/dist）剩 34 处，逐条确认都是 `vue-vben-admin` 归属或外部事实；重跑 `@antdv/{eslint-config,oxlint-config,vite-config,shared,utils}` 的 tsdown 产物并确认 dist 内无 `vben`；`turbo run type-check` 与相关包单测绿。

- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
  - @antdv/types@0.1.0
