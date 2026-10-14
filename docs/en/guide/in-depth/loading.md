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

A home-grown plugin, `internal/vite-config/src/plugins/app-loading`, prepends an HTML snippet **outside** `#app`, so mounting Vue cannot touch it. Three conventions to know:

- The entry **always** does `import { loadingFadeOut } from 'virtual:app-loading'`, and `main.ts` runs `void nextTick(() => loadingFadeOut())` after `app.mount('#app')`. The plugin deliberately sets `autoRemove: false`: mounting does not clear the overlay, so if nobody calls the fade-out it covers the page and swallows every click.
- The virtual module is **always resolvable**, switch or not: `VITE_INJECT_APP_LOADING` only decides whether to inject (true in both `.env.development` and `.env.production`). Wrapping the whole plugin in that if breaks the build with a resolve error.
- The overlay theme tracks CSS variables automatically (`autoTheme: true`, scanning `src/**/*.css` etc. with prefix `--color-`, excluding `--ant-*` / `--tw-*`); fade duration comes from `VITE_APP_LOADING_DURATION`.

## 2. Route-change layer

Two parallel pieces with different jobs:

| Piece | Source | Notes |
| --- | --- | --- |
| NProgress | configured in `router/guards/index.ts` (`minimum: 0.1`, `trickleSpeed: 200`); styles in `@antdv/design`' `nprogress.css` | the thin line on top; preference `showProgressBar` (default true) controls its visibility |
| `RouteLoadingBar` + `PageLoading` | `apps/web/src/components/common/Loading/`, state from `@antdv/composables/useRouteLoading` | in `layouts/index.vue`: `useRouteLoading({ minDuration: 400, auto: true })`; the bar runs with `:duration="250"`, percentage on, cancellable (`@cancel="cancelRouteLoading"`), slow threshold 3000ms; `PageLoading` in the content area binds the same `isLoading`, with `isSlow` surfacing as an error hint |

`minDuration` is an **anti-flicker** rule: even an instant navigation keeps the loading visible for that long, otherwise a flashing bar is more anxiety-inducing than helpful. The composable also offers `withLoading(fn)` to wrap async work (state is set synchronously, not deferred to rAF — the source comment records a fixed bug where fast calls hit the "not started yet" branch and the bar never came down).

Enter animations live in `components/layout/PageTransition.vue`: `@vueuse/motion` plays the variant from preference `transitionEffect` (default `fade-slide`, variants in `transitions.ts`); when `usePreferredReducedMotion` reports `reduce` it jumps straight to the end state — respecting the OS setting is not optional.

## 3. Element-level masks

The three tools from `@antdv/loading-ui` (the entry point takes `vLoading` at `main.ts:8` and registers it at `:113`: `app.directive('loading', vLoading)`):

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

- The attribute map sits in `packages/ui-kit/loading-ui/src/directive.ts:34-39`: `loading-tip / loading-theme(light|dark) / loading-size(default|small|large) / loading-background`; `binding.arg` wins over `loading-tip`.
- Functional API: `createLoading` / `createFullscreenLoading` / `createContainerLoading`, returning a `LoadingInstance` (`open` / `close` / `setTip` / `destroy`). `close` waits for the fade-out before cleaning the DOM; `destroy` rips it out immediately — use the latter when you know the overlay must die (interrupted navigation, unmounting). The demo page `views/components/loading/index.vue` shows disciplined timer cleanup.
- The declarative `Loading` component and the `useLoading` composable ship in the same package; props in `packages/ui-kit/loading-ui/src/types.ts` (`absolute` distinguishes in-container from fullscreen). The spinner inside it is the `Spinner` from `@antdv/shadcn-ui` — antdv-next's `Spin` is no longer involved.

## 4. Component-internal and skeletons

- `BasicTable` has its own `hooks/useLoading`; while `api` runs it spins automatically and `setLoading(value)` on the instance intervenes manually — do not cover a table with a second `v-loading`.
- Skeletons: `apps/web/src/components/common/Skeleton/` (`PageSkeleton`, `TableSkeleton`) for first-paint placeholders; empty and error states are `EmptyState` and `ErrorBoundary`.
- The request layer (`src/composables/web/request/`) deliberately provides **no global loading**; it owns cache, dedupe, retry and the 401 replay. Adding an implicit overlay there would fight the four layers above.

## Switch matrix

| Switch | Where | Effect when off |
| --- | --- | --- |
| `VITE_INJECT_APP_LOADING` | `.env.*` | no first-screen overlay (the virtual module still exists; `loadingFadeOut` no-ops) |
| `showProgressBar` | preferences (settings drawer, General panel) | top progress bar hidden |
| `showLoading` | preferences, default `true` | route-level content loading hidden |
| `transitionEffect` | preferences | page enter animation style |

Gate all of these through the `isEnvEnabled` semantics — see the env-coercion trap in [Vite config](/en/guide/project/vite).
