# CI 与部署

两条互不相干的发布链路：管理后台走 Vercel 的 Git 集成，文档站走 GitHub Actions 部署到 GitHub Pages；CI 只做门禁，两边互不重叠：

```
GitHub 仓库 ──► Vercel 项目：管理后台        Root Directory = apps/web
            ├─► GitHub Actions（.github/workflows/ci.yml）：lint / 单测 / 三引擎 e2e
            └─► GitHub Actions（.github/workflows/docs.yml）：文档构建 → GitHub Pages
```

## 为什么文档站不跟管理后台挤在同一个部署里

- **发布解耦**：改一版后台不应该把文档一起重新发布，反之亦然。
- **构建成本**：文档只需 `pnpm install --filter @antdv/docs...`，不用把 echarts、tiptap、video.js 这些重依赖装一遍。
- **门禁也解耦**：`docs.yml` 只守文档自己的死链检查，不跑 lint / type-check / e2e；一次改错文档不该把应用的门禁拖红，反过来应用的存量类型错误也不该挡住文档上线。
- **访问边界**：文档站是纯静态、公开可读；管理后台可能要挂保护、要接真实后端的域名与转发规则。

::: tip 也可以把文档挂到 Vercel 把文档做成 Vercel 的第二个项目（Root Directory = `docs`）同样能跑，本项目曾经就是这么配的。换到 GitHub Pages 的理由只有一个：**文档改动是高频小步提交，Pages 的部署日志和站点设置就贴在仓库的 Insights 里，不用在两个平台之间来回找**。两条路都只依赖构建产物，切换不需要改文档内容本身。:::

## 管理后台（Vercel）

Vercel 控制台里 New Project → 导仓库 → **Root Directory 填 `apps/web`**，其余按下表（`apps/web/vercel.json` 已经写好，控制台设置会覆盖它，两边保持一致即可）：

| 项 | 值 |
| --- | --- |
| Framework Preset | Vite |
| Build and Development Settings → Root Directory | `apps/web` |
| Install Command | `pnpm install --frozen-lockfile --filter @antdv/web...` |
| Build Command | `pnpm --filter @antdv/web... build` |
| Output Directory | `dist` |
| Node Version | 24（跟随根目录 `.node-version`） |

::: important `--filter @antdv/web...` 末尾那三个点不是排版错误 `apps/web` 依赖 21 个 workspace 包（19 个运行时子包 + `@antdv/tsconfig` / `@antdv/vite-config`），其中 `shared` / `composables` / `directives` / `layouts` / `preferences` / `router` / `types` / `node-utils` / `vite-config` 这几个是 **`tsdown` 出来的产物**，仓库里不入库 `dist`。pnpm 的 `<pkg>...` 会把这个包**和它的依赖**一起纳入，于是 `... build` 会先构建 `@antdv/shared`、`@antdv/layouts`、`@antdv/vite-config` …再构建 web。只写 `pnpm --filter @antdv/web build` 的话，Vercel 上会得到一堆"找不到 `@antdv/shared/utils/cn`"的构建失败 ——本地不复现，因为你机器上的 `dist` 是上一次构建留下的。另一批（`icons` / `design` / `ui-kit` 十个）是源码发布，没有构建步骤，由 web 的 Vite 直接编译，所以它们在不在 `... build` 里都一样。

也可以用 `pnpm turbo build --filter=@antdv/web`（turbo 自己会算 `^build`），代价是要在 Vercel 上多装一遍 turbo 的缓存目录，收益只有远程缓存；真要加速 CI 时再换。:::

产物侧不需要额外配置：

- `base: './'`（`apps/web/vite.config.ts`）→ 资源相对路径，放任何子路径都能直接打开；
- 路由是 **hash 模式**，深链是 `/#/system/user` 形式，服务端永远只需要 `/index.html`；
- `vercel.json` 里仍留了 `rewrites: /(.*) → /index.html`，兼容将来切 history 路由和手输的旧地址；
- `/assets/*` 设了一年 `immutable`：文件名带 hash，改内容就换名，不会缓存到旧包。

::: warning 环境变量在 Vercel 上配，不要提交 `VITE_APP_BASE_API` 指向真实后端、`VITE_MOCK=false`、`VITE_WS_URL` 填生产 WebSocket 地址、 `VITE_CACHE_ENCRYPT_KEY` 换成你自己的 32 字符随机密钥（SM4）。Project Settings → Environment Variables 里配，值不进仓库。根目录那份 `nginx.conf` 是自建部署的老路径（`try_files` + `/api/v1` 反代），Vercel 上用不到，两条路选一条，别同时留着两套前缀。:::

## 文档站：GitHub Actions + Pages

仓库 Settings → Pages → Build and deployment → **Source 选 GitHub Actions**（不改这一步， `deploy` job 会在"没有 Pages configuration with Actions for the provided repository"这里失败）。其余不用在控制台配任何东西，`.github/workflows/docs.yml` 就是全部：

| 环节 | 值 |
| --- | --- |
| 触发 | push 到 `main` 且改动命中 `docs/**` / 该 workflow / `pnpm-lock.yaml`，或手动 dispatch |
| Install | `pnpm install --frozen-lockfile --filter @antdv/docs...` |
| Build | `pnpm --filter @antdv/docs build`（含死链检查，是唯一的质量闸门） |
| 产物 | `docs/.vitepress/dist` → `actions/upload-pages-artifact` |
| 部署 | `actions/deploy-pages`，`environment: github-pages` |

站点是 `/` 与 `/en/` 双语，根路径 `docs/index.md` 是语言选择页。语言切换用默认主题自带的菜单（顶栏的 `VPNavBarTranslations`、汉堡菜单里的 `VPNavScreenTranslations`，标签由 `langMenuLabel` 本地化），它按当前页面路径跳到另一语言的同一篇，所以两边的 **文件名必须保持一致** —— `zh/layout.md` 对应 `en/layout.md`。

::: warning 坑：`locales` 的键必须是裸语言码写 `zh` / `en`，**不能**写成路径 `'/'`。VitePress 拿键去拼 `/${key}/` 再对当前路由做正则匹配（`getLocaleForPath`），写成路径就成了 `///`，永远匹配不上 —— 症状是正文照常渲染，但侧栏、顶栏菜单、语言切换、站内搜索文案**全部为空且不报错**，从产物 HTML 上完全看不出来（导航栏是 SSR 的，locale 级 `themeConfig` 要等客户端合并）。键用裸码后 URL 仍是 `/`，因为 `link` 由裸码推导，不用担心路径变化。

顺带一条验收口径：顶栏那份语言菜单按上游响应式规则只在视口 ≥1280px 出现，更窄的窗口要去汉堡菜单里找；另外 SPA 内切语言后 `<html lang>` 不会立刻跟着更新（整页刷新才对），断言请钉 URL 和标题，别钉这个属性。:::

::: warning `base` 只在 CI 里设 Pages 的项目站挂在 `https://<user>.github.io/<repo>/` 下，资源路径必须是这个前缀，否则症状是"HTML 在、样式与脚本全 404、页面裸奔"。这一步交给 workflow 的 `VITEPRESS_BASE: /<仓库名>/`（workflow 里那个值取自 GitHub 的仓库名上下文），配置里默认 `/`（本地 dev/preview 就用根路径，URL 不用带前缀）。绑了自定义域名或用户站时把 `VITEPRESS_BASE` 改成 `/`， **改 CI 里的这一个环境变量就行，不要在 `config.mts` 里硬编码** —— 硬编码会把本地预览变成 `/antdv-next-admin/`，反而更容易误判。:::

本地预览产物（和 CI 里那两条命令等价）：

```bash
pnpm docs:dev        # http://localhost:5200
pnpm docs:build      # 构建，会检查死链
pnpm docs:preview    # 预览 dist
```

::: tip 死链会让构建失败 VitePress 默认检查链接有效性，写错页面名会直接 **build failed**，`docs.yml` 的 build job 也就红了。这是想要的行为 —— 文档烂掉最典型的症状就是链接指向已经不存在的页面。但**锚点不在检查范围内**：指向不存在的 `#某标题` 只会静默落到页面顶部。双语站点里锚点尤其容易漂（英文标题的 slug 与中文完全不同），所以跨页锚点要靠人工核对生成产物。:::

## GitHub Actions 门禁

`.github/workflows/ci.yml`，触发条件：push 到 `main`、Pull Request、手动。三个 job：

| Job | 内容 | 是否拦截 |
| --- | --- | --- |
| `quality` | `pnpm lint`、`pnpm check:circular`、`pnpm test:unit` | ✅ |
| `e2e` | 矩阵跑 `chromium / firefox / webkit`，`fail-fast: false` | ✅ |
| `type-check` | `pnpm check:type` | ⚠️ 暂不拦截 |

文档构建**不在这里**，它有自己的 `docs.yml`（见上一节）。理由：`ci.yml` 守的是应用代码，文档的一次笔误不该让三条引擎的 e2e 重跑一遍；`docs.yml` 也只做构建 + 发布，不重复跑 lint / type-check / e2e。

几个决定的理由：

- **`node-version-file: .node-version`**：Node 版本只有一处真值，不用维护第二份。
- **e2e 三引擎都跑**：滚动条、菜单溢出、响应式断点这类问题只在非 Chromium 上暴露；只跑 chromium 等于放弃"各种主流浏览器兼容"这条要求。
- **`pnpm turbo build --filter=@antdv/web^...` 先构建依赖**：和上面 pnpm 的三个点同理， `<` 方向（`^...`）只构建依赖不构建 web 自己，web 交给 Playwright 的 `webServer` 起 dev。
- **`VITE_WRITE_DTS=false`**：类型声明产物在 CI 里没用，省掉几十秒。
- **失败时上传 `test-results` 与 `playwright-report`**：`error-context.md` 里有错误详情 + 页面 aria 快照，是定位假红最快的路径。

### type-check 为什么先设成非阻断

`pnpm check:type` 当前有 **253 条存量错误**，集中在 `apps/web/src/components/business/**`、 `src/api/mock.ts`、`views/security/dashboard/**`、`views/form/validation` 等，本批次新增文件零错误。把已知存量直接变成必过门禁，结果是每条 PR 都红 —— 那等于没有门禁。所以：

1. 现在：`continue-on-error: true`，让类型错误在 CI 日志里可见（报告不拦截）；
2. 收敛：按目录批量清（先从本批次碰过的文件与新代码开始，新代码不许新增错误）；
3. 之后：去掉 `continue-on-error`，把 `type-check` 并进 `quality` 变成必过步骤。

::: info 本地钩子还是空的 `lefthook.yml` 里所有 hook 都被注释掉了，提交时不会自动 lint。CI 是目前唯一的强制层，所以本地自查请按 [测试策略](/guide/project/testing) 的收尾清单来。:::

## 回滚与验证

Vercel 每次部署都有 Deployments 列表，出问题直接在该项目里 Promote 上一个 Production 部署，不需要重新构建。文档站回滚走 GitHub 那一侧：Actions → `Docs` → 挑一次历史运行 → **Deploy workflow**，Pages 就换回那一次的产物。上线后至少手工确认：

管理后台：

1. `/`（不带 hash）能打开，资源 200，无控制台报错；
2. 登录接口打的是 `VITE_APP_BASE_API` 指向的真实后端，而不是 `/api`（那是 mock 的前缀）；
3. 深链刷新（`/#/system/user`）不 404，未匹配路径落到 `index.html`。

文档站：

1. `/antdv-next-admin/` 打开是语言选择页，`/` 与 `/en/` 的**样式与脚本都是 200** （资源 404 就说明 `VITEPRESS_BASE` 和实际挂载路径不一致）；
2. 语言切换能把当前页跳到另一语言的同一篇，两篇的标题对得上。顶栏那份要视口 ≥1280px 才出现，窄屏走汉堡菜单里那份，验收时按对应宽度测；
3. 站内搜索**只覆盖当前语言**。`locales` 用裸语言码后，本地产物是每语言一份索引（`assets/chunks/@localSearchIndex{zh,en,root}.*.js`），在 `/en/` 页面搜中文是搜不到的 ——这是切到裸键之后行为的变化（此前键写成路径、全部落到 `root` 一份索引，才表现为"两种语言混着搜"），按"各语言独立检索"验收。
