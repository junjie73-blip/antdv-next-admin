# @antdv/backend-mock

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

- Updated dependencies [abfe730]
- Updated dependencies [abfe730]
  - @antdv/types@0.1.0
