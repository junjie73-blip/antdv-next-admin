# 规范

一句话：**规范正文在仓库根的 `CODE_STANDARD.md`（497 行、20 个 `##` 小节），工具链是 oxlint + oxfmt + ESLint(flat) + stylelint 四件套，提交规范走 cz-git + commitlint；hook 目前全部注释停用，闸门靠手动跑 `pnpm check` / `pnpm lint`。**

## 规范正文：CODE_STANDARD.md

别复制它的条目，这里只给骨架和"为什么"（全文见 `CODE_STANDARD.md`）：

| 节 | 核心口径 |
| --- | --- |
| 1 目录组织 | 一个页面模块拆 `index.vue` / `actions.ts` / `columns.ts` / `schemas.ts` / `constants.ts` / `types.ts`，不许全堆在 index.vue |
| 2 命名 | 组件文件大驼峰、变量小驼峰、常量大写下划线；CSS 类 Tailwind 优先，复杂用 `cn()` |
| 3 Vue | `<script setup lang="ts">` 必须；`defineProps<{}>()` / `defineEmits<{}>()` 泛型写法，不用 runtime props |
| 4 Pinia | setup store；`useUserStore`（`packages/stores/src/user.ts:17`）是**唯一**用户态出口，`useAuthStore`（`apps/web/src/stores/modules/auth.ts:13`）已废弃且全仓零消费者；禁用 pinia 全量持久化插件 |
| 7 样式 | 优先级：Tailwind 原子类 → `cn()` 合并 → `:deep()` → `scoped`；复杂 class 串抽进 `constants.ts` |
| 8-9 表格/CRUD | `BasicTable` + `useTable` 标准用法、`useCRUD` 参数面（见[常用功能](/guide/in-depth/common)） |
| 12 环境变量 | `VITE_` 前缀才暴露；密钥不进 `VITE_*` |
| 13 表单 Schema | schema 依赖响应式数据必须 `computed` 工厂，不许静态数组 |
| 19 TypeScript | 禁 `any`（用 `unknown` + 类型守卫）；类型一律 `import type` |
| 20 性能 | 大列表虚拟滚动、图表 `shallowRef`/`markRaw`、路由懒加载 |

`cn()` 的实现是 `packages/core/base/shared/src/utils/cn.ts`（clsx + tailwind-merge），约定写法：

```ts
import { cn } from '@antdv/shared/utils/cn';
export const cardClassName = cn('shadow-sm', 'rounded-lg');
```

## 注释语言与写法

仓库没有成文的注释语言条款，但既有代码的实际口径高度一致：**注释写中文、讲"为什么"**，并且大量注释记录的是修复过的坑（例如 `packages/stores/src/user.ts:78-82` 解释 logout 为什么必须 `resetRoutes()`、`internal/vite-config/src/plugins/index.ts:157-164` 解释首屏 Loading 插件为什么不能被开关整块包住）。新写注释请沿这个口径：不复述代码行为，只留"读代码看不出来、下次会再踩"的信息。

## 工具链四件套

| 工具 | 配置文件 | 说明 |
| --- | --- | --- |
| oxlint | `oxlint.config.ts:1,4` → `@antdv/oxlint-config`（`internal/lint-configs/oxlint-config`） | Rust 快车道，`vsh lint` 固定带 `--type-aware`（`scripts/vsh/src/lint/index.ts:128`）；根配置只做 `defineConfig(oxlintConfig)`，叠加扩展的 `mergeOxlintConfigs` 住在共享包里（`src/configs/index.ts:19`，`src/index.ts:11-15` 用它组装） |
| oxfmt | `oxfmt.config.ts:4` → `@antdv/oxfmt-config` | 格式化，`ignorePatterns` 排掉 dist / node_modules / coverage 等 |
| ESLint | `eslint.config.ts:1-3` → `@antdv/eslint-config` 的 `defineConfig()` | 自维护的 flat config（`internal/lint-configs/eslint-config`），组合 vue / javascript / typescript / jsonc / node / perfectionist / yaml / pnpm _configs + `customConfig`；不是 `@antfu/eslint-config`，别按那套找规则 |
| stylelint | `@antdv/stylelint-config` | 管 `*.{vue,css,less,scss}`（`scripts/vsh/src/lint/index.ts:131`）。**仓库里没有任何 `stylelint` 落地配置文件**，所以这一步实际拿不到规则，见[常见问题](/guide/other/faq)"已知的死代码" |

一条命令全跑：

```bash
pnpm lint            # vsh lint：oxlint --type-aware → oxfmt --check → eslint → stylelint（都不改文件）
pnpm format          # vsh lint --format：oxlint --fix → oxfmt → eslint --fix → stylelint --fix（串行）
pnpm check           # package.json:16 —— check:circular + check:dep + check:type + check:cspell
```

`vsh lint` 会按机器降级：**串行还是并行只看核数**（CPU ≤4 核串行，`scripts/vsh/src/lint/index.ts:136`），**线程数才看内存**（核数 >4 且空闲内存 >8GB 才给 4 线程，否则 2，`:113-115`），低配机上不会一启动就冻住。

## 提交规范

- 类型集与交互问卷在 `commitlint.config.mjs`（cz-git 的 `defineConfig`）： `feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert`，breaking change 只允许 `feat`、`fix` 带（`:87` 的 `allowBreakingChanges`）；推荐用 `pnpm commit`（czg）走问卷，别手敲。
- 校验器 `@antdv/eslint-config` 同目录还有 `@antdv/commitlint-config`，根 devDependencies 里两者都装了。
- **lefthook 的钩子目前整文件注释停用**（`lefthook.yml:1-11` 的 `pre-commit`（oxfmt + eslint）与 `:13-16` 的 `post-merge` 全部带 `#`，文件里根本没有 `commit-msg` 段），但 `prepare` 脚本仍会 `lefthook install`（`package.json:34`）。后果：提交时**没有任何自动检查**，`test.only`、类型错误、脏格式都能直接进仓库。所以提交前自查是硬要求，清单见[测试](/guide/project/testing)文末。

## 测试与文档的口径

- 单测放被测对象同目录的 `__tests__/`，文件 `*.spec.ts` 或 `*.test.ts`；"源码契约"类守卫必须带正反样例（防止扫描正则写错导致的永真绿）。详见[测试](/guide/project/testing)。
- 值得记版本的改动补一条 `.changeset/*.md`（见 [Changeset](/guide/project/changeset)）。
- 拼写检查**在 `pnpm check` 的链路里**（`package.json:16` 串了 `check:cspell`，`:18` 的定义扫 `**/*.ts`、`**/README.md`、`.changeset/*.md`），但 **cspell 并不是任何包的依赖**：它只作为版本项挂在 `pnpm-workspace.yaml:133` 的 catalog 上，`pnpm-lock.yaml` 里一次都没出现。所以 `pnpm check` 跑到最后一步必然报"找不到命令"，日常用前三条，细节见[常见问题](/guide/other/faq)。

## 相关页面

- 目录树逐层解释：[目录说明](/guide/project/dir)
- 样式体系（Tailwind 与 antd 共存）：[Tailwind CSS](/guide/project/tailwindcss)
