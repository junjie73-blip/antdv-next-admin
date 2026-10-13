# 规范

一句话：**规范正文在仓库根的 `CODE_STANDARD.md`（489 行、20 节），工具链是 oxlint + oxfmt + ESLint(flat) + stylelint 四件套，提交规范走 cz-git + commitlint；hook 目前全部注释停用，闸门靠手动跑 `pnpm check` / `pnpm lint`。**

## 规范正文：CODE_STANDARD.md

别复制它的条目，这里只给骨架和"为什么"（全文见 `CODE_STANDARD.md`）：

| 节 | 核心口径 |
| --- | --- |
| 1 目录组织 | 一个页面模块拆 `index.vue` / `actions.ts` / `columns.ts` / `schemas.ts` / `constants.ts` / `types.ts`，不许全堆在 index.vue |
| 2 命名 | 组件文件大驼峰、变量小驼峰、常量大写下划线；CSS 类 Tailwind 优先，复杂用 `cn()` |
| 3 Vue | `<script setup lang="ts">` 必须；`defineProps<{}>()` / `defineEmits<{}>()` 泛型写法，不用 runtime props |
| 4 Pinia | setup store；`useUserStore` 是**唯一**用户态出口，`useAuthStore` 已废弃不许用；禁用 pinia 全量持久化插件 |
| 7 样式 | 优先级：Tailwind 原子类 → `cn()` 合并 → `:deep()` → `scoped`；复杂 class 串抽进 `constants.ts` |
| 8-9 表格/CRUD | `BasicTable` + `useTable` 标准用法、`useCRUD` 参数面（见[常用功能](/zh/guide/in-depth/common)） |
| 12 环境变量 | `VITE_` 前缀才暴露；密钥不进 `VITE_*` |
| 13 表单 Schema | schema 依赖响应式数据必须 `computed` 工厂，不许静态数组 |
| 19 TypeScript | 禁 `any`（用 `unknown` + 类型守卫）；类型一律 `import type` |
| 20 性能 | 大列表虚拟滚动、图表 `shallowRef`/`markRaw`、路由懒加载 |

`cn()` 的实现是 `packages/shared/src/cn.ts`（clsx + tailwind-merge），约定写法：

```ts
import { cn } from '@antdv/shared/cn';
export const cardClassName = cn('shadow-sm', 'rounded-lg');
```

## 注释语言与写法

仓库没有成文的注释语言条款，但既有代码的实际口径高度一致：**注释写中文、讲"为什么"**，并且大量注释记录的是修复过的坑（例如 `stores/modules/user.ts` 里 logout 为什么必须 `resetRoutes()`、`App.vue` 里 getPopupContainer 为什么对表格固定列例外）。新写注释请沿这个口径：不复述代码行为，只留"读代码看不出来、下次会再踩"的信息。

## 工具链四件套

| 工具 | 配置文件 | 说明 |
| --- | --- | --- |
| oxlint | `oxlint.config.ts` → `@antdv/oxlint-config`（`internal/lint-configs/oxlint-config`） | Rust 快车道，带 `--type-aware`；配置里出现 `mergeOxlintConfigs`，可叠加扩展 |
| oxfmt | `oxfmt.config.ts` → `@antdv/oxfmt-config` | 格式化，`ignorePatterns` 排掉 dist/public/lock 等 |
| ESLint | `eslint.config.ts` → `@antdv/eslint-config` 的 `defineConfig()` | 自维护的 flat config（`internal/lint-configs/eslint-config`），组合 vue / javascript / typescript / jsonc / node / perfectionist / yaml / pnpm _configs + `customConfig`；不是 `@antfu/eslint-config`，别按那套找规则 |
| stylelint | `@antdv/stylelint-config` | 管 `*.{vue,css,less,scss}` |

一条命令全跑：

```bash
pnpm lint            # vsh lint：oxlint --fix → oxfmt → eslint --fix → stylelint --fix
pnpm format          # 同上，带 --format 语义
pnpm check           # check:circular(vsh) + check:dep(vsh) + check:type(turbo) + cspell
```

`vsh lint` 会按机器降级：CPU ≤4 核或空闲内存 ≤8GB 时串行、线程数压到 2（`scripts/vsh/src/lint/index.ts` 的阈值注释），低配机上不会一启动就冻住。

## 提交规范

- 类型集与交互问卷在 `commitlint.config.mjs`（cz-git 的 `defineConfig`）： `feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert`，breaking change 只允许 `feat`、`fix` 带；推荐用 `pnpm commit`（czg）走问卷，别手敲。
- 校验器 `@antdv/eslint-config` 同目录还有 `@antdv/commitlint-config`，根 devDependencies 里两者都装了。
- **lefthook 的钩子目前整文件注释停用**（`lefthook.yml` 里 pre-commit / commit-msg / post-merge 全部带 `#`），但 `prepare` 脚本仍会 `lefthook install`。后果：提交时**没有任何自动检查**，`test.only`、类型错误、脏格式都能直接进仓库。所以提交前自查是硬要求，清单见[测试](/zh/guide/project/testing)文末。

## 测试与文档的口径

- 单测放被测对象同目录的 `__tests__/`，文件 `*.spec.ts`；"源码契约"类守卫必须带正反样例（防止扫描正则写错导致的永真绿）。详见[测试](/zh/guide/project/testing)。
- 值得记版本的改动补一条 `.changeset/*.md`（见 [Changeset](/zh/guide/project/changeset)）。
- 拼写检查进 `pnpm check`：cspell 扫 `**/*.ts`、README 与 `.changeset/*.md`。

## 相关页面

- 目录树逐层解释：[目录说明](/zh/guide/project/dir)
- 样式体系（Tailwind 与 antd 共存）：[Tailwind CSS](/zh/guide/project/tailwindcss)
