# CLI

一句话：**没有独立的脚手架 CLI（不存在 `plop`/`gen` 这类命令）。"CLI" 在这里就是 pnpm scripts + turbo + 两个自研小工具（`vsh`、`turbo-run`）。所有命令名以 `package.json` 为准，本页逐条核对过。**

## 环境前置

| 项 | 要求 | 依据 |
| --- | --- | --- |
| Node | `>=22.0.0` | 根 `package.json` `engines` |
| pnpm | `10.12.4`，且**只认 pnpm**（`preinstall: npx only-allow pnpm`） | 根 `packageManager` 字段 |
| 安装 | `pnpm install`（`bootstrap` 是别名）；`postinstall` 会自动对各子包跑 `stub` | 根 scripts |

## 日常开发

```bash
pnpm dev              # turbo-run dev：交互式选任务跑 turbo
pnpm dev:web          # pnpm --filter @antdv/web run dev（vite，端口取 VITE_PORT，.env.development 配的 6080）
pnpm preview          # turbo-run preview
```

Mock 服务不用单独起：`VITE_MOCK=true`（`.env.development` 默认开）时，dev server 由内嵌的 `vite:mock-server` 插件拉起 Nitro（端口 5320）。要脱离前端单跑 mock：

```bash
pnpm --filter @antdv/backend-mock dev     # nitro dev
```

## 构建

```bash
pnpm build            # cross-env NODE_OPTIONS=--max-old-space-size=8192 turbo build
pnpm build:docker     # scripts/deploy/build-local-docker-image.sh
pnpm --filter @antdv/web build            # 单包构建
```

::: warning

体积分析走环境变量，不走 `build:analyze` 根 scripts 里的 `build:analyze` 指向的 turbo 任务在 `turbo.json` 里**没有定义**，会报找不到任务。实际可用的路径是：`VITE_VISUALIZER=true pnpm build` （`createVisualizerPlugin` 按该开关挂 `vite-bundle-analyzer`，见 [Vite Config](/guide/project/vite)）。:::

turbo 任务图（`turbo.json`）：`build / dev / type-check / test:unit / test:e2e` 全部 `dependsOn ^build`（先构建依赖包再动本包）；`dev / test:e2e / clean` 不缓存； `build` 的 outputs 声明了 `dist / .output / .nitro / .vitepress/dist`。改了 `packages/*` 后浏览器读的是子包 `dist`，dev 缓存没失效时会"改了没反应"——重启 dev 是 [测试](/guide/project/testing)文末清单里的固定动作。

## 质量与检查

```bash
pnpm check            # check:circular && check:dep && check:type && check:cspell
pnpm check:type       # turbo run type-check（apps/web 是两个 vue-tsc 项目：app + vitest）
pnpm lint             # vsh lint（oxlint/oxfmt/eslint/stylelint 四连，见[规范](/guide/project/protocol)）
pnpm format           # vsh lint --format
pnpm publint          # vsh publint：发布前检查包导出面
pnpm test:unit        # turbo run test:unit（24 个子包声明了 test:unit）
pnpm test:e2e         # turbo run test:e2e
pnpm test:e2e:install # playwright install（三引擎内核，首次必跑）
pnpm test:benchmark   # vitest bench --run
```

`vsh` 是 `scripts/vsh` 的 bin（`pnpm exec vsh <cmd>`），五个子命令： `check-circular / check-dep / code-workspace / lint / publint`。

## 代码生成（都随 vite 跑，无独立命令）

| 产物 | 谁生成 | 备注 |
| --- | --- | --- |
| `apps/web/types/router.d.ts` | unplugin-vue-router（`routesFolder: src/views`） | 约定式路由类型 |
| `apps/web/types/auto-imports.d.ts` / `components.d.ts` | unplugin-auto-import / vue-components | 入库文件；映射盘上偶发写失败带走进程时用 `VITE_WRITE_DTS=false` 跳过（见 [Vite Config](/guide/project/vite)） |
| `apps/web/types/env.d.ts` | `vite-plugin-env-parse` | 环境变量类型 |

这些文件由 dev/build 顺带刷新，**不要手改**。

## 版本与发布

```bash
pnpm commit           # czg：问卷式提交（type/scope/subject）
pnpm changeset        # 生成 .changeset/*.md
pnpm version          # changeset version && pnpm install --no-frozen-lockfile
pnpm release          # build && changeset publish
```

细节见 [Changeset](/guide/project/changeset)。

## 杂项

- `pnpm docs:dev / docs:build / docs:preview` —— 文档站（VitePress，独立 workspace 包 `@antdv/docs`，不参与应用构建）。
- `pnpm update:deps` —— `taze -r -w` 列可升级依赖；`pnpm catalog` —— `pnpm dlx codemod pnpm/catalog` 同步 catalog。
- `pnpm clean / reinstall` —— `scripts/clean.mjs`，后者顺带删 lock。
- `pnpm sync-upstream` —— 按 `sync-upstream.json` 对上游做同步的自研脚本。
- 根 `package.json` 没有 `test`（裸）/ `coverage` 顶层任务，跑覆盖率进 `apps/web` 用 `pnpm exec vitest run --coverage`。

## 相关页面

- 环境变量的读取与开关语义：[Vite Config](/guide/project/vite)
- 各条测试命令的取舍与口径：[测试](/guide/project/testing)
