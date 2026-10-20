# Removing code

Adopting this template as a business system usually starts with deletion: the demo pages, the big-screen dashboard, the packages you will never import. What order to cut in, and what each cut drags along, is the whole subject here — because one rule in this repository turns "half a deletion" into a silent fault.

## The rule: the menu _is_ the permission

Neither the sidebar nor the access set comes from the route table. Both come from `GET /api/menus`, whose seed data is a plain array in `apps/backend-mock/server/api/menus.get.ts`:

- `packages/stores/src/route.ts` flattens the whole tree (including `hidden` nodes) into `allowedNames` / `allowedPaths`, then `syncRouteRegistry()` diffs it against the route-table snapshot and **calls `removeRoute` for every conventional route the menu does not list**;
- navigation itself is decided by `packages/router/src/guards/dynamic-route.ts:85-86`: a failed `canAccess` goes to `/error/403`, and that path is injected by the app (`apps/web/src/router/guards/index.ts:63`);
- a path the menu lists but no page provides falls through to `/:pathMatch(.*)*` at the end of `router/routes.ts`, which redirects to `/error/404`.

The two half-deletions fail differently and both fail badly: **delete the page but keep the menu record** and the sidebar keeps a dead link that lands on 404; **delete the menu record but keep the page** and the file still compiles and answers a direct link (unless you delete it too), but nobody can navigate to it and `site-sweep` never visits it.

::: warning

`hidden` is not deletion `hidden: true` only means "not in the navigation"; the node still enters the access set — the comment block in `menus.get.ts` exists precisely to say so. The "show in nav" switch on the menu management page writes to no backend either: it stores `xy-menu-hidden-overrides` in localStorage (`packages/stores/src/route.ts:26,38-46`), and `apps/web/src/api/menu.ts` contains nothing but `getMenus()` — there is no menu write endpoint at all. Locally, "delete a menu record" means editing that seed file; on a real backend it means deleting the row.
:::

## The deletion checklist, in dependency order

| Step | What you touch | What you get if you skip it |
| --- | --- | --- |
| 1 | `apps/web/src/views/**` — the page plus its private `components/`, `composables/`, `__tests__/` | the conventional route still registers |
| 2 | the node in `apps/backend-mock/server/api/menus.get.ts` (and collapse the parent if it is left with one child) | dead sidebar link → 404 |
| 3 | the `menu.<Name>` line in `src/locales/lang/zh-CN.ts` **and** `en-US.ts` | the English UI falls back to the Chinese `menuName` (`packages/layouts/src/hooks/use-menu-tree.ts:25` runs `localizeMenus`; the fallback lives at `packages/utils/src/menu.ts:474`) |
| 4 | `apps/web/types/router.d.ts` — generated, not hand-edited: the top of the file says `@ts-nocheck` and `DO NOT MODIFY` | the type system keeps offering a route name that no longer exists |
| 5 | `types/components.d.ts`, `types/auto-imports.d.ts` — generated in the same pass | the editor autocompletes components that are gone |
| 6 | hardcoded paths and constants in `apps/web/e2e/**` | either e2e goes red, or worse it stays green while testing nothing |
| 7 | `apps/web/src/api/<area>.ts` and the mock side `apps/backend-mock/server/api/<area>/**` | an orphan module stays reachable through `~/api` |
| 8 | `apps/web/package.json`, plus the matching `catalog:` line in `pnpm-workspace.yaml` if you want it truly gone | the dependency keeps installing and keeps landing in the lockfile |

Steps 4 and 5 need no manual edit: run `pnpm dev` or `pnpm build` once and let the plugin rewrite them (`VueRouter({ dts: './types/router.d.ts' })`, see `internal/vite-config/src/plugins/vue.ts:20`). `VITE_WRITE_DTS=false` skips the write when you only want a site-wide sweep — but it will not clear the stale entries either.

## Case A: one demo page

Cron expression is the worked example. This returns the complete list of places to cut: `grep -rn "components/cron\|DemoCron" apps/web/src apps/web/types apps/web/e2e apps/backend-mock`.

- `apps/web/src/views/components/cron/` — the page itself
- `apps/backend-mock/server/api/menus.get.ts:306-310` — the `DemoCron` node (`:308`)
- `menu.DemoCron` in both locale files
- `apps/web/types/router.d.ts:69-71` and `:458-460` — the route-table snapshot plus the file mapping, both inside that `DO NOT MODIFY` file

The overview page builds its card wall from `routeStore.menus` (`views/components/overview/index.vue:118`, `findGallery(routeStore.menus)`), so removing the menu record removes the card by itself, no code edit needed. End-to-end will stop you though: `apps/web/e2e/gallery-examples.spec.ts:46` pins the Demo section's leaf count as `OVERVIEW_CARD_COUNT = 24` (the comment at `:41-44` adds up 25 leaves, and the overview page itself is not in the wall, so 24 cards). **One page fewer is one card fewer**, and that number must change with it.

## Case B: a whole feature area

| Area | Files | Extra things it holds |
| --- | --- | --- |
| Big screen `views/screen/**` | `monitor/` + `components/` + `composables/` + `__tests__/` (3 unit specs) | `api/screen.ts`, the mock handler `server/api/screen/monitor.get.ts`, the `ScreenMonitor` menu node — note it hangs under **Dashboard**, not under its own directory — and 4 e2e specs (`dashboard-merge` / `ops-sweep` / `screen-fit` / `screen-resize`) plus `e2e/utils/app.ts`, which hardcodes `/screen/monitor` |
| System management `views/system/**` | 13 page directories | `api/system.ts`, the mock side `server/api/system/**` (11 domains), the `SystemManage` subtree, `apps/web/src/stores/modules/dict.ts` (the dictionary store is fed by the system API, so dictionary rendering in `v-*` loses its data too), and 17 e2e files referencing `/system/` |
| Dashboard `views/dashboard/**` | `analysis/` + `__tests__/` | **change `HOME_PATH` first** (`src/config/constants.ts:14` = `/dashboard/analysis`): login redirect and the directory-node fallback both aim at it, so deleting the page first drops you into 404. `packages/stores/__tests__/route-menu.test.ts` and `views/dashboard/__tests__/analysis-merge.spec.ts` also use that path as an anchor |

::: danger

A static contract ties pages to the menu seed on purpose `apps/web/src/views/dashboard/__tests__/analysis-merge.spec.ts` reads `apps/backend-mock/server/api/menus.get.ts` as text, lifts every `path: '/...'` into a set, and asserts that each quick action on the analysis page targets one of them. Its comments state the policy plainly: "the menu seed is both the route table and the permission source", "deleting a page means deleting the seed entry with it". Fastest place in the repo for a half-deletion to turn red — which is the point.
:::

## Case C: a workspace package

Short answer: none of the 21 packages under `packages/` can be deleted by removing a directory. The middle column is the real file count from `grep -rl "@antdv/<pkg>" apps/web/src | wc -l`; the third column is the edge between packages — **only `from '@antdv/<pkg>'` occurrences in source, mentions inside comments do not count**. That distinction matters: `shared/src/constants/css-vars.ts`, `layout-ui/src/layout.vue` and `utils/src/menu.ts` all say things like "aligned with `@antdv/preferences` / `@antdv/tabs-ui` / `@antdv/menu-ui`" in comments, and a plain string search would turn three packages that can be removed independently into three that cannot.

| Package | Files in `apps/web/src` | Imported by | What removal actually costs |
| --- | --- | --- | --- |
| `@antdv/shared` | 81 | almost everything except `design` / `directives` / `router`: `icons` / `hooks` / `preferences` / `types`, the six other ui-kit packages, `layouts` / `request` / `stores` / `utils` (`cn()` is the repository's only class-merge entry) | roughly a rewrite of the app |
| `@antdv/types` | 12 | `preferences` / `layout-ui` / `menu-ui` / `tabs-ui` / `layouts` / `stores` / `utils` + `apps/backend-mock` (`server/api/menus.get.ts:1` etc.) | type surface spread over every layer |
| `@antdv/shadcn-ui` | 55 | the implementation base of `icons` / `common-ui` / `form-ui` / `layout-ui` / `menu-ui` / `popup-ui` / `table-ui` / `tabs-ui` / `layouts` | that whole group collapses with it, i.e. there is no UI layer left |
| `@antdv/common-ui` | 63 | **not "app only"**: `form-ui` / `layout-ui` / `menu-ui` / `table-ui` / `tabs-ui` / `layouts` all import it; it depends on `icons` / `shadcn-ui` / `shared` (loading and scrollbar now live inside it) | the shared display components (Card, Tag, Steps, Upload, Transfer, skeletons) all go; `@antdv/design`'s `index.css:39-48` carries ten `@source` lines, and the matching one must be deleted in the same change |
| `@antdv/popup-ui` | 44 | `hooks` / `common-ui` / `table-ui` / `layouts` / `request`; the app's `BasicModal` / `BasicDrawer` / `useModal` / `useDrawer` / `confirm` / `message` **all come from this package** (`apps/web/src/components/business/` now holds only `ImportExport.vue` and `TenantSelect.vue`) | modals, drawers, imperative confirms and the global toast break together, see [Modal and drawer](/en/components/modal-drawer) |
| `@antdv/table-ui` | 22 | `hooks` (`useCRUD`'s boundary spec imports it); the app's `BasicTable` / `useTable` / `BasicColumn` come from it | every list page loses its table |
| `@antdv/form-ui` | 20 | `hooks` / `table-ui` (editable cells); the app's `BasicForm` / `useForm` / `FormSchema` come from it | search forms and form pages break together |
| `@antdv/layout-ui` | 3 | the render base layer under `@antdv/layouts` (shell, five regions, size contract and the text injection point) | the DOM for all seven layout shapes lives here, so the composition layer would have nothing left to render |
| `@antdv/layouts` | 8 | no other package imports it; the app's thin shell `apps/web/src/layouts/index.vue` takes `BasicLayout` and the widget bar from it | layout shell, header widgets, menu, breadcrumb and tabs all go |
| `@antdv/preferences` | 4 | `layouts` / `stores`; `shared/src/constants/*` only mentions it in comments (naming alignment, not an import) | the theme chain breaks, see [Theming & preferences](/en/guide/in-depth/theme) |
| `@antdv/tabs-ui` | 1 | `layouts` (`layout-ui` mentioning it is a comment too) | tab bar, context menu and zoom toggles all go |
| `@antdv/menu-ui` | 1 | `layout-ui` (`layouts` / `utils` mentioning it is a comment too) | sider / icon-rail menu rendering breaks |
| `@antdv/icons` | 3 | the six ui-kit packages + `common-ui` + `layouts` import `@antdv/icons/icon` heavily. The iconify offline list in `internal/vite-config` only supplies data, it does not import this package | the icon picker, `IconifyIcon` and `SvgIcon` go together |
| `@antdv/directives` | 2 | no other package imports it; `apps/web/src/directives/index.ts` injects the checkers; `v-permission` / `v-lazy` appear in 7 template spots | deletable; the degraded permission styling lives in `@antdv/design`'s `src/css/permission.css` |
| `@antdv/router` | 1 | no other package imports it; the guards all live in the package and `apps/web/src/router/guards/index.ts` only injects dependencies | not a one-line dependency edit: 403 pruning, progress bar and title all have to be rewritten in the app |
| `@antdv/design` | 2 | no package imports it (only `main.ts` takes that one CSS entry); `shared`'s css-vars and the directive's disabled state merely follow its naming | lose the Tailwind layer order and the ten `@source` lines, and every library override needs `!important` |
| `@antdv/stores` | 23 | `hooks` / `layouts`; the app imports stores straight from `@antdv/stores` (see [State management](/en/guide/essentials/stores)) | login state, menu pruning, tabs and the page-cache registry all go |
| `@antdv/request` | 4 | `common-ui` (markdown attachment download) / `stores` | the HTTP / SSE / WebSocket layers all go together |
| `@antdv/hooks` | 9 | `layouts`; `hooks` itself points back at `popup-ui` / `table-ui` / `stores` | the app-side wrappers break, taking `useCRUD` / `usePermission` / `useRouteLoading` with them |
| `@antdv/utils` | 3 | `preferences` / `layout-ui` / `menu-ui` / `layouts` / `stores` | theme resolution and menu helpers go; light/dark detection would have to be written per consumer |
| `@antdv/enums` | 10 | `stores` (`CacheKey`); other packages only take string constants | cache keys and status enums lose their single spelling |

**The package name `@antdv/composables` no longer exists** (it split into `@antdv/request` + `@antdv/hooks`), so every older "delete the composables package" walkthrough is void.

Two mechanics. Of the 21 workspace packages the app depends on, **only 6 produce `dist`** (`@antdv/{shared,types,hooks,preferences,directives,router}` — `main: ./dist/...`, `build: tsdown`; the internal packages `internal/{vite-config,node-utils}` also build to dist), while the remaining 15 are source-published (`design` / `icons` / `enums` / `layouts` / `request` / `stores` / `utils` plus the eight ui-kit packages — `main` points straight at `./src/index.ts`, and `design` at `./src/index.css`): changing a dist package needs `pnpm --filter <pkg> build` **and a dev restart**, while a source package hot-reloads on save. And the instructive coupling is inside `@antdv/router`: the route store deliberately does not import the router (its comment says `router → guards → store → router` would close a cycle) and takes the pruning decision by injection instead — that is the "looks like a decorator, actually cannot be pulled out" class of dependency.

## Case D: one application dependency

The video trio is a clean case: `@videojs-player/vue`, `@videojs/http-streaming` and `video.js` have **zero imports** in `apps/web/src`, `packages`, `internal` and `apps/web/e2e` — grepping those trees for `videojs|video-js` leaves only prose in the docs site. Delete the three lines in `apps/web/package.json`, run `pnpm install` to sync the lockfile, and if you want it fully gone, drop the three `catalog:` lines from `pnpm-workspace.yaml` too (leaving them changes nothing about resolution; you just re-confirm them at the next audit).

::: warning

"nothing imports it" is not "safe to delete" `pnpm check:dep` (knip) reports a batch of unused dependencies, but its built-in config ignores `docs/**` and hardcodes an `ignoreDependencies` list containing `playwright`, `rimraf`, `tailwindcss` and more (see `scripts/vsh/src/check-dep/index.ts`). Build-time plugins and CDN-loaded libraries all look "unused" to it — grep the app source and `internal/vite-config` yourself before deleting.
:::

## What catches what you broke

```bash
pnpm check:type                        # turbo run type-check (@antdv/web runs vue-tsc twice: app + vitest)
pnpm test:unit                         # whole-workspace vitest, including the source contracts and the icon audit
pnpm check:dep && pnpm check:circular  # leftovers you forgot to delete / cycles you introduced
cd apps/web && pnpm test:e2e           # three engines; locally start with --project=chromium
cd docs && pnpm exec vitepress build   # dead links to the page you just deleted
```

Who catches what: `src/views/__tests__/page-root-padding.spec.ts` checks root-container padding (the same `**/*/components/*` exclusion the router plugin uses), `src/views/__tests__/gallery-api-usage.spec.ts` catches three classes of silent API misuse, `apps/web/test/icon-names.test.ts` reconciles icon literals, `e2e/site-sweep.spec.ts` fetches `/api/menus` and walks every leaf page (**this is why pruning the menu matters more than deleting the page**), and `e2e/ops-sweep.spec.ts` checks that controls actually respond.

## Honest limits

- The menu is **a static seed plus per-browser localStorage overrides**, with no write API. Any "menu deleted" action is a source edit, and browsers that already flipped the switch keep their override locally.
- `internal/*` and `scripts/*` are not optional trim: `@antdv/vite-config` assembles conventional routing, the layouts plugin, auto-imports for framework APIs plus both generated `.d.ts` files, the iconify offline sets, the Nitro mock proxy and the chunking strategy — and it imports `@antdv/node-utils` itself. Editing it is editing the build.
- i18n is wired into the menu and the shell, but **only by injection — there is one real call site in the whole repository**: the three ui-kit packages (`layout-ui` / `menu-ui` / `tabs-ui`) never import vue-i18n; they receive `t` and `translateMenu` from `configureUiKitRuntimes()` (`apps/web/src/plugins/ui-runtime.ts:13-25`, whose comment explains why they must not touch `~/stores`), and the single `useI18n()` call lives at `apps/web/src/composables/useLocale.ts:65`. The header language switch is `packages/layouts/src/widgets/language-toggle/index.vue`, with its candidate table injected by `apps/web/src/plugins/layouts-host.ts:35-38`. Business-page copy is still hardcoded Chinese. Before deleting a locale pack, check `src/locales/__tests__/locale.spec.ts` and `packages/layouts/src/hooks/use-menu-tree.ts`.
- `docs/` sits level with `apps/` in `pnpm-workspace.yaml`: delete it and half the language switcher goes with it.

Related: [Routes and menu](/en/guide/essentials/route), [Mock server (Nitro)](/en/guide/essentials/mock), [Testing strategy](/en/guide/project/testing), [Keeping the template up to date](/en/guide/other/project-update).
