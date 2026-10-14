# Removing code

Adopting this template as a business system usually starts with deletion: the demo pages, the big-screen dashboard, the packages you will never import. What order to cut in, and what each cut drags along, is the whole subject here — because one rule in this repository turns "half a deletion" into a silent fault.

## The rule: the menu _is_ the permission

Neither the sidebar nor the access set comes from the route table. Both come from `GET /api/menus`, whose seed data is a plain array in `apps/backend-mock/server/api/menus.get.ts`:

- `apps/web/src/stores/modules/route.ts` flattens the whole tree (including `hidden` nodes) into `allowedNames` / `allowedPaths`, then `syncRouteRegistry()` diffs it against the route-table snapshot and **calls `removeRoute` for every conventional route the menu does not list**;
- the guard in `packages/router/src/guards/dynamic-route.ts:85-86` consults `canAccess` and sends a miss to `/error/403`; a path the menu lists but no page provides falls through to `/:pathMatch(.*)*` in `router/routes.ts`, which redirects to `/error/404`.

The two half-deletions fail differently and both fail badly: **delete the page but keep the menu record** and the sidebar keeps a dead link that lands on 404; **delete the menu record but keep the page** and the file still compiles and answers a typed URL, but nothing navigates to it and `site-sweep` never visits it.

::: warning `hidden` is not deletion `hidden: true` only means "not in the navigation"; the node still enters the access set — the comment block at the top of `menus.get.ts` exists precisely to say so. The "show in nav" switch on the menu management page writes to no backend either: it stores `xy-menu-hidden-overrides` in localStorage (`stores/modules/route.ts`), and `apps/web/src/api/menu.ts` contains nothing but `getMenus()`. Locally, "delete a menu record" means editing that seed file; on a real backend it means deleting the row. :::

## The deletion checklist, in dependency order

| Step | What you touch | What you get if you skip it |
| --- | --- | --- |
| 1 | `apps/web/src/views/**` — the page plus its private `components/`, `composables/`, `__tests__/` | the conventional route still registers |
| 2 | the node in `apps/backend-mock/server/api/menus.get.ts` (and collapse the parent if it is left with one child) | dead sidebar link → 404 |
| 3 | the `menu.<Name>` line in `src/locales/lang/zh-CN.ts` **and** `en-US.ts` | the English UI falls back to the Chinese `menuName` (`layouts/composables/useMenuTree.ts:22` runs `localizeMenus`) |
| 4 | `apps/web/types/router.d.ts` — generated, not hand-edited: line 4 says `@ts-nocheck`, line 6 says `DO NOT MODIFY THIS FILE` | the type system keeps offering a route that no longer exists |
| 5 | `types/components.d.ts`, `types/auto-imports.d.ts` — generated in the same pass | the editor autocompletes components that are gone |
| 6 | hardcoded paths and constants in `apps/web/e2e/**` | either e2e goes red, or worse it stays green while testing nothing |
| 7 | `apps/web/src/api/<area>.ts` and the mock side `apps/backend-mock/server/api/<area>/**` | an orphan module stays reachable through `~/api` |
| 8 | `apps/web/package.json`, plus the matching `catalog:` line if you want it truly gone | the dependency keeps installing and keeps landing in the lockfile |

Steps 4 and 5 need no manual edit: run `pnpm dev` or `pnpm build` once and let the plugin rewrite them (`VueRouter({ dts: './types/router.d.ts' })`, `internal/vite-config/src/plugins/vue.ts:20`; `VITE_WRITE_DTS=false` skips it).

## Case A: one demo page

Cron expression is the worked example. This returns the complete list of places to cut: `grep -rn "components/cron\|DemoCron" apps/web/src apps/web/types apps/web/e2e apps/backend-mock`.

- `apps/web/src/views/components/cron/` — the page itself
- `apps/backend-mock/server/api/menus.get.ts:300-304` — the `DemoCron` node
- `menu.DemoCron` in both locale files — plus `types/router.d.ts:62-64` and `:422-424`, which regenerate on the next build

The overview page builds its card wall from `routeStore.menus` (`views/components/overview/index.vue:107`), so removing the menu record removes the card by itself. End-to-end will stop you though: `apps/web/e2e/gallery-examples.spec.ts:46` pins the Demo section's leaf count as `OVERVIEW_CARD_COUNT = 23` (the comment above it adds up 24 leaves, minus the overview page). **One page fewer is one card fewer.**

## Case B: a whole feature area

| Area | Files | Extra things it holds |
| --- | --- | --- |
| Big screen `views/screen/**` | `monitor/` + `components/` + `composables/` + `__tests__/` (3 unit specs) | `api/screen.ts`, the mock handler `server/api/screen/monitor.get.ts`, the `ScreenMonitor` menu node — note it hangs under **Dashboard**, not under its own directory — and 4 e2e specs that hardcode `/screen/monitor` |
| System management `views/system/**` | 13 page directories | `api/system.ts`, the mock side `server/api/system/**` (11 domains), the `SystemManage` subtree, `stores/modules/dict.ts` (the dictionary store is fed by the system API, so dictionary rendering loses its data too), and 13 e2e specs referencing `/system/` |
| Dashboard `views/dashboard/**` | `analysis/` + `__tests__/` | **change `HOME_PATH` first** (`src/config/constants.ts:17`, `/dashboard/analysis`): login redirect and the directory-node fallback both aim at it, so deleting the page first drops you into 404. `stores/__tests__/route-menu.spec.ts` and `views/dashboard/__tests__/analysis-merge.spec.ts` also use it as an anchor |

::: danger A static contract ties pages to the menu seed on purpose `apps/web/src/views/dashboard/__tests__/analysis-merge.spec.ts` reads `apps/backend-mock/server/api/menus.get.ts` as text, lifts every `path: '/...'` into a set, and asserts that each quick action on the analysis page targets one of them. Its comments state the policy: the seed is both the route table and the permission source, and "deleting a page means deleting the seed entry with it". Fastest place in the repo for a half-deletion to turn red. :::

## Case C: a workspace package

Short answer: none of `packages/*` can be deleted by removing a directory. The middle column is `grep -rl "@antdv/<pkg>" apps/web/src | wc -l`, re-run after this refactor; the third is actual cross-package imports, comments and docstrings excluded.

| Package | Files in `apps/web/src` | Imported by | What removal actually costs |
| --- | --- | --- | --- |
| `@antdv/shared` | 108 | `composables` / `layouts` / `preferences` / `icons` / `common-ui` / `popup-ui` / `table-ui` … all import it (`cn()` is the repository's only class-merge entry) | roughly a rewrite of the app |
| `@antdv/types` | 31 | `shared` / `layouts` / `preferences` / `composables` + the whole `apps/backend-mock` server layer | type surface spread over every layer |
| `@antdv/shadcn-ui` | 67 | the implementation base of `common-ui` / `icons` / `popup-ui` / `table-ui` / `form-ui` / `menu-ui` / `tabs-ui` | that whole group collapses with it, i.e. there is no UI layer left |
| `@antdv/common-ui` | 67 | app only; it depends on `icons` / `shadcn-ui` / `shared` (loading and scrollbar now live inside it) | the shared display components (Card, Tag, Steps, Upload, Transfer, skeletons) all go; `@antdv/design`'s `index.css` also carries a `@source '../../../ui-kit/common-ui/src'` line that must be deleted in the same change |
| `@antdv/popup-ui` | 50 | `BasicModal` / `BasicDrawer` / `useModal` / `useDrawer` / `confirm` / `message` in the app **all come from this package** (`apps/web/src/components/business/**` no longer holds that set of wrappers) | modals, drawers, imperative confirms and the global toast break together, see [Modal and drawer](/en/components/modal-drawer) |
| `@antdv/table-ui` | 27 | the app's `BasicTable` / `useTable` / `BasicColumn` come from it | every list page loses its table |
| `@antdv/form-ui` | 22 | the app's `BasicForm` / `useForm` / `FormSchema` come from it | search forms and form pages break together |
| `@antdv/layout-ui` | 10 | the region shell of `apps/web/src/layouts/index.vue`; `layouts` only supplies blueprints and state | the DOM for all seven layout shapes lives in this layer, so deleting the shell leaves it nowhere to mount |
| `@antdv/composables` | 7 | app only | removable, but `echarts` / `sse` / `websocket` are three separate entry points |
| `@antdv/layouts` | 7 | no other package; the app's `src/layouts/index.vue` shell comes from it | layout, menu, breadcrumb and tabs all go |
| `@antdv/preferences` | 5 | no other package; `apps/web/src/settings/index.ts` is the adapter | the theme chain breaks, see [Theming & preferences](/en/guide/in-depth/theme) |
| `@antdv/tabs-ui` | 5 | the app's `useTabs` plus the layout shell | tab bar, context menu and zoom toggles all go |
| `@antdv/menu-ui` | 2 | the menu tree inside the layout shell | sider / icon-rail menu rendering breaks |
| `@antdv/icons` | 2 | the app uses `IconPicker` directly, while the packages (including `common-ui`) import `@antdv/icons/icon` heavily. The iconify offline list in `internal/vite-config` only supplies data, it does not import this package | the icon picker, `IconifyIcon` and `SvgIcon` go together |
| `@antdv/directives` | 2 | `apps/web/src/directives/index.ts` injects the checker; `v-permission` / `v-lazy` appear in 7 template spots | the cheapest one; the disabled state styles sit in `@antdv/design/css/permission.css` |
| `@antdv/router` | 1 | the guards live in the package; `apps/web/src/router/guards/index.ts` only injects dependencies | not a one-line dependency edit: 403 pruning, progress bar and title all have to be rewritten in the app |
| `@antdv/design` | 1 (`main.ts`) | no other package imports it; `preferences/css-vars.ts` and the directive only match its naming | lose the Tailwind layer order and every library override needs `!important` |
Two mechanics. Every package except the source-published ones (`icons` / `design` / the eight `ui-kit` packages) builds to `dist` (`main: ./dist/...`, `build: tsdown`), so after touching a dist package run `pnpm --filter <pkg> build` **and restart dev**, while a source package hot-reloads on save. And the coupling inside `@antdv/router` is the instructive one: the route store refuses to import the router (its comment says `router → guards → store → router` would close a cycle) and takes it by injection instead.

## Case D: one application dependency

The video trio is a clean case: `@videojs-player/vue`, `@videojs/http-streaming` and `video.js` have **zero imports** in `apps/web/src`, `packages`, `internal` and `apps/web/e2e` — grepping those trees for `videojs|video-js` leaves only prose in the docs site. The surviving "video" hits are a native `<video>` node in a tiptap extension and a local `VideoUploadConfig` type. Delete the three lines in `apps/web/package.json`, run `pnpm install` to sync the lockfile, and optionally drop the three `catalog:` lines from `pnpm-workspace.yaml`.

::: warning "nothing imports it" is not "safe to delete" `pnpm check:dep` (knip) reports a batch of unused dependencies, but its built-in config ignores `docs/**` and hardcodes an `ignoreDependencies` list containing `playwright`, `rimraf`, `tailwindcss` and more (`scripts/vsh/src/check-dep/index.ts`). Build-time plugins and CDN-loaded libraries all look "unused" to it — grep the app source and `internal/vite-config` yourself before deleting. :::

## What catches what you broke

```bash
pnpm check:type                        # turbo run type-check (@antdv/web runs vue-tsc twice: app + vitest)
pnpm test:unit                         # whole-workspace vitest, including the source contracts
pnpm check:dep && pnpm check:circular  # leftovers you forgot to delete / cycles you introduced
cd apps/web && pnpm test:e2e           # three engines; locally start with --project=chromium
cd docs && pnpm exec vitepress build   # dead links to the page you just deleted
```

Who catches what: `src/views/__tests__/page-root-padding.spec.ts` checks root-container padding (same `**/*/components/*` exclusion as the router plugin), `gallery-api-usage.spec.ts` catches silent API misuses, `test/icon-names.test.ts` reconciles icon literals, `e2e/ops-sweep.spec.ts` checks that controls respond — and `e2e/site-sweep.spec.ts:119` fetches `/api/menus` and walks every leaf: pruning the menu matters more than deleting the page.

## Honest limits

- The menu is **a static seed plus per-browser localStorage overrides**, with no write API. Any "menu deleted" action is a source edit, and browsers that already flipped the switch keep their override locally.
- `internal/*` and `scripts/*` are not optional trim: `@antdv/vite-config` assembles conventional routing, the layouts plugin, auto-imports, the mock proxy and chunking, and imports `@antdv/node-utils` — editing it is editing the build.
- i18n is wired for the shell and menu titles (10 `.vue` files call `useI18n`; `LocaleSwitcher.vue` sits in the header) while business-page copy is hardcoded Chinese — check `src/locales/__tests__/locale.spec.ts` before deleting packs.
- `docs/` is a workspace member listed in `pnpm-workspace.yaml`: delete it and half the language switcher goes with it.

Related: [Routes and menu](/en/guide/essentials/route), [Mock server (Nitro)](/en/guide/essentials/mock), [Testing strategy](/en/guide/project/testing), [Keeping the template up to date](/en/guide/other/project-update).
