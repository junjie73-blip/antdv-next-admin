# Directives and drag layout

This page covers two demo routes: `/components/directive` (the **five globally registered custom directives** — `v-permission`, `v-loading`, `v-lazy`, `v-safe-html`, `v-escape`) and `/components/drag-layout` (**drag layout** built on `vue-draggable-plus`, in five flavours: list / handle / cross-container / grid / constraints). They share a page because both are page-level infrastructure rather than component-library material. Table row dragging is documented elsewhere — see [Table](/en/components/table).

## The five global directives: exactly two registration sites

The only `app.directive(...)` calls in the entire repository are these five, at `apps/web/src/main.ts:103-113`:

| Directive | Implementation lives in | App-side injection | Production use sites (outside the demo) |
| --- | --- | --- | --- |
| `v-permission` | `packages/directives/src/permission/index.ts:57` | `apps/web/src/directives/index.ts:19-36` | `apps/web/src/components/business/ImportExport.vue:206, 223` |
| `v-loading` | `packages/ui-kit/loading-ui/src/directive.ts:88-107` | the `vLoading` from `@antdv/loading-ui`, registered directly (`main.ts:8, 113`) | `apps/web/src/views/components/loading/index.vue:1026` onwards |
| `v-lazy` | `packages/directives/src/lazy.ts:145, 311` | re-exported at `apps/web/src/directives/index.ts:16` | **no usage outside the demo page** (see below) |
| `v-safe-html` | `packages/shared/src/xss.ts:437-445` | re-exported at `apps/web/src/directives/index.ts:17` | `MarkdownEditor.vue:599`, editor demo `editor/index.vue:834` |
| `v-escape` | `packages/shared/src/xss.ts:454-462` | re-exported at `apps/web/src/directives/index.ts:17` | **no usage outside the demo page** (see below) |

::: warning Don't look for everything under the package name `@antdv/directives` contains **only permission and lazy** (its `src/index.ts:10-11` has exactly those two exports). `escape` / `safe-html` live in `@antdv/shared/xss`, `v-loading` lives in `@antdv/loading-ui`. `apps/web/src/directives/index.ts` exists to inject project dependencies into the factories: the packages never import pinia / stores (the design constraint is stated at `packages/directives/src/index.ts:4-7`); checkers and the subscription source come from the app. :::

## v-permission: decisions outside the package, DOM flags inside it

### The three injections

`apps/web/src/directives/index.ts:19-36` builds the global directive with `createPermissionDirective()`, injecting three things (option contract at `packages/directives/src/permission/types.ts:67-84`):

- `checkers: () => usePermission()` (`index.ts:24`) — a **lazy factory**: when this module is imported by `main.ts`, pinia is not yet attached to the app, so calling `usePermission()` eagerly throws `no active pinia` (comment at `index.ts:20-23`). The checker contract is seven synchronous functions (`types.ts:9-24`); this project's implementation is `apps/web/src/composables/web/permission/usePermission.ts:105-117`, reading `permissions` / `roles` from `useUserStore()`; `isAdmin()` accepts the `SUPER` / `ADMIN` roles (`usePermission.ts:66-73`).
- `onCheck` (`index.ts:25-29`) — `console.log('[v-permission]', …)` in dev, fired on every evaluation.
- `subscribe` (`index.ts:34-35`) — `watch(() => useUserStore().permissions, notify, { deep: true })`. Permissions are filled in asynchronously after login; without this subscription, an element mounted while the permission table is still empty stays **stuck at "no permission" forever** (`packages/directives/src/permission/index.ts:106-112`). The returned stop function runs on `unmounted`, leaving no dangling watcher (`index.ts:125-129`).

### What actually works (evaluation order)

`resolveAccess()` (`packages/directives/src/permission/utils.ts:82-109`) interprets the binding in this order:

| Form | Effect | Source |
| --- | --- | --- |
| `v-permission="'user:add'"` | single permission code, `any` | `utils.ts:39-43, 65-67` |
| `v-permission="['a','b']"` | **any by default** — one hit passes | `utils.ts:100-101` (mode defaults to `'any'`) |
| `v-permission.all="['a','b']"` | every — all must hit | `utils.ts:100-101` (`.all` modifier) |
| `v-permission:role="'editor'"` | string/array read as **roles** | `utils.ts:41-43` (`arg === 'role'`) |
| `v-permission:admin` | straight to `isAdmin()`; the value is ignored | `utils.ts:88` |
| `v-permission="{ permission, role, mode }"` | object form; permission and role groups **both must pass** | `utils.ts:46-50, 105-108`; type at `types.ts:39-44` |
| `v-permission.disabled="'user:add'"` | greyed out instead of hidden | `permission/index.ts:96` (`disabledMode`) + `utils.ts:182-195` |

::: warning Three caveats stated as they are

1. **`:role` is an arg, `.role` is a modifier** — the evaluator only reads the arg (`utils.ts:41`); `.role` silently degrades to permission-code interpretation. The demo prints this on its UI (`apps/web/src/views/components/directive/index.vue:284-289`).
2. **Empty values pass**: `undefined` / `null` / `''` / `[]` all grant access (`utils.ts:90-97`). `v-permission="[]"` is the same as not writing it.
3. **Mode precedence**: `mode` in the object > `.all` modifier > default `any` (`utils.ts:100-101`); once the object sets `mode: 'all'`, `.all` no longer says anything. :::

### What happens to the DOM when access is denied

`applyPermissionState()` (`utils.ts:176-209`): the default hiding mode sets `display: none` plus the `disabled` attribute, `aria-disabled`, and the class `permission-disabled`; `.disabled` keeps the element visible and only disables it. **Nodes are never removed** — deleting a node leaves Vue's patch without an anchor and corrupts sibling diffing (comment at `utils.ts:172-174`). The degraded style is `packages/styles/src/permission.css:12-17` (`cursor-not-allowed opacity-50 saturate-50 select-none` + `pointer-events: none`, because non-form elements ignore the `disabled` attribute), with an escape hatch class `permission-disabled--passthrough` (`permission.css:21-23`) for "looks degraded but still interactive". The stylesheet is pulled in by `packages/styles/src/index.css:26`.

::: tip The router layer reads none of this The `RouteMeta` type declares `roles?: string[]` / `permissions?: string[]` (`packages/types/src/app-router.ts:9-10`), but **nothing anywhere in `apps/web/src/router/**` or `packages/router/src/**` reads them** — route admission is actually driven by menu data ("menu is the permission"; `apps/web/src/stores/modules/route.ts:181, 210` only handles `meta.requiresAuth`). `v-permission` governs only the element layer; the full three-layer picture is in [Access control](/en/guide/in-depth/access). :::

## v-loading: boolean-driven, configuration read from attributes

The directive value is a `boolean` (type annotation at `packages/ui-kit/loading-ui/src/directive.ts:88`). Key points:

- **Configuration comes from element attributes**: `loading-background` / `loading-size` / `loading-theme` / `loading-tip` (`directive.ts:34-39`). The tip can also be the directive arg, `v-loading:加载中="isLoading"`, which takes precedence (`directive.ts:81, 96-98`).
- **Mount target is decided by modifiers**: `.fullscreen` or `.body` pins the overlay to `body`, covering the whole page (`directive.ts:59-61`); the default covers the element itself.
- **Overlay instances are created lazily and kept in a WeakMap** (`directive.ts:45, 69-86`): `mounted` creates an instance even when the value is `false` (hidden), `updated` only toggles visibility (`directive.ts:93-99`), `unmounted` destroys it (`directive.ts:101-104`).

::: warning Attributes are read exactly once, at overlay creation `getPropsFromAttributes()` runs only when the overlay instance is **first created** (`directive.ts:70-76` — an existing instance is returned as-is). Changing `loading-tip` / `loading-theme` attributes after mount has **no effect**; the only hot-updatable setting is the directive arg `binding.arg` (`directive.ts:96-98`). :::

## v-lazy: the default instance plus a four-layer resolution

`app.directive('lazy', vLazy)` registers the default instance produced by calling `createLazyDirective()` with no options (`packages/directives/src/lazy.ts:311`). The binding value is an object or a string (the string is `src`, `lazy.ts:24`); the directive is only meant for `<img>` elements.

| Option | Default | Notes |
| --- | --- | --- |
| `src` | required | falls back to the `data-src` attribute (`lazy.ts:164`) |
| `placeholder` | none | shown before entering the viewport (`lazy.ts:260`); also via `data-placeholder` |
| `error` | none | fallback image when preloading fails (`lazy.ts:235`); also via `data-error` |
| `fade` / `duration` | `true` / 300ms | double-rAF fade-in to avoid a hard jump (`lazy.ts:112-122, 190-201`) |
| `rootMargin` / `threshold` | `'100px'` / 0.1 | IntersectionObserver lead (`lazy.ts:61-62, 273`) |

Resolution precedence: **`binding.value` > `data-*` attributes > factory-level `defaults` > built-in fallbacks** (`lazy.ts:152-188`). Loaded URLs go into a module-level `Set` shared globally (`lazy.ts:66, 211-214`) — the same image is fetched at most once across components, so replaying the demo hits the cache on the second run. Without IntersectionObserver the directive **loads immediately** rather than leaving a blank image (`lazy.ts:276-280`). Mid-flight src changes and unmounts invalidate pending preload results via an incrementing token (`lazy.ts:132-136, 226`).

## v-safe-html and v-escape: one sanitizes, one escapes to plain text

### v-safe-html

The `updateSafeHtml()` pipeline (`packages/shared/src/xss.ts:476-533`): **regex-strip the worst content first, then hand the result to DOMPurify with a tag whitelist**. The binding value is a string or a `{ content, allowedTags, … }` object (options are `XssFilterOptions`, `xss.ts:21-38;` the caller's fields override the defaults, `xss.ts:514-519`).

- Stage one, `stripDangerousMarkup()` (`xss.ts:127-153`): paired deletion of `<script>/<iframe>/<object>/<embed>/<applet>`, then a sweep of leftover fragments; strips every `on*=` handler and `srcdoc`. The stated motivation: DOMPurify may parse inconsistently in SSR / test environments, so this strip guarantees a **floor in every runtime** (`xss.ts:119-126`).
- Stage two, DOMPurify (`xss.ts:523-530`): whitelist `defaultSafeTags` (`xss.ts:482-511` — paragraphs, headings, lists, tables, `a`, `img` and friends), with `ALLOW_DATA_ATTR: false`. If DOMPurify is unavailable the pipeline falls back to full `escapeHtml()` (`xss.ts:530`).
- The result is written straight to `el.innerHTML` (`xss.ts:532`) — **existing child nodes of the host are discarded**; use it on empty elements only.

### v-escape

`escapeDirective` does one thing: write the value into `el.textContent` (`xss.ts:470-474`), so content can never be parsed as HTML. The arg selects the context (`EscapeType`, `xss.ts:41`):

- default / `:html`: **displayed verbatim** — no entity encoding, because `textContent` already doesn't parse tags and double-encoding would only show the user `&lt;` noise (comment at `xss.ts:464-469`).
- `:url`: dangerous protocols (`javascript:` / `vbscript:` / `data:text/html`) are replaced wholesale by `#unsafe-url` with a `console.warn` (`xss.ts:198-214`); everything else goes through `encodeURI`.
- `:js` / `:css` / `:attr`: a semantic transformation first, then still displayed as text (`smartEscape`, `xss.ts:286-310`).

## Live example: /components/directive

Open `http://localhost:6080/#/components/directive` (for starting the services and logging in, see [Component Examples](/en/components/index)). The four cards show how to click each capability; the page's own header comment (`apps/web/src/views/components/directive/index.vue:16-23`) states the intent: every directive gets an example that actually reacts.

**v-permission card** (from `index.vue:214`). The demo **does not touch the global directive**; it builds a local `v-demo-permission`: under `<script setup>`, a variable named `vDemoPermission` automatically becomes a local directive (`index.vue:94-98`). Why local? The real permission table is a computed over the persisted `useUserStore().userInfo`, so writing it from a demo would change the logged-in account's permissions, and keep-alive would carry that change to other pages (comment at `index.vue:53-60`). Tick codes/roles on the left (two local refs, `index.vue:61-62`) and the seven forms on the right flip in place — which also demonstrates `subscribe`: `watch([grantedCodes, grantedRoles], notify)` (`index.vue:97`). Each row's grey hint names its form (any at `index.vue:267-273`, `.all` at 276-281, the "`:role` is an arg" caveat at 284-289, `:admin` at 292-296, `.disabled` at 299-304, object form at 307-313). The "judgement trail" panel is fed by `onCheck` (`recordCheck`, `index.vue:82-92`), recording only results that differ from the previous one, capped at 8 entries.

**v-loading card** (from `index.vue:322`). "加载这块 / 加载那块" each raise a 2-second overlay; the second box carries the three attributes `loading-size="large"` / `loading-theme="dark"` / `loading-tip` (`index.vue:349-351`); the full-page button hosts `v-loading.fullscreen` itself (`index.vue:365`). The source also buries a `<script setup>` trap: template expressions receive unwrapped values, so passing a ref into a function delivers `false` instead of a Ref, `.value = true` throws and the overlay never appears — the demo therefore uses "a key name + one reactive record" (`index.vue:107-123`).

**v-lazy card** (from `index.vue:375`). Scroll the image box: requests fire only on entering the viewport and the counter climbs step by step; the last tile is a deliberately broken URL that falls back to the logo. The failure URL is a data: URI rather than a 404-ing external link, so the site-wide sweep doesn't log it as an API error (`index.vue:132-137`). The replay button remounts the wall via a new key (`index.vue:155, 168-171`); the second run lands instantly thanks to the global cache. The load counter only counts when the element's src truly became the target image — the placeholder's `load` event doesn't count (`index.vue:158-166`).

**v-safe-html / v-escape card** (from `index.vue:413`). The left column shows the raw dirty payload in full (`index.vue:193-199`: script tag, `<svg onload>`, a `javascript:` link, an `onclick` paragraph); the top right is the `v-safe-html` rendering — rich text kept, payloads stripped; the bottom right mounts a second instance with the whitelist narrowed to `b/i/p` (`strictSafeHtml`, `index.vue:206-209, 441-444`), where lists and links vanish from the same data. `v-escape` displays the script payload as plain text (`index.vue:452-456`); `v-escape:url` shows the pseudo-protocol turning into `#unsafe-url` (`index.vue:462-467`; the adjacent button swaps in a safe link). Note the string concatenation in the source (`['<scr','ipt>…'].join('')`, `index.vue:176-186`): it exists because a literal closing tag would truncate the SFC at parse time — a syntactic constraint, not demo content. `data-safe-box` / `data-escape-box` are observation hooks for e2e (`index.vue:433, 450-451`).

## Drag layout: VueDraggable (the component, not the directive)

The whole `/components/drag-layout` page is built on `vue-draggable-plus`'s **`VueDraggable` component** (`apps/web/src/views/components/drag-layout/index.vue:7`). Dependency and version: `apps/web/package.json:107` (`"vue-draggable-plus": "catalog:"`, a runtime dependency) → pinned at `^0.6.1` in `pnpm-workspace.yaml:216`; it entered the repo with the architecture commit (`ea1ffefc`), while the demo directory itself is still an untracked new page in the working tree (menu node `DemoDragLayout` at `menus.get.ts:335-340`, path `/components/drag-layout` at `menus.get.ts:339`).

::: tip The component form is used; the library's other two forms have no callers `vue-draggable-plus` also exports a `v-draggable` directive and a `useDraggable` composable (three entry points in `dist/index.d.ts`), but a repository-wide search finds **zero call sites** — neither this demo nor the table's `dragSort` uses them (table row dragging binds Sortable inside `BasicTable`; see `apps/web/src/components/business/Table/hooks/useDragSort.ts`, documented on the [Table](/en/components/table) page, not repeated here). :::

### Props are sortablejs Options

`VueDraggable`'s props are the full sortablejs `Options` plus `modelValue` / `tag` / `target` (the library's type definition: `IProps extends UseDraggableOptions`; the demo's header comment says the same, `drag-layout/index.vue:13-14`). Event names are the sortablejs callbacks with the `on` prefix dropped: `@start` / `@update` / `@add` / `@remove` / `@end` / `@filter`. Each of the five blocks demonstrates a different configuration concern:

| Card | Demonstrates | Key config, with source |
| --- | --- | --- |
| Basic list | `v-model` owns the array | `v-model="basicList"` (a local ref, `index.vue:131-138`), `:animation="150"`, `ghost-class` / `chosen-class` (`index.vue:265-271`); the tag strip below tracks v-model live (`index.vue:278-283`) |
| Handle | trigger zone narrowed to ⠿ | `handle=".drag-grip"` (`index.vue:295`); the grip class sits on the row's span (`gripClassName`, `index.vue:68-77`; template at `index.vue:302`). Row text stays selectable (`selectableClassName`, `index.vue:67`) |
| Two lists | cross-container group | both sides share the module-level constant `panelGroup = { name: 'drag-layout-panel', pull: true, put: true }` (`index.vue:162-166`), bound to two refs `candidateList` / `chosenList` (`index.vue:181-182, 330, 351`) |
| Grid cards | list → grid, zero config changes | `VueDraggable` itself is the grid container (`:class="cardGridClassName"`, the `grid grid-cols-1 … xl:grid-cols-4` at `index.vue:92, 382-387`) |
| Constraints | disabled / filter / onEnd | `:disabled="dragDisabled"` (`index.vue:419`, switch at `index.vue:230`), `:filter="lockedSelector"` (`index.vue:420`, selector `.drag-locked` at `index.vue:212`), `:prevent-on-filter="false"` (`index.vue:421`), `@end="handleEnd"` (`index.vue:426`) |

Hard conclusions read straight from the source:

- **You don't sync the order yourself.** Sortable fires `update` first — and the library has already spliced the `v-model` array by then — before firing `end`; manually moving items inside `end` is duplicate work, and stacking the two reorders garbles the sequence (comment at `index.vue:236-243`). The `v-for` `key` must be a stable id: keys by index fight Sortable's real-DOM node moves and produce visible misplacement (`index.vue:259-263`).
- **Don't write `group` as a template literal.** `:group="{ name: 'x' }"` creates a new object on every render; the library deep-compares options and re-applies them one by one via `sortable.option(...)`, wasting work and risking a momentary config mismatch mid-drag — hence the module-level constant (`index.vue:156-161`).
- **An empty container needs height.** `emptyInsertThreshold` defaults to 5px; a collapsed zero-height list can't catch a drop. The right-hand "已选上墙" panel still accepts drops when emptied because its list carries `min-h-[112px]` (`index.vue:90-91`; copy at `index.vue:314-317`).
- **The grid has exactly one constraint**: the `VueDraggable` layer must itself be the grid container (it renders a `div` by default; `tag` changes that) — wrapping the cards in an extra layer kills dragging, because Sortable only recognises the container's direct children (`index.vue:372-378`).
- **`preventOnFilter` defaults to `true` and bites buttons**: it calls `preventDefault()` on elements hit by `filter`, which makes the row's "unlock" button unresponsive; the demo sets `:prevent-on-filter="false"` explicitly — items stay undraggable, buttons work (`index.vue:421, 450-454`). Also, changing `disabled` / `filter` needs no instance rebuild; the library re-applies options item by item after a deep compare (`index.vue:453-454`).
- **Ghost/chosen styles need `:deep()`.** `ghost-class` / `chosen-class` pass class-name strings that Sortable applies to the real dragged node; cross-container moves transplant that node into another component's DOM, where `<style scoped>` matching via `data-v-*` attributes no longer hits — hence `:deep(.drag-ghost)` / `:deep(.drag-chosen)` as plain selectors (`index.vue:460-476`).

### Where the dragged order goes: a local ref, no backend

**There are no network requests** and no localStorage. On drop, `handleEnd()` merely joins the current ids into a string and writes it to a local `ref` (`lastOrder`, `index.vue:232, 244-248`); the monospace line "onEnd 得到的顺序" on the page is exactly the payload you would POST to a sort endpoint (`index.vue:410, 442-449`) — the demo prints it but never sends it. A refresh restores the initial order; the "还原" buttons just re-copy initial array literals (`resetPanelLists` at `index.vue:184-187`; `resetCardOrder` at `index.vue:204-206`).

## Live example: /components/drag-layout

Open `http://localhost:6080/#/components/drag-layout`. Per card: on the first, drag any row and watch the tag strip re-order live; on the second, verify that dragging the row body does nothing while the left ⠿ works, then select text inside a row to confirm it stays selectable; on the third, drag items from "待选组件" into "已选上墙" (empty the right side first and drop into the empty area to exercise the `min-h`), then hit "还原示例数据"; on the fourth, drag stat cards inside the four-column grid; on the fifth, first click "解锁" on the locked "置顶公告" row (that's `filter` + `preventOnFilter` at work), then flip the "整列表禁用" switch to freeze the whole list, and after dragging, read the id-order line and the `old → new` index from `onEnd`.

## Verified absent or silently inert

- **The demo's claim that route-switch fullscreen loading "does the same thing via `createFullscreenLoading()`" is not true** (`apps/web/src/views/components/directive/index.vue:368-371`). `createFullscreenLoading()` is exported (`packages/ui-kit/loading-ui/src/createLoading.ts:66-74`) but has **zero call sites** in the repository; the actual route-switch loading comes from `useRouteLoading()` + `RouteLoadingBar` + `PageLoading` (`apps/web/src/layouts/index.vue:14, 160-167, 177-183, 225-229`) and has nothing to do with that function.
- **`v-lazy` and `v-escape` are registered but used only by the demo page itself** (registration: `main.ts:107, 111`; usage search finds hits only in `views/components/directive/index.vue`). The "avatar list" rationale behind the `data-*` fallbacks (`lazy.ts:154-155`) also has no consumer in this repository.
- **`vue-draggable-plus`'s `v-draggable` directive and `useDraggable` composable have no call sites** (see the tip above), and `RouteMeta.roles` / `RouteMeta.permissions` have no readers (see the v-permission tip). These, like `packages/types/src/app-router.ts:9-10` and the library's `dist/index.d.ts`, are cases of "declared ≠ used".
- **There is no wildcard path for the `'*'` permission code**: neither the evaluation chain `resolveAccess()` (`utils.ts:82-109`) nor the matching implementation of `usePermission()` (`usePermission.ts:23-34`) contains a `'*'` branch — the permission table is a plain `Array.includes` whitelist. Yet the mock grants the admin account `permissions: ['*']` (`apps/backend-mock/server/api/auth/login.post.ts:24`), and `['*'].includes('user:add')` is `false`, so that wildcard **grants nothing** at the element layer; on the demo account, visible `v-permission` passes rely on `.disabled` / `:admin` or on the exact code being in the table.
- **`v-loading` reads its attribute configuration only at overlay creation** (`packages/ui-kit/loading-ui/src/directive.ts:69-76`); mutating `loading-tip` and friends afterwards is silently ineffective — only `binding.arg` hot-updates (`directive.ts:96-98`).
- **`v-escape` / `v-safe-html` overwrite the host element's content** (`textContent` / `innerHTML`, `xss.ts:472, 532`); hosting them on an element with slots or children means discarding that DOM — by design, but the UI never says so.

## Related pages

- [Component Examples](/en/components/) — chapter overview and how to start the services
- [Table](/en/components/table) — `dragSort` row dragging (a separate path from this page's VueDraggable)
- [Permissions, directives and cursors](/en/guide/in-depth/access) — the three permission layers: route, menu, element
- [Styles and icons](/en/guide/essentials/styles) — where `permission-disabled` and other degraded styles live
- [Directory structure](/en/guide/project/dir) — where `packages/directives` / `packages/shared` sit in the layout
