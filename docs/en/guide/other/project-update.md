# Keeping the template up to date

Once you clone this repository it is yours — nobody pushes updates to you. This page says **where versions are pinned**, which update tooling is **actually installed**, and where a breaking `antdv-next` upgrade bites first. Every version cited was read out of `pnpm-workspace.yaml` and `pnpm-lock.yaml`.

## Three places a version lives

| Location | Contents | Notes |
| --- | --- | --- |
| `catalog:` in `pnpm-workspace.yaml` | 247 entries (`:21`) | the single source of truth; all 155 dependency entries in `apps/web` (93 in `dependencies` at `:17-111`, 62 in `devDependencies`) are `catalog:` or `workspace:*` — not one literal version |
| `overrides` in the same file | `vue`, `clsx`, `pinia`, `@ctrl/tinycolor`, `@ast-grep/napi` → `catalog:` | forces one instance of each so third-party peer trees cannot fork |
| Root `package.json` | `packageManager: pnpm@10.12.4`, `engines.node: ">=22"`; `.node-version` says 24.0.0 | `preinstall` runs `only-allow pnpm`; a workspace installed with npm/yarn is a fake one |

**No dependency anywhere in the workspace carries a literal version**: every package — `apps/web` included — uses `catalog:` or `workspace:*`. The one formal variation is `apps/web`'s `vue`, which points at a **named catalog**: `"vue": "catalog:conflicts_vue_h3_5_43"` (`apps/web/package.json:101`). To bump a version you edit the `catalog:` line in `pnpm-workspace.yaml`; never add a literal to a sub-package.

::: warning

One named catalog, and `overrides` overrides it `catalogs.conflicts_vue_h3_5_43` (`pnpm-workspace.yaml:270-272`, `vue: ^3.5.43`) is genuinely referenced by `apps/web`, so it is not dead configuration — but `overrides.vue: 'catalog:'` (`:298-303`) pins it straight back onto the **exact** `3.5.43` in the default catalog (`:235`). That named channel therefore resolves to nothing different today; it survives as a historical artefact. To actually upgrade Vue, editing `catalog:` at `:235` is enough.
:::

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
| Git hooks | `lefthook`, installed by `prepare` | the files really are in `.git/hooks`, but `lefthook.yml` contains only two blocks — `# pre-commit:` (`:1-11`) and `# post-merge:` (`:13-16`) — and **both are entirely comments**; there is not even a `commit-msg` hook, so nothing is enforced (commitlint only fires on the manual `pnpm commit`/`czg` path). There is no `simple-git-hooks`, no `lint-staged` |

## changesets: versions move, but no one releases for you

```bash
pnpm changeset                    # writes .changeset/*.md (25 of them are pending right now)
pnpm version                      # changeset version && pnpm install --no-frozen-lockfile
pnpm release                      # pnpm build && changeset publish
```

Three decisions in `.changeset/config.json` matter: `fixed: [["@antdv/*", "@antdv/*"]]` (`:10`) makes every `@antdv/*` package **jump to the same version within one `pnpm version` run**; `privatePackages: { version: true, tag: true }` (`:14-17`) lets versioning and tagging reach private packages; `updateInternalDependencies: "patch"` (`:21`). Changelogs come from `@changesets/changelog-github`, with the repository name hardcoded to `junjie73-blip/antdv-next-admin` (`:3-8`).

::: warning

`fixed` does not mean "everyone is on the same number right now" Packages created **after** the last `pnpm version` joined the group carrying their own initial version, so the workspace's numbers are scattered: most packages are on `0.4.0` (= root `package.json:3`), `@antdv/layouts` is already `0.5.0`, `@antdv/{common-ui,enums,request,stores,utils}` started at `0.1.0`, `internal/lint-configs/*` and `@antdv/docs` sit at `0.0.0`, and the two `scripts/*` packages (`@antdv/turbo-run`, `@antdv/vsh`) are still on the `5.8.0` the template shipped with. The next `pnpm version` is what pulls them together — never read a version number as "this package is newer than that one".
:::

::: danger

`pnpm release` is not "publish to npm" `packages/*`, `apps/*`, `docs` and the root package.json are **all `"private": true`** (the single `publishConfig` is at `packages/core/ui-kit/shadcn-ui/package.json:29`, and it merely repeats the `src` exports verbatim — that package is private too). Here changesets only produce CHANGELOG entries and git tags; nothing goes to a registry. The release history is thin for the same reason: `git tag` shows `v0.0.3` plus a stray `vnull` while the version is already 0.4.0, and `.github/workflows/` contains only `docs.yml`. **Upgrading and releasing is a local act** — if you want tags, run `git tag && git push --tags` yourself.
:::

## Running an antdv-next upgrade

`antdv-next` appears exactly once in the catalog (`pnpm-workspace.yaml:116`, `^1.6.0`), and today **only `apps/web` depends on it directly** (`apps/web/package.json:67`) — not one of the 21 runtime packages does (`shared`, `types`, `hooks`, `preferences`, `directives`, `router`, `stores`, `request`, `utils`, `enums`, `icons`, `design`, `layouts` and the eight `ui-kit` packages are all clean): toasts go through `@antdv/popup-ui` (a vue-sonner wrapper), while forms, tables, popups, tabs, menus and layout shells are built on TanStack + shadcn-vue. This boundary is guarded file by file by `packages/core/hooks/__tests__/boundary.test.ts` (first block `:136-186`, containing "no component-library import in source" and "no component library in a manifest's dependencies / peerDependencies"), so bumping antdv-next touches the app only and never a package build output. The same file has a second block, "cross-package imports go by package name" (from `:188`), guarding a different edge: relative specifiers must not reach into another package (the single exception is the `@source` list in `@antdv/design`, because Tailwind only accepts filesystem paths — that list must also cover every package containing a `.vue`), every cross-package `@antdv/*` must be listed in `dependencies`/`peerDependencies`, and files under `src` must not import their own package name through the barrel. The satellites deserve the same attention: the catalog lists three (`cssinjs` `:22`, `icons` `:23`, `tailwind` `:24`) but only the first two are referenced, both from `apps/web` (`apps/web/package.json:18-19`) — `@antdv-next/tailwind` is in no manifest anymore, so its catalog line can be ignored during an upgrade, or simply deleted. What still puts antd DOM into the bundle is `@form-create/antd-designer` + `@form-create/antdv-next` (catalog `:42`, `apps/web/package.json:46-47`) — see item 2 below. The five `@iconify-json/*` sets (catalog `:43-47`) mainly live in `@antdv/icons` (`packages/core/base/icons/package.json:27-31`); `apps/web` additionally depends directly on carbon and on four dev-side collections (`apps/web/package.json:48,116-119`).

```bash
# 1. edit the catalog line in pnpm-workspace.yaml
pnpm install --no-frozen-lockfile
# 2. build the dist-published packages first — six of them (shared, types, hooks,
#    preferences, directives, router) whose `main` points at ./dist; the app imports
#    that output. The other 15 (design, icons, enums, layouts, request, stores, utils
#    plus the eight ui-kit packages) are source-published: `main` is ./src and web's
#    Vite compiles them directly, so they need no build step
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

1. **The shape of the `ConfigProvider` theme** (`apps/web/src/App.vue:67-74`, with `themeConfig` computed at `:21-23`). The `theme` object is assembled by `getAntdTheme` in `apps/web/src/settings/theme/index.ts:80-122` in three layers: `algorithm` (`darkAlgorithm` / `defaultAlgorithm` / `compactAlgorithm`, `:87-94`), `token` (`lightToken` / `darkToken` + registered style presets + runtime overrides, `:98-116`) and `components` (`:117-120`). A renamed algorithm field does not throw — dark and compact themes just silently fall back to the default. A second, independent chain runs from preferences to the DOM: `applyPreferencesToDom` in `packages/core/preferences/src/update-css-variables.ts:37-72` writes only the `--app-*` / `--radius-*` variables owned by `@antdv/design` (the theme-related ones at `:85-115`). The `--ant-color-primary`, `--ant-primary-color` and `--ant-border-radius` variables that once served the antd compatibility layer have been removed completely, and `packages/core/preferences/__tests__/update-css-variables.test.ts:64-78` pins in the opposite direction — they must not come back. Theme details: [Theming & preferences](/en/guide/in-depth/theme).
2. **Sub-component template syntax.** First-party source no longer has any antd component consumers: inside `apps/web/src`, `from 'antdv-next'` survives in only three places of production code (`App.vue:8`, `plugins/vendor-antd-components.ts:5-42`, `settings/theme/index.ts:2-4`) plus two tests (`settings/__tests__/antd-theme.test.ts`, `views/__tests__/gallery-api-usage.spec.ts`). Pages and layouts that need a component must import the `@antdv/*` wrappers — a rule held by the guard test at `apps/web/src/views/__tests__/gallery-api-usage.spec.ts:137`. What cannot be closed off is pre-compiled third-party templates: `@form-create/antd-designer` finds components at runtime through `resolveComponent('a-…')`, and what serves it is the 36 kebab-case registrations in `apps/web/src/plugins/vendor-antd-components.ts` (the list at `:59-96`, registered at `:112-119`, plus the `a-form-item-rest` pass-through placeholder). A new material has to be added to that table. A missing name **does not fail the build** — you get one `Failed to resolve component` warning and an empty node, which is why `apps/web/e2e/gallery-examples.spec.ts` asserts at the end of the example-page cases that no such warning appears (`:968-972`, `:1394-1398`), and the detail lists count common-ui's own `[data-common-descriptions-label]` instead (`:937`).
3. **Table.** `App.vue:73` turns `virtual` on for the antd `ConfigProvider`, but that only affects **places still rendering antd tables** (the designer's materials). `BasicTable` in `@antdv/table-ui` is a TanStack implementation: whether it gets an internal scroll container and a pinned header depends solely on a numeric `scroll.y` (`packages/core/ui-kit/table-ui/src/BasicTable.vue:151`), and the `virtual` field at `types.ts:648` is the table's own virtual-scroll switch — the two are not the same thing under the same name. On the drag-sort side, `packages/core/ui-kit/table-ui/src/hooks/useDragSort.ts:26-46` measures "how many rows precede the first data row" on every event (data rows are the only `<tr>` elements carrying `data-row-key` inside `<tbody>`, see `BasicTable.vue:1364`), so an inserted measure or placeholder row cannot misalign an index. Both behaviours have unit tests (`packages/core/ui-kit/table-ui/__tests__/drag-sort.test.ts`).
4. **APIs that are wrong but silent.** `apps/web/src/views/__tests__/gallery-api-usage.spec.ts` catches three families before you do: a named `useApp` import (1.6 only exposes `App.useApp()`), permission directive arguments written as modifiers (`v-permission:role`, not `v-permission.role`), and Tabs bound to `@add` (1.6 only emits `@edit`).
5. **Icons.** `@antdv-next/icons` (catalog `:23`, `apps/web/package.json:19`) + the five `@iconify-json/*` collections (catalog `:43-47`) + the offline list in `internal/vite-config/src/plugins/auto-import.ts:30-32` (`local: ['carbon', 'ant-design', 'lucide', 'fa6-regular', 'mdi']` — that list has to stay in step with the dependencies; drop one and it becomes a build-time fetch or a blank icon). A misspelled icon name never errors, it just renders an empty square, which is why `apps/web/test/icon-names.test.ts` reconciles every literal against the installed collections across three roots — `apps/backend-mock/server`, `apps/web/src`, `packages` (`SCAN_ROOTS`, `:45`).

::: tip

Vue is the one runtime that is nailed down. In the default catalog `vue: 3.5.43` (`pnpm-workspace.yaml:235`) carries **no range operator**; eleven other catalog entries are also exact (`reka-ui`, `@vueuse/core`, `vee-validate`, …), but `vue` is the only one that additionally appears in `overrides` (`:298-303`), which forces a single instance across the whole tree. The reason a range is dangerous: it lets some third-party peer trees settle on 3.5.42, which duplicates `@vue/runtime-core` types and makes Directive types fight across package boundaries. Before bumping Vue, decide whether `overrides` should move with it.
:::

Stripping out what you do not need is covered by [Removing code](/en/guide/other/remove-code); the rest of the engineering conventions are in [Development conventions and environment variables](/en/guide/essentials/development) and [Directory structure](/en/guide/project/dir).
