# Routes and menu

This app's routes are **assembled in three layers**, plus **one backend menu**: file-convention routing generates the page records → the layouts plugin wraps them in a shell → static routes and the fallback fill the gaps → after login the registry is pruned according to what `/menus` returns. Once you understand these four layers, problems like "blank page / the layout is gone / can't get into 403" can mostly be located by yourself.

## How the route table is assembled

```ts
// apps/web/src/router/index.ts:20-22
function buildAppRoutes(autoRoutes: RouteRecordRaw[]): RouteRecordRaw[] {
  return [...constantRoutes, ...setupLayouts(autoRoutes), catchAllRoute];
}
```

| Source | Content | Source of truth |
| --- | --- | --- |
| Conventional routes | `.vue`/`.tsx` under `src/views` generate paths by directory; the route name is derived by `getFileBasedRouteName` | `internal/vite-config/src/plugins/vue.ts:18-37`, the types land in `apps/web/types/router.d.ts` |
| Layout layer | `vite-plugin-vue-layouts-next` stuffs pages into an **anonymous parent record** `{ component: LayoutWrapper, meta.isLayout }` | `internal/vite-config/src/plugins/vue.ts:52-55`, `apps/web/src/router/index.ts:51` |
| Static routes | `/`→`/login`, `/login`, `/register`, `/redirect/:path(.*)` | `apps/web/src/router/routes.ts:7-56` |
| Fallback | `/:pathMatch(.*)*` → `/error/404` | `apps/web/src/router/routes.ts:58-68` |

Remember three exclusion rules: `**/*/components/*` doesn't enter the route table (page-private components), the `index` of `account|login|register/**` isn't treated as a conventional route, and the layouts plugin likewise skips `**/components/**` and `**/widgets/**`.

The Router itself: `createWebHashHistory()` + `strict: true` + scrolling back to the top on every navigation (`apps/web/src/router/index.ts:33-41`).

::: warning `/redirect/:path(.*)` must be registered explicitly `views/redirect/index.vue` only generates the exact match `/redirect`; it can't catch the `/redirect/system/user` used by the tab's "refresh current". It's written in `constantRoutes` and takes effect before the conventional routes (`apps/web/src/router/routes.ts:39-45`). Think through how to recover the tab refresh before deleting it. :::

## What you can put in meta

The type is defined in `packages/types/src/app-router.ts:3-12`:

| Field | Who reads it | Description |
| --- | --- | --- |
| `title` | Title guard + menu + tab pages + breadcrumb | A literal string, **not run through i18n** |
| `requiresAuth` | Auth guard (`packages/router/src/meta.ts:12-19`) | Defaults to "login required", so public pages must explicitly write `false` |
| `hidden` | Removed when rendering the menu | Only removed at the render layer; the route is still directly reachable |
| `icon` | Sidebar / icon bar / tab pages / breadcrumb | An Iconify name, e.g. `carbon:dashboard` |
| `keepAlive` | The page cache set | Together with "whether the tab is open" decides the cache; see [Layout, menu, and tab pages](/en/guide/in-depth/layout) |
| `layout` | `'blank' \| 'default'` | Login/register/error pages use `blank` |
| `roles` / `permissions` | **No consumer** | Button-level permissions go through a directive instead; see [Permissions, directives and cursors](/en/guide/in-depth/access) |

The app side also reads two fields **not written into `RouteMeta`**: `meta.microApp` (`apps/web/src/layouts/index.vue:246`) and `meta.noTransition` (`:252`). No route in the repo currently sets them; remember to add the types before using them.

## Guards: five fixed stages

The order is hardcoded in `packages/router/src/guards/index.ts:36-75`; dependency injection is in `apps/web/src/router/guards/index.ts:38-111`:

```
progress → auth → dynamicRoutes → title → navLog
```

1. **progress** (`guards/progress.ts:24-52`): NProgress start/stop. Must return `undefined`; returning anything else swallows the navigation.
2. **auth** (`guards/auth.ts:14-37`): logged-in users hitting the login page get kicked back to the home page; `requiresAuth: false` or the whitelist passes through; otherwise it jumps to `LOGIN_PATH` with `query.redirect`. The whitelist and home-page constants are in `apps/web/src/config/constants.ts:9-18` (`HOME_PATH = '/dashboard/analysis'`).
3. **dynamicRoutes** (`guards/dynamic-route.ts:51-104`): the first navigation lazy-loads `loadRoutes()`; on load failure it **swallows the exception and passes through** (`:71-78`); when `canAccess({name, path})` fails → `/error/403`; clicking a directory node → `resolveDirectory` lands on the first visible child page (the app implementation is `apps/web/src/router/guards/index.ts:85-91`).
4. **title** (`guards/title.ts:20-51`): `page title | VITE_APP_TITLE`, and scrolls back to the top.
5. **navLog**: telemetry. The app side also attaches an extra `beforeEach` for registry self-healing (`:129-132`).

## The menu comes from the backend, not from the route table

::: warning This is the point most easily got backwards The sidebar is **not** recursed out of routes. After login `GET /menus` returns the menu tree (`apps/web/src/stores/modules/route.ts:112-117`), and the frontend only does three things: :::

1. `normalize()` maps the backend fields into the internal structure: `menuName → title`, carrying `icon/hidden/isExternal/path/keepAlive/children`; it **does not sort**, the order is just the array order (`route.ts:86-99`).
2. `attachMenuPaths()` takes the menu and reverse-looks-up the real path in the route table, with five-level priority matching (`packages/shared/src/utils/menu.ts:258-314`). If the menu writes a path the route table doesn't have, the page won't open.
3. `syncRouteRegistry()` in turn **prunes the routes**: whitelist exemption, `requiresAuth: false` exemption, a parent node is kept because a child is kept, duplicate paths take the first, incremental `addRoute`/`removeRoute` (**never `clearRoutes`**) (`route.ts:189-263`, `packages/shared/src/utils/menu.ts:82-106`).

Render layer: `buildMenuItems`'s key takes `name → path → title` in turn (`menu.ts:32-36,561-591`); external links render as `<a target="_blank">` (`:440-455`); top-level nodes are dispatched to the top bar / icon bar / sidebar according to the layout blueprint (`packages/layouts/src/menu-source.ts:165-191`); the nested tree is **not flattened**.

Locally there's also a "navigation visibility" switch that only affects display, stored in `localStorage['xy-menu-hidden-overrides']` (`route.ts:27,324-331`) — it doesn't change accessibility; a hidden route is still directly reachable.

## The HMR trap in dev

Editing any page file makes `vue-router/auto-routes` re-evaluate; its built-in HMR does `clearRoutes()` → `addRoute(bare route)` one by one, and a bare route **has no layout parent record**. So this hooks `handleHotUpdate` and re-lays the whole table with the same `buildAppRoutes` (`router/index.ts:46-73`).

The symptoms and conclusions:

- Writing your own HMR branch and only "patching the layout" incrementally is **wrong** — the static routes (login, `/redirect/**`, the 404 fallback) get cleared by the same `clearRoutes()`; missing the fallback is what shows "type a random URL and get a blank page".
- The pruning snapshot `appRoutes` is frozen only once at startup (`router/index.ts:31`, `stores/modules/route.ts:289-292`); HMR won't let it drift.
- This only affects dev: `import.meta.hot` is replaced by a constant in the production build, so the whole block never enters the bundle.

## What to touch to add a page

| Scenario | What to do |
| --- | --- |
| Add a visible page | Create `src/views/xxx/index.vue` (the conventional routing picks it up automatically), then add a `path` in the backend menu pointing to it |
| Add a page that doesn't enter the menu | Create the file + `meta: { hidden: true, requiresAuth: true }`, reach it by direct URL |
| Add a public page | Put it in `constantRoutes` with an explicit `requiresAuth: false`, and also add it to `WHITE_LIST` |
| Only want it wrapped in the blank layout | `meta.layout = 'blank'` |

::: warning What happens when you only create the file but add no menu The route exists and the guard lets you in, but the sidebar doesn't show it — because the sidebar reads `/menus`. Conversely, adding only the menu without creating the file, `attachMenuPaths` can't reverse-look-up the path and clicking doesn't navigate. Both sides need to be there. :::

## Micro-frontend routing

The registry matches sub-apps by `baseroute`; the loader supports `webcomponent` / `iframe`; the master switch is `VITE_MICRO_APP` (`apps/web/src/config/micro-app.ts:5-12`). The view reads `meta.microApp` and uses a sandbox when same-origin (`views/micro-app/SubAppView.vue:38`, `packages/types/src/menu.ts:24-31`).
