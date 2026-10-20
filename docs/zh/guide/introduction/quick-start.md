# 快速开始

## 1. 环境

| 项 | 要求 | 事实来源 |
| --- | --- | --- |
| Node | `>=22`，本地按 `.node-version` 用 24.0.0 | `package.json` 的 `engines.node` |
| pnpm | `10.12.4` | `package.json` 的 `packageManager` |
| 包管理器 | 只能用 pnpm（`preinstall` 挂了 `only-allow pnpm`） | 根 `package.json` |

```bash
corepack enable
corepack prepare pnpm@10.12.4 --activate
```

::: warning

别用 npm / yarn 根目录的 `preinstall` 脚本会直接拦掉非 pnpm 安装；而且 workspace 依赖、catalog 版本、`internal/*` 的软链都依赖 pnpm 的语义，混用会装出一片假的 `node_modules`。
:::

## 2. 安装与启动

```bash
pnpm install          # 装依赖 + 触发 stub
pnpm dev:web          # 只起管理后台（apps/web）
```

打开 `http://localhost:6080`，用 mock 账号登录：

| 用户名  | 密码       |
| ------- | ---------- |
| `admin` | `admin123` |

`pnpm dev:web` 一条命令就够了，因为它同时拉起两件事：

```
apps/web dev server ──── 6080 ─  前端（Vite 8 + Vue 3 + antdv-next 1.6）
        │
        └─ 进程内 Nitro Mock ── 5320 ─  /api/**，21 个菜单页 + 登录 + 上传都有数据
```

端口不是写死的：`apps/web/.env.development` 里 `VITE_PORT=6080`、`VITE_MOCK_SERVER=http://localhost:5320`，dev server 再把 `/api` 代理过去。所以**不需要单独准备后端**。

其他常用脚本：

```bash
pnpm dev              # turbo-run dev，web + mock 一起
pnpm build            # turbo build，按依赖图构建全部包
pnpm preview          # 预览构建产物
pnpm test:unit        # 全仓单测（turbo；24 个子包声明了 test:unit）
pnpm test:e2e         # Playwright（会自己起 dev server）
pnpm lint             # eslint（内部 lint-configs 里的那套共享配置）
pnpm check:type       # vue-tsc 逐包 type-check
```

## 3. 改了共享包却没生效

`apps/web` 消费的是各子包的 **`dist`**，不是 `src`。改 `packages/*/src` 或 `internal/vite-config/src` 之后：

```bash
pnpm --filter @antdv/shared build   # 或直接 pnpm build
```

然后重启 dev server。这条约束是本项目最容易踩的坑：不重启的话，页面拿到的还是旧模块，表现就是"明明改了，页面没变化"。

::: details 为什么不用 alias 直接指向 src

- 子包要能被别的项目单独安装使用，产物必须是自己的 `dist`；
- vite 的 `optimizeDeps` 和类型解析在 alias 到源码时经常和构建结果不一致；
- `turbo dev` 已经用 `dependsOn: ["^build"]` 保证启动前依赖包是最新的，代价只是首次构建慢一点。

`apps/web/.env.development` 里留了个 `VITE_DEV_POLLING` 开关，在映射盘（本机仓库在 `J:`）上实测**救不回 HMR**，所以保持注释状态，别指望它。
:::

## 4. 目录速览

```
apps/
  web/              # 管理后台（@antdv/web）
  backend-mock/     # Nitro Mock（@antdv/backend-mock）
  docs/             # 本站点（@antdv/docs，独立部署）
packages/           # 9 个运行时子包：shared / preferences / composables / ui /
                    # layouts / router / directives / styles / types
internal/           # 构建与规范：vite-config / node-utils / tsconfig / lint-configs/*
.changeset/         # 版本与 CHANGELOG 的来源
```

细节见 [目录说明](/zh/guide/project/dir)。

## 5. 第一次提交前

```bash
pnpm lint && pnpm test:unit
```

再按 [测试策略](/zh/guide/project/testing) 跑一遍端到端。改动值得记版本的话，`pnpm changeset` 补一条，见 [开发规范与环境变量](/zh/guide/essentials/development)。
