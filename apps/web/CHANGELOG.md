# @antdv/web

## 0.1.0

### Minor Changes

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

- 8e9e066: feat: 生产产物自带浏览器内 mock，静态部署不需要任何后端

  诉求：**"web 子包生产环境需要开启 VITE_MOCK"** —— 目标口径是产物单独部署出去就能把 21 个菜单点得动，不依赖 Node mock 服务，也不接真实后端。

  ## 拦截器装在 fetch 出口，不在 axios/ofetch 里

  `apps/web/src/mock/` 九个文件：`activate.ts` 判定开关（`!!env.PROD && isEnvEnabled(env.VITE_MOCK)`），命中才 `import('./browser')`。用动态 import 是为了那 427 KB 的 `fixtures.json` —— 开关关着时它是另一个 chunk，浏览器根本不会去取，主包不受影响。`browser.ts` 换掉 `globalThis.fetch`，补 20–60ms 的人造延迟，应答用 `Response.json()`；没命中或跨域一律透传。`matcher.ts` 负责去前缀、同域与 method 判定，多条候选时取 `:param` 最少的那条。`overlay.ts` 是会话 + 写覆盖层。

  选 fetch 而不是在请求层加开关，是因为请求层之外还有别的出口（图标集合、PWA 更新检查、示例页里直接 `fetch` 的地方），一处劫持全都覆盖；反过来在 `fetcher.ts` 里加分支只能覆盖 `http.*`。

  ## 数据从一次"正在跑的 Nitro"抓下来

  `scripts/generate-mock-fixtures.mjs`（`pnpm mock:fixtures`）遍历运行中的 mock 服务，把 67 条接口的响应信封 + 各账号（凭据、权限码、可见菜单白名单）快照成 `src/mock/fixtures.json`。

  **写接口不抓**：抓一次 POST/PUT/DELETE 就真改掉开发中 mock 的数据（DELETE 尤其致命），所以它们的应答由覆盖层按同一信封现造。`/upload*` 与 `/mock-center*` 也在排除名单里 —— 前者是 multipart 且要求每次唯一，后者本来就不该进产物。

  ## 两处只有生产才会暴露的缺陷
  1. **列表筛选整个被丢掉**。覆盖层以前只读 `page/pageSize`，`keyword`、`status` 一律忽略：搜索框输什么都返回第一页，表现和"后端没响应"几乎一样，dev 下由 Nitro 真算所以看不见。现在按 Nitro 各 handler 的口径补上 `filterItems`：文本走不区分大小写的 `includes`，`status`/`priority`/`parentId` 这类走全等，`page/pageNum/pageSize` 三个分页键**不参与筛选**（否则 `page=1` 会被当成一个要求 `item.page === 1` 的条件），`total` 取筛选后的条数。
  2. **上传在产物里没人接**。fixtures 排除了 `/upload*`，而示例页七张卡片还写着 `action="/api/upload..."`：那是 antd 自带的 **XHR** 上传器，从 fetch 劫持旁边绕过去，而且 `/api` 只是 dev 前缀（`VITE_APP_BASE_API` 只写在 `.env.development`，生产包里它是空串）。两头都错，点一次就是 404。现在七张卡片统一 `:custom-request="uploadRequest('…')"` → 项目的 `http`（ofetch → fetch）， `/upload`、`/upload/:variant` 由新增的 `dynamic.ts` 现造应答，契约逐字段对着 `apps/backend-mock/server/utils/upload.ts` 抄（`fileId` / `storedPath` / `uploadedAt` / `url` / `variant`）。代价是进度条不再真实：只在应答回来时补一次 `onProgress(100)`。

  `AvatarUploader` 此前已经走 `http.Post('/upload/avatar')`，正好跟着这套一起通。

  ## 会话、权限与刷新

  覆盖层是**内存态**的：新增的行可检索、`total` 跟着副本走，但刷新页面就回到快照。生产预览里没有真实后端可对账，把会话落盘反而会让人换台机器读到一份对不上号的数据。`/auth/user-info` 与 `/menus` 按会话账号出：菜单按白名单裁剪（叶子看名单、父壳只要有孩子活着就留），而前端正是拿这棵树摊成 allowedNames/allowedPaths 的 —— 不裁就等于生产预览里换个账号还是全通。

  ## 验证
  - 单测：`src/mock/__tests__` 六个文件覆盖开关、匹配、覆盖层读写、筛选口径与上传现造；web 包 `vitest run` 376 条全绿。`vue-tsc` 仍是 **205** 条历史存量（本批文件零错误）。
  - 生产口径：`apps/web/scripts/verify-prod-mock.mjs`（`pnpm --filter @antdv/web verify:prod-mock`）。自带一个**不带代理**的静态 dist 服务器（端口给 0 让系统挑），且**故意不做 SPA history 兜底** ——那会把没被接住的接口伪装成 `200 + index.html`。跑登录、侧栏、useCRUD 增改删（含关键词检索）、语言切换后的标签页标题、custom 账号菜单裁剪与越权 403、上传落 done 态，并把「逃逸到网络的接口请求」当硬失败统计。两轮 9/9，逃逸与 console 错误均为空。
  - **不能用 `vite preview` 验生产**：`internal/vite-config` 没有 `preview` 段，Vite 的 preview server 会继承 `server.proxy`，`/api` 又被 dev 的 Nitro 接住 —— 上一轮就是这么"绿"的，属于假阳性。
  - dev 回归：`ops-sweep` 的「上传示例页」用例照旧绿（它监听 `/api/upload` 响应，dev 下前缀由请求层补上，换传输方式不改口径）。

  ## 没做的
  - 图标集合仍走 HTTP：离线化把 @iconify 的本地集合发布成同源 `/npm/…json`，那是静态资源而不是接口，核验脚本按"非资源请求"口径把它们排除在逃逸统计之外。
  - `fixtures.json` 进仓库（427 KB）：重新生成需要一个正在跑的 mock 服务，不进门禁就没法复现产物。mock 接口有增删或结构变化时**必须**重跑 `pnpm mock:fixtures`，否则产物里是上一次的快照。

- abfe730: fix: 全站交互巡检收尾，并把 Ctrl+K 搜索从假功能做成真功能

  巡检口径从"页面有没有坏"推进到"控制台、组件解析、快捷键这些看不见的地方干不干净"。 `e2e/site-sweep.spec.ts` 判负的四个页面全部修好，并新增三条搜索链路用例。

  - **虚拟滚动告警**：全局 ConfigProvider 开了 `virtual`，antd 因此要求每张表都有数值 `scroll.y`。订单详情与上传队列这类只有几行的表显式 `:virtual="false"`，不再刷 `scroll.y in virtual table must be number`。
  - **CSP 与样例源**：`index.html` 补 `media-src`（缺省回落到 `default-src 'self'`，视频示例全灭在 `MEDIA_ERR_SRC_NOT_SUPPORTED`），并把 w3schools 那个对非浏览器请求返回 403 的循环视频换成 `media.w3.org`。指令里刻意不写 `https:` 通配，新增样例源必须显式登记。
  - **组件解析归零**：17 类 `Failed to resolve component` 分三种根因处理 ——不存在的 antd 子组件（`Checkbox.Button` / `Slider.Input` / `RangeSlider` / `Skeleton.Table`）改写成真实组件；历史遗留的 antd 图标裸标签统一换成 `<Icon icon="ant-design:..." />`； `@form-create/antd-designer` 是**预编译**模板，运行期 `resolveComponent('a-xxx')` 拿不到编译期注入的自动导入，新增 `src/plugins/vendor-antd-components.ts` 按静态扫描出的 35 个 `a-*` 精确注册子集（不是 `app.use(antd)`，保住 tree-shaking）。
  - **死代码**：`components/business/Modal/props.ts`（无人引用且 `Pick` 了三个 `ModalProps` 上不存在的键，TS2344）与 `components/common/PreviewDialog.vue`（全站零引用，且 import 了不存在的 `previewFile` / `downloadFile`）删除。 `pnpm run type-check` 由 273 降到 267，新增文件零错误。

  - **Ctrl+K 菜单搜索**：以前顶栏搜索按钮和快捷键把一个从未渲染的 ref 置真，按下去毫无反应。现在 `layouts/composables/useMenuSearch.ts` 放纯逻辑（拍平菜单 + 空格分词取交集 + 标题前缀 > 标题包含 > 路径/层级）， `MenuSearchModal.vue` 读 `useRouteStore().menus`（搜到的永远是权限裁剪后真能去的页），候选区用封装的 `<Scrollbar>`、↑↓/Enter/Esc 键盘操作、`hidden` 项标注"不在导航"、外链走新标签。快捷键监听挪到 `LayoutHeader`：小部件是异步分包的，chunk 落地前 `useMagicKeys` 还不存在，表现为"刚进系统时快捷键时灵时不灵"（e2e 稳定复现）。
  - **顶栏小部件不再反复卸载重挂**：`<component :is="defineAsyncComponent(meta.component)">` 每次顶栏重渲染都产生一个新的组件类型，Vue 只能卸了再挂；`defineAsyncComponent` 改在 `widgets/index.ts` 的模块作用域包一次，`WidgetMeta.component` 存稳定引用。

  e2e 与单测同步：`ops-sweep` 从 8 条增至 11 条（呼出+过滤+跳转、跳转隐藏页、↑↓/Esc/空态）， `useMenuSearch` 13 条单测，Chromium 全量 71 条绿、Firefox / WebKit 各 11 条绿； `expectTabBar` 的等待从默认 10s 提到 25s —— 每个引擎第一条用例要付浏览器冷启动 + dev server 首次 transform 的代价（WebKit 实测 40s+），10s 会把"引擎刚起来"误判成"登录没进去"。

### Patch Changes

- 2f1a233: feat: `AuthPageLayout` 换成整屏左右分栏版式，背景改成从主色推导的四层画布

  现象（用户归纳）：「auth 组件的背景有点单调，登录页看起来不像后台系统的登录页」。原来那版是视口正中一张 `max-w` 卡片，左右两侧整片留白，只有一层 `bg-card`，跟"管理系统的门面"对不上。方向经用户选定：**全屏左右分栏** + **克制的缓慢动效**。

  - **版式**：`[data-auth="card"]` 从"居中卡片"变成"铺满视口宽度的分栏行"，`lg` 以上左栏品牌 52% / 右栏表单 48%（右栏 `bg-card/70` + `backdrop-blur`，落在玻璃面上而不是又开一个颜色命名空间），`lg` 以下品牌栏整块 `hidden` 收成单列。`data-auth` 钩子一个没删，只改了 `card` 的语义 —— 依赖它的 `register-page.spec.ts`（断言 `card` 可见）不用动就还成立，但**任何按"卡片宽度 ≤ max-w"写的几何断言都会失效**，`login-page.spec.ts` 里那条已改成量两栏是否铺满、宽度比是否 ≥ 0.5 / 0.45、两栏是否等高同顶。
  - **背景四层，全部只从 `--primary` 推导**：`[data-auth="canvas"]` 是 `aria-hidden` + `pointer-events: none` + `overflow: hidden` 的装饰层，含三枚 `radial-gradient` 光斑（34 / 28 / 40s 的 `alternate` 漂移）、一层 3.5rem 网格（120s 走完一格，`mask-image` 用偏心径向把网格压向左上、避免糊到表单栏）、两道蓝图圆弧与一条地平线。用 `radial-gradient` 而不是 `filter: blur()`，是因为大尺寸模糊在低端机和 Firefox 上是首屏开销；`--primary` 在 14 个预设 × 明暗两套里都不带 alpha，所以 `hsl(var(--primary) / α)` 恒可用。动效在 `prefers-reduced-motion: reduce` 下整组 `animation: none`。
  - **品牌栏内容**：铭牌 + `brandBadge`（新增可选 prop，大标题上方那行引导语；分栏版式左栏是整屏高的画布，光一句标题压不住空白）+ 大标题 + 描述 + 三枚特性胶囊 + 一台界面示意（`[data-auth="slogan-visual"]`：窗口栏 / 侧边栏 / 三张卡 / 12 根柱 / 表格行，柱高是组件内写死的装饰值 —— 认证外壳刻意不认识 store，真接数据就得引入数据源）。`#sloganVisual` 插槽整块可替换，传 `sloganImage` 则换成图。
  - **顺手的两处**：`AuthFormPanel` 去掉自己的 `mt-*`（垂直居中与上下留白归 `AuthPageLayout` 的栏容器管，两处都管就会在窄屏上顶出滚动条）；`AuthSocialLogin` 的三枚入口加了 hover 上浮与主色描边 —— 分栏之后表单栏是"贴屏"的，原来那圈没有反馈的灰边显得像没做完。装饰 CSS 写在组件 `<style>` 里（BEM `auth-*`），沿用 `BorderBeam` 的先例：这类规则用 Tailwind 任意值写会退化成一大串方括号，而玻璃栏的**底色**仍留在 `bg-card/70` 工具类上，自定义类不与工具类抢同一属性。
  - **宿主侧**：登录 / 注册页接 `brandBadge`（新增 `auth.brandBadge` 中英文案），两个登录方式按钮补 `carbon:user` / `carbon:mobile` 图标，demo 账号提示从一行裸字改成带边框的信息条。按钮文案仍是 `账号登录` / `手机号登录` 整串，`signIn()` 用的是 `{ exact: true, name: '登录' }`，加图标不影响可访问名。

  验证：`common-ui` 单测 `__tests__/auth.test.ts` 25 例（新增 3 例：canvas 是纯装饰层（`aria-hidden`、内部无 `img/a/button/input`）、`brandBadge` 有传才渲染 `[data-auth="brand-badge"]`、示意柱状条带内联高度），`pnpm exec vue-tsc --noEmit` 该包 0 错，oxlint 新增行 0 命中（该文件存量的 5 条 `no-non-null-assertion` 全在我没碰的行上）。端到端 `login-page.spec.ts` + `register-page.spec.ts` 三引擎：chromium 10/10、webkit 10/10、firefox 10/10。整跑三引擎时 firefox 的**第一条**用例撞过 90s 墙钟（`主色和深色偏好真的落到登录页上` 要登录 → 开偏好抽屉 → 改两档 → 清 storage → reload → 四轮 `expect.poll`，冷编译下就是慢），单跑该 spec 6/6 绿、第一条 41.4s，按仓库既有口径记为负载型假红而不是改 `signIn` 或放宽超时。浏览器侧另用 10 组截图核过 1440 / 1280×720 / 1024 / 390 四档与明暗、紫 / 橙预设、`prefers-reduced-motion`，全部 `scrollWidth === clientWidth`（无横向溢出），1280×720 不产生纵向滚动；光斑漂移用两次采样对比 `getComputedStyle().transform` 矩阵确认在动（这也是为什么静止态必须写 `translate3d(0, 0, 0) scale(1)` 而不是留 `none` —— webkit 内核不在 `none` 与函数列表之间插值）。文档 zh 正文与 en 镜像同步了分栏契约与 `brandBadge`。

- 340f692: feat: common-ui 新增 `BorderBeam` 与 `Listy`；轻提示/通知去掉彩色底色，状态只留徽标

  两条线凑在一个 changeset 里，是因为它们共用同一批验证（示例页 + `preference-effects` 的实值断言）。

  - **`BorderBeam`（`common-ui/src/components/border-beam/BorderBeam.vue`，115 行）**：给卡片描一圈顺时针转的角度渐变光带。可配置项是 `border-width` / `color` / `tail-color` / `duration` / `delay` / `size` / `radius`（类型 `BorderBeamProps` 在 `types.ts`，全部 `number | string` 走 `toLength()`，默认主色 + 6s + 2px）；`size` 是光带在整圈里占的角度比例，不是像素。实现只有两层 DOM：外圈 `.border-beam__ring` 用 `padding` 撑出边框厚度、`mask-composite: exclude` 只留环，内圈 `.border-beam__spin` 是 `inset: -50%` 的 `conic-gradient` 靠 `rotate(360deg)` 转 —— 不用 `@property` 渐变角动画，因为那要求浏览器能插值 `<angle>`，而本包按源码被下游消费时没法假定构建链。`prefers-reduced-motion` 下直接 `animation: none`。
  - **`Listy`（`common-ui/src/components/listy/`，`Listy.vue` 156 行 + `types.ts` 48 行）**：通用列表。`items` 支持字段名自定义（`title-field` / `description-field` / `avatar-field`，默认回落到 `title` / `description` / `icon`），`size` 三档 `small | medium | large` 决定行高与字号，`selectable` / `striped` / `divider` / `empty` / `loading` 各自独立。九个插槽（`header` / `loading` / `empty` / `item` / `item-media` / `item-extra` / `footer`）里 `item` 是整行替换，其余是局部覆盖。**是否监听 `@select` 不能靠 `attrs` 嗅探** —— 声明过的 emit 会被从 `attrs` 里剥掉，`onSelect` 根本不会出现在 `attrs` 中，所以 `selectable` 是显式 prop（`Listy.vue:29-33` 的注释记录了这件事）。
  - **`EmptyState` 的深色可读性**：底色与文字原来是写死的 `bg-gray-50` / `text-gray-900`，深色模式下面是黑底黑字。换成 `bg-muted` / `text-muted-foreground` / `text-foreground` 三个语义 token（第一次尝试给图标加了 `/60` 透明度，结果深色下字形直接看不见，透明度撤掉）。
  - **轻提示与通知不再有彩色底色**：上一版把 `rich-colors` 打开，用 `--{success,info,warning,error}-bg` 给整块卡片染色，实测两种病：一是底色染成琥珀/红之后正文对比度掉下去（通知正文是给用户读的，不是状态徽章），二是 `rich-colors` 连带把 `[data-description]` 的颜色改成 `inherit`，描述跟着变彩。现在 `--normal-bg` 一律 `var(--app-popover)`，四种类型共用中性卡片，状态只体现在左侧那枚 20px 实色圆徽上（`bg-success` / `bg-info` / `bg-warning` / `bg-destructive` + 反白笔画；感叹号与信息符没有"只有笔画不带外框"的 lucide 图标，`CircleAlert` / `Info` 自带一圈，画进圆底成了框中框，所以这两枚手写 path）。部件微调走 `toastOptions.classes` 且**每条都带 `!`** —— sonner 的内置规则是 `[data-sonner-toast][data-styled='true'] [data-icon]` 这种三选择器特异度，不带 important 压不住。关闭按钮原来骑在卡片边框上（库默认 `translate(±35%)`），改成落在卡片内侧右上角，选择器按按钮自己的 `data-close-button-position` 分四种朝向（不是 toaster 的 `data-x/y-position`，两者互不跟随）。
  - **这套样式落在新增的 `common-ui/src/components/toast/Toaster.vue`（200 行），不在 `@antdv/shadcn-ui` 里**：shadcn 那只 `Sonner.vue` 把 `rich-colors` 写死在 `v-bind` 之后（外部传不进来），四枚状态图标也写死在自己的插槽里（外部传不出去，SFC 不转发插槽），要在不动它源码的前提下换掉这两样，只能用选择器去赌它内部选了哪几个 lucide 图标，子包一升级就失效。所以本包直接以 vue-sonner 为底座自建外壳：props 就是 `ToasterProps` 并 `v-bind` 原样透传（`index.ts` 把它转口出来），宿主的 `toast-options` 与默认样式**逐档合并、宿主优先**，六档徽标插槽写成"具名插槽 + 默认内容"可被同名插槽替换，覆写规则挂在 `.antdv-toaster` 这个本包自己的钩子上。结果：`@antdv/shadcn-ui` 一行未动（changeset 里也不再 bump 它），它新增/删除/迭代任何组件都波及不到这里；宿主侧只换 import 来源（`apps/web/src/App.vue:5`）。
  - **`message` / `notification` 的时长与开关（`popup-ui/src/message/index.ts`）**：轻提示默认 3s、通知默认 8s 固定在包里（`MESSAGE_DURATION` / `NOTIFICATION_DURATION`），不再把 `duration: undefined` 传给 sonner 吃它的 5s 默认值；`notification.*` 补上第三个 `duration` 参数。宿主侧 `apps/web/src/App.vue:87-94` 给通知那只 `<Toaster />` 加了 `close-button` 与 `close-button-position="top-right"`，轻提示那只不开 —— 3 秒自己走的东西挂关闭按钮反而多一块可点区域。
  - **示例页与菜单**：新增 `/components/border-beam`、`/components/listy`、`/components/feedback`（轻提示与通知的六种触发 + 通知位置偏好），菜单节点进 `apps/backend-mock/server/api/menus.get.ts:161-366` 与 `apps/web/src/mock/fixtures.json` 两份。顺手修掉两个不存在的图标名 —— 离线图标集里缺名字是**渲染空白方块且不报错**，`carbon:trash-bin` → `carbon:trash-can`、`carbon:border` → `carbon:border-full`，由 `apps/web/test/icon-names.test.ts` 兜住。

  **注意两条包内约定**（新组件的单元测试一开始全红，就是踩在这上面）：BEM 钩子类必须写静态 `class` 而不是塞进 `cn()` —— `border-beam` 会被 tailwind-merge 认成 `border-{color}` 那一档、`listy` 认成 `list-{type}` 而被合并掉；`<template>` 根元素**前面不能放注释**，dev 构建会保留注释节点使组件变成 Fragment，导致非 prop 的 `class` / `style` 透传失效、`wrapper.classes()` 返回空数组。

  验证：

  - `common-ui` 单测 27 个文件 / 288 条全绿（新增 `__tests__/border-beam.test.ts` 81 行、`__tests__/listy.test.ts` 147 行、`__tests__/toast.test.ts` 7 条：中性变量、宿主 `style` 覆写变量、props 透传、`toastOptions.classes` 逐档合并、四枚实色徽标、loading 是转圈而非圆底、宿主同名插槽可替换徽标），`vue-tsc --noEmit` 干净，eslint 干净；`popup-ui` 单测 6 个文件 / 56 条全绿。
  - 浏览器端到端（1440×900 与 768 宽、明暗两色）：`e2e/preference-effects.spec.ts` 7/7，其中四组实值断言钉住"卡片底色是 `--app-popover` 的中性值而不是类型色"「徽标背景等于 `--app-success` 等实色」「toaster 的 computed `z-index` 仍是 999999999」「通知落在偏好指定的角落且不与轻提示串位」。另用一份临时 spec 在 `/components/feedback` 上把**六种触发**逐个点过（默认 / 成功 / 信息 / 警告 / 错误 / Promise），断言的是计算值：`default` 不挂徽标、四种类型的卡片底色四份都等于 `--app-popover` 且 `data-rich-colors='false'`、徽标 `SPAN` 圆底等于状态色令牌而笔画为 `rgb(255,255,255)`、Promise 在 pending 阶段是 `animate-spin` 的 `svg`（没有圆底）落地后换成成功徽标、通知那只的关闭按钮矩形完全落在卡片矩形之内；深色主题下同一批断言重跑一遍，四张截图（浅色堆叠 / pending / 落地 / 深色通知）人工看过后连 spec 与截图目录一起清掉。
  - 迁移没有波及别的 shadcn-ui 消费方：`@antdv/shadcn-ui` 与 HEAD 零 diff，`e2e/icon-picker.spec.ts`（Popover + Select + Input + ScrollArea + `message` 播报）5/5 绿。顺带修掉该 spec 的一处 strict mode 违例 —— 根部有两只 `<Toaster />`，裸 `[data-sonner-toaster]` 命中 2 个元素，按 `data-x/y-position` 收窄到轻提示那只。
  - 文档：`docs/components/common-ui.md` 补 BorderBeam / Listy 两节与导出清单（34 → 54 个值导出，含 `Toaster`）与「Toaster（提示容器）」一节（说明为什么这层不在 `@antdv/shadcn-ui`）、`docs/components/modal-drawer.md` 新增「轻提示与通知」一节，中英两份同步；`docs/_linkcheck.mjs`（121 个文件）与 `_sidebarcheck.mjs`（94 条链接）零缺失，`vitepress build` 通过。

- 340f692: feat: 谷歌风格（`chrome`）标签按浏览器标签重做——选中页长出反向圆角，标签之间是会让位的发丝线

  原来那版只是"上圆角 + 描边 + 底色"的胶囊（`border border-b-0`、栏底 `bg-primary/10`），和真标签页差在一节：选中页与内容区之间没有过渡，整条栏还被主色染了一遍，换到深色主题尤其脏。这版按参考实现重画，两处几何用 Tailwind 表达不出来（`clip-path` 象限裁剪 + 伪元素圆扩散阴影），落在 `TabsBar.vue` 末尾的样式块里，全部按根元素的 `data-tab-style='chrome'` 生效 —— 新属性挂在 `.tab-bar` 上是为了让 CSS 认得到当前风格，其余四种风格的规则一条都不匹配。

  - **胶囊本体（`useTabStyle.ts` 的 `chrome` 槽）**：`h-8 rounded-[10px] px-3.5`、不描边；列表 `items-end gap-1 px-2.5`（两端各留 10px，否则第一个标签的左脚会被滚动容器的 `overflow` 裁掉）；栏底不再染色，未选中只留 `hover:bg-gray-100 dark:hover:bg-gray-700`；选中态只给 `text-primary`，**底色一律不写在这个槽里** —— 标签体和它的两只脚必须共用同一个颜色值，所以底色写在 `--tab-chrome-fill`（`color-mix(in oklab, var(--app-primary) 12%, var(--app-background))`），三处引同一个变量，换主题换明暗一起变，不会出现"脚"与标签不同色的接缝。
  - **反向圆角**：`::before` / `::after` 两个 20px 圆，圆心正落在标签下沿的外侧角上（`bottom: 0; left/right: -20px`），`box-shadow: 0 0 0 30px var(--tab-chrome-fill)` 把同色铺满圆外，再用 `clip-path: inset(50% -10px 0 50%)` / `inset(50% 50% 0 -10px)` 只保留靠标签那一侧的下半象限。**半径必须等于标签自己的圆角**：两条弧的圆心同在底边上、半径相同，交点处切线都是竖直的才接得上；参考稿用的 8px 圆角配 10px 弧，接缝处差的那 2px 会露出一个针尖大的缺口，所以这里统一成 10px。
  - **发丝线**：1px × 16px 垂直居中在未选中项的**左沿**，走它们的 `::after` 槽位（选中页的两只伪元素已被脚占用，用同一个槽就没有抢占之争，隐藏规则也只需同步带 `:not([data-active='true'])` —— 少写这一层判断，悬停到选中页时会把它的左脚一起 `opacity: 0` 掉）。按参考稿隐藏四种情形：整条的第一个（左边是栏边，没有邻居）、自己正被悬停、自己就是选中页、紧邻在悬停/选中页后面那一个。线带 0.3s `opacity` 过渡，是"让位"不是"删掉"。

  验证：

  - `tabs-ui` 单测 3 个文件全绿。`actions-and-style.test.ts` 里那条 chrome 用例原来是红的（断言 `bg-muted/60`，而源码早已是 `bg-primary/10`，上一轮改栏底颜色时漏了同步），按新版设计重写：断言 `rounded-[10px]`、`items-end`、`px-2.5`，并逐条检查选中项与栏底**都不含 `bg-` / `border`**（几何之外的染色一律算回归），`divider` 标志改回 `true`。`tabs-bar.test.ts` 补一条容器带 `data-tab-style` 的用例 —— jsdom 永远不应用 SFC 里的 `<style>`，几何本身只能钉到类名与属性这一层。
  - 浏览器端到端：`apps/web/e2e/tabs.spec.ts` 新增一条 chrome 用例，用 `getComputedStyle(el, '::before' | '::after')` 直接量几何 —— 上左圆角 10px、脚宽 20px、`clip-path` 落在两个象限之一、阴影色等于标签底色、选中页底边与栏底边相差不超过 1px，再逐条断言发的线（第一个不画 / 左邻是选中页时不画 / 悬停时让位 / 移开又回来，线只是隐掉不是删掉）。`apps/web` tabs spec 15/15 通过。两条时序坑值得记：`.tab-item` 上的 `transition-colors` 让刚切换风格的 `backgroundColor` 还在从旧值插值，而 Chromium 把 `color-mix(in oklab, …)` 的计算值序列化成 `oklab(L a b)`，所以读几何之前要先 poll 到"阴影色已经等于底色"；发丝线同理，直接读会拿到过渡中点上的 `0.887511`，断言必须走 `expect.poll`。
  - 明暗两色、宽窄两档与溢出态用临时截图核过（脚在深色下铺在 `--app-background` 上，与参考稿行为一致），临时 spec 与截图目录已清理。
  - 文档：`docs/guide/in-depth/layout.md`、`docs/zh/` 副本与 `docs/en/` 三份的标签页风格条目改成新形状；`_linkcheck.mjs`（121 个文件，0 缺失）与 `_sidebarcheck.mjs`（94 条链接，0 缺失）干净。

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

- f740d13: feat: 分析面板吸收工作台，`/dashboard/workbench` 下线

  诉求：**分析面板和工作台合并**。两个页面上半段本是同一批东西（欢迎语 + 4 张统计卡 + 今日访问之类的 KPI），放在一起等于自己跟自己重复；确认后口径是保留 `/dashboard/analysis`（`HOME_PATH` 与标签页标题「分析面板」都不变），工作台独有的两块内容并进来。

  - **KPI 区合并成 6 张**：工作台的总用户数 / 活跃会话 / 告警数量进 `kpiList`；两边的「今日访问」是同一个指标，只留一条。`trendLabel` 改成可选（告警数这种说不出"较什么"的，就只显示涨跌箭头），新增 `cyan` / `red` 两个图标底色。容器从 `a-row :xs=12 :sm=6`（固定 4 列）换成 `grid`（1/2/3 列响应式）：6 张卡在 4 列下会留下"第二行只有两张"的半空行，3 列正好整除。
  - **快捷操作 / 最近动态**作为第五行两列并进来，标题区顺带带上日期。
  - **顺手修掉两处光标谎言**：原工作台的四个快捷格子是 `cursor-pointer` 却没有任何点击行为的 `<div>` —— 亮着、能悬停、点了没反应。合并时全部换成 `RouterLink`，落到真实路由上；其中「安全审计」从来没有对应页面，换成可访问的「系统日志」（`/system/log`，菜单里 `hidden` 但仍放行）。KPI 卡片同样挂着 `cursor-pointer` 却不可点，一并摘掉（它保留 hover 阴影，只是不再谎称能点）。
  - **下线干净**：删掉 `views/dashboard/workbench/`，同时从菜单种子（它既是路由表来源也是权限来源）里删掉「工作台」记录，清掉 `locales` 里再没人用的 `workplace` 键， `layout.spec.ts` 里以工作台为导航目标的断言改指分析面板。只删页面不删种子，侧栏会留下一条点不动的菜单。

  验证：

  - 单测 `apps/web/src/views/dashboard/__tests__/analysis-merge.spec.ts` 5 条，打在静态契约上—— 挂载有 7 张 echarts 的分析页只会得到一堆 stub，而这几条坏法本来就是"数据写错"型：每个快捷操作路径都必须在菜单种子里存在（先断言抓到了 ≥4 条，防空跑）、工作台从种子与页面一起消失、KPI 标题不许重复、快捷格子必须是 `RouterLink` 且不带 `cursor-pointer`、根容器自己不加 padding。
  - e2e `apps/web/e2e/dashboard-merge.spec.ts` 3 条 × chromium / firefox / webkit 全绿：侧栏查无工作台、真的从分析面板点进 `/system/user` 与 `/screen/monitor`、两个新区块渲染。WebKit 首轮在裸 `expect(tab(...))`（10s）上假红 —— dev 下首进 `/system/user` 要现场编译，冷跑超过 10s；改用夹具里幂等的 `go()`（末次 20s）后三引擎稳定。
  - `pnpm test:unit` 21/21 任务（web 245 测试）全绿，改动文件 eslint 干净。

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

- abfe730: fix: 开发态改页面文件不再把一级布局改没

  现象很具体：本地 dev 下编辑一个二级页面（例如 `views/system/user/index.vue`），保存之后顶栏、侧栏、标签栏、面包屑这一整套外壳整个消失，页面变成脱离布局的整屏，只能靠整页刷新找回来。生产构建里不会发生，所以它只消耗开发时间 —— 但消耗的是每天几十次的那种。

  - **根因是两套路由机制在 HMR 路上没接上**：本项目用 `vite-plugin-vue-layouts-next` 把布局**编译进路由表** —— `setupLayouts()` 给每个页面套一层 `{ component: LayoutWrapper, meta.isLayout }` 的父记录。而 `vue-router/auto-routes` 自带的 HMR 逻辑是"`router.clearRoutes()` → 逐条 `addRoute(新生成的裸路由)`"：裸路由里没有那层父记录，页面于是被挂回顶层。布局壳的父记录**没有 `name`**，这正是它自愈不了的原因 —— `stores/modules/route.ts` 的注册表对齐按 `router.hasRoute(name)` 判断缺席，无名记录永远判不到。
  - **修法用官方留的口子**：`handleHotUpdate` 的第二个参数按声明"在替换路由之后、导航之前" 被调用，拿到刚重新生成的那份裸路由。把路由表拼装的启动逻辑抽成 `buildAppRoutes()`，在这个回调里用同一个函数重铺一遍。
  - **不采用"只补布局"的增量修补**：那次 `clearRoutes()` 连静态路由一起清了（`/login`、`/redirect/**`、404 兜底），增量补会漏掉它们；"漏掉 404 兜底"在 dev 下表现为乱敲地址直接白屏，比丢布局更难归因。重铺之后由它自己发起的 `router.replace(..., force)` 会走到导航守卫里的注册表自愈，按菜单做的裁剪仍会重新对齐。
  - `e2e/utils/app.ts` 的 `region()` 联合类型补上 `'header'`：代码里一直有这个区域（`data-layout-region="header"`），类型里少一项，探针就没法断言顶栏。

  测试口径（新增 `apps/web/e2e/dev-route-hmr.spec.ts`）：

  - 这条只能跑在 dev server 上（`playwright.config.ts` 本来就统一用 `pnpm dev`，不存在 preview 分支），并且**只在 chromium 保留一份**：改一次页面文件会让 dev server 给所有连着的浏览器重发路由表更新，三个引擎同时既改又看就是互相制造噪音，而被保护的东西与引擎无关。
  - 用例先断言"确实观察到 `vue-router/auto-routes` 被热更新过"才往下走 ——如果那次更新没发生，后面每条断言都只是在检查启动状态，坏掉也照样绿，空跑比没有用例更坏。
  - 覆盖三件事：外壳仍在且**没有重复套第二层**（`sidebar`/`header` 各数到 1）、二级页面仍渲染在布局里、静态路由与 404 兜底都还认得。
  - 检查静态路由用改 hash 而不是 `page.goto()`：goto 若触发整页加载就等于重新启动一遍，"热更新后静态路由还在吗"这条会永远为真。`/login` 的判据也不是"登录页渲染出来"（已登录会被守卫请回首页），而是"它被匹配到了"——这条常量路由缺席时 hash 会落到兜底去 `/error/404`。
  - 红绿都验过：临时把回调去掉后该用例立刻红（`sidebar` 数到 0），装回即绿。

- d8fa761: fix: `dragSortConfig.disabled` 与 `canDrop` 真的生效（整表冻结、按行禁用、落点约束三种形态都钉）

  诉求（用户原话）：定位并修复 `useDragSort` 的 `disabled` 参数与 `canDrop` 回调不生效的问题，确保参数传入后能正确控制拖拽排序的启用状态与元素拖拽放置规则。

  - **`disabled` 不生效的根因是"拦错地方"**：Sortable 的构造参数 `disabled` 只在 `new Sortable()` 那一拍读一次，之后 `dragSortConfig.disabled` 换值不会回头；而 `onStart` 里 `preventDefault()` / `return false` 也是无效的 —— `EventDispatcher.js` 派发用户回调时写的是 `options[onName].call(sortable, evt)`，返回值直接丢掉。**唯一每次按下都现读、且返回值真的被认的门是 `filter`**，所以禁用判定搬到 `filter`，构造参数恒写 `false`（注释里留了这句原因，别被"disabled 怎么是 false"骗回去）。
  - **`filter` 拦住时不能再吞 `mousedown`**：默认 `preventOnFilter: true` 会连 `preventDefault()` 一起做，结果禁用行里的按钮、链接、文本选中全废（用户下一条反馈就会是"禁用行连复制都做不到"）。写 `preventOnFilter: false`，与"点在非手柄区域压根不 preventDefault"那条路径保持同一口径。
  - **两种 `disabled` 形态都支持**：布尔 `true` 整表冻结，函数形态按行判。函数拿到的必须是**数据记录**而不是 DOM 元素，所以行身份先认 `BasicTable` 写在 `<tr>` 上的 `data-row-key`，没写这个属性才退回下标换算。
  - **`canDrop` 原来读的字段根本不存在**：Sortable 给 `onMove` 的事件对象上只有 `dragged` / `related` / `to` / `from` 和几个 `*Rect`，**没有** `oldIndex` / `newIndex` / `draggedRowIndex` / `relatedRowIndex`。照这些字段取下标，永远比的是"数据源第 0 条 vs 自己"，于是任何 `canDrop` 都看起来"没拦住也没放行"。`onMove` 的返回值本身是被认的（`!== false` 才换位），所以修法是把取索引改成从 `dragged` / `related` 反查记录。
  - **快照必须在 `filter` / `onStart` 这一拍量**：拖拽中途 Sortable 会真的把 `<tr>` 挪位，此时再数"首行前有几个非数据行"就漂了。所以 `leadingRowCount`（测量行 / 占位行数量，用来把 DOM 下标换算成数据下标）和 `rowByKey` 都在 `filter` 里、DOM 还没动的时候量一次，`onStart` 再补一次。
  - **落点约束要管"跨过的那几行"，不只是落点那一行**：一步拖得远时中间会掠过多行，只校验 `related` 的话"不能越过锁定行"形同虚设。所以 `onMove` 里对 `dragged` 与 `related` 之间的每个位置都调一次 `canDrop`；悬在自己原位（`dragRecord === dropRecord`）放行，不构成"越过"。

  测试口径：

  - 单测（`packages/core/ui-kit/table-ui/__tests__/drag-sort.test.ts`，19 条）钉的是**契约而不是 Sortable 内部**：布尔与函数两种 `disabled` 形态、前导偏移下的行对齐、`canDrop` 拿到的是哪两条记录、跨越路径逐行校验、"拖过之后 DOM 已换位仍按 `data-row-key` 认人"，以及"落点没有对应数据行时不许落"。
  - 端到端（`apps/web/e2e/gallery-examples.spec.ts` 的拖拽一段，chromium / firefox / webkit 三引擎）只能走 Playwright 的 `dragTo`：sortablejs 1.15.7 走原生 HTML5 DnD，`mouse.down()` + 分步 `move()` + `up()` 这种手搓序列在这台机器上 3/3 召不出 `dragstart`。禁用行那条断的是"数据顺序不变"而不是"没动画"，因为 `filter` 命中时 Sortable 只是不起拖，DOM 没有任何可观察的中间态。

- abfe730: fix: 交互巡检第二轮 —— 把"看起来能用、实际点不动"的一批缺陷清掉

  上一轮巡检看的是"页面有没有坏"，这一轮逐个点开抽屉、弹窗、气泡确认，验证的是**点下去到底有没有结果**。挖出来的问题里大半是全站性的：修一处，所有页面一起好。

  - **弹窗里的表单回填一直是空的**：`BasicModal` 默认 `destroyOnHidden`，表单每次开弹窗都是新实例；而 `useForm` 持有的 `formRef` 在组件卸载后并不会变成 `null`。于是全站通行的 "先 `setFieldsValue` 再 `openModal`"写法把值写进了一个已经死掉的实例 —— 不报错、不提示，编辑弹窗打开就是空白，用户改无可改。现在 `FormActionType` 多一个 `isMounted()` 契约， `useForm` 认这个契约：实例是死的就把值暂存进待写入队列，`@register` 拿到活实例时一次性兑现。一处改动覆盖全站 20+ 个调用点，配 7 条单测把契约钉住。
  - **搜索条件存不住**：`useDataSource` 只在提交那一次用到 `searchInfo`，之后任何一次不带条件的取数—— 保存/删除后业务页惯常调的 `reload()`、点分页翻页 —— 都会静默退回"全量第一页"。表现是"搜到某一行改完保存，那条记录凭空消失"，看起来像编辑没生效。现在最近一次生效的条件由 hook 记住，重置表单时同步清掉；5 条单测分别盯 reload、翻页、覆盖、清空。
  - **固定列里的确认气泡点不下去**：全局 `getPopupContainer` 把弹层挂到触点的父节点（为了跟随内层滚动容器），但表格固定列的 `<td>` 是 `position: sticky`，sticky 一律自成一个层叠上下文 ——挂进去的气泡 z-index 只在这个上下文里比大小，被隔壁单元格的 sticky 阴影整块盖住。操作列落在固定列里时把落点退回 `document.body`。
  - **antd 自带文案全是英文**：`loadLocale` 早就写好了，调用点在 `App.vue` 里被注释掉过，于是分页的「条/页」、日期选择器的「开始日期」一直是英文。接回来，语言切换与 dayjs 同步。
  - **图片墙点不出预览**：三层原因叠在一起 —— 新选的本地图片没有 `url`（antd 给的是 blob `thumbUrl`）、服务端地址挂在信封 `response.data.url` 里、`listType="picture-card"` 的缩略图本体是个 `<a target="_blank">`（`@preview` 只是额外回调，它不 `preventDefault`，点一下会另开标签页）；再加上 `.ant-upload-list-item-actions` 那条绝对定位、撑满整格的图标条把点击整个吃掉。预览地址统一走一个解析函数，事件里吃掉原生跳转，卡片内遮罩与图标条改为穿透（图标自身仍可点）。头像框此前按"数组有没有长度"判断渲染哪一面，文件刚进列表还没地址的那一瞬两边都不渲染，头像整个消失，改成只看有没有地址。
  - **每张表的"下一页"其实还是第一页**：`BasicTable` 发的是 `pageNum`（与 `pageSize` 成对），而 mock 的 10 个列表 handler 沿用了 legacy 的 `query.page`。两边各自都"对"，唯独对不上：翻页控件能点、请求会发、状态码 200，界面上一行都不换。handler 改成 `pageNum ?? page` 两种都认，并在 `test/api-parity.test.ts` 加一组静态对账 —— 新增列表接口若只读 `query.page` 当场变红。这个错前后端单测都抓不到：前端只断言"我把 pageNum 发出去了"，后端只断言"给我 page 我能切片"，所以 `ops-sweep` 里那条分页用例也从"URL 里有没有 pageNum"升级成"翻页之后首行内容必须真的变了"。
  - **删除这种不可逆操作没有二次确认**：用户管理点一下就直接删；菜单管理更狠，删目录等于连子树一起删，而提示只报一个菜单名。现在两处都走确认气泡，菜单的文案与结果提示都把"连带多少个子项"说清楚。组件示例里的操作树是反过来的问题 —— 按钮只弹一句"删除节点: xxx"、节点原地不动，演示页给了反馈不给结果，现在真的摘掉节点，并按子树大小给确认文案。
  - **视频演示页在没能力的浏览器上摆黑框**：`/components/video` 的 HLS 卡片无论环境能不能播都照挂播放器，放不出来时用户看到的是一句英文厂商标案 "No compatible source was found for this media."。实测三种引擎的差别：Chromium 原生 `canPlayType('…mpegurl')` 给 `maybe` 且 `MediaSource.isTypeSupported` 可用；Firefox 靠 MSE；而 **Playwright 自带的 WebKit 构建里 `window.MediaSource` 整个不存在**（它的 mp4 反而是支持的），这条卡片必然报错 —— 巡检被它咬红，真实用户看到黑框。现在挂之前先探测（原生 m3u8 / `MediaSource.isTypeSupported` / 旧前缀名 / `ManagedMediaSource`），放不出来就换成中文说明并说明"换哪个浏览器能看到效果"，另外两张 MP4 卡片照常挂；真到了运行期才失败（断网、CDN 挂了）也有 `@error` 兜底给单独一条说明，不连带误伤别的卡片。 `notSupportedMessage` 一并换成中文。探测逻辑抽成 `media-capability.ts`，配 8 条单测 —— ⚠️ 标准方法是 `isTypeSupported`，写成 `isSupportedType` 不报错但恒为假，会把 Chrome 上的 HLS 卡片整块藏掉。
  - **通知管理页的编辑是死代码**：弹窗标题写着 `isEditing ? '编辑消息' : '新增消息'`，

    但没有任何入口把 `isEditing` 置真，`editingNoticeId` 也一起是死的；保存时不带主键， `/system/notice/save` 永远当新增处理。补上编辑按钮、回填与带 id 的提交。

  - **顶栏通知小部件复活**：铃铛此前挂在偏好里但从不渲染。现在按 `widgetNotice` 开关出现，下拉里读的是真实未读列表，单条已读/全部已读跳接口，跳「消息通知」页走路由；mock 侧补 `notice/save` 与整套 `upload` 接口（分片上传、秒传命中、合并校验）。

  `e2e/ops-sweep.spec.ts` 从 12 条增至 18 条，把"能不能真的操作"写成断言：图片墙预览（点本体不另开标签、Esc 之后还能二次打开）、用户/通知/消息的增改删闭环、删除确认的取消分支（点了取消却删掉等于没加确认）、菜单连带子树的删除、顶栏主题与全屏、以及搜索条件在保存后仍在（新增用例直接盯本次修复）。夹具全部带时间戳 —— mock 的库存在进程内存里，上一轮失败留下的同名数据会把下一轮误判成"没删干净"。该轮收尾时 Chromium 全量端到端与仓库单测全绿（全站条数会随后续几轮变化，以最新一条 changeset 的口径为准）。

- 340f692: feat: `Listy` 加虚拟滚动模式，万级数据只渲染视口内那十几行

  `Listy` 原来只有直排一条路：`items` 有多少就挂多少个 `<li>`，两千条就够卡。这次加 `virtual` 开关，**同一套行模板、同一个 `<li>` 形状**，打开后只渲染窗口内的行；滚动算术一律压在 `@vueuse/core` 的 `useVirtualList` / `useScroll` / `useResizeObserver` 上，没有自研第二套虚拟化实现。

  - **新增 props（`types.ts` 48 → 134 行，`Listy.vue` 156 → 434 行）**：`virtual`（默认 `false`，关掉时行为与之前完全一致）、`container-height`（默认 320，数字加 px、字符串原样）、`item-height`（`number | (index, item) => number`，默认 40）、`measure-heights`（默认 `false`）、`overscan`（默认 5）。事件两条：`scroll` 带整个 `ListyScrollState`，`item-click` 沿用原来的 `(item, index)`。暴露的状态与方法：`scrollState` / `visibleItems` / `visibleRange` / `totalHeight` / `arrivedState` / `directions` / `isScrolling` / `containerElement`，方法 `scrollToIndex` / `scrollTo` / `scrollToTop` / `scrollToBottom` / `recalc`。
  - **`<ul>` 自己就是占位块**：`wrapperProps.style` 给 `<ul>` 同时上 `marginTop`（窗口之前所有行的总高）与 `height`（剩下的），不变量是 `marginTop + height === 内容总高`，所以滚动条长度与实际排布永远拼得上，不需要"外层撑高 + 内层绝对定位"那套脚手架。**代价是这一层不能再有 padding / border**，行的间距全部留在 `<li>` 自己身上。
  - **`item-height` 一律以函数交给 VueUse**：`useVirtualList` 在建立时把选项解构掉了（`const { itemHeight, overscan } = options`），传数字等于把值冻在那一刻，之后改属性不会重算；给函数则每次求值都读最新 props，`item-height` / `measure-heights` / 换数据都自动跟上。代价是它内部的定位扫描从 O(1) 变 O(n)，20 000 行 uniform 高度实测在几十微秒量级，滚动时看不见。`overscan` 是真的只读一次，类型注释里写明了改它要重挂。
  - **动态高度的自愈观察**：`measure-heights` 关掉行内高度、由内容撑开，再对一个**只包含当前窗口行**的 computed 目标数组挂 `ResizeObserver`，量到的 `offsetHeight` 回灌 `measuredHeights`；读的是 `virtualRows`，所以窗口一移动新进视口的行就自动补上测量（`observe()` 对新元素必定回调一次，头部插数据导致的下标错位会被下一轮实测覆盖，不需要手动清缓存）。回调里**只写高度不手动重算**：`measuredHeights` 一变 `totalHeight` 就变，VueUse 自己 watch 着总高，在这里同步滚反而容易撞 `ResizeObserver loop` 警告。
  - **首帧必须自己算一次窗口**：视口用**函数式 ref**（`setViewportRef`）而不是 `:ref="containerProps.ref"`，因为绑 Ref 对象要等 watcher flush 才写入，`onMounted` 里那次 `recalc()` 会量到 `null` —— 万级列表在第一次滚动之前是空的。`containerSize` 同样在 `onMounted` 先同步读一次 `clientHeight`，剩下的交给 `useResizeObserver`（无 ResizeObserver 的环境不至于永远等不到回调）。
  - **`scroll` 事件由 `watch(scrollY)` 发**：`useScroll` 的 `y` 是 computed，位置真的变了才回调，所以程序化滚动、就地换数据都走同一条路，不需要补发；反过来在同一个 `scrollTop` 上 dispatch `scroll` 是不会产生事件的（单测里踩过）。

  验证：

  - `common-ui` 单测 26 个文件 / 280 条全绿（新增 `__tests__/listy-virtual.test.ts` 300 行 / 17 条：窗口长度、`visibleRange` 与 DOM 行一致、`marginTop + height` 拼总高、`scrollToIndex` 落点、动态模式实测回灌后总高变化、直排路径未回归）。两条 jsdom 坑值得记：首帧窗口在 `onMounted` 里算，挂载后必须 `await nextTick()` 才查得到 `<li>`；jsdom 永不应用 `<style>`，`offsetTop/offsetHeight` 恒为 0，所以占位高度断言改成解析 `<ul>` 的行内 style（在 jsdom 里断言几何只会得到恒等式）。`vue-tsc --noEmit` 与 eslint 干净。
  - 浏览器端到端：`apps/web/e2e/listy-virtual.spec.ts`（289 行 / 8 条）在 chromium + firefox + webkit 三个引擎各 8/8。钉的都是 jsdom 量不到的东西：20 000 条只挂 12–16 行且**每行 computed 高度恰为 48px**、`data-rendered` 等于 DOM 行数、滚到中段 `data-start` 与渲染行的绝对下标连续、`scrollToIndex(10_000)` 之后目标行真的在视口里、跳到底 `data-end === '19999'` 且 `progress ≈ 1`、`measure-heights` 下行内不再写高度且至少两种实测高度、`overflow-y: visible` 的直排对照 30 行全量渲染、30 步 rAF 连续滚动没有单帧超过 250ms 且窗口零报错。两个环境坑：`toBeInViewport` 量的是与**页面**视口的相交，点卡片右上角按钮会把 320px 的列表顶出折叠线，断言前要先 `scrollIntoViewIfNeeded()`；本机 WebKit 时序比 Chromium 慢 2–4 倍，100ms 阈值是假红，按实测放宽到 250ms 并把数值写在注释里。
  - 示例页：`apps/web/src/views/components/listy/index.vue`（336 行）新增「虚拟滚动」四张卡 —— 固定行高（顶部/底部/跳到 #10000/跳到末行/切换视口高度五个按钮 + 一行 machine-readable 的 `data-testid="listy-stats"`）、函数行高（每 10 行一组首行 72px，20 000 行合计 936 000px）、动态行高（`#item` 换成可换行段落，说明长度随行号变化）、直排对照（同一份数据不开虚拟）。临时截图脚本与截图目录已清理。
  - 文档：`docs/components/common-ui.md` 与 `docs/en/components/common-ui.md` 的 Listy 一节补齐五个新 prop、两条事件、暴露的状态与方法、最小可用示例与「虚拟模式怎么跑起来的」五条实现说明，并新增 `::: warning 虚拟模式需要一个能滚的盒子`；导出清单补 `ListyRow` / `ListyScrollState` / `ListyScrollToOptions` 等七项，行号引用按 434 行的新版重新对齐。`_linkcheck.mjs` 与 `_sidebarcheck.mjs` 零缺失，`vitepress build` 通过。

- f740d13: 登录页改成跟随主题色与暗黑模式，并收成一条响应式布局。

  登录页是全站唯一一个"用户带着偏好来看的第一屏"，但它原先有两处不认偏好：

  1. **中性色只写了浅色一侧**（`bg-white/70`、`text-stone-800`、复选框上还钉了 `[&_.ant-checkbox-inner]:!bg-white`）。明暗开关是 `@antdv/preferences` 写在 `<html>` 上的 `dark` class，模板里一个 `dark:` 都没有，于是"整站深色、登录页还白着"，深色下那块被 `!important` 钉白的复选框尤其扎眼。
  2. **强调色一半靠 `var(--ant-color-primary)` 内联样式**（logo、标题、分段选中态、发送验证码），一半靠 `!text-stone-500` 之类的覆盖把 link 按钮按回灰色；换主色时该亮的没亮、该灰的灰到底。

  做法是把样式表整体重写为"强调色只用 `*-ant-primary` 工具类、中性色必须成对写 `dark:`、antd 能从主色派生的就不再自己画"：

  - 输入框只保留高度与圆角两条覆盖，边框/底色/focus 光环交回 antd（它已经按 `colorPrimary` 和 `darkAlgorithm` 派生好了，之前那些 `!bg-white!` 恰恰是把这条派生链掐断的地方）；复选框与「忘记密码」「发送验证码」同理，删掉覆盖就对了。
  - 品牌区、装饰光斑、分段控件、主按钮全部走 `bg-ant-primary/10`、`text-ant-primary` 这类工具类，内联 style 只剩 SVG。
  - 顺手删掉一段靠 `[class*='group']:hover .w-11` 猜元素的 scoped 样式，换成 `group-hover:scale-110`；窄屏（<lg）折叠成单列时补一行紧凑 logo，避免表单卡上面什么都没有。

  **一个值得记住的运行时事实**：antdv-next 是开着 CSS 变量的，它把 `--ant-color-primary` 写在 `.ant-app` 上，作用域比偏好写在 `<html>` 上的那一份更近。浅色下两者相等所以看不出来，深色下 antd 会按暗底把主色重算一档（`#FA541C` → `rgb(216, 74, 27)`），页面读到的是重算后的值。因此端到端断言不能钉种子色值，改成钉"工具类与 antd 主按钮取到同一个主色、且已离开默认蓝"。

  验证：

  - `src/views/login/__tests__/login-styles.spec.ts` 5 条，断的是 composable 的不变量而不是具体类名 —— 强调色不许写死、出现浅色中性色就必须带 `dark:`；另有 1 条把 e2e 夹具依赖的占位符与「登录」文案钉住，防止改文案时静默弄红整套端到端。
  - `e2e/login-page.spec.ts` 3 条 × chromium/firefox/webkit 全绿：登录后改偏好→清 token→ **整页 reload**（只换 hash 不会重启应用，守卫会把 `/#/login` 弹回后台）再算样式；1440/390 两档的可见性 + 不出现横向溢出；手机登录里的链接色与主按钮底色同源。

- f64fc3a: feat: MarkdownEditor 迁入 `@antdv/common-ui`，`FMarkdown` 字段从 textarea 换成 tiptap

  `MarkdownEditor` 原先长在应用里（`apps/web/src/components/business/MarkdownEditor/`），表单字段 `FMarkdown` 却是另一套东西 —— 一个 `<textarea>` 加"自己按语法高亮"的补丁，两边都对不上"富文本编辑 Markdown"这句话。而 `docs/components/editor-upload.md` 里那条"`getMarkdown()` 返回的其实是 HTML"的债，根子也在 value 语义没定下来。

  - **编辑器整体迁入 `@antdv/common-ui/components/markdown-editor/`**（目录、components、extensions、constants、types、utils 一并搬），依赖从应用侧收到包里：9 个 `@tiptap/*` + `marked` 走 catalog（`common-ui/package.json:29-41`），提示语用 `@antdv/popup-ui` 的 `message`，上传走 `@antdv/request`；`apps/web` 的 16 条 `@tiptap/*` 全部删除，catalog 里没被引用的 7 条一并撤掉。应用只留 `apps/web/src/components/business/index.ts` 的再导出，示例页与表单字段共用同一份实现。
  - **value 语义由 `contentType` 说清楚**（`'html' | 'markdown'`，默认 `html` 保持旧调用不变）。新增 `markdown.ts`：`docToMarkdown(JSONContent)` 把 prosemirror 文档序列化成 Markdown 源码，`markdownToDoc()` 用 marked 的 lexer 反解回文档（`case 'html'` 分支保证喂 HTML 也解得开）。没有改用 `@tiptap/markdown` 是因为本编辑器有自定义 `todo` 节点和块级 `text-align`，官方 markdown 扩展会把这两样丢掉 —— 理由写进了模块注释。于是"导出 Markdown"按钮打出来的终于是 Markdown 而不是 HTML，那条文档债清掉。
  - **`FMarkdown` 改为编辑器壳**：删掉 textarea 与它的事件处理，`defineOptions({ inheritAttrs: false })` + `v-bind="$attrs"` 把 attrs 落到编辑区，`data-field-control` 保留（表单的 focus/校验定位靠它）。旧字段的 `rows` 不再有意义，换算成编辑区最小高度（`rows * 24`，下限 60）；`content-type="markdown"` 让字段值就是 Markdown 源码。
  - **`apps/web` 自定义组件示例同步改口径**：两处 `component: 'MarkdownEditor'` 的 `defaultValue` 由 HTML 片段换成 Markdown 源码，说明文字改成"tiptap 富文本，value 存 Markdown 源码"。
  - **编辑器配色改为吃 design token**：迁入后它是库组件，不能再带着一套 Tailwind 灰阶。外框 / 工具栏分隔线 / 表格线 → `border-border`（`--app-border`），面板 `bg-card`、下拉弹层 `bg-popover`、代码与表头底 `bg-muted`、正文 `text-card-foreground`、选中态 `text-primary`；`MarkdownEditor.vue` 尾部那整段 `:global(.dark)` 覆盖随之删除（token 自己会切），组件里已无 `gray-*` / `blue-*` 硬编码。顺带修掉一个真实的错位：原来深色下外框是 `gray-700`，与其余组件的 token 边框不是同一个色，切 8 套预设主题时编辑器根本不跟着变。

  **这是 `FMarkdown` 的破坏性变更**：字段值从 HTML 变成 Markdown 源码，把它直接塞进 `v-html` 的调用方需要自己过一遍 marked（或把 `content-type` 显式写回 `html`）。

  验证：

  - `common-ui/__tests__/markdown-editor.test.ts` + `markdown-roundtrip.test.ts`（文档→Markdown→文档的往返，含 todo、对齐、表格、代码块）；`form-ui/__tests__/fields.test.ts` 新增 `describe('FMarkdown')`，钉住"渲染出来没有 `textarea`、有 `contenteditable="true"`、`contentType === 'markdown'`、Markdown 源码里的 `# 标题` 解析成 `.tiptap h1`"。
  - 两个包的 `vitest.setup.ts` 补了 jsdom 缺的 `Range.getClientRects` / `Element.getClientRects`：ProseMirror 的 `scrollToSelection` 在 jsdom 里会抛，不 stub 就是拿假绿的 unhandled error。
  - 浏览器实测（1280×900）：富文本 Tab `{editable:"true", strong:1, table:1, heading:1}`，工具栏 24 个按键、图标 svg 正常出图，「导出 Markdown」打到控制台的是真 Markdown 源码（含 `#` 与 `**`）；表单页两个 tiptap 实例（字段 `document` / `preview`），表单里剩下的唯一 `textarea` 属于显式的 `note` 多行文本字段，默认值里的 `**加粗**` 已经是真的 `<strong>`，预览态 `contenteditable="false"`；token 化之后亮色外框 `rgb(240,240,240)` / 深色 `rgba(255,255,255,.12)`、弹层 `#fff` / `#1f1f1f`、表头底 `#f5f5f5` / `rgba(255,255,255,.08)`，全部跟着 `--app-*` 走；控制台除登录前的 `未登录` 小部件请求外无报错。

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

- f740d13: fix: 路由页面不再重复加内边距（内边距归布局管）

  诉求：**"所有路由页面，在布局组件中增加了 padding，那么路由页面外层容器不需要添加 padding"**。

  布局在内容区外面已经套了一层 `<Scrollbar view-class="p-4">`（`src/layouts/index.vue:239`，注释里写明了"内边距挪进 view，挂在滚动元素上会让滚动条盖住内容"）。页面再给自己加一份，表现是内容离边缘 40px、跟别的页面对不齐、卡片阴影被顶出可视区。

  ## 被修掉的五个页面

  | 页面                          | 原来根容器                               |
  | ----------------------------- | ---------------------------------------- |
  | `/components/editor/markdown` | `flex h-full flex-col p-4`               |
  | `/security/dashboard`         | `cn('space-y-4 p-5')`                    |
  | `/demo/table-pagination-test` | `p-6`                                    |
  | `/micro-app/SubAppView`       | 两个空状态根 `... gap-2 p-6 text-center` |
  | `/system/micro-app`           | `flex h-full flex-col gap-4 p-4`         |

  页面**内部**的卡片、代码块、抽屉内容该有内边距照旧有 —— 只动根容器。

  ## 门禁

  新增两份互补的检查，因为单靠一种都有盲区：

  - 源码侧 `src/views/__tests__/page-root-padding.spec.ts`：遍历 `src/views` 下所有页面文件，解析模板的**顶层元素**（多根 `v-if` 分支逐个看），断言 class 里没有 `p-*/px-*/py-*/pt-*/pb-*/pl-*/pr-*`，也没有行内 `padding:`；同时钉住"布局那层 `view-class="p-4"` 还在"，哪天把 padding 从布局挪走，这条会逼着回来改口径。遍历口径按**文件**而不是按路由表：页面有三种来源（文件约定式路由、`routes.ts` 的静态路由、菜单接口动态注册的 `account/*`），只有按文件扫才覆盖得全；排除的私有组件目录（`views/<页>/components/**`、`widgets/**`）与 vite-config 里 VueRouter 的 `**/*/components/*` 排除规则对齐。
  - 渲染侧 `e2e/page-padding.spec.ts`（chromium / firefox / webkit 各 4 条）：进页面量 `getComputedStyle`，断言布局 view 是 16px、页面根容器是 0px。源码扫描看不到 `cn()` 最终拼出什么，计算样式看不到没渲染的分支，两边各补一半。

  ## 写门禁时踩到的两个坑（都记在测试注释里）
  1. **计算属性根容器**：`/security/dashboard` 的 padding 藏在 `const containerClassName = cn('space-y-4 p-5')` 里，模板上只有 `:class="containerClassName"`。只读字面量等于给它开后门，所以按 `xxxClassName` 这条命名约定回到脚本里取定义原文再匹配。
  2. **定义块的边界**：一开始拿"下一个空行"当结束，结果 prettier 把连续的一行式 `const xxxClassName = cn(...)` 挤成不留空行的一整块，于是 `btnClassName = cn('px-0.5!')` 这种**别的元素**的 padding 被算到根容器头上，一次误报 20 多个页面。改成"下一条顶格语句之前"（`(?=\n\S|\s*$)`）。另一个坑是 Windows checkout 出来是 CRLF，`\n\n` 永远匹配不上，必须先归一成 LF。

  ## 验证
  - 单测：`pnpm test:unit` 21/21 任务通过（web 包 27 文件 / 250 条）。
  - 端到端：`page-padding.spec.ts` 三引擎 12 条全绿；回归跑 `shell-scroll.spec.ts`（同样路过 `/demo/table-pagination-test` 与内容区滚动）2 条绿。
  - 真实浏览器截图复核：Markdown 编辑器、安全看板、子应用空状态三张改动页 + 分析面板基线，内容左边缘与标签栏/面包屑对齐，`h-full` 页面（编辑器）高度链没被拆坏。

- f740d13: fix: 实时监控大屏的图表跟随**容器**自动 resize

  诉求：**实时监控大屏的 echart 需要自动 resize**。

  页面原本只有 `useEventListener(window, 'resize', ...)` 一条 resizing 通路，而大屏里真正频繁改尺寸的动作都**不动视口**：

  - `useScreenAdapter` 重算 `scale`（只改 `#screen-content` 的 width/height/margin）；
  - 侧栏折叠、标签页最大化、窗口半屏；
  - 大屏在 `layouts/index.vue` 里被禁掉了 transition + keepAlive，回到该页时容器是重新 layout 出来的。

  这些情况下 echarts 画布停在旧宽上：轴标签被截断、右侧一大块留白、整张图糊在一起。另外确认过 **echarts 6.1.0 没有 `autoResize`**（全量 d.ts 里搜不到这个字段），所以不能靠 option 打开，只能自己挂观察器。

  ## 改动

  `apps/web/src/views/screen/monitor/index.vue`：

  - 新增常驻的 `observeChartSize(name, el)` —— 每张图建起来之后给它的容器挂一个 `ResizeObserver`，回调里 `charts.get(name).resize()`。注意 `charts` 这张 map 是按**图表名**（`'pv'` / `'uv'` …）索引的，不是按 DOM 节点，第一版按 element 取实例导致回调永远拿不到图，白跑一轮；
  - 回调里带 `clientWidth > 0 && clientHeight > 0` 的门槛：容器被 `display: none` 藏起来时尺寸是 0，此时 resize 会把画布压成 0×0，再显示出来就是一片空白；
  - `initChartImmediately` 的**两条**分支都要挂（容器立刻有尺寸的同步路径 + `whenReady` 等尺寸的异步路径），漏一条就等于"首屏没尺寸的图永远不自适应"；
  - 和 `whenReady` 那个一次性观察器分开登记进 `sizeObservers`， `onBeforeUnmount` 里 `stopObservingChartSize()` 先断观察器再 `disposeAll()` ——延续 `monitor-cleanup.spec.ts` 立下的"离开大屏不留尾巴"契约，观察器不能悬挂在已卸载节点上。

  ## 验证
  - 单测：`apps/web/src/views/screen/__tests__/monitor-cleanup.spec.ts` 新增「容器变宽变高时图表跟着 resize」—— 给观察器回调整寸，断言 `resize` 调用次数增加，卸载后所有观察器 `disconnected`。断言只统计 `resize` 次数，**不去数观察器个数**：页面里 Scrollbar、适配钩子也在挂 `ResizeObserver`，按个数断言必假红。jsdom 下所有盒子都是 0×0，所以这条用例在 `try/finally` 里把 `HTMLElement.prototype` 的 `clientWidth/clientHeight/offsetWidth/offsetHeight` 临时打成 320，用完还原。
  - 端到端：`apps/web/e2e/screen-resize.spec.ts`（chromium / firefox / webkit 各 1 条）把主图容器改成 `width: 55%` —— **全程不改视口**，再断言画布跟上。踩到过三个坑，都写进文件头注释了：
    1. `querySelector('canvas')` 的"第一张画布"会随渲染时机命中不同小图，必须认死PV 主图的容器（`[class*="min-h-[200px]"]`，全页唯一）；
    2. 量尺寸和缩容器要用**同一个 locator 句柄**，各查一次 DOM 会让用例在没修复的代码上绿掉；
    3. 容器宽度取 `clientWidth` 而不是 `getBoundingClientRect().width`（根节点被打了 `scale`，后者读到的是缩放后的视觉宽，实测 908 的容器读成 605），画布宽度取 `canvas.style.width` 而不是 `canvas.width`（webkit 上下文 dpr=2，CSS 499 对应 buffer 998）。最终判据是两条同时成立：画布比初始值**真的变小了**（`canvas < initial.canvas - 100`）且贴住新容器宽（`|canvas - host| <= 3`）。只留后者会假绿 —— 实测有过一次首帧读到尚未缩小的容器宽，8.4s 就"通过"了。反向验证：把两处 `observeChartSize` 注释掉，同一条用例稳定失败（`908 / 499`），恢复后三引擎复绿。

- f740d13: 大屏缩放改为按**内容区**计算，不再按视口。

  `useScreenAdapter` 原来用 `window.innerWidth/innerHeight` 求 scale。大屏并不是独立打开的页面，它是管理后台内容区里的一页，外面还有侧栏、标签页、面包屑和布局内边距：1440 视口下 scale=0.75、缩完正好 1440 宽，而内容区实际只有约 1198 宽 —— 右侧「资源使用率 / 地区用户分布 / 服务与告警」整列被裁到视口之外，内容区还多出一条横向滚动条。另一半问题更隐蔽：折叠侧栏、标签页放大、切「内容全屏」都只改内容区尺寸、不动视口，只听 `window.resize` 就永远停在旧比例。

  - **量谁**：宽度问容器自己（页面根节点从 `h-screen w-screen` 改成 `w-full`，块级布局给的是确定值），高度问外层滚动盒 `.scrollbar__wrap` 的 `clientHeight` 再减掉布局挂在 view 上的内边距 —— 容器自己的父级链是 `height: auto` 的滚动内容容器，量不到"可见高度"。
  - **容器高度写死**：`transform: scale()` 不改变布局占位，`#screen-content` 的布局盒子始终是 1920x1080。原来靠页面根上那句 `h-screen w-screen` 硬撑，代价就是溢出外壳；现在由适配器量出来再写死，`#screen-container` 作为 `<Scrollbar>` 自带 `overflow-hidden` 裁掉未缩放的溢出盒子。
  - **监听谁**：`ResizeObserver` 观察外层滚动盒（侧栏折叠 / 标签页放大 / 内容全屏都会碰到它），`window.resize` 只作兜底。顺带删掉一句从没被赋值的死代码 `const resizeObserver: null | ResizeObserver = null`。
  - **配套**：`layouts/index.vue` 的内容内边距改成 `shellHidden ? '' : 'p-4'`。「内容全屏 / 标签页放大」是沉浸视角，四周留 16px 会把深色大屏围出一圈白边，等于全屏没全成。

  验证：

  - 单测 `src/views/screen/__tests__/screen-adapter.spec.ts`（8 条）。jsdom 里所有盒子都是 0×0，尺寸只能逐个元素挂 getter 伪造；用例把 `window.innerWidth` 故意设成 3840，任何还在按视口算的实现都会立刻对不上。踩到的坑：`scale` 的短板可能是高度，1280x720 下 540/1080=0.5 会把折叠前后的读数钉成一样，测不出"重算"，得给一个高视口或高容器让短板落到宽度上。
  - e2e `e2e/screen-fit.spec.ts`（3 条 × 三引擎）：右侧整列不越界 + 无横向溢出、折叠侧栏后 scale 重算、内容全屏时内边距为 0 且铺满视口。判据一律用 `clientWidth` 与 `scrollWidth - clientWidth`，不碰 `getBoundingClientRect` 的缩放坐标系。
  - 反向验证：把 `measure()` 换回 `window.innerWidth/innerHeight` 并去掉 `ResizeObserver`，前两条立刻红（`scale*1920 = 1599.99 > 容器 1359`、右侧列被裁）；第三条在「内容全屏」下容器恰好等于视口，按视口算也能过 —— 这条只用来钉内边距，不冒充缩放证据。

- abfe730: fix: 修复偏好设置抽屉与多布局的五处体验缺陷

  - Scrollbar 在抽屉里改用 `min-h-0 flex-1`，滚动能到面板最末一项（原先带默认 `h-full`，与顶部分类切换条一起撑出容器被裁）
  - `side-nav` 蓝图把侧栏改回常驻（`sidebarPresentation: 'inline'`），选它不再"什么都没出现"；浮层抽屉只由窄屏触发
  - 新增 `chrome` 谷歌风格标签页（顶部圆角、不画底边、贴标签栏下沿），`TabStyle` 联合类型随之扩展
  - 设置抽屉的分段控件在 `SettingItem` 上新增 `stacked` 槽位，标签风格选择器换到下一行并铺满
  - 面包屑抽出 `LayoutBreadcrumb`：`headerLead` 为 breadcrumb 的形态住顶栏，其余落到内容列第一行，`showBreadcrumb` / `showBreadcrumbIcon` 两个偏好真正接入渲染

  同时移除 `@antdv/layouts` 中无人消费的 `sidebarOpenByDefault` 区域开关。

  端到端基线跟着补了两处计时口径：全站巡检按菜单页数分配超时预算（`E2E_SWEEP_PAGE_BUDGET`，默认每页 15s），WebKit 项目的整条墙钟从 150s 放宽到 240s —— 只放宽总时长，单步 `actionTimeout` / `expect` 一个没动，功能真坏了仍然立刻红。

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

- d8fa761: refactor: 轻提示与通知的关闭按钮改成单条可选项，默认不展示

  诉求（用户归纳）：`message` 不再默认渲染关闭按钮；`notification` 增加可配置项控制显隐；两者的默认状态统一为「不展示」，没配置传入就没有按钮；其余功能不动，配置读写与不同取值下的展示状态都要验。

  **开关落在单条，而不是 toaster**：`vue-sonner@2.0.9` 的解析顺序是 `Toast.vue:233` 的 `props.toast.closeButton ?? props.closeButton`，而 `Toaster.vue:170` 的 `closeButton` 默认 `false`。所以把开关做成 `ToastInit` 上的 `closeButton?: boolean`（`popup-ui/src/message/index.ts:67`）就能同时表达两件事——「默认没有」和「这一条要/不要」；只开在宿主那侧反而做不到后者（整体开一次，就没法让某一条不带按钮）。两条通道共用这一个键、同一条判断，`toToastOptions` 只在 `closeButton !== undefined` 时写进载荷（`:98`），所以不传时连键都不出现，载荷形状与改动前完全一致，`message` / `notification` 的方法清单仍然逐档相同。

  - **`message`（`:95-98`）**：`ToastInit` 新增 `closeButton`，`closeButton: true` 才有 ✕。原来的"轻提示一律带按钮"来自宿主的整体开关，现在宿主不开了，所以默认无按钮就是默认无按钮，不是靠这层特判。
  - **`notification`**：同一个键，同一个口径，走对象写法（`notification.info('标题', { closeButton: true, description: '描述' })`）。数字/字符串两档简写不带开关——那两个位置已经有含义，再往里塞布尔只会让人猜（`normalizeInit` 的注释记了这条）。
  - **宿主（`apps/web/src/App.vue:60-70`）**：两只 `<Toaster>` 都去掉 `close-button`，`close-button-position="top-right"` 留着，它只给"显式开了 ✕ 的那条"定朝向。
  - **示例页（`apps/web/src/views/components/feedback/index.vue`）**：通知那组改成 `{ closeButton: true, description }`，另加一张「关闭按钮开关」卡把四档都点出来（轻提示开 ✕ / 轻提示不开 / 通知开 ✕ / 通知不传），页面文案跟着改掉「点右上角 ✕ 或等 3 秒」那句已经不再适用于所有条目的说明。
  - **单测**：`popup-ui/__tests__/message.test.ts` 新增一组 5 条（默认不写键 × 两条通道、简写不带开关、`true` 原样透传、轻提示侧同样生效且仍不带 `toasterId`、显式 `false` 要写进载荷），整包 18/18；`common-ui/__tests__/toast.test.ts` 补一条外壳层的默认口径（不传 props 就不该有 `[data-close-button]`）。
  - **e2e**：`apps/web/e2e/preference-effects.spec.ts` 里原来那条「两条通道都能点 ✕」改成按单条口径断言（轻提示默认无按钮、通知那条有并点了立刻收），另加一条专测开关本身；卡片样式对照表里去掉了 ✕ 数量这一维，因为它已经不再是两条通道的公共属性。同一轮补了一处**早就缺的等帧**：`/account/settings` 那条 warning 在量 `elementFromPoint` 之前没调 `settleToast`，slide-in 头几帧整张卡片还在视口上沿之外、命中测试拿到 `null`，于是 WebKit 稳定假红（Chromium / Firefox 恰好读得晚所以看不出来；缩小到单条复跑仍红 → 补 `settleToast` 后通过）。
  - **文档**：`docs/components/modal-drawer.md` 与 en 镜像的「为什么根部要挂两只 `<Toaster />`」一节重写（原话「两只都开 `close-button`」已过期），签名表与行号引用同步（`message/index.ts` 从 128 行变 141 行，`NOTIFICATION_TOASTER_ID` 从 `:33` 移到 `:34` 等）；`docs/zh/**` 那份副本按 `docs/.vitepress/config.mts:14-15` 的口径不写入。

  顺带两处类型口径修复：`apps/web/tsconfig.vitest.json` 的 `types` 是**覆盖**不是追加，原来漏了 `vite/client`，于是 `ImportMetaEnv` 没有索引签名、被测源码里的 `import.meta.env.VITE_APP_BASE_API` 报 TS2339；补上之后该项目的报错从 74 降到 66，`src/plugins/**` 与其新增用例全部干净。`types/env.d.ts:1-4` 顶部那几行 `<reference>` 也被 `spaced-comment` 拆成了 `// /`（本仓库文档里记过这个失效形式），所以它指望不上，`types` 里必须显式列。

  验证：`popup-ui` 单测 18/18、`vue-tsc --noEmit` 该包 0 错、`common-ui/__tests__/toast.test.ts` 8/8；`apps/web` 的 `src/plugins/__tests__` 18/18、`vue-tsc -p tsconfig.app.json` 90 条存量错且无一条落在本轮改动文件、`-p tsconfig.vitest.json` 66 条同样不含 `src/plugins/**`。清掉 `apps/web/node_modules/.vite` 后重启 :6080（Nitro mock 5320 一起起），确认 dev 侧拿到的 `App.vue` / `feedback/index.vue` transform 已不含 `close-button`；`preference-effects.spec.ts` 三引擎各 `--workers=1` 整跑：chromium 10/10（1.7m）、firefox 10/10（2.8m）、webkit 10/10（补上等帧后那条单跑 57.4s 通过）。用例全程挂 `watchErrors`，四种配置组合（轻提示开/关、通知开/关）的按钮显隐与"点了立刻收"都在浏览器里读实值断言，控制台无新增报错。

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

- 340f692: refactor: `apps/web` 的通用 composables 与无业务耦合组件迁进对应子包（hooks / common-ui / table-ui），web 侧只留业务件

  诉求（用户归纳）：把 web 子包 `composables/` 与 `components/` 里"可复用公共内容"统一迁到对应子包，保留类型、响应式逻辑与功能兼容，更新全部引用路径，迁完清理冗余并同步文档。判据沿用仓库既有一条：**换一个项目还能不能用**——能就进包，需要应用配置/store 单例/应用内组件类型的留在 `apps/web`。

  - **`usePermission` → `packages/core/hooks/src/use-permission.ts`（184 行，`@antdv/hooks`）**：原 `apps/web/src/composables/web/permission/`（`usePermission.ts` + `types.ts` + `index.ts`）整目录搬走，七个判定函数、四个枚举（`PermissionAction` / `PermissionMode` / `PermissionResource` / `PermissionRole`，枚举在 `:27-32`）与 `UsePermissionOptions` 全部原样保留。它能进 hooks 的理由写在包入口注释里：这是唯一读会话状态的 hook，但只认 `@antdv/stores` 的 user store，不读路由实例、不发请求，因此子包可直接复用。消费点三处改为从包里引：`apps/web/src/directives/index.ts:13`、`apps/web/src/plugins/table-runtime.ts:1`、`views/components/table/crud/index.vue:34`。单测跟着搬（`packages/core/hooks/__tests__/use-permission.test.ts`，6 条）。**顺带纠正一条写错的文档**：`docs/components/directive-drag.md` 原来断言 `permissions: ['*']` 在元素层"什么都不授予"，实际上 `checkArrayMatch()` 第一件事就是 `userList.includes('*')` 直接返回 true（`use-permission.ts:91-93`），而 `v-permission` 的 `resolveAccess()` / `matchGroup()`（`packages/directives/src/permission/utils.ts:82-108`、`:53-68`）整条链都委托给注入的 checkers——所以 mock 给 admin 发的 `['*']`（`apps/backend-mock/server/utils/accounts.ts:48`）是全量放行。这条通配在迁移前的 `git show HEAD` 里就存在，迁移没有改变行为，是文档口径错。
  - **`useCRUD` → `packages/core/hooks/src/use-crud.ts`（393 行）**：入参/返回、`containerType`、批量删除内置那一次确认框（现在显式走 `@antdv/popup-ui` 的 `confirm()`，`use-crud.ts:277`）都没动。**依赖方向是要设计过的**：它对 `@antdv/form-ui` / `@antdv/table-ui` 只取 `*ActionType` 这几个**类型**（`use-crud.ts:1-3`），运行时只碰 popup-ui 的 `confirm` / `message`（`:8`），所以 `ui-kit → hooks` 这条边不成环。测试 28 条一并迁入，`apps/web/src/composables/__tests__/use-crud.spec.ts` 删除。
  - **`MicroAppContainer` → `common-ui/src/components/micro-app-container/`（162 行 + `types.ts` 18 行）**：micro-app SDK 派发的四个 window 事件（`beforeload-` / `mounted-` / `unmount-` / `error-${name}`）用 `useEventListener` 收敛成 props/emits（`:76-79`），加载遮罩、失败重试与"未配置地址"占位都在组件内。`<micro-app>` 标签由 `internal/vite-config` 的 `isCustomElement` 认下（`plugins/custom-elements.ts`、`plugins/vue.ts:43`），组件不声明局部组件，否则会有 `Failed to resolve component` 警告。
  - **`ECharts` → `common-ui/src/components/charts/`（65 行），只走子路径 `@antdv/common-ui/charts`**：`import * as echarts from 'echarts'` 会把全量注册表拖进来，所以它和 `@antdv/hooks/echarts` 同口径**故意不进根 barrel**（豁免注释在 `charts/index.ts:1-5`）。`EChartsProps` 也只从子路径导出。
  - **`TreeTable` → `table-ui/src/components/TreeTable.vue`（301 行），而不是 common-ui**：组件内部渲染的就是 `BasicTable`，而 `table-ui → common-ui` 这条依赖已经存在，反向引用会让两个包成环。类型进 `table-ui/src/types.ts:1071-1108`（`TreeDataNode` / `TreeTableFetchParams` / `TreeTableProps` / `TreeTableEmits`），从包根导出（`table-ui/src/index.ts:9`）。对外分页字段仍是 `page`，由内部 `pageNum` 换算（`TreeTable.vue:136-142`）——这是 `FetchParams` 与组件契约之间唯一的翻译点，别改成直接透传。搬迁后端到端验证顺带修掉一个从原 `apps/web` 版本就带着的缺陷：右侧表格由 `selectedKey` 才挂载，第一次点树节点时 `reload()` 跑在组件注册之前，选中了却取不到数（表现为空表格）。现在在 `handleTreeSelect` 里 `await nextTick()` 再 `reload()`，回归用例见 `apps/web/e2e/tree-table.spec.ts`。
  - **导出规范与样式管理**：`common-ui` 三个出口保持 `.` / `./charts` / `./package.json`；迁移后根 barrel 实测 55 个值导出 + 66 个类型导出（`UploadProps` 仍未转口，`EChartsProps` 只在 `./charts`）。组件一律 `components/<kebab>/<Pascal>.vue` + `types.ts` + `index.ts`，样式走 shadcn 语义 token（`bg-background` / `text-muted-foreground` 一类），不新增裸色值。
  - **web 侧清理（收尾一轮做完）**：`apps/web/src/components/` **整目录删除** —— `business/ImportExport.vue` → `@antdv/common-ui/import-export`，`common/AvatarUploader.vue` → `@antdv/common-ui/avatar-uploader`，`common/Upload/**` → `@antdv/common-ui/chunk-upload`，`layout/ReloadPrompt.vue` → `components/reload-prompt/` 并进根 barrel；`business/TenantSelect.vue` 直接删掉，`grep -rn TenantSelect apps packages` 为空。`Upload.vue` 在包内改名 `FileUpload.vue`：`components/upload/` 早就占着 `Upload` 这个名字（`upload/index.ts` 同时导出 `Upload` 与 `UploadDragger`/`UploadList`），两个入口共用一个名字会让人分不清拖拽壳和基础件。`apps/web/src/composables/useLocale.ts` → `packages/core/hooks/src/use-locale.ts`，按 `@antdv/hooks/use-locale` 深路径暴露（唯一牵 vue-i18n 的组合式函数，进根 barrel 等于让每个 `@antdv/hooks` 消费者都付一份 i18n 运行时），消费点 `App.vue`、`plugins/layouts-host.ts`、`views/{login,register}/index.vue`、`locales/__tests__/locale.spec.ts` 全部改成从包里引。
  - **自动导入声明跟着收**：`unplugin-vue-components` 的注册范围就是那个被删掉的目录，所以 `apps/web/types/components.d.ts` 里的 6 条（`AvatarUploader` / `ChunkUpload` / `ImportExport` / `ReloadPrompt` / `TenantSelect` / `Upload`）必须清掉 —— 留着不会报错，但会把"裸标签能用"这个假象留在类型层，实际运行时解析不到组件。现在只剩 `RouterLink` / `RouterView`。
  - **文档同步**：`docs/components/{index,common-ui,chart-cron,table,directive-drag}.md` 与 en 镜像、`docs/{guide,zh/guide,en/guide}/in-depth/{common,composables}.md`、`docs/{guide,zh/guide,en/guide}/essentials/utils.md` 逐条把路径与行号对回当前实现；三副本一致性用"`docs/zh` 去掉 `/zh` 前缀后与 canonical 逐字节相同"校验。`~/components/business/{Table,Form}` 一类的旧 import 全量替换为 `@antdv/{table-ui,form-ui}`。

  验证：`@antdv/hooks` 构建 + `vue-tsc` 绿、包内 10 个测试文件 102 条用例全绿；`@antdv/common-ui` `vue-tsc` 绿；这一轮迁进来的四件按包内既有口径补了单测（`__tests__/chunk-upload-hash.test.ts` 8 条、`import-export.test.ts` 7 条、`reload-prompt.test.ts` 9 条，`upload.test.ts` 覆盖基础件），`useLocale` / `useLocaleSync` 的行为断言留在 `apps/web/src/locales/__tests__/locale.spec.ts`（它要 vue-i18n 实例与语言包，那两样都住在应用侧）；`pnpm turbo run test:unit --concurrency=2` 32/32；`vue-tsc -p tsconfig.app.json` 剩 98 条且**没有一条能归到这次迁移**（迁移前 109）；`node _linkcheck.mjs .` 与 `node _sidebarcheck.mjs .`（在 `docs/` 下跑）均为 0 missing。浏览器侧需要重启 :6080 dev server 再看 `/components/chart`、`/components/table/tree-table`、`/components/table/crud`、`/components/directive`、`/micro-app` 五个页面——hooks 走 dist 产物，不重启会读到旧 chunk。Playwright（chromium）在这台 dev server 上跑过：新增的 `apps/web/e2e/tree-table.spec.ts` 2 条（选部门驱动取数 + 搜索过滤树，首次点击就取到数正是上面那个 nextTick 修复的验收点）、`e2e/table-crud.spec.ts` 4 条（`useCRUD` 全链路 + custom 账号的按钮级权限）、`e2e/permission-accounts.spec.ts` 7 条、`e2e/site-sweep.spec.ts` 2 条（全站菜单叶子逐页打开，本站错误为零），合计 15 条全绿。

- d8fa761: refactor: `apps/web/src/plugins` 逐个梳理，vue-query 客户端下沉为 `@antdv/request/vue-query`

  诉求（用户归纳）：把 `apps/web/src/plugins` 下所有插件梳理清楚（文件、配置项、依赖、调用链），按新架构规范适配，保留原有导出与调用参数，逐个补功能验证与单测，同步依赖声明与文档，最后无残留、无控制台报错。

  **先划清范围**：`internal/vite-config/src/plugins/` 那 20 个是构建期 Vite 插件，跟这次的"运行时装配模块"不是一回事。`apps/web/src/plugins/` 是应用入口的**五个装配模块**，每个都只做一件事——把"只有应用才知道的能力"注进包里。调用链在 `apps/web/src/main.ts`，全部早于挂载：`configureRequestRuntime()` `:50` → `configureUiKitRuntimes()` `:56` → `configureLayoutsHost()` `:61` → `configureTableRuntime()` `:63` → `getPreferences()` `:69` → `setupVueQuery(app)` `:71`。

  - **`query.ts` 是唯一该搬走的那个**：它只读 `import.meta.env.VITE_APP_BASE_API`？不，它连 store 和路由都不碰，内容就是一个 `QueryClient` 加 `app.use(VueQueryPlugin)`，跟应用没有任何耦合，而它的重试策略又必须和 `@antdv/request` 的 executor 对齐（传输层重试归 executor 的 `withRetry` + 401 重放，vue-query 这边 `retry: false`，两层不能叠加）。于是整模块下沉为 `packages/request/src/vue-query.ts`，走**子路径导出** `@antdv/request/vue-query`，与 `./sse`、`./websocket` 同口径不进根 barrel。导出名（`queryClientConfig` / `queryClient` / `setupVueQuery`）、参数与默认值一字未改；`package.json` 加 `@tanstack/vue-query`（catalog `^5.104.2`）与 `./vue-query` 出口，`//exports` 注释同步改成"四档"。全仓 `queryClient` 只有 `main.ts` 一个 importer，所以不存在"两个 QueryClient"的风险；`apps/web` 仍保留 `@tanstack/vue-query` 依赖，因为 `src/api/query.ts` 直接用它。
  - **另外四个留在应用，不是没梳理完，是搬不动**：`ui-runtime.ts` 注 `t` / `translateMenu` 给 `@antdv/layout-ui`、`menu-ui`、`tabs-ui`；`request-runtime.ts` 注 baseUrl / loginPath / 凭证读写 / `onLogout` 给 `@antdv/request`；`table-runtime.ts` 注权限判定与错误文案给 `@antdv/table-ui`；`layouts-host.ts` 注接口、推送通道、账户页、语言候选与滚动条偏好给 `@antdv/layouts`。这四个各自 import `~/locales`、`~/config/*`、`~/api/system`、`~/utils/ws`、`~/views/account/*`，包反向依赖应用就是循环，turbo 直接编不过。**它们的导出名、函数签名、调用参数与配置读取口径全部保持原样**，逐个核对后不需要改造（连 import 顺序都不动：文档里有 5 处按行号引用 `request-runtime.ts:16/22/24`，挪一行就断一次）。
  - **单测按每个模块的实际情况分两种写法**：新增 `packages/request/__tests__/vue-query.spec.ts`（3 条）钉住 `retry: false` 这套默认策略、`queryClient` 是按它建出来的同一个实例、`setupVueQuery` 挂的是它而不是新建一个。四个应用侧模块只能写成"注入完再读包那边的 runtime"：`test/setup.ts` 会先 `configureUiKitRuntimes()` 并 import `~/locales`，setup 比用例里的 `vi.mock` 先执行，被它摸过的模块之后替换不掉，所以 mock 模块这条路对 `ui-runtime` 根本走不通。`apps/web/src/plugins/__tests__/` 共 18 条：`ui-runtime`（4）断言三个包的 `t` 拿到的是译文、能插值、`translateMenu` 能区分"没这个键"与"值和键同名"、切语言后现取现算；`request-runtime`（4）断言前缀与登录页交给包、access 走 user store 而不读缓存里那串密文、refresh 走缓存、`onLogout` 收的是 `logout()`；`table-runtime`（5）断言配置阶段不取 store（入口在 pinia 就绪前也能调）、权限跟着 store 变、未登录一律判否、错误文案复用请求层解析、提示走应用的 `message`；`layouts-host`（5）断言语言候选与标签、滚动条偏好、账户页是两个独立异步块、通知三个接口接到应用 api、推送载荷原样交给包且退订用的是 ws 返回的那个函数。`packages/request/__tests__/structure.spec.ts` 的"src 根目录只有约定的这些文件"清单补 `vue-query.ts`。
  - **文档同步**：`docs/guide/essentials/request.md` 与 en 镜像加"数据请求客户端：`@antdv/request/vue-query`"一节（默认策略三条 + 为什么走子路径），顺手改掉一处写错的约束——原文把 `ui-runtime.ts` 和 `request-runtime.ts`、`table-runtime.ts` 并列为"测试 setup 不能碰"，实际 `test/setup.ts` 调的正是 `ui-runtime`（它只注入文案，不碰 store），现在按真实边界重写。`docs/guide/essentials/utils.md` 与 en 镜像的"靠依赖注入拿应用能力"表加一行说明客户端与安装已在包里、入口装一次。`docs/zh/**` 那份副本按 `docs/.vitepress/config.mts:14-15` 的口径**不再写入**。

  验证：`npx turbo run test:unit --concurrency=1` 48/48 成功（含 `@antdv/request` 9 个文件、`@antdv/web` 20 个文件 119 条）。`turbo run type-check` 47/48，唯一红的仍是 `@antdv/web#type-check` 的 90 条存量错，全部落在 `src/views/**`、`src/api/mock.ts`、`stores/modules/dict.ts`、`composables/usePasswordPolicy.ts` 这些历史文件，`src/plugins/**` 与 `main.ts` 一条没有；`tsconfig.vitest.json` 那个项目单跑 66 条（同样不含新增用例，`vite/client` 那条修复记在 `.changeset/toast-close-button-per-item.md`）。:6080 按重启配方清 `.vite` 后重起，入口装配与顶栏铃铛、语言切换在浏览器端复核，`preference-effects` 三引擎整跑无控制台报错。

- c1e9020: fix: 链接的光标不再靠浏览器内建样式表（WebKit 静止态算 `auto`），并修好 WebKit 专属墙钟其实从未生效这件事

  背景：本轮 `BasicTable` / `BasicForm` 重构按"三引擎都绿才算绿"的口径整跑端到端时，`e2e/cursor.spec.ts` 在 webkit 上红了两条。两条都不是这次改动带进来的，但都归到这一条 changeset 里，因为它们会一直制造"看起来像重构改坏了"的假红。

  - **链接光标（真缺陷，只在 Safari 内核现形）**：全站兜底扫描报 `/system/user` 的面包屑"系统管理"与顶栏的 GitHub 链接算出来是 `cursor: auto`。用一份最小页面探针复跑两个引擎：同一个裸 `<a href>`，Chromium 的 UA 样式表给 `pointer`，WebKit 静止态给 `auto`（`class="cursor-pointer"` 那种显式声明两边都是 `pointer`，差异纯粹来自内建样式表）。所以这不是"Safari 抽风"，而是**我们只在 Chromium 上验过**。修法按 `design/css/base.css` 的既有主张来 —— 能点的元素自己在样式层写死，不赌 UA 默认：新增 `@layer base { a[href] { @apply cursor-pointer; } }`。**必须待在 `@layer base` 里**：这个文件其余光标规则是无层级的，层外规则压过全部工具类，链接要是也写层外，`<a class="cursor-not-allowed">`（禁用态下载链接这类显式表态）就会被盖掉。守门断言同步进 `design/__tests__/design.test.ts` 的光标那条。
  - **WebKit 的 240s 墙钟从来没生效（假红发生器）**：`playwright.config.ts` 里 WebKit 的 `timeout: 240_000` 写在 `use` 里 —— `use` 装的是 fixture 选项，`timeout` 不在其中，于是它既不报错也不生效，实际执行的仍是顶层 `timeout: 90 * 1000`。失败信息里的 `Test timeout of 90000ms exceeded` 就是证据：注释里"webkit 单跑立刻绿、只放宽墙钟不动单步超时"这条经验一直没落地。改成项目级字段（`TestProject.timeout`），`actionTimeout: 45_000` 保持在 `use` 里不动 —— 它是真的 fixture 选项，各步 15s/45s 的判据一个没改，功能真坏了仍然立刻红。

  验证：`@antdv/design` 单测 `__tests__/design.test.ts` 32/32（含新断言：`a[href]` 的 `@apply cursor-pointer` 必须在 `@layer base` 块内）；`e2e/cursor.spec.ts` 单跑 `--project=webkit` 4/4 绿（此前 2 红），首条用例 54.5s —— 在旧配置下就是被 90s 墙钟咬死的那条；chromium / firefox 复跑结果见下。

- Updated dependencies [2f1a233]
- Updated dependencies [f64fc3a]
- Updated dependencies [c1e9020]
- Updated dependencies [340f692]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [f740d13]
- Updated dependencies [5194446]
- Updated dependencies [d8fa761]
- Updated dependencies [54d880b]
- Updated dependencies [c1e9020]
- Updated dependencies [f740d13]
- Updated dependencies [340f692]
- Updated dependencies [f64fc3a]
- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
- Updated dependencies [340f692]
- Updated dependencies [54d880b]
- Updated dependencies [abfe730]
- Updated dependencies [d8fa761]
- Updated dependencies [2f1a233]
- Updated dependencies [abfe730]
- Updated dependencies [d8fa761]
- Updated dependencies [54d880b]
- Updated dependencies [f64fc3a]
- Updated dependencies [340f692]
- Updated dependencies [d8fa761]
- Updated dependencies [c1e9020]
  - @antdv/common-ui@0.1.0
  - @antdv/popup-ui@0.1.0
  - @antdv/shadcn-ui@0.1.0
  - @antdv/table-ui@0.1.0
  - @antdv/tabs-ui@0.1.0
  - @antdv/form-ui@0.1.0
  - @antdv/design@0.1.0
  - @antdv/shared@0.1.0
  - @antdv/utils@0.1.0
  - @antdv/preferences@0.1.0
  - @antdv/directives@0.1.0
  - @antdv/hooks@0.1.0
  - @antdv/layouts@0.1.0
  - @antdv/router@0.1.0
  - @antdv/types@0.1.0
  - @antdv/icons@0.1.0
  - @antdv/enums@0.1.0
  - @antdv/stores@0.1.0
  - @antdv/request@0.1.0
  - @antdv/layout-ui@0.1.0
  - @antdv/menu-ui@0.1.0
