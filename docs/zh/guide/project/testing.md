# 测试策略

质量口径是三件事同时成立：**单测绿、端到端三引擎绿、提交前清理干净**（不留调试代码、不留 `.only`、不留临时 spec）。任何一条没跑完就不要说"改好了"。

## 单元测试

```bash
pnpm test:unit                 # turbo 全仓（21 个任务，按依赖图先 ^build）
pnpm --filter @antdv/shared test:unit
cd apps/web && pnpm exec vitest run src/views/__tests__/page-root-padding.spec.ts
cd apps/web && pnpm exec vitest run -t "关键字"
```

分层做法：

| 位置 | 测什么 |
| --- | --- |
| `packages/*/__tests__` | 纯逻辑：XSS 转义、缓存、加密、偏好落 DOM、区域蓝图、守卫流程。子包不 import pinia，所以不需要 mock store |
| `apps/web/src/**/__tests__` | 应用内组合层：store、布局装配、**源码契约** |
| `apps/web/test/` | 仓库级对账，例如图标名真实性 |

::: tip "源码契约"是本项目的特色层有些规则只有扫源码才钉得住：路由页面根容器不许写 padding（`page-root-padding.spec.ts`）、登录页强调色不许写死（`login-styles.spec.ts`）、标签风格 class 集合（`tab-style.spec.ts`）、API 不许静默用错（`gallery-api-usage.spec.ts`）。:::

::: danger 静态守卫必须配正反样例只断言"现存代码里 0 命中"是不够的 —— 正则写错（比如漏了转义、扫错了目录）时结果同样是 0 命中，守卫会静默变成一条永远绿的空检查。所以每条规则都带两组样例：**必须被抓到**的错写法，和**不许误伤**的正确写法，外加一条"扫描范围非空"的 sanity 断言（如 `expect(FILES.length).toBeGreaterThan(30)`）。:::

## 端到端

```bash
cd apps/web
VITE_WRITE_DTS=false pnpm exec playwright test gallery-examples --project=chromium --workers=1 --reporter=line
pnpm exec playwright test --project=chromium --project=firefox --project=webkit   # 全量三引擎
pnpm test:e2e:install            # 首次要装三个浏览器内核
E2E_HEADED=1 pnpm exec playwright test    # 本地调试弹窗跑
```

配置里几个**不是默认值**的决定（`apps/web/playwright.config.ts`）：

- **端口来自 vite 配置**（`VITE_PORT=6080`），不区分 dev / preview：preview 端口和 dev 不一致，而 mock 只挂在 dev 上，CI 也用 dev，少一半环境差异；已有服务在跑就直接复用（`reuseExistingServer: true`），所以本地起着的 dev 不用关。
- **`workers` 本地压到 3**：默认值（核数/2）× 3 个引擎会把本机打满 —— 被占满的不只是浏览器，还有那个同时扛着 Vite 按需编译和进程内 Nitro mock 的单 dev server 进程，结果是一堆 "纯超时"的假红。CI 串行（`workers: 1`，`retries: 2`）。
- **WebKit 单独放宽计时**（`actionTimeout: 45s`、整条用例 `timeout: 240s`）：它在本机比另外两个引擎慢 3-5 倍。只放宽**墙钟**，各步的 `actionTimeout` 与 `expect` 超时一个没动 ——功能真坏了仍然立刻红。
- **`baseURL` 是唯一外部地址来源**，用例里一律写相对路径（`/#/login`），换地址用 `E2E_BASE_URL` 覆盖，不改代码。
- 报告：`list` + `html`（不自动打开浏览器）。失败现场在 `apps/web/test-results/<用例目录>/error-context.md`：错误详情 + 页面 aria 快照 + 代码片段，先读它再猜。

e2e 夹具在 `apps/web/e2e/utils/app.ts`：`signIn` / `go` / `navigate` / `expectActivePath` / `watchErrors` / `HOME_PATH`。两条口径要记住：

- `go()` 会断言标签页激活，所以**不能用在只做重定向的路由**上；纯跳转用 `navigate()`（直接改 hash），落地判断按地址（`toHaveURL(/#\/error\/404/)`）而不是按标签激活状态。
- `watchErrors(page)` 把"本站控制台错误 / 接口 4xx-5xx / 第三方噪音"分桶，每页一个新探针并用完 `stop()`，否则上一片的桶会把后面的错误也收进来。

## 巡检型用例的两类假信号

`site-sweep.spec.ts` 会遍历菜单里每个叶子页面，它教过两件事：

1. **假阳**：巡检靠"内容区文本里有没有 `页面不存在`"抓死链接，而示例页正好把 404 的 `a-result` 当素材摆在 `a-card` 里 —— 好页面被判成兜底页。修法是判定**跳过卡片内的文字** （真兜底页是裸的 h1/p），并补一条"死链接要认得出、示例页的 404 卡不能误判"的正反用例。
2. **假红**：WebKit 整跑时把 `/system/user` 判红，现场快照停在**上一个**页面（实时监控大屏，它自己还在跑定时器），标签页始终没出现 —— 导航还在路上，不是页面坏了。巡检是"每页都能打开"的存在性检查，不是性能闸门，所以给这个引擎单独放宽等待；另外两个引擎保持紧，真退化立刻红。

::: tip 判断"计时问题"还是"真坏了" 只重跑那一个引擎、那一条用例：`--project=webkit e2e/xxx.spec.ts -g "名字"`。单跑立刻绿 + 整跑红 ⇒ 环境/并发；单跑也红 ⇒ 真问题，去读 `error-context.md`。:::

## 断言要落在"用户看得见的结果"上

antdv-next 1.6 的 DOM 和老 API 差别不小，写断言时的既成事实：

- 线形进度条是 `rail / track / indicator` 三段，旧的 `.ant-progress-bg` 没了，百分比在根节点的 `aria-valuenow` 上；
- `editable-card` 会渲染**两个** `.ant-tabs-nav-add`（常驻 + 溢出收纳区），要 `.first()`；
- 切换后旧面板只是 `ant-tabs-content-hidden`，仍留在 DOM 里，取内容用 `[role=tabpanel][aria-hidden=false]`；
- Timeline 是拿 Steps 的 DOM 实现的（每个 `.ant-timeline-item` 同时挂着 `ant-steps-item`），页级选择器会多数，要圈进卡片；
- message 的 wrapper 与 notice 两层都带 `ant-message-<type>`；两个汉字的按钮可访问名会被写成「成 功」（中间插空格），`getByRole({ name: '成功', exact: true })` 选不中。

比选择器更可靠的口径是**行为**：点了提示真的出现又消失、进度值真的在涨、过滤后列表真的变短、权限勾选后按钮真的自己翻正。

## 收尾清单

提交前自查（本项目的固定动作）：

- [ ] `pnpm test:unit` 全绿
- [ ] 相关 spec 三引擎绿（改到布局/样式/交互类就必须跑非 Chromium 引擎）
- [ ] `pnpm exec eslint <改动文件>` 干净
- [ ] 没有 `test.only` / `console.log` / 临时探针 spec
- [ ] 改了 `packages/*` 就重新构建并**重启 dev** 再验证（浏览器读的是 `dist`）
- [ ] 值得记版本的改动补了 changeset
