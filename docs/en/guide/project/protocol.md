# Conventions

In one sentence: **the rules live in `CODE_STANDARD.md` at the repo root (489 lines, 20 sections); the toolchain is oxlint + oxfmt + ESLint (flat) + stylelint; commits go through cz-git + commitlint; git hooks are currently commented out, so the gate is running `pnpm check` / `pnpm lint` yourself.**

## The written rules: CODE_STANDARD.md

Do not copy its text here — this is the skeleton and the "why" (full text in `CODE_STANDARD.md`):

| Section | Core stance |
| --- | --- |
| 1 Directory layout | a page module splits into `index.vue` / `actions.ts` / `columns.ts` / `schemas.ts` / `constants.ts` / `types.ts` — no dumping everything in index.vue |
| 2 Naming | components PascalCase, variables camelCase, constants `UPPER_SNAKE`; CSS classes: Tailwind first, `cn()` for the complex ones |
| 3 Vue | `<script setup lang="ts">` mandatory; `defineProps<{}>()` / `defineEmits<{}>()` generic form, no runtime props |
| 4 Pinia | setup stores; `useUserStore` is the **only** user-state exit, `useAuthStore` is deprecated and banned; no blanket persistence plugins |
| 7 Styles | precedence: Tailwind atoms → `cn()` merge → `:deep()` → `scoped`; long class strings move into `constants.ts` |
| 8-9 Table/CRUD | canonical `BasicTable` + `useTable` usage, `useCRUD`'s option surface (see [Reusable components](/en/guide/in-depth/common)) |
| 12 Environment | only `VITE_`-prefixed vars reach the client; secrets never go into `VITE_*` |
| 13 Form schema | schemas depending on reactive data must be `computed` factories, never static arrays |
| 19 TypeScript | no `any` (use `unknown` + type guards); types always via `import type` |
| 20 Performance | virtual scrolling for big lists, `shallowRef`/`markRaw` for charts, lazy routes |

`cn()` is implemented in `packages/shared/src/utils/cn.ts` (clsx + tailwind-merge); the house style:

```ts
import { cn } from '@antdv/shared/utils/cn';
export const cardClassName = cn('shadow-sm', 'rounded-lg');
```

## Comment language and spirit

There is no written clause, but the codebase is unanimous: **comments are Chinese and explain "why"**, and many of them record a bug already fixed (e.g. why `logout()` must call `resetRoutes()` in `stores/modules/user.ts`, why `getPopupContainer` makes an exception for table fixed columns in `App.vue`). New comments should follow that: never restate what the code does — only what a reader could not infer and would trip over again.

## The four-piece toolchain

| Tool | Config | Notes |
| --- | --- | --- |
| oxlint | `oxlint.config.ts` → `@antdv/oxlint-config` (`internal/lint-configs/oxlint-config`) | the fast Rust lane, runs `--type-aware`; configs merge via `mergeOxlintConfigs` |
| oxfmt | `oxfmt.config.ts` → `@antdv/oxfmt-config` | formatter; `ignorePatterns` excludes dist/public/lockfiles |
| ESLint | `eslint.config.ts` → `defineConfig()` from `@antdv/eslint-config` | a **home-grown flat config** (`internal/lint-configs/eslint-config`) composing vue / javascript / typescript / jsonc / node / perfectionist / yaml / pnpm configs plus `customConfig`. It is _not_ `@antfu/eslint-config` — don't hunt for its rules |
| stylelint | `@antdv/stylelint-config` | covers `*.{vue,css,less,scss}` |

One command each:

```bash
pnpm lint            # vsh lint: oxlint --fix → oxfmt → eslint --fix → stylelint --fix
pnpm format          # same pipeline, format semantics
pnpm check           # check:circular(vsh) + check:dep(vsh) + check:type(turbo) + cspell
```

`vsh lint` self-throttles: with ≤4 CPU cores or ≤8GB free memory it runs serially with 2 threads (threshold comments in `scripts/vsh/src/lint/index.ts`), so low-end machines don't freeze at kickoff.

## Commit conventions

- The type set and interactive prompt live in `commitlint.config.mjs` (cz-git's `defineConfig`): `feat / fix / docs / style / refactor / perf / test / build / ci / chore / revert`; breaking changes only allowed on `feat`/`fix`. Use `pnpm commit` (czg) instead of typing messages by hand.
- `@antdv/commitlint-config` ships alongside in `internal/lint-configs/`.
- **The lefthook hooks are entirely commented out** (`lefthook.yml`: pre-commit, commit-msg and post-merge all prefixed with `#`), although `prepare` still runs `lefthook install`. Consequence: **nothing checks at commit time** — `test.only`, type errors and unformatted files sail in. The pre-commit self-review checklist at the end of [Testing](/en/guide/project/testing) is therefore mandatory.

## Testing and docs rules

- Unit tests sit in `__tests__/` next to the subject as `*.spec.ts`; "source contract" guards require positive and negative samples (so a broken regex can't become an always-green no-op). Details in [Testing](/en/guide/project/testing).
- Changes worth a version get a `.changeset/*.md` entry (see [Changesets](/en/guide/project/changeset)).
- Spell check is part of `pnpm check`: cspell scans `**/*.ts`, the READMEs and `.changeset/*.md`.
