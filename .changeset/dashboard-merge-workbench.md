---
"@antdv/backend-mock": patch
"@antdv/web": patch
---

feat: 分析面板吸收工作台，`/dashboard/workbench` 下线

诉求：**分析面板和工作台合并**。两个页面上半段本是同一批东西（欢迎语 + 4 张统计卡 +
今日访问之类的 KPI），放在一起等于自己跟自己重复；确认后口径是保留
`/dashboard/analysis`（`HOME_PATH` 与标签页标题「分析面板」都不变），工作台独有的
两块内容并进来。

- **KPI 区合并成 6 张**：工作台的总用户数 / 活跃会话 / 告警数量进 `kpiList`；
  两边的「今日访问」是同一个指标，只留一条。`trendLabel` 改成可选（告警数这种
  说不出"较什么"的，就只显示涨跌箭头），新增 `cyan` / `red` 两个图标底色。
  容器从 `a-row :xs=12 :sm=6`（固定 4 列）换成 `grid`（1/2/3 列响应式）：
  6 张卡在 4 列下会留下"第二行只有两张"的半空行，3 列正好整除。
- **快捷操作 / 最近动态**作为第五行两列并进来，标题区顺带带上日期。
- **顺手修掉两处光标谎言**：原工作台的四个快捷格子是 `cursor-pointer` 却没有任何
  点击行为的 `<div>` —— 亮着、能悬停、点了没反应。合并时全部换成 `RouterLink`，
  落到真实路由上；其中「安全审计」从来没有对应页面，换成可访问的「系统日志」
  （`/system/log`，菜单里 `hidden` 但仍放行）。KPI 卡片同样挂着 `cursor-pointer`
  却不可点，一并摘掉（它保留 hover 阴影，只是不再谎称能点）。
- **下线干净**：删掉 `views/dashboard/workbench/`，同时从菜单种子（它既是路由表
  来源也是权限来源）里删掉「工作台」记录，清掉 `locales` 里再没人用的 `workplace` 键，
  `layout.spec.ts` 里以工作台为导航目标的断言改指分析面板。只删页面不删种子，
  侧栏会留下一条点不动的菜单。

验证：
- 单测 `apps/web/src/views/dashboard/__tests__/analysis-merge.spec.ts` 5 条，打在静态契约上
  —— 挂载有 7 张 echarts 的分析页只会得到一堆 stub，而这几条坏法本来就是"数据写错"型：
  每个快捷操作路径都必须在菜单种子里存在（先断言抓到了 ≥4 条，防空跑）、工作台从种子
  与页面一起消失、KPI 标题不许重复、快捷格子必须是 `RouterLink` 且不带 `cursor-pointer`、
  根容器自己不加 padding。
- e2e `apps/web/e2e/dashboard-merge.spec.ts` 3 条 × chromium / firefox / webkit 全绿：
  侧栏查无工作台、真的从分析面板点进 `/system/user` 与 `/screen/monitor`、两个新区块渲染。
  WebKit 首轮在裸 `expect(tab(...))`（10s）上假红 —— dev 下首进 `/system/user` 要现场编译，
  冷跑超过 10s；改用夹具里幂等的 `go()`（末次 20s）后三引擎稳定。
- `pnpm test:unit` 21/21 任务（web 245 测试）全绿，改动文件 eslint 干净。
