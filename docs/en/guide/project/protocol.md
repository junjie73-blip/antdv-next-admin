# Conventions

In one sentence: **the rules live in `CODE_STANDARD.md` at the repo root (497 lines, 20 `##` sections); the toolchain is oxlint + oxfmt + ESLint (flat) + stylelint; commits go through cz-git + commitlint; git hooks are currently commented out, so the gate is running `pnpm check` / `pnpm lint` yourself.**

## The written rules: CODE_STANDARD.md

Do not copy its text here — this is the skeleton and the "why" (full text in `CODE_STANDARD.md`):

| Section | Core stance |
| --- | --- |
| 1 Directory layout | a page module splits into `index.vue` / `actions.ts` / `columns.ts` / `schemas.ts` / `constants.ts` / `types.ts` — no dumping everything in index.vue |
| 2 Naming | components PascalCase, variables camelCase, constants `UPPER_SNAKE`; CSS classes: Tailwind first, `cn()` for the complex ones |
| 3 Vue | `<script setup lang="ts">` mandatory; `defineProps<{}>()` / `defineEmits<{}>()` generic form, no runtime props |
| 4 Pinia | setup stores; `useUserStore` (`packages/stores/src/user.ts:17`) is the **only** user-state exit, `useAuthStore` (`apps/web/src/stores/modules/auth.ts:13`) is deprecated and has zero consumers; no blanket persistence plugins |
| 7 Styles | precedence: Tailwind atoms → `cn()` merge → `:deep()` → `scoped`; long class strings move into `constants.ts` |
| 8-9 Table/CRUD | canonical `BasicTable` + `useTable` usage, `useCRUD`'s option surface (see [Reusable components](/en/guide/in-depth/common)) |
| 12 Environment | only `VITE_`-prefixed vars reach the client; secrets never go into `VITE_*` |
| 13 Form schema | schemas depending on reactive data must be `computed` factories, never static arrays |
| 19 TypeScript | no `any` (use `unknown` + type guards); types always via `import type` |
| 20 Performance | virtual scrolling for big lists, `shallowRef`/`markRaw` for charts, lazy routes |

`cn()` is implemented in `packages/core/base/shared/src/utils/cn.ts` (clsx + tailwind-merge); the house style:

```ts
import { cn } from '@antdv/shared/utils/cn';
export const cardClassName = cn('shadow-sm', 'rounded-lg');
```

## Comment language and spirit

There is no written clause, but the codebase is unanimous: **comments are Chinese and explain "why"**, and many of them record a bug already fixed (e.g. why `logout()` must call `resetRoutes()` in `packages/stores/src/user.ts:78-82`, why the first-screen Loading plugin can never be wrapped in the `VITE_INJECT_APP_LOADING` switch in `internal/vite-config/src/plugins/index.ts:157-164`). New comments should follow that: never restate what the code does — only what a reader could not infer and would trip over again.

## The four-piece toolchain

| Tool | Config | Notes |
| --- | --- | --- |
| oxlint | `oxlint.config.ts:1,4` → `@antdv/oxlint-config` (`internal/lint-configs/oxlint-config`) | the fast Rust lane; `vsh lint` always passes `--type-aware` (`scripts/vsh/src/lint/index.ts:128`). The root config only calls `defineConfig(oxlintConfig)`; the `mergeOxlintConfigs` helper that stacks extensions lives in the shared package (`src/configs/index.ts:19`, composed at `src/index.ts:11-15`) |
| oxfmt | `oxfmt.config.ts:4` → `@antdv/oxfmt-config` | formatter; `ignorePatterns` excludes dist / node_modules / coverage |
| ESLint | `eslint.config.ts:1-3` → `defineConfig()` from `@antdv/eslint-config` | a **home-grown flat config** (`internal/lint-configs/eslint-config`) composing vue / javascript / typescript / jsonc / node / perfectionist / yaml / pnpm configs plus `customConfig`. It is _not_ `@antfu/eslint-config` — don't hunt for its rules |
| stylelint | `@antdv/stylelint-config` | covers `*.{vue,css,less,scss}` (`scripts/vsh/src/lint/index.ts:131`) — but **no landed stylelint config file exists anywhere in the repo**, so this step has no rules to apply; see the "dead code" table in [FAQ](/en/guide/other/faq) |

One command each:

```bash
pnpm lint            # vsh lint: oxlint --type-aware → oxfmt --check → eslint → stylelint (nothing rewrites files)
pnpm format          # vsh lint --format: oxlint --fix → oxfmt → eslint --fix → stylelint --fix (serial)
pnpm check           # package.json:16 — check:circular + check:dep + check:type + check:cspell
```

`vsh lint` self-throttles, and the two rules are separate: **serial vs parallel depends only on core count** (≤4 cores → serial, `scripts/vsh/src/lint/index.ts:136`), while **the thread count is what looks at memory** (>4 cores and >8GB free → 4 threads, otherwise 2, `:113-115`), so low-end machines don't freeze at kickoff.

## Commit conventions

- The type set and interactive prompt live in `commitlint.config.mjs` (cz-git's `defineConfig`): `feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert`; breaking changes only allowed on `feat`/`fix` (`allowBreakingChanges`, `:87`). Use `pnpm commit` (czg) instead of typing messages by hand.
- `@antdv/commitlint-config` ships alongside in `internal/lint-configs/`.
- **The lefthook hooks are entirely commented out** — `lefthook.yml:1-11` (`pre-commit`: oxfmt + eslint) and `:13-16` (`post-merge`: `pnpm install`) are all prefixed with `#`, and there is no `commit-msg` section in the file at all — although `prepare` still runs `lefthook install` (`package.json:34`). Consequence: **nothing checks at commit time** — `test.only`, type errors and unformatted files sail in. The pre-commit self-review checklist at the end of [Testing](/en/guide/project/testing) is therefore mandatory.

## Testing and docs rules

- Unit tests sit in `__tests__/` next to the subject as `*.spec.ts` or `*.test.ts`; "source contract" guards require positive and negative samples (so a broken regex can't become an always-green no-op). Details in [Testing](/en/guide/project/testing).
- Changes worth a version get a `.changeset/*.md` entry (see [Changesets](/en/guide/project/changeset)).
- Spell check **is wired into `pnpm check`** (`package.json:16` chains `check:cspell`, whose definition at `:18` scans `**/*.ts`, `**/README.md` and `.changeset/*.md`) — but **cspell is not a dependency of any package**: it only exists as a version entry in the catalog (`pnpm-workspace.yaml:133`) and appears nowhere in `pnpm-lock.yaml`. So the last step of `pnpm check` always fails with "command not found"; use the first three day to day, as noted in [FAQ](/en/guide/other/faq).
