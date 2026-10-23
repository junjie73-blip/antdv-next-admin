# Keeping the template up to date

Once you clone this repository it is yours — nobody pushes updates to you. This page says **where versions are pinned**, which update tooling is **actually installed**, and where a breaking upgrade of the component stack (reka-ui + TanStack + vue-sonner) bites first. Every version cited was read out of `pnpm-workspace.yaml` and `pnpm-lock.yaml`.

## Three places a version lives

| Location | Contents | Notes |
| --- | --- | --- |
| `catalog:` in `pnpm-workspace.yaml` | 241 entries (`:22-262`) | the single source of truth; all 148 dependency entries in `apps/web` (87 in `dependencies` at `:17-105`, 61 in `devDependencies`) are `catalog:` or `workspace:*` — not one literal version |
| `overrides` in the same file | `vue`, `clsx`, `pinia`, `@ctrl/tinycolor`, `@ast-grep/napi` → `catalog:` | forces one instance of each so third-party peer trees cannot fork |
| Root `package.json` | `packageManager: pnpm@10.12.4`, `engines.node: ">=22"`; `.node-version` says 24.0.0 | `preinstall` runs `only-allow pnpm`; a workspace installed with npm/yarn is a fake one |

**No dependency anywhere in the workspace carries a literal version**: every package — `apps/web` included — uses `catalog:` or `workspace:*`. The one formal variation is `apps/web`'s `vue`, which points at a **named catalog**: `"vue": "catalog:conflicts_vue_h3_5_43"` (`apps/web/package.json:95`). To bump a version you edit the `catalog:` line in `pnpm-workspace.yaml`; never add a literal to a sub-package.

::: warning

One named catalog, and `overrides` overrides it `catalogs.conflicts_vue_h3_5_43` (`pnpm-workspace.yaml:264-266`, `vue: ^3.5.43`) is genuinely referenced by `apps/web`, so it is not dead configuration — but `overrides.vue: 'catalog:'` (`:292-297`) pins it straight back onto the **exact** `3.5.43` in the default catalog (`:229`). That named channel therefore resolves to nothing different today; it survives as a historical artefact. To actually upgrade Vue, editing `catalog:` at `:229` is enough. :::

## Switches that actually fire at install time

pnpm 10's build-script allow-list is maintained explicitly here: `onlyBuiltDependencies` admits the four `@vue-office/*` packages, `ignoredBuiltDependencies` skips `esbuild`, `core-js`, `lefthook` and the imagemin binaries, and `allowBuilds` carries a separate map. **When you upgrade to a dependency with a postinstall hook, pnpm does not ask — it skips it and prints one line about ignored build scripts**, so the symptom is a package whose native binary never landed (`vite-plugin-imagemin` is the usual victim). Read that part of every install.

Three more values shape the upgrade: `verifyDepsBeforeRun: false` (scripts do not check node_modules against the lockfile first, so a forgotten `pnpm install` runs the old tree), `minimumReleaseAge: 0` (a version published a minute ago resolves immediately — no supply-chain buffer), plus `dedupePeerDependents: true`, `strictPeerDependencies: false` and `autoInstallPeers: true`.

## Update tooling: what is real and what is not

| Command | What it runs | Status |
| --- | --- | --- |
| `pnpm update:deps` | `npx taze -r -w` | works, but taze is **not a dependency** — npx downloads it each run |
| `pnpm catalog` | `pnpm dlx codemod pnpm/catalog` | works; the way to fold stray literal versions into the catalog |
| `pnpm check:dep` | `vsh check-dep` → knip 6.40.0 | works (knip comes from `scripts/vsh`). Its default config ignores `docs/**` and hardcodes a `ignoreDependencies` list including `playwright`, `rimraf`, `tailwindcss` — "unused" is not the same as "safe to delete" |
| `pnpm check:builds` | `node ./scripts/check-uniform-build.mjs` | works, and it is **the check most likely to stop a new package**. It turns the "uniform sub-package build standard" into an executable rule (written up in [Development conventions](/en/guide/essentials/development)): every workspace package must have a `build`, and packages that only ship raw files must be registered in `NO_BUILD_PACKAGES` (today that is `@antdv/{tsconfig,stylelint-config,commitlint-config}`); a package whose entry points at `dist/` must list `dist` in `files`; a source-published package (entry at `src/`) must not carry its own `dev` / watch |
| `pnpm check:circular` | `vsh check-circular` → circular-dependency-scanner | works |
| `pnpm check:type` | `turbo run type-check` | works (the script is `check:type`; **there is no `pnpm typecheck`**) |
| `pnpm check:cspell` | `cspell lint ...` | **always fails**: no package.json depends on cspell, see [FAQ](/en/guide/other/faq) |
| `pnpm check` | circular → dep → type → builds → cspell | the last link is broken; use the first four day to day |
| Git hooks | `lefthook`, installed by `prepare` | the files really are in `.git/hooks`, but `lefthook.yml` contains only two blocks — `# pre-commit:` (`:1-11`) and `# post-merge:` (`:13-16`) — and **both are entirely comments**; there is not even a `commit-msg` hook, so nothing is enforced (commitlint only fires on the manual `pnpm commit`/`czg` path). There is no `simple-git-hooks`, no `lint-staged` |

## changesets: versions move, but no one releases for you

```bash
pnpm changeset                    # writes .changeset/*.md (32 of them are pending right now)
pnpm version                      # changeset version && pnpm install --no-frozen-lockfile
pnpm release                      # pnpm build && changeset publish
```

Three decisions in `.changeset/config.json` matter: `fixed: [["@antdv/*", "@antdv/*"]]` (`:5`) makes every `@antdv/*` package **jump to the same version within one `pnpm version` run**; `privatePackages: { version: true, tag: true }` (`:9-12`) lets versioning and tagging reach private packages; `updateInternalDependencies: "patch"` (`:16`). Changelogs come from `@changesets/changelog-git`, so entries carry the short commit SHA and need no credentials — with `changelog-github` instead, a missing `GITHUB_TOKEN` aborts the whole `version` run.

::: warning

`fixed` means "the next release moves everyone to one number" — the landing version is the **highest number currently in the group** plus the largest bump level of the round. The first real `pnpm version`, on 2026-10-23, tripped over exactly that: the packages had been hand-numbered during the rework and sat on five different numbers (`0.0.0` / `0.1.0` / `0.4.0` / `0.5.0` / `5.8.0`), and `scripts/*` (`@antdv/turbo-run`, `@antdv/vsh`) still carried `5.8.0` inherited from upstream `vue-vben-admin`. Run as-is, it would have pushed the whole set to `5.9.0`. The fix was to reset every member to `0.0.0` first, so the first unified release landed on `0.1.0`. **So new packages are born at `0.0.0`**: the highest number in the group decides the landing point for all of them. :::

::: danger

`pnpm release` is not "publish to npm" `packages/*`, `apps/*`, `docs` and the root package.json are **all `"private": true`** (the single `publishConfig` is at `packages/core/ui-kit/shadcn-ui/package.json:31`, and it merely repeats the `src` exports verbatim — that package is private too). Here changesets only produce per-package CHANGELOGs and git tags; nothing goes to a registry. The release history is thin for the same reason: `.github/workflows/` contains only `docs.yml`, and no job runs changesets; before 0.1.0 the repository had nothing but `v0.0.3` plus a stray `vnull`. **Upgrading and releasing is a local act** — commit the `version` output yourself, then `pnpm exec changeset tag`, and push with `git push --follow-tags` because a plain `git push` leaves tags behind. :::

## Running a component-stack upgrade

The component layer is four groups of dependencies now, and each appears exactly once in the catalog: `reka-ui` is **nailed to an exact version** (`pnpm-workspace.yaml:189`, `2.11.0`, no range operator), the four TanStack packages carry ranges (`@tanstack/vue-form ^1.33.5` at `:58`, `vue-query ^5.104.2` at `:59`, `vue-store ^0.11.2` at `:60`, `vue-table ^9.2.8` at `:61`), toasts sit on `vue-sonner: 2.0.9` (`:238`, exact as well), and the icon sets are the five `@iconify-json/*` entries (`:38-42`). **`antdv-next`, `@antdv-next/*` and `@form-create/*` have been removed from the catalog entirely** — `grep -n "antdv-next\|form-create" pnpm-workspace.yaml` returns nothing and `pnpm-lock.yaml` holds not a single resolution record for them — they are gone from the dependency graph: `apps/web` does not reference them, and neither does any of the 21 runtime packages in its `dependencies` (`apps/web/package.json:18-38`).

The consumer side is narrow, so this list is enough to find what an upgrade touches: `reka-ui` is referenced by three packages only — `packages/core/ui-kit/{common-ui,form-ui,shadcn-ui}`; `vue-sonner` by four — `common-ui`, `popup-ui`, `shadcn-ui`, `table-ui`; the `@iconify-json/*` sets mainly live in `@antdv/icons` (`packages/core/base/icons/package.json:29-33`), while `apps/web` additionally depends directly on carbon (`apps/web/package.json:44`) and on four collections used only on the dev side (`:110-113`). Forms, tables, popups, tabs, menus and layout shells are built on TanStack + shadcn-vue, and toasts go through `@antdv/popup-ui` (a vue-sonner wrapper).

Two guards hold this boundary, which means a component-stack upgrade never turns them red — but the moment someone pulls a component library back in, it does: `packages/core/hooks/__tests__/boundary.test.ts`, first block "sub-packages do not depend on antdv-next" (`:136-186`, containing "no component-library import in source" and "no component library in a manifest's dependencies / peerDependencies") and second block "cross-package imports go by package name" (from `:188`, guarding a different edge: relative specifiers must not reach into another package — the single exception is the `@source` list in `@antdv/design`, because Tailwind only accepts filesystem paths, and that list must also cover every package containing a `.vue`; every cross-package `@antdv/*` must be listed in `dependencies`/`peerDependencies`; files under `src` must not import their own package name through the barrel). On the application side the guard is `apps/web/src/views/__tests__/gallery-api-usage.spec.ts:144`, whose patterns at `:121-123` catch both the imports of `antdv-next` / `@antdv-next/*` / `@form-create/*` **and** the `<a-xxx>` tag form. Conclusion: bumping reka-ui or TanStack means work inside `packages/core/ui-kit/**`; the app only follows.

```bash
# 1. edit the catalog line in pnpm-workspace.yaml
pnpm install --no-frozen-lockfile
# 2. build the dist-published packages first — six of them (shared, types, hooks,
#    preferences, directives, router), `build` is tsdown and `main` points at ./dist;
#    the app imports that output. The other 15 (design, icons, enums, layouts,
#    request, stores, utils plus the eight ui-kit packages) run `vite build` and list
#    both dist and src in `files`, but their `main`/`exports` still point at ./src —
#    the app compiles their source, so those 15 dists exist for the publishing side only
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

1. **The single outlet from preferences to the DOM**. `applyPreferencesToDom()` (`:39`) in `packages/core/preferences/src/update-css-variables.ts`, together with its internal `writeThemeCssVars()` (`:87`), turns `primaryColor / borderRadius / fontSize` and the gray/colour-weak switches into `--primary` / `--radius` / `--font-size` / `--filter` on `<html>` plus the `dark` class and the `data-theme` tier. Two format rules are the easiest to break on an upgrade: colour variables hold **HSL channel triplets** (`convertToHslCssVar()`), and writing a full colour makes the whole `hsl(var(--x))` declaration invalid; radii are **rem** (`radiusToRem()` is the only px→rem outlet). The `--ant-color-primary`, `--ant-primary-color` and `--ant-border-radius` variables that once served the antd compatibility layer are gone, pinned in the opposite direction by `packages/core/preferences/__tests__/update-css-variables.test.ts:80-82`. Theme details: [Theming & preferences](/en/guide/in-depth/theme).

2. **Controlled prop names on the primitives.** This is the family a `reka-ui` major bump changes first. `Checkbox` and `Switch` in `@antdv/shadcn-ui` just pass props / emits straight through `useForwardPropsEmits` to reka's `CheckboxRoot` / `SwitchRoot` (`shadcn-ui/src/components/checkbox/Checkbox.vue:16`, `switch/Switch.vue:18`), and the model name is `modelValue` — writing `:checked` on a page is ignored (the checkbox stays on its initial value) and `@change` never fires, **with no error at all**. The correct form in this repo is `apps/web/src/views/account/settings/index.vue:286-291`. Same shape in `@antdv/common-ui`'s `TabPane`: the required prop is `value`, not `key` (`common-ui/src/components/tabs/TabPane.vue:13`) — Vue swallows `key`, so the pane registers as `undefined`.
3. **Table.** `BasicTable` in `@antdv/table-ui` is a TanStack implementation: whether it gets an internal scroll container and a pinned header depends solely on a numeric `scroll.y` (`packages/core/ui-kit/table-ui/src/hooks/useMergedProps.ts:28-32`), and the `virtual` field at `types.ts:648` is the table's own virtual-scroll switch — the two are not the same thing under the same name. On the drag-sort side the discipline is the opposite of intuition: `useDragSort.ts` must **not** measure inside the event, because Sortable has already moved the `<tr>` into its new position during `onMove` and the sibling indices drift with it (the explanation is at `:21-31`). It measures once before each drag starts in `snapshotRows()` (`:44-59`), storing `leadingRowCount` (how many non-data rows precede the first data row, `:53`) and a `data-row-key` → record map called `rowByKey` (`:54-58`); data rows are the only `<tr>` elements carrying `data-row-key` inside `<tbody>` (see `packages/core/ui-kit/table-ui/src/BasicTable.vue:766`), so an inserted measure or placeholder row cannot misalign an index. Both behaviours have unit tests (`packages/core/ui-kit/table-ui/__tests__/drag-sort.test.ts`).
4. **APIs and component names that are wrong but silent.** `apps/web/src/views/__tests__/gallery-api-usage.spec.ts` keeps exactly one silently-failing rule now: the permission directive's `role` / `admin` are **arguments**, not modifiers — `v-permission:role="'auditor'"` and `v-permission:admin` take the matching channel, while `.role` / `.admin` are never read (`resolveAccess` only looks at `binding.arg`); the rule is at `:24-37` with its positive/negative samples at `:72-86`. The two checks that targeted antdv-next (a named `useApp` import, Tabs bound to `@add`) went away with the library, and the note explaining that is at `:15-18`. Wrong component names have a different story now: the global `a-*` registration is gone, so an unknown component in a template is caught by vue-tsc during `pnpm check:type`; what survives that (names assembled only at runtime) is caught by `apps/web/e2e/gallery-examples.spec.ts`, which asserts at the end of the example-page cases that no `Failed to resolve component` warning appears (`:989-992`, `:1416-1419`), while detail lists count common-ui's own `[data-common-descriptions-label]` (`:959`, `:1344`).
5. **Icons.** `@antdv/icons` + the five `@iconify-json/*` collections (catalog `:38-42`) + the offline list in `internal/vite-config/src/plugins/auto-import.ts:30-32` (`local: ['carbon', 'ant-design', 'lucide', 'fa6-regular', 'mdi']` — that list has to stay in step with the dependencies; drop one and it becomes a build-time fetch or a blank icon). A misspelled icon name never errors, it just renders an empty square, which is why `apps/web/test/icon-names.test.ts` reconciles every literal against the installed collections across three roots — `apps/backend-mock/server`, `apps/web/src`, `packages` (`SCAN_ROOTS` at `apps/web/test/icon-names.test.ts:45`).

::: tip

Vue is the one runtime that is nailed down. In the default catalog `vue: 3.5.43` (`pnpm-workspace.yaml:229`) carries **no range operator**; eleven other catalog entries are also exact (`reka-ui` at `:189`, `vue-sonner` at `:238`, `@vueuse/core`, `vee-validate`, `@lucide/vue`, `embla-carousel-vue`, `pdfjs-dist`, `zod`, …), but `vue` is the only one that additionally appears in `overrides` (`:292-297`), which forces a single instance across the whole tree. The reason a range is dangerous: it lets some third-party peer trees settle on 3.5.42, which duplicates `@vue/runtime-core` types and makes Directive types fight across package boundaries. Before bumping Vue, decide whether `overrides` should move with it. :::

Stripping out what you do not need is covered by [Removing code](/en/guide/other/remove-code); the rest of the engineering conventions are in [Development conventions and environment variables](/en/guide/essentials/development) and [Directory structure](/en/guide/project/dir).
