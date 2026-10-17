# FAQ

Indexed by **symptom**, not by module — when you hit one, all you have is the symptom. Every entry cites its source, so before changing anything confirm that what you are seeing really has the same cause.

## Development environment

| Symptom | Cause | What to do |
| --- | --- | --- |
| Changed a sub-package's source and the page didn't react | The app consumes the sub-package `dist`, not its source | `pnpm --filter <pkg> build`, then **restart** dev (restarting without building still serves the old output) |
| `pnpm install` gets blocked | The root `preinstall` runs `only-allow pnpm` | `corepack prepare pnpm@10.12.4 --activate`; a workspace installed with npm/yarn is a fake one |
| In dev, editing a second-level page makes the header and sidebar disappear | Route auto-import HMR re-lays **bare routes** and drops the layout parent record | Fixed (`apps/web/src/router/index.ts:46-73` takes over `handleHotUpdate`); if it reproduces, first check that nothing bypasses `buildAppRoutes` |
| Three ports collide | Docs site 5200 / app 6080 / mock 5320 | The mock port is hardcoded and each side holds a copy; changing it means changing `VITE_MOCK_SERVER` and the plugin's probe together, see [Mock server (Nitro)](/en/guide/essentials/mock) |
| `pnpm check:cspell` fails with command not found | cspell is not installed in this workspace | Known gap, CI does not run it either; don't add a dependency for it |

## Routing and menu

| Symptom | Cause | What to do |
| --- | --- | --- |
| The page opens directly but the sidebar doesn't show it | The sidebar reads `GET /menus`, it does **not** recurse over the route table | Add the menu item on the backend; locally you can create it on the menu management page first |
| Clicking a menu item does not navigate | `attachMenuPaths` cannot find that path in the route table | A menu path must hit a generated conventional route, see [Routes and menu](/en/guide/essentials/route) |
| Opening a page kicks you to 403 | The menu does not contain it → the route is pruned by `removeRoute` | This is the normal outcome of "menu equals permission", not a bug |
| A public page redirects to login | `requiresAuth` is the default | Write `meta.requiresAuth: false` explicitly and add it to `WHITE_LIST` (`apps/web/src/config/constants.ts:9-18`) |
| The tab's "refresh current" shows a blank page | `/redirect/:path(.*)` was removed | It has to be registered explicitly; conventional routes only produce the exact `/redirect` (`router/routes.ts:46-55`) |
| The layout shell disappears after switching to a second-level page (dev) | The same HMR issue as the first row | Same as above; production is unaffected, the `import.meta.hot` block does not ship |

## Requests and APIs

| Symptom | Cause | What to do |
| --- | --- | --- |
| Any input in the search box gives the same result, and paging keeps returning page-one data | `get(url, { params })` wraps one layer too many, so the request goes out as `?params=[object Object]` | For `get`/`del` **the second argument is the query string** (`apps/web/src/api/request.ts:22-26`) |
| HTTP 200 but a business failure goes unreported | When the envelope has `code !== 200`, `afterFetch` throws `RequestError` marked `handled` | Don't just catch it at the call site and call it done, `fetcher.ts:283-297` |
| A forced logout arrives but the app does not go to login | The WebSocket message type was written as `forceLogout` | Use `force-logout` (hyphen) |
| WS keeps reconnecting and flooding the log | `VITE_WS_URL` is not configured | The singleton **does not connect at all** when the URL is empty (`apps/web/src/utils/ws.ts:105-112,310`) |
| The upload endpoint complains that `Content-Type` is wrong | A hand-written JSON header overrode the FormData | Go through the shared client: with `FormData` it **deliberately empties** `Content-Type` (`fetcher.ts:243-252`) |
| The backend rejects the login request because it carries a Bearer header | Token injection skipped the auth-endpoint check | New login-style endpoints have to be added to the `isAuthEndpoint` list (`fetcher.ts:186`) |

## Theme and styles

| Symptom | Cause | What to do |
| --- | --- | --- |
| Changing the primary color leaves the selected menu item unchanged | Only the antd token changed, or only one variable name was written | The primary colour has one chain: the tier goes on `<html data-theme>`, a custom colour additionally inlines `--app-primary`; the bridge for antdv-next has to write **both** `--ant-color-primary` and the legacy `--ant-primary-color` (`packages/utils/src/css-vars.ts:104-127`) |
| In dark mode the primary color differs from the one you set | The page mixes two chains: `--app-primary` reads the seed on `html`, while antdv-next keeps a recomputed family on `.ant-app` | New pages use `@antdv/design`'s `*-primary` tokens only; don't pin color values in assertions — either assert in light mode or assert the same-source relation (see [Theming & preferences](/en/guide/in-depth/theme)) |
| Utilities no longer beat the `components` layer | The Tailwind layer order was changed | `@layer theme, base, components, utilities` must be declared explicitly with `utilities` last (`packages/core/base/design/src/index.css:27`) |
| Spacing is inconsistent between pages | The route page's outer container declares its own padding | Inner padding is the layout's job, see [Development conventions and environment variables](/en/guide/essentials/development) |
| Icons are empty squares in the production bundle | An Iconify prefix outside the offline list was used | A new collection goes into the catalog dependency and the offline list at `auto-import.ts:95-97` together |

## Components and interaction

| Symptom | Cause | What to do |
| --- | --- | --- |
| `notification` does not open | The static method was used | Get the instance from `App.useApp()`; the title field is `title` |
| A popup inside a fixed table column gets clipped | The fixed column creates its own stacking context | Raise the popup's `z-index` above the fixed column |
| Button-level permissions do not take effect | The belief that `meta.permissions` does something | No guard reads it; use `hasPermission` / the directive, see [Permissions, directives and cursors](/en/guide/in-depth/access) |

## Docs site

| Symptom | Cause | What to do |
| --- | --- | --- |
| The sidebar, the top-bar menu and the language switcher are all empty while the body renders fine | The `locales` keys were written as paths `'/'`, which build into `///` and never match | Use bare language codes `zh` / `en`, see [CI and deployment](/en/guide/essentials/deploy) |
| No language switcher in the top bar | Upstream hides it on small screens (<1280px) | On narrow windows it is inside the hamburger menu; it is not a dead link |
| `<html lang>` did not change after switching language | VitePress does not reload the document when switching locale on the same page | Assert on the URL and the heading in acceptance checks, not on `lang` |
| The HTML is there but every stylesheet 404s | `VITEPRESS_BASE` does not match the actual mount path | A GitHub Pages project site is `/<repo-name>/`; in Git Bash you also need `MSYS_NO_PATHCONV=1` |
| The language switcher jumps to 404 | The file names/paths of zh and en do not line up | **Directories and file names must correspond one to one on both sides**; when you add a page, add the other side first |
| A wrong link raises no error but the anchor is dead | VitePress only validates page existence, not anchors | The bilingual anchor slugs are completely different, so verify the built output by hand after changing a heading |

## Known dead code and unwired features

These are not pitfalls, they are **the current state**. Know them before touching anything, and don't infer that "it exists, therefore it works":

| Location | Status |
| --- | --- |
| `stores/modules/auth.ts` | Duplicates `user.ts`, **zero consumers in the repo** |
| `routeMode` in the preferences | Declared at `packages/preferences/src/defaults.ts:73`, no read site in app code |
| `VITE_NAMESPACE` | No code path reads it; the prefix actually comes from `VITE_APP_TITLE` |
| vue-i18n | **Wired up, not dead code**: 10 `.vue` files in the shell call `useI18n`, menu titles go through `localizeMenus` (`layouts/composables/useMenuTree.ts:22`), and the header has a language switcher (`layouts/components/LocaleSwitcher.vue` calls the `setLocale` at `useLocale.ts:71`). What is still unwired is the business pages: not one `useI18n` under `src/views/**`, the copy is hardcoded Chinese, and there is no `$t()` in any `.vue` |
| `apps/web/src/assets/icons/` | Empty directory; the sprite path is wired up but has no custom icons |
| `views/tool/mock/**` | Only the private modules are left, no `index.vue`, so the mock-center panel can only be driven over its HTTP endpoints |
| stylelint | The rules package exists, **there is no config file on disk**, and the lefthook step is commented out (`lefthook.yml:16-18`) |
| The logo in `docs/` and `apps/web/public/pwa-icons/` | A **copy** relationship, not a reference; changing the logo means changing both sides |

::: tip Cleaning up Ranked by what the "dead code" costs, the best value is: for i18n the shell and the menu titles are already wired, what is missing is the business-page copy (either add `useI18n` there or accept that Chinese is this UI's language); delete the `auth` store outright (the only thing holding it in is the `export *` at `stores/index.ts:2`); pick one for `routeMode` / `VITE_NAMESPACE` — either implement them or remove them from `.env` and `types/env.d.ts`. Keep this FAQ in sync afterwards, and for the deletion order and its blast radius see [Removing code](/en/guide/other/remove-code). :::
