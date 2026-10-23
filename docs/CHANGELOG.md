# @antdv/docs

## 0.1.0

### Minor Changes

- f740d13: feat: 新增中英双语 VitePress 文档站，并补上 CI 门禁与两条独立发布链路

  诉求：**"需要添加 docs 子包，并需要修改对应的 ci，这个项目部署在 vercel 上，然后需要调整部署"**，后续追加：**"README.md 要更新，补充英文版，然后 docs 子包也得支持英文；docs 使用 github actions 而不是 vercel，部署文档，只需要进行文档构建就行，不需要 e2e,lint,type-check；docs 包与 apps 齐平，然后增加语言切换功能"**。

  ## `docs/`（`@antdv/docs`）：与 `apps/` 齐平

  最早放在 `apps/docs`，理由是 `pnpm-workspace.yaml` 的 glob 只认 `internal/*` / `packages/*` / `apps/*` / `scripts/*`，根目录裸放的 `docs/` 不会被识别为 workspace 成员。按新的口径改成 **顶层 `docs/`**，代价是 glob 里要显式加一行 `- docs` —— 这一行是必须的，不是可选的排版：漏了它 `pnpm --filter @antdv/docs` 会直接报 "No projects matched"，而 turbo 的依赖图里也不会有这个任务。

  10 个页面全部按本仓库的真实事实写（包清单、`LAYOUT_BLUEPRINTS` 字段、CSS 变量名、 `defineMockRoute` 的入参语义、Playwright 配置里那几个非默认值、253 条类型存量），不是通用教程。依赖只有 catalog 里的 `vitepress`，没引新第三方库。

  ## 双语：`/zh/` 与 `/en/`，根路径是语言选择页

  `locales` 用**路径当 key**（`'/zh/'`、`'/en/'`），根路径留给一个只做分流的选择页。两边**文件名必须一致**（`zh/layout.md` ↔ `en/layout.md`），因为语言切换靠的就是路径映射。

  语言切换**没有自写组件**。默认主题里的 `VPNavBarTranslations` / `VPNavScreenTranslations` / `VPNavBarExtra` 会读 `useLangs({ correspondingLink: true })`：只要每个 locale 给了 `label`，导航栏（和窄屏的汉堡菜单）就自动出现语言菜单，并且按 `page.relativePath` 剪掉当前 locale 前缀、拼到目标 locale 上 —— 也就是**从 `/zh/layout` 点过去就是 `/en/layout`**，不是跳回首页。所以这里要做的只是把 `label` 配齐，加组件反而是多余的维护面。

  搜索文案按 locale 覆盖（`search.options.locales['/zh/'].translations`），英文用 VitePress 自带文案。

  ## 部署拆成两条链路
  - **管理后台**：Vercel（`apps/web/vercel.json`，Root Directory = `apps/web`）。
  - **文档站**：GitHub Actions → GitHub Pages（`.github/workflows/docs.yml`），**只构建 + 发布**，不跑 lint / type-check / e2e。

  这条切分是有理由的：`ci.yml` 守的是应用代码，文档一次笔误不该让三个引擎的 e2e 重跑；反过来应用的 253 条存量类型错误也不该挡住文档上线。`docs.yml` 的触发面收窄到 `docs/**` + workflow 自身 + `pnpm-lock.yaml` / `pnpm-workspace.yaml`，PR 只构建不部署（`if: github.event_name != 'pull_request'`）。前置条件是仓库 Settings → Pages → Source 选 **GitHub Actions**，这一步没做的话 `deploy` job 报的是 "Pages either do not exist or are disabled"，从日志看不出是自己漏了设置。

  `apps/docs/vercel.json` 随之删除 —— 文档不再走 Vercel。

  `base` 交给 workflow 的 `VITEPRESS_BASE`：Pages 项目站挂在 `https://<user>.github.io/<repo>/` 下，路径不对的症状是"HTML 在、样式与脚本全 404、页面裸奔"，而配置里默认 `/` 让本地 dev/preview 的 URL 保持干净。绑自定义域名时只改这一个环境变量，不在 `config.mts` 里硬编码。

  ## 为什么 `ci.yml` 里没有 docs

  原来 `ci.yml` 有一个 `docs` job（构建 + `upload-artifact`）。它和 `docs.yml` 会重复构建同一棵树，而且 artifact 也不是发布通道，所以删掉，文档构建只活在 `docs.yml` 里。 `ci.yml` 现在是三个 job：`quality`（拦截）、`e2e` 三引擎矩阵（拦截）、`type-check` （`continue-on-error`，被 253 条存量错误逼的，收敛路径写在 `deploy.md`）。

  ## 顺手纠正的三处文档与代码不符

  写英文版时逐条回查代码，发现三处中文原文说错了，中英两边一起改：

  - `layout.md`：`sidebarPresentation` 的取值写成了 "inline 还是 popper"。实际类型是 `SidebarPresentation = 'drawer' | 'inline'`（`packages/layouts/src/modes.ts:32`），没有 popper。
  - `permissions.md`：小节标题"另外三个安全/体验指令"，下面列了 `safe-html` / `escape` / `lazy` / `loading` **四个**。改成"另外四个"。
  - `development.md`：提交类型说成"conventional 那 11 个"，且别名写成 `fd`。实际 `type-enum` 白名单是 **13 个**（多出 `types`、`release`），czg 交互列表里还另有 `wip` / `workflow` **不在**白名单里（选了会被 commitlint 判失败）；别名是 `b / c / f / r / s` 五个，用法 `pnpm commit :f`。另外"只有 `feat` 与 `fix` 允许标 breaking change"没有对应规则，那只是交互提示的措辞，删掉。

  ## 配套改动
  - `pnpm-workspace.yaml`：packages 增加 `docs`。
  - `turbo.json`：`build.outputs` 加 `.vitepress/dist/**`，否则文档产物不进 turbo 缓存。
  - 根 `package.json`：`docs:dev` / `docs:build` / `docs:preview`（按包名 filter，移动目录不用改）。
  - `.gitignore`：`apps/docs/.vitepress/cache` → `docs/.vitepress/cache`（`dist` 已被既有的无路径 `dist` 规则覆盖）。
  - `README.md` 重写（原来的技术栈表、`tenantCode` 登录、`ForgotPasswordModal.vue`、Alova 请求层、 `useWs()` 都和现在的代码不一致了），并新增 `README.en.md`，两份顶部互相链接。

  ## 验证
  - `pnpm install`（workspace 成员从 `apps/docs` 变成 `docs`，lockfile 的 importer key 跟着变）后 `pnpm --filter @antdv/docs build` 绿。**过程中修掉两个真实故障**：
    1. `docs/index.md` 的 feature `details` 里有 `English: architecture...`，未加引号的 YAML 标量遇到 `冒号+空格` 直接 `incomplete explicit mapping pair`，构建红 —— 加引号。
    2. `deploy.md` 里把 workflow 的 `${{ github.event.repository.name }}` 原样抄进内联代码，VitePress 渲染时**真的当 Vue 插值去求值**，SSR 抛 `Cannot read properties of undefined (reading 'event')`（zh/en 两份都抛，但构建仍报 complete，属于"红得不出声"那一类）。文档里改成 `/<repo>/` 的描述写法，不再出现插值。
  - 死链检查跑过（第一版抓出未写的 `/deploy` 与一个自动链接）。**锚点不在检查范围内**，所以英文锚点逐个对着产物 HTML 里的 `id` 核过：`_3-you-changed-a-shared-package-but-nothing-took-effect` （以数字开头的标题会带前导下划线，照抄中文那次的经验仍然差点漏掉）、 `content-area-padding-belongs-to-the-layout`、`writing-the-primary-color-with-tailwind`、 `why-type-check-is-non-blocking-at-first` 都在 `docs/.vitepress/dist/en/*.html` 里存在。
  - 站内搜索：实测产物只有**一份**索引（`assets/chunks/@localSearchIndexroot.*.js`，158KB，中英文标题都在里面），也就是两种语言混着搜。`deploy.md` 里原本按"按 locale 分片"写的验收口径已改成这个实测结果 —— 别按"只搜当前语言"去验收。
  - `.github/workflows/docs.yml` 与 `ci.yml` 用 workspace 里的 `yaml` 包解析过，job / 矩阵 / `if` / `permissions` 与预期一致（`.github/**` 在 eslint 忽略清单里， `yaml/sort-keys` 那套装不到它们身上，所以只能自己解析）。
  - **没有在真实 GitHub Actions / Pages 与 Vercel 上跑过**：workflow 与两个 `vercel.json` 是按 `--filter` / `--frozen-lockfile` / Pages 的 `base` 语义写的，本地只验证了构建本身和 YAML 可解析。首次连线时按 `docs/zh/deploy.md`（`docs/en/deploy.md`）的表格逐项核对，并跑一遍 "回滚与验证"里那几条手工确认 —— 特别是 Pages 的 `base`，它错了不会让构建红。
