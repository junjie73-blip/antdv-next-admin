# Global loading

In one sentence: **loading state is split across four layers — the first-screen overlay (injected into HTML by a build plugin), the route-change layer (progress bar + `useRouteLoading`), element-level masks (`v-loading` / `Loading` / `createLoading`), and component-internal loading (table fetch, skeletons). Each layer has its own switch and owner; do not mix them.**

```
browser requests index.html
  → [1] first-screen overlay (on body, outside #app)
  → JS loads, Vue mounts
  → main.ts calls loadingFadeOut() inside nextTick, removing [1]
navigate to a page
  → [2] NProgress (start/done in the guards) + RouteLoadingBar / PageLoading (useRouteLoading)
      → the component fetches data → [3] BasicTable's own useLoading, or [4] v-loading for a block
```

## 1. First screen: `vite:app-loading`

A home-grown plugin, `internal/vite-config/src/plugins/app-loading`, prepends an HTML snippet **outside** `#app`, so mounting Vue cannot touch it. Four conventions to know:

- The entry **always** does `import { loadingFadeOut } from 'virtual:app-loading'`, and `main.ts` runs `void nextTick(() => loadingFadeOut())` after `app.mount('#app')`. The plugin deliberately sets `autoRemove: false`: mounting does not clear the overlay, so if nobody calls the fade-out it covers the page and swallows every click.
- The virtual module is **always resolvable**, switch or not: `VITE_INJECT_APP_LOADING` only decides whether to inject (true in both `.env.development` and `.env.production`). Wrapping the whole plugin in that if breaks the build with a resolve error.
- The overlay theme tracks CSS variables automatically (`autoTheme: true`, scanning `src/**/*.css` etc. with prefix `--color-`, excluding `--ant-*` / `--tw-*`); fade duration comes from `VITE_APP_LOADING_DURATION`.
- **The template is an HTML file**, not a TS template string: `internal/vite-config/src/plugins/app-loading/defaults/loading.html`, read as a string at build time through `?raw` (`src/index.ts:10`) thanks to `loader: { '.html': 'text' }` in `internal/vite-config/tsdown.config.ts:26`. It is inlined into `dist`, so no `defaults/` directory exists (or should exist) next to the bundle — reading it with `__dirname` at runtime would be an `ENOENT`. Two substitution syntaxes: EJS-style `<%= VAR %>` / `<%= VAR || 'fallback' %>` (`src/html-injector.ts:60-64`, values from `config.env` plus `htmlVariables`) and Vite's native `%VAR%` (`:66-68`, unrecognised names are left alone). To bring your own template: `loadingHtmlPath` (already wired to `VITE_APP_LOADING_PATH` for the app, `internal/vite-config/src/plugins/index.ts:207`; an unresolvable path prints a `console.warn` and falls back to the built-in template, `src/index.ts:104-119`), or pass `loadingHtml` as a string, which wins. Inside the template, radii are always rem and colours are always "CSS variable + fallback".

## 2. Route-change layer

Two parallel pieces with different jobs:

| Piece | Source | Notes |
| --- | --- | --- |
| NProgress | assembled in `apps/web/src/router/guards/index.ts:15-19` (`minimum: 0.1`, `trickleSpeed: 200`, `showSpinner: false`), with `start`/`done` handed to `@antdv/router`'s `applyRouterGuards` as callbacks (`:32-45`); styles in `packages/core/base/design/src/css/nprogress.css` | the thin line on top; preference `showProgressBar` (default true, `packages/core/preferences/src/config.ts:76`) controls its visibility |
| `RouteLoadingBar` + `PageLoading` | `packages/layouts/src/basic/content/` (`route-loading-bar.vue`, `page-loading.vue`, exported from `packages/layouts/src/index.ts:39,41`), state from `@antdv/hooks/use-route-loading` (`packages/core/hooks/src/use-route-loading.ts:24`) | assembled at `packages/layouts/src/basic/layout.vue:206-229`: `useRouteLoading({ minDuration: 400, auto: true })`; the bar runs with `:duration="250"`, percentage on, cancellable (`@cancel="cancelRouteLoading"`), slow threshold 3000ms; `PageLoading` in the content area binds the same `isRouteLoading`, with `isSlow` surfacing as an error hint (`:275-278`) |

`minDuration` is an **anti-flicker** rule: even an instant navigation keeps the loading visible for that long, otherwise a flashing bar is more anxiety-inducing than helpful. The composable also offers `withLoading(fn)` to wrap async work (state is set synchronously, not deferred to rAF — the source comment records a fixed bug where fast calls hit the "not started yet" branch and the bar never came down).

Enter animations live in `packages/layouts/src/basic/content/page-transition.vue`: `useMotion` from `@vueuse/motion` (`:5-18`) plays the enter variant from preference `transitionEffect` (`:30`, `:45`; default `fade-slide`, variants in `transitions.ts` in the same directory); when `usePreferredReducedMotion` (`:24`) reports `reduce` it jumps straight to the end state — respecting the OS setting is not optional.

## 3. Element-level masks

The three tools from `@antdv/common-ui` (the entry point takes `vLoading` at `main.ts:8` and registers it at `:118`: `app.directive('loading', vLoading)`):

```vue
<!-- directive: config comes from attributes; the arg is the tip text -->
<div
  v-loading="isLoading"
  loading-tip="Loading..."
  loading-theme="dark"
  loading-size="large"
  loading-background="rgba(0,0,0,0.5)"
>…</div>
<!-- modifier .body / .fullscreen: attach to the viewport, not the container -->
<div v-loading.fullscreen="busy">…</div>
```

- The attribute map sits in `packages/core/ui-kit/common-ui/src/components/loading/directive.ts:34-39`: `loading-tip / loading-theme(light|dark) / loading-size(default|small|large) / loading-background`; `binding.arg` wins over `loading-tip`.
- Functional API: `createLoading` / `createFullscreenLoading` / `createContainerLoading`, returning a `LoadingInstance` (`open` / `close` / `setTip` / `destroy`). `close` waits for the fade-out before cleaning the DOM; `destroy` rips it out immediately — use the latter when you know the overlay must die (interrupted navigation, unmounting). The demo page `views/components/loading/index.vue` shows disciplined timer cleanup.
- The declarative `Loading` component and the `useLoading` composable ship in the same package; props in `packages/core/ui-kit/common-ui/src/components/loading/types.ts` (`absolute` distinguishes in-container from fullscreen). The spinner inside it is the `Spinner` from `@antdv/shadcn-ui` — antdv-next's `Spin` is no longer involved.

## 4. Component-internal and skeletons

- `BasicTable` has its own `hooks/useLoading`; while `api` runs it spins automatically and `setLoading(value)` on the instance intervenes manually — do not cover a table with a second `v-loading`.
- Skeletons: `packages/core/ui-kit/common-ui/src/components/skeleton/` (`PageSkeleton`, `TableSkeleton`) for first-paint placeholders; empty and error states are separate — `EmptyState` and `ErrorBoundary`.
- The request layer (`packages/request/`) deliberately provides **no global loading**; it owns cache, dedupe, retry and the 401 replay. Adding an implicit overlay there would fight the four layers above.

## Switch matrix

| Switch | Where | Effect when off |
| --- | --- | --- |
| `VITE_INJECT_APP_LOADING` | `.env.*` | no first-screen overlay (the virtual module still exists; `loadingFadeOut` no-ops) |
| `showProgressBar` | preferences (settings drawer, General panel) | top progress bar hidden |
| `showLoading` | preferences, default `true` | route-level content loading hidden |
| `transitionEffect` | preferences | page enter animation style |

Gate all of these through the `isEnvEnabled` semantics — see the env-coercion trap in [Vite config](/en/guide/project/vite).

## Related pages

- Layout and tabs: [Layout & tabs](/en/guide/in-depth/layout)
- Theme and CSS variables: [Theme & preferences](/en/guide/in-depth/theme)
