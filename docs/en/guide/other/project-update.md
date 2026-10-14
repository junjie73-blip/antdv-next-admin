# Keeping the template up to date

Once you clone this repository it is yours — nobody pushes updates to you. This page says **where versions are pinned**, which update tooling is **actually installed**, and where a breaking `antdv-next` upgrade bites first. Every version cited was read out of `pnpm-workspace.yaml` and `pnpm-lock.yaml`.

## Three places a version lives

| Location | Contents | Notes |
| --- | --- | --- |
| `catalog:` in `pnpm-workspace.yaml` | 254 entries | the single source of truth; every one of the 170 dependency entries in `apps/web/package.json` is `catalog:` or `workspace:*` |
| `overrides` in the same file | `vue`, `clsx`, `pinia`, `@ctrl/tinycolor`, `@ast-grep/napi` → `catalog:` | forces one instance of each so third-party peer trees cannot fork |
| Root `package.json` | `packageManager: pnpm@10.12.4`, `engines.node: ">=22"`; `.node-version` says 24.0.0 | `preinstall` runs `only-allow pnpm`; a workspace installed with npm/yarn is a fake one |

**Only three dependencies in the whole workspace bypass the catalog**: `clsx@^2.1.1`, `pinia@^3.0.4` and `vue@^3.5.43` in `apps/web` — the first two are leftovers (`overrides` pulls them back onto the catalog range), and the `vue` line is overridden to the exact `3.5.43` regardless. Bump the catalog line; do not add a literal.

::: warning One dead entry `pnpm-workspace.yaml` also declares a named catalog at the bottom — `catalogs.conflicts_vue_h3_5_43` with `vue: ^3.5.43` — while no package.json anywhere references `catalog(conflicts_vue_h3_5_43)`. It takes part in nothing. Don't expect it to hold anything back. :::

## Switches that actually fire at install time

pnpm 10's build-script allow-list is maintained explicitly here: `onlyBuiltDependencies` admits the four `@vue-office/*` packages, `ignoredBuiltDependencies` skips `esbuild`, `core-js`, `lefthook` and the imagemin binaries, and `allowBuilds` carries a separate map. **When you upgrade to a dependency with a postinstall hook, pnpm does not ask — it skips it and prints one line about ignored build scripts**, so the symptom is a package whose native binary never landed (`vite-plugin-imagemin` is the usual victim). Read that part of every install.

Three more values shape the upgrade: `verifyDepsBeforeRun: false` (scripts do not check node_modules against the lockfile first, so a forgotten `pnpm install` runs the old tree), `minimumReleaseAge: 0` (a version published a minute ago resolves immediately — no supply-chain buffer), plus `dedupePeerDependents: true`, `strictPeerDependencies: false` and `autoInstallPeers: true`.

## Update tooling: what is real and what is not

| Command | What it runs | Status |
| --- | --- | --- |
| `pnpm update:deps` | `npx taze -r -w` | works, but taze is **not a dependency** — npx downloads it each run |
| `pnpm catalog` | `pnpm dlx codemod pnpm/catalog` | works; the way to fold stray literal versions into the catalog |
| `pnpm check:dep` | `vsh check-dep` → knip 6.40.0 | works (knip comes from `scripts/vsh`). Its default config ignores `docs/**` and hardcodes a `ignoreDependencies` list including `playwright`, `rimraf`, `tailwindcss` — "unused" is not the same as "safe to delete" |
| `pnpm check:circular` | `vsh check-circular` → circular-dependency-scanner | works |
| `pnpm check:type` | `turbo run type-check` | works (the script is `check:type`; **there is no `pnpm typecheck`**) |
| `pnpm check:cspell` | `cspell lint ...` | **always fails**: no package.json depends on cspell, see [FAQ](/en/guide/other/faq) |
| `pnpm check` | circular → dep → type → cspell | the last link is broken; use the first three day to day |
| Git hooks | `lefthook`, installed by `prepare` | the files are in `.git/hooks`, but every job in `lefthook.yml` (`pre-commit`, `post-merge`, `commit-msg`) is **commented out**, so nothing is enforced. There is no `simple-git-hooks`, no `lint-staged` |

## changesets: versions move, but no one releases for you

```bash
pnpm changeset                    # writes .changeset/*.md (15 of them are pending right now)
pnpm version                      # changeset version && pnpm install --no-frozen-lockfile
pnpm release                      # pnpm build && changeset publish
```

Three decisions in `.changeset/config.json` matter: `fixed: [["@antdv/*", "@antdv/*"]]` makes every `@antdv/*` package **jump to the same version together** (that is why they all read 0.4.0, while `scripts/turbo-run` and `scripts/vsh` sit at 5.8.0); `privatePackages: { version: true, tag: true }` lets versioning and tagging reach private packages; `updateInternalDependencies: "patch"`. Changelogs come from `@changesets/changelog-github`, with the repository name hardcoded to `junjie73-blip/antdv-next-admin`.

::: danger `pnpm release` is not "publish to npm" `packages/*`, `apps/*` and the root are **all `"private": true`**, and none has a `publishConfig`. Here changesets only produce CHANGELOG entries and git tags; nothing goes to a registry. The release history is thin for the same reason: `git tag` shows `v0.0.3` plus a stray `vnull` while the version is already 0.4.0, and `.github/workflows/` contains only `docs.yml` (whose comments still point at a `ci.yml` that does not exist). **Upgrading and releasing is a local act** — if you want tags, run `git tag && git push --tags` yourself. :::

## Running an antdv-next upgrade

`antdv-next` appears exactly once in the catalog (`^1.6.0`) but it is a direct dependency of four packages (`composables`, `preferences`, `shared`, `types`) plus `apps/web`, so that one line moves everything. Its four satellites deserve the same attention: `@antdv-next/cssinjs`, `-icons`, `-tailwind`, `-happy-work-theme`, along with the `@iconify-json/*` sets. None of the ten `ui-kit` packages import antdv-next — forms, tables, popups, tabs, menus and layout shells were re-implemented on TanStack + shadcn-vue, so an antdv-next bump never touches them.

```bash
# 1. edit the catalog line in pnpm-workspace.yaml
pnpm install --no-frozen-lockfile
# 2. build the dist-published packages first (shared, composables, directives, layouts,
#    preferences, router, types) — the app imports their dist. The source-published ones
#    (icons, styles, the ten ui-kit packages) are read straight from src and need no build
pnpm build
# 3. types + unit tests (turbo runs ^build before each task)
pnpm check:type
pnpm test:unit
# 4. end to end: one engine first, not three in parallel
cd apps/web && pnpm exec playwright test --project=chromium --reporter=line
```

Three facts about that last layer, from `apps/web/playwright.config.ts`: the baseURL is `http://localhost:6080` (it comes from `VITE_PORT` in `apps/web/.env.development`), the dev server **hosts the in-process Nitro mock on 5320**, so one `pnpm dev` gives you both halves of the stack; `workers` is capped at 3 locally and 1 in CI, because the default concurrency saturates the single dev process that is doing Vite's on-demand compilation _and_ serving the mock, which produces a run full of pure-timeout false reds (see [Testing strategy](/en/guide/project/testing)). `pnpm test:e2e:install` fetches the three browser engines the first time.

Two more things about `pnpm build`: it sets `NODE_OPTIONS=--max-old-space-size=8192` (a full workspace build blows the default heap), and `pnpm-lock.yaml` sits in `globalDependencies` in `turbo.json` — **every install invalidates the whole turbo cache**, so the first post-upgrade build being slow is expected.

## Five places a breaking upgrade touches first

1. **The shape of the `ConfigProvider` theme** (`apps/web/src/App.vue:46-62`). The object is assembled by `packages/preferences/src/theme/index.ts` in three layers: `algorithm` (`darkAlgorithm` / `defaultAlgorithm` / `compactAlgorithm`), `token` (`lightToken` / `darkToken` + preset + runtime overrides), and `components`. A renamed algorithm field does not throw — dark and compact themes just silently fall back to the default. The same layering shows up in `css-vars.ts`, which writes the primary color **twice** (`--ant-color-primary` plus the legacy `--ant-primary-color`); see [Theming & preferences](/en/guide/in-depth/theme).
2. **Sub-component template syntax.** Four pages still render antd sub-components (`views/account/center`, `views/components/form/steps`, `views/components/table/crud`, `views/system/notice`), and since the resolver was withdrawn every one of them goes through an explicit `import { DescriptionsItem as ADescriptionsItem } from 'antdv-next'` — there is no bare `<a-descriptions-item>` left in `apps/web/src`. That closes the failure mode for first-party source, but not for the pre-compiled third-party templates: `@form-create/antd-designer` resolves at runtime through `resolveComponent('a-…')` and is served by the 36 kebab-case entries in `apps/web/src/plugins/vendor-antd-components.ts` — that list is where a new sub-component has to be added. A missing name **does not fail the build**; you get one `Failed to resolve component` warning and an empty node, which is why `apps/web/e2e/gallery-examples.spec.ts` counts `.ant-descriptions-item-label` nodes instead of checking that a heading is visible, and asserts on the warning text as well.
3. **Table.** `App.vue` turns `virtual` on globally, so antd requires a numeric `scroll.y`; `BasicTable.vue` papers over the pages that only pass `{ x: 1400 }` through `mergedVirtual`. Fixed headers and horizontal scrolling also inject a leading `ant-table-measure-row` into `<tbody>`, and `useDragSort.ts` counts `data-row-key` rows to find that offset. Both behaviours have unit tests (`components/business/Table/__tests__/drag-sort.spec.ts`).
4. **APIs that are wrong but silent.** `apps/web/src/views/__tests__/gallery-api-usage.spec.ts` catches three families before you do: a named `useApp` import (1.6 only exposes `App.useApp()`), permission directive arguments written as modifiers (`v-permission:role`, not `v-permission.role`), and Tabs bound to `@add` (1.6 only emits `@edit`).
5. **Icons.** `@antdv-next/icons`, the five `@iconify-json/*` sets, and the offline list in `internal/vite-config/src/plugins/auto-import.ts`. A misspelled icon name never errors — it renders an empty square — so `apps/web/test/icon-names.test.ts` reconciles every literal against the installed collections.

::: tip Vue is the one runtime that is nailed down `vue: 3.5.43` in the catalog is an **exact** version, and the comment next to it explains why: a range lets some third-party peer trees settle on 3.5.42, which duplicates `@vue/runtime-core` types and makes Directive types fight across package boundaries. Read that comment before you bump Vue or touch `overrides`. :::

Stripping out what you do not need is covered by [Removing code](/en/guide/other/remove-code); the rest of the engineering conventions are in [Development conventions and environment variables](/en/guide/essentials/development) and [Directory structure](/en/guide/project/dir).
