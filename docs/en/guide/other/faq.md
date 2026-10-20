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
| A public page redirects to login | `requiresAuth` is the default | Write `meta.requiresAuth: false` explicitly and add it to `WHITE_LIST` (`apps/web/src/config/constants.ts:6-12`) |
| The tab's "refresh current" shows a blank page | `/redirect/:path(.*)` was removed | It has to be registered explicitly; conventional routes only produce the exact `/redirect` (`apps/web/src/router/routes.ts:48-57`) |
| The layout shell disappears after switching to a second-level page (dev) | The same HMR issue as the first row | Same as above; production is unaffected, the `import.meta.hot` block does not ship |

## Requests and APIs

| Symptom | Cause | What to do |
| --- | --- | --- |
| Any input in the search box gives the same result, and paging keeps returning page-one data | `get(url, { params })` wraps one layer too many, so the request goes out as `?params=[object Object]` | For `get`/`del` **the second argument is the query string** (`apps/web/src/api/request.ts:22-26`) |
| HTTP 200 but a business failure goes unreported | When the envelope has `code !== 200`, `afterFetch` throws `RequestError` marked `handled` | Don't just catch it at the call site and call it done, `fetcher.ts:287-298` |
| A forced logout arrives but the app does not go to login | The WebSocket message type was written as `forceLogout` | Use `force-logout` (hyphen) |
| WS keeps reconnecting and flooding the log | `VITE_WS_URL` is not configured | The singleton **does not connect at all** when the URL is empty (`apps/web/src/utils/ws.ts:107-112,312-319`) |
| The upload endpoint complains that `Content-Type` is wrong | A hand-written JSON header overrode the FormData | Go through the shared client: with `FormData` it **deliberately empties** `Content-Type` (`fetcher.ts:245-259`) |
| The backend rejects the login request because it carries a Bearer header | Token injection skipped the auth-endpoint check | New login-style endpoints have to be added to the `AUTH_ENDPOINTS` list (`fetcher.ts:18-27`) |

## Theme and styles

| Symptom | Cause | What to do |
| --- | --- | --- |
| Changing the primary color leaves the selected menu item unchanged | Only the antd token changed, or only one variable name was written | The primary colour has one chain: the tier goes on `<html data-theme>`, a custom colour additionally inlines `--app-primary` (`packages/core/preferences/src/update-css-variables.ts:85-116`). The `--ant-*` bridge that fed antdv-next was deleted wholesale — do not add variables in that direction again |
| In dark mode the primary color differs from the one you set | Preset tiers **deliberately skip** the inline `--app-primary`: the dark palette in `@antdv/design`'s `token/dark.css` is already brightened per theme, and an inline value would push the light values back | Only a custom colour picked from the color picker needs the inline variable (that is when `data-theme='custom'`); new pages use `@antdv/design`'s `*-primary` tokens only, and don't pin color values in assertions — either assert in light mode or assert the same-source relation (see [Theming & preferences](/en/guide/in-depth/theme)) |
| Utilities no longer beat the `components` layer | The Tailwind layer order was changed | `@layer theme, base, components, utilities` must be declared explicitly with `utilities` last (`packages/core/base/design/src/index.css:27`) |
| Spacing is inconsistent between pages | The route page's outer container declares its own padding | Inner padding is the layout's job, see [Development conventions and environment variables](/en/guide/essentials/development) |
| Icons are empty squares in the production bundle | An Iconify prefix outside the offline list was used | A new collection goes into the catalog dependency and the offline list at `internal/vite-config/src/plugins/auto-import.ts:30-32` together |

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
| `stores/modules/auth.ts` | Duplicates `user.ts` in `@antdv/stores`, **zero consumers in the repo** (the only thing holding it in is the `export *` at `apps/web/src/stores/index.ts:1`) |
| `routeMode` in the preferences | Declared at `packages/core/preferences/src/config.ts:79`, no read site in app code |
| `VITE_NAMESPACE` | No code path reads it; the prefix actually comes from `VITE_APP_TITLE` |
| vue-i18n | **Wired up, not dead code**: there is exactly one real `useI18n()` call in the repository — `apps/web/src/composables/useLocale.ts:65` (the mention in `layout-ui/src/layout.ts` is only a comment). Menu titles are translated by `localizeMenus` (`packages/layouts/src/hooks/use-menu-tree.ts:25`); the lookup function `translateMenu` is injected by the host (`apps/web/src/plugins/ui-runtime.ts:20-21`) and the packages never import vue-i18n. The header language switcher is `packages/layouts/src/widgets/language-toggle/index.vue`, which writes through `appStore.updateSetting({ locale })` (`:38`) — the app-side entry is the same, `setLocale` at `useLocale.ts:70`. What is still unwired is the business pages: not one `useI18n` under `src/views/**`, the copy is hardcoded Chinese, and there is no `$t()` in any `.vue` |
| `apps/web/src/assets/icons/` | Four host-owned SVGs (github / wechat / qq / google), bundled into a `#icon-<filename>` sprite by `vite-plugin-svg-icons`, registered at `apps/web/src/main.ts:42` and consumed at `apps/web/src/config/auth-social.ts:17-25`. **Not an empty directory** |
| `views/tool/mock/**` | Only the private modules are left, no `index.vue`, so the mock-center panel can only be driven over its HTTP endpoints |
| stylelint | Both the `@antdv/stylelint-config` rules package and the stylelint deps in `apps/web` are installed, but **there is no `.stylelintrc*` / `stylelint.config.*` anywhere in the repo and no stylelint script**; `lefthook.yml` is commented out from line 1, so pre-commit runs nothing at all |
| The logo in `docs/` and `apps/web/public/pwa-icons/` | A **copy** relationship, not a reference; changing the logo means changing both sides |

::: tip

Cleaning up Ranked by what the "dead code" costs, the best value is: for i18n the shell and the menu titles are already wired, what is missing is the business-page copy (either add `useI18n` there or accept that Chinese is this UI's language); delete the `auth` store outright (the only thing holding it in is the `export *` at `apps/web/src/stores/index.ts:1`); pick one for `routeMode` / `VITE_NAMESPACE` — either implement them or remove them from `.env` and `types/env.d.ts`. Keep this FAQ in sync afterwards, and for the deletion order and its blast radius see [Removing code](/en/guide/other/remove-code).
:::
