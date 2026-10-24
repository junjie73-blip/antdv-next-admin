---
'@antdv/common-ui': patch
'@antdv/layouts': patch
'@antdv/popup-ui': patch
'@antdv/table-ui': patch
'@antdv/tabs-ui': patch
---

fix: 把 `type-check` 的门禁链修通 —— 一处打错三个字符的指令连累四个包

现象：交付口径要求 `npx turbo run type-check` 绿，实际只报一条 `@antdv/stores#type-check`（`../core/ui-kit/popup-ui/src/message/index.ts(31,8): error TS2882: Cannot find module or type declarations for side-effect import of 'vue-sonner/style.css'`）。改掉它之后红点**往下挪**，再改再挪，一路牵出四个包：`stores` → `tabs-ui`（3 条 TS2339）→ `table-ui`（1 条 TS2367）→ `layouts`（2 条 TS2448/TS2454）。

- **根因只有三个字符**：那行本该是 `/// <reference path="../types/css.d.ts" />`，实际写作 `// / <reference … />` —— 第二个斜杠后面多了一个空格，TypeScript 就不再把它当指令，而是一句普通注释。于是"声明随模块图走"的机制整个落空：`popup-ui/src/types/css.d.ts` 从来没进过下游的 program，任何按源码消费 `popup-ui` 的包（这里是 `stores`）都在 `import 'vue-sonner/style.css'` 上报 TS2882。`common-ui/src/components/toast/Toaster.vue` 是同一处拼错，只是暂时没被下游撞上（`tabs-ui` 按源码吃 `common-ui`，但它那条链上没走到这个文件的 CSS 导入）。
- **为什么四个包同时烂却只看得见一个**：turbo 默认在依赖任务失败时**不执行**下游任务，`--concurrency=1` 更是逐条停。所以"整跑只看 `Failed:` 那一行"永远低估债务。口径改成一趟跑到底再看计数：`npx turbo run type-check --concurrency=1 --continue`。
- **`tabs-ui`**：`__tests__/tab-item-list.test.ts` 三处 `[...list.children].map((node) => node.dataset.scrollKey)` —— `HTMLCollection` 的迭代器类型给的是 `Element`，`.dataset` 在 `Element` 上不存在（TS2339）。文件里另外五处早就写了 `as HTMLElement[]`，这三处漏了；补上同一形状的收窄，不动测试意图。
- **`table-ui`**：`getButtonSize()` 里有一句 `if (action.size === 0) return undefined;`，而 `ActionItem.size` 的类型是 `'large' | 'middle' | 'small'`，`0` 与它没有交集（TS2367）。这是 antd 时代 `size={0}` 表示"不接管尺寸"的残留：全仓（含 `apps/web` 与两包测试）没有任何调用点传 `0`，测试只钉 `small`/`large` 两个档位。删掉这条不可达分支，三个合法档位的映射原样保留。同包的 `useTableClasses.ts:117` 有一句注释还在写 `min-w-[var(--basic-table-min-width)]`，而上一轮重构已把类名改成 v4 的变量简写形式，注释跟着改成实际那一串（它正是本轮把 `basic-table.test.ts` 拉回断言字面量的那个形状）。
- **`layouts`**：`lock-screen.vue` 的 `withDefaults(…, { threshold: UNLOCK_PULL_THRESHOLD })` 引用的 `const` 声明在 22 行**之后**，TS 报"used before its declaration"（TS2448）加"used before being assigned"（TS2454）。把常量提到 props 定义之前，门禁即绿。**顺手记下踩到的第二道墙**：改动中途若把同一枚 `const` 留成"上面一份、下面一份"，`@vue/compiler-sfc` 会直接编译失败，而 dev server 的失败方式是在页面上盖一层 `<vite-error-overlay>` —— 端到端表现为"`<button>登录` 解析到了、可点不动，日志里写着 `<vite-error-overlay> intercepts pointer events`"。看着像用例有问题，其实是编辑器把语法错误投影到了浏览器。判据：`curl` 那个模块的 URL 拿 200 + 产物 JS，比读测试日志快得多。
- **`docs`**：`docs/guide/project/tailwindcss.md` 与其 `en` 镜像里，`@source` / `@plugin` / `@custom-variant` 的行号引用与被引用文件的当前行号对不上（`@plugin` 指成 `:39-40`，实际 `:57-58`；`@source` 指成 `:47-56`，实际 `:46-55`），逐条对回；守门用例的范围也从 `design.test.ts:628-660` 改成实际的 `:637-669`。

仍然红着的一条，且**本轮不修**：`@antdv/web#type-check`。脚本是 `vue-tsc -p tsconfig.app.json && vue-tsc -p tsconfig.vitest.json`，前一段先失败 90 条，`&&` 让后一段（单独跑另有 70 条）**根本没被执行** —— 所以"90"不是全貌，全貌是 160，而日志永远只给你前 90 条。app 项目这 90 条里 81 条在 `src/views/**`（`system` 33、`screen` 30、`components` 10、`security` 6、`redirect` 1、`micro-app` 1），9 条在 `src/api/mock.ts`、`src/stores/modules/dict.ts`、`src/composables/{usePasswordPolicy,useNotice}.ts`、`src/router/index.ts`；类型以 TS2339 / TS2345 / TS2532 为主，多数是 `noUncheckedIndexedAccess` 下按下标取值没判 `undefined`。逐条核过：报错行没有一条落在本轮 diff 的 hunk 里，报错文件名也没有一条命中改动过的组件（`views/components/cron/index.vue:129` 是 `check(previewExpr.value)` 的重载问题，与本批 colour/token 改动无关）。这是重构期就登记在册的待办 P7a，CI 只跑 docs 所以从未挡过路。包侧（`packages/**`）的 `type-check` 任务整跑（`--concurrency=1 --continue`）全部通过，红的只剩这一条应用侧。

顺带记下查这条时撞到的两处口径坑：`e2e/` 不在 type-check 覆盖范围内（`tsconfig.app.json` 只 include `types/` 与 `src/`，vitest 配置只 include `src/**/__tests__/*`），它有自己的 `apps/web/e2e/tsconfig.json`，单独跑 `vue-tsc --noEmit -p e2e/tsconfig.json` 会回 1 条 TS2339（`layout.spec.ts:628` 的 `row.dataset` —— `querySelectorAll` 给的是 `Element`），和本轮修掉的 `tabs-ui` 三处是同一形状，本轮范围外；以及 `pnpm lint`（`vsh lint`）会带 `oxlint --type-aware`，这台机器上它直接 panic（`Error running tsgolint: exit code 2`），而 `better-tailwindcss` 那组规则虽然确实挂在入口链上，却找不到自己的样式入口（`No tailwind css entry point found at …/tailwind-config/src/theme.css`，该包在 `internal/` 下并不存在），19 条诊断是在"没有基准文件"的前提下给出的。这两条都不是本轮引入，按"报告不偷改"登记。
