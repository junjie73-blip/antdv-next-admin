# CI 与部署

两条互不相干的发布链路：管理后台走 Vercel 的 Git 集成（或根目录 `nginx.conf` 那条自建路径），文档站走 GitHub Actions 部署到 GitHub Pages。**仓库里只有一个 workflow** —— `.github/workflows/` 下目前只有 `docs.yml`，没有任何跑 lint / 单测 / e2e 的 CI 作业：

```
GitHub 仓库 ──► Vercel 项目：管理后台        Root Directory = apps/web
            └─► GitHub Actions（.github/workflows/docs.yml）：文档构建 → GitHub Pages
```

## 为什么文档站不跟管理后台挤在同一个部署里

- **发布解耦**：改一版后台不应该把文档一起重新发布，反之亦然。
- **构建成本**：文档理论上只需 `pnpm install --filter @antdv/docs...`，不用把 echarts、tiptap、video.js 这些重依赖装一遍；当前 `docs.yml` 图省事跑的是全量 `pnpm install`（见下表），要收窄就在 install 那一步加 filter。
- **门禁也解耦**：`docs.yml` 只守文档自己的死链检查，不跑 lint / type-check / e2e；一次改错文档不该把应用的门禁拖红，反过来应用的存量类型错误也不该挡住文档上线。
- **访问边界**：文档站是纯静态、公开可读；管理后台可能要挂保护、要接真实后端的域名与转发规则。

::: tip 也可以把文档挂到 Vercel 把文档做成 Vercel 的第二个项目（Root Directory = `docs`）同样能跑，本项目曾经就是这么配的。换到 GitHub Pages 的理由只有一个：**文档改动是高频小步提交，Pages 的部署日志和站点设置就贴在仓库的 Insights 里，不用在两个平台之间来回找**。两条路都只依赖构建产物，切换不需要改文档内容本身。:::

## 管理后台（Vercel）

Vercel 控制台里 New Project → 导仓库 → **Root Directory 填 `apps/web`**，其余按下表（仓库里**没有** `apps/web/vercel.json`，也没有任何 Vercel 配置文件，所以每一项都得在控制台手配）：

| 项 | 值 |
| --- | --- |
| Framework Preset | Vite |
| Build and Development Settings → Root Directory | `apps/web` |
| Install Command | `pnpm install --frozen-lockfile --filter @antdv/web...` |
| Build Command | `pnpm --filter @antdv/web... build` |
| Output Directory | `dist` |
| Node Version | 24（跟随根目录 `.node-version`） |

::: important `--filter @antdv/web...` 末尾那三个点不是排版错误 `apps/web` 依赖 23 个 workspace 包（`dependencies` 里 21 个运行时子包 `apps/web/package.json:20-40`，加上 `devDependencies` 里的 `@antdv/tsconfig` 与 `@antdv/vite-config` `:113-114`），其中 `@antdv/{shared,hooks,directives,preferences,router,types}` 六个是 **`tsdown` 出来的产物**（`main` 指 `./dist/index.js`），`@antdv/{vite-config,node-utils}` 同样是；仓库里不入库 `dist`。pnpm 的 `<pkg>...` 会把这个包**和它的依赖**一起纳入，于是 `... build` 会先构建 `@antdv/shared`、`@antdv/layouts`、`@antdv/vite-config` …再构建 web。只写 `pnpm --filter @antdv/web build` 的话，Vercel 上会得到一堆"找不到 `@antdv/shared/utils/cn`"的构建失败 ——本地不复现，因为你机器上的 `dist` 是上一次构建留下的。另一批（`enums` / `layouts` / `request` / `stores` / `utils` / `icons` / `design` 与 ui-kit 八个，共 15 个）是源码发布 —— `main` 直指 `./src/index.ts`（`design` 是 `./src/index.css`），连 build 脚本都没有，由 web 的 Vite 直接编译，所以它们在不在 `... build` 里都一样。

也可以用 `pnpm turbo build --filter=@antdv/web`（turbo 自己会算 `^build`），代价是要在 Vercel 上多装一遍 turbo 的缓存目录，收益只有远程缓存；真要加速 CI 时再换。:::

产物侧不需要额外配置：

- `base: './'`（`apps/web/vite.config.ts:15`）→ 资源相对路径，放任何子路径都能直接打开；
- 路由是 **hash 模式**，深链是 `/#/system/user` 形式，服务端永远只需要 `/index.html`；
- 因为仓库里没有 `vercel.json`，重写规则与缓存头都只能在控制台配：Settings → Rewrites 加一条 `/(.*) → /index.html`（兼容将来切 history 路由和手输的旧地址），Settings → Headers 给 `/assets/*` 加 `Cache-Control: public, max-age=31536000, immutable`（文件名带 hash，改内容就换名，不会缓存到旧包）。

::: warning 环境变量在 Vercel 上配，不要提交 `VITE_APP_BASE_API` 指向真实后端、`VITE_MOCK=false`、`VITE_WS_URL` 填生产 WebSocket 地址、 `VITE_CACHE_ENCRYPT_KEY` 换成你自己的 32 字符随机密钥（SM4）。Project Settings → Environment Variables 里配，值不进仓库。根目录那份 `nginx.conf` 是自建部署的老路径（`try_files` + `/api/v1` 反代），Vercel 上用不到，两条路选一条，别同时留着两套前缀。:::

## 文档站：GitHub Actions + Pages

仓库 Settings → Pages → Build and deployment → **Source 选 GitHub Actions**（不改这一步， `deploy` job 会在"没有 Pages configuration with Actions for the provided repository"这里失败）。其余不用在控制台配任何东西，`.github/workflows/docs.yml` 就是全部：

| 环节 | 值 |
| --- | --- |
| 触发 | push 到 `main`（**没有 paths 过滤**，改 README 也会重发一次文档）+ `workflow_dispatch` 手动 |
| 工具链 | `pnpm/action-setup@v4`（`version: 10.12.4`）→ `actions/setup-node@v6`（`node-version: 24`，**写死的**，没读根目录 `.node-version`）→ `actions/configure-pages@v4` |
| Install | `pnpm install`（全量，不带 filter，也没带 `--frozen-lockfile`） |
| Build | `pnpm docs:build`，等价于 `pnpm --filter @antdv/docs build`（含死链检查，是唯一的质量闸门） |
| 产物 | `docs/.vitepress/dist` → `actions/upload-pages-artifact@v3` |
| 部署 | `actions/deploy-pages@v4`，`environment: github-pages` |
| 并发 | `group: pages`、`cancel-in-progress: false` —— 正在跑的发布不被后来的 push 打断 |

::: warning 两处和"最佳实践"不一致的地方，是现状不是笔误 Node 版本在 workflow 里写死 `24`，而根目录 `.node-version` 是 `24.0.0` —— 升级 Node 时这两个数字都要改，漏一个就是本地与发布环境不同版本。install 不带 `--frozen-lockfile`，锁文件与 package.json 不一致时 CI 会静默装出另一棵树。:::

站点**默认中文**：根路径 `docs/index.md` 是中文首页（`layout: home` 的 hero，不是"选择语言"中间页），英文整站在 `/en/` 下，靠语言菜单跳。语言切换用默认主题自带的菜单（顶栏的 `VPNavBarTranslations`、汉堡菜单里的 `VPNavScreenTranslations`，标签由 `langMenuLabel` 本地化），它按当前页面路径跳到另一语言的同一篇，所以两边的 **文件名必须保持一致** —— `guide/essentials/cache.md` 对应 `en/guide/essentials/cache.md`。

::: warning 坑：`locales` 的键必须是裸语言码写 `zh` / `en`，**不能**写成路径 `'/'`。VitePress 拿键去拼 `/${key}/` 再对当前路由做正则匹配（`getLocaleForPath`），写成路径就成了 `///`，永远匹配不上 —— 症状是正文照常渲染，但侧栏、顶栏菜单、语言切换、站内搜索文案**全部为空且不报错**，从产物 HTML 上完全看不出来（导航栏是 SSR 的，locale 级 `themeConfig` 要等客户端合并）。键用裸码后 URL 仍是 `/`，因为 `link` 由裸码推导，不用担心路径变化。

顺带一条验收口径：顶栏那份语言菜单按上游响应式规则只在视口 ≥1280px 出现，更窄的窗口要去汉堡菜单里找；另外 SPA 内切语言后 `<html lang>` 不会立刻跟着更新（整页刷新才对），断言请钉 URL 和标题，别钉这个属性。:::

::: warning `base` 现在只有一处真值，而且不在 CI 里Pages 的项目站挂在 `https://<user>.github.io/<repo>/` 下，资源路径必须是这个前缀，否则症状是"HTML 在、样式与脚本全 404、页面裸奔"。当前取值是 `docs/.vitepress/config.mts:39` 的 `process.env.VITEPRESS_BASE ?? '/antdv-next-admin'`，而 **`docs.yml` 并没有设这个环境变量** —— 也就是说本地 dev 与线上发布用的是同一个前缀 `/antdv-next-admin`，本地看到 `http://localhost:5200/antdv-next-admin/` 才是对的，别按"本地挂根路径"去理解。绑了自定义域名或改成用户站（挂在 `/`）时有两条路：在 workflow 的 build 步骤加 `VITEPRESS_BASE: /`，或者直接改那行默认值。改仓库名同理 —— 前缀与仓库名一致这件事是靠人记的，不是靠代码推的。:::

本地预览产物（和 CI 里那两条命令等价）：

```bash
pnpm docs:dev        # http://localhost:5200
pnpm docs:build      # 构建，会检查死链
pnpm docs:preview    # 预览 dist
```

::: tip 死链会让构建失败 VitePress 默认检查链接有效性，写错页面名会直接 **build failed**，`docs.yml` 的 build job 也就红了。这是想要的行为 —— 文档烂掉最典型的症状就是链接指向已经不存在的页面。但**锚点不在检查范围内**：指向不存在的 `#某标题` 只会静默落到页面顶部。双语站点里锚点尤其容易漂（英文标题的 slug 与中文完全不同），所以跨页锚点要靠人工核对生成产物。:::

## 应用代码没有 CI 门禁（现状）

`.github/workflows/` 下**只有 `docs.yml` 一个文件**：没有 `ci.yml`，没有跑 lint / 单测 / e2e 的作业，Pull Request 也不会被任何工作流检查。上面那张表里"文档构建不重复跑 lint / type-check / e2e"说的就是这个 —— 不是"分工在另一个 workflow 里"，而是**根本没有那一份**。

所以质量闸门全在本地，靠人跑：

| 命令 | 内容 | 出处 |
| --- | --- | --- |
| `pnpm lint` | `vsh lint`（oxlint + eslint 组合） | 根 `package.json` 的 `lint` |
| `pnpm check` | `check:circular` → `check:dep` → `check:type` → `check:cspell` 四连 | 根 `package.json` 的 `check` |
| `pnpm test:unit` | `turbo run test:unit`（vitest，按包并行） | 同上 |
| `pnpm test:e2e` | `turbo run test:e2e`（Playwright，三引擎矩阵在 `apps/web/playwright.config.ts` 里） | 同上 |

::: important 要补 CI 时的顺序 补 `ci.yml` 的成本主要不在 yaml，而在"跑不跑得过"：`pnpm check:type` 现在就过不了（下一节），三引擎 e2e 在 runner 上要装 firefox/webkit 的系统依赖，且这个仓库的 e2e 里有已登记的疑似 flake。合理的切法是先只上 `quality`（lint + circular + 单测），把 `type-check` 挂成 `continue-on-error`，e2e 单独一个 job 慢慢调。:::

### type-check 为什么过不了，以及它现在意味着什么

`pnpm check:type`（= `turbo run type-check`，`turbo.json` 里那条任务只声明 `dependsOn: ["^build"]`）**目前跑不完整**：`@antdv/layout-ui` 那条 `vue-tsc --noEmit` 会把默认堆吃满并崩在 `FATAL ERROR: Zone Allocation failed`，整条任务以 134 退出，其余包大约跑到 19/30 就被中断 —— 所以"仓库总错误数"不是一个稳定可复现的数字，别引用任何版本。注意根目录 `build` 脚本带了 `NODE_OPTIONS=--max-old-space-size=8192`，而 `check:type` 没有，这是它比构建更容易 OOM 的直接原因。

能稳定复现的是应用侧那一段，手工加大堆单独跑：

```bash
cd apps/web
NODE_OPTIONS=--max-old-space-size=8192 npx vue-tsc --noEmit -p tsconfig.app.json
# 当前：98 条
```

分布（按目录，`src/` 相对路径）：`views/` 81、`components/` 7、`composables/` 3、`api/` 3、`stores/` 2、`router/` 1。最集中的三个文件是 `views/screen/composables/useScreenAdapter.ts`（15）、`views/screen/monitor/index.vue`（13）、`views/system/user/index.vue`（7）—— 大屏适配与系统管理列表页是主战场，`views/form/validation` 现在**一条都没有**。

还有一个坑值得写下来：`@antdv/web` 的 `type-check` 是 `vue-tsc -p tsconfig.app.json && vue-tsc -p tsconfig.vitest.json`（`apps/web/package.json:14`），中间是 `&&`。前一段一红，**测试配置那一段根本不会执行**，所以"98 条"是下界而不是全量。想真正量化存量，得把 `&&` 换成 `;` 或者分两条任务跑。

在没有 CI 的现状下，这三步是实际口径：

1. 现在：改动前后各跑一次上面那条应用侧命令，**新代码不许新增错误**（存量按文件数对比即可）；
2. 收敛：按目录批量清，从大屏与 `views/system/**` 开刀；顺带给 `check:type` 补 `NODE_OPTIONS`，让仓库级任务能跑完；
3. 之后：再补 `ci.yml`，把 `type-check` 并进必过步骤（见上面那条 important）。

::: info 本地钩子还是空的 `lefthook.yml` 里所有 hook 都被注释掉了（只剩 `# pre-commit:` 与 `# post-merge:` 两段注释），提交时不会自动 lint；`prepare` 脚本 `is-ci || pnpm exec lefthook install` 仍然会装钩子，只是钩子里没有启用的步骤。**当前没有任何强制层** —— 既不是 CI 也不是钩子，所以本地自查请按 [测试策略](/guide/project/testing) 的收尾清单来。:::

## 回滚与验证

Vercel 每次部署都有 Deployments 列表，出问题直接在该项目里 Promote 上一个 Production 部署，不需要重新构建。文档站回滚走 GitHub 那一侧：Actions → `Docs` → 挑一次历史运行 → **Deploy workflow**，Pages 就换回那一次的产物。上线后至少手工确认：

管理后台：

1. `/`（不带 hash）能打开，资源 200，无控制台报错；
2. 登录接口打的是 `VITE_APP_BASE_API` 指向的真实后端，而不是 `/api`（那是 mock 的前缀）；
3. 深链刷新（`/#/system/user`）不 404，未匹配路径落到 `index.html`。

文档站：

1. `/antdv-next-admin/` 打开是**中文**首页（不是语言选择页），`/antdv-next-admin/en/` 是英文首页，两边的**样式与脚本都是 200**（资源 404 就说明 `base` 与实际挂载路径不一致，见上一节）；
2. 语言切换能把当前页跳到另一语言的同一篇，两篇的标题对得上。顶栏那份要视口 ≥1280px 才出现，窄屏走汉堡菜单里那份，验收时按对应宽度测；
3. 站内搜索**只覆盖当前语言**。`locales` 用裸语言码后，本地产物是每语言一份索引（`assets/chunks/@localSearchIndex{zh,en,root}.*.js`），在 `/en/` 页面搜中文是搜不到的 ——这是切到裸键之后行为的变化（此前键写成路径、全部落到 `root` 一份索引，才表现为"两种语言混着搜"），按"各语言独立检索"验收。
