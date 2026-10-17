# Layout, menu, and tab pages

This page covers which layers a routed page passes through on its way to production, and the responsibility boundary of each layer — changing styles, adding interactions, or debugging problems like "why doesn't the page fill the height / why is the padding stacked twice" all start here.

## Layout modes are described by region blueprints

The 7 modes are defined by `LayoutMode` in `@antdv/types`:

```
full-content · horizontal · mixed-two-column · mixed-vertical · side-nav · two-column · vertical
```

**"Which modes exist" belongs to the types package; "what each mode looks like" belongs to `@antdv/layouts`**, and the latter breaks every mode down into enumerable switches in a single `LAYOUT_BLUEPRINTS` table:

| Field | Meaning |
| --- | --- |
| `chromeless` | Whether the shell is rendered at all (top bar / sidebar / tab pages) |
| `headerNavVisible` / `headerNavDepth` | Whether the top bar carries navigation or the breadcrumb, and how many levels the navigation expands to |
| `navRailVisible` / `railDepth` | Whether the icon bar is rendered, and which level it carries |
| `sidebarSource` / `sidebarPresentation` | Whether the sidebar's data comes from the whole tree, from the current top bar group, or not at all; `drawer` (overlay on top of the content area) or `inline` (permanent, taking width from the content area) |
| `hideSidebarWhenEmpty` | When the sidebar has no content the whole block disappears and takes up no width |
| `headerLead` | Whether the left end of the top bar is the logo or the breadcrumb |

::: tip Adding an 8th mode Add one entry to `LAYOUT_BLUEPRINTS` plus one literal to the `LayoutMode` union type, and the layout components don't have to change. That's the point of expressing mode differences as data instead of `if/else`. The legacy value `'mixed'` was renamed to `'mixed-vertical'`; `normalizeLayoutMode()` migrates old cached values while reading preferences, without persisting them. :::

## Content area padding belongs to the layout

`LayoutContent` from `@antdv/layout-ui` (`packages/core/ui-kit/layout-ui/src/components/layout-content/index.vue:44`) wraps the content area in an extra `<Scrollbar view-class="p-4">` layer, which means **the layout already owns the page content**. If a routed page **also** adds padding to its own outer container, the symptoms are content sitting 40px from the edge, pages that don't line up with each other, and card shadows pushed outside the visible area.

The rule: **the outer container of a routed page never declares padding**; cards, code blocks, and drawer content inside the page can have as much inner padding as they want. `apps/web/src/views/__tests__/page-root-padding.spec.ts` pins this down as a source contract — it scans the **root container** of every `.vue` page file and forbids utility classes like `p-*` / `px-*` / `pt-*` plus inline `padding:`, while also asserting that the layout's own `p-4` is still there (move it and you have to come back and change the rule).

The scan has to cover all three sources of pages (file-convention routing, the static routes in `routes.ts`, and the `account/*` pages registered dynamically by the menu endpoint), so it walks files instead of the route table and excludes only page-private components (`views/<page>/components/**`, `widgets/**` — they aren't pages, see below).

## Second-level routes: HMR in development

Pages live at `views/<module>/<page>/index.vue`, and first- and second-level pages share the same layout shell.

There's a very specific trap in development: save an edit to a second-level page (for example `views/system/user/index.vue`) and the whole shell — top bar, sidebar, tab bar, breadcrumb — **vanishes as a block**, leaving the page as a full screen detached from the layout, and only a full page reload brings it back. It never happens in the production build, so it only burns development time — but the kind you pay dozens of times a day.

The root cause is that **two route mechanisms never connect on the HMR path**:

- `vite-plugin-vue-layouts-next` **compiles the layout into the route table** — `setupLayouts()` wraps every page in a parent record `{ component: LayoutWrapper, meta.isLayout }`;
- the HMR that ships with `vue-router/auto-routes`, though, does `router.clearRoutes()` → `addRoute(newly generated bare route)` one entry at a time, and the bare route has no such parent record, so the page gets re-attached at the top level;
- the layout shell's parent record **has no `name`**, so it can't self-heal: the registry reconciliation in `stores/modules/route.ts` detects a missing record via `router.hasRoute(name)`, and an unnamed record is never detected.

The fix goes through the opening the official tooling leaves: the second argument of `handleHotUpdate` is specified as being called "after the routes are replaced, before navigation", so there you have the freshly regenerated bare routes and use the extracted `buildAppRoutes()` to **re-lay the entire route table**. No incremental "re-attach the layout only" patch — that `clearRoutes()` wipes the static routes along with everything else (`/login`, `/redirect/**`, the 404 fallback), and a missing 404 fallback in dev shows up as a blank screen on a mistyped URL, which is harder to attribute than a lost layout.

`apps/web/e2e/dev-route-hmr.spec.ts` pins three things: the shell is still there and **not wrapped a second time** (`sidebar` / `header` each count to 1), second-level pages still render inside the layout, and the static routes plus the 404 fallback are all still recognized. Two of its conventions are worth copying:

- The case first asserts that it really did observe `vue-router/auto-routes` being hot-updated before going further — if that update never happened, every assertion afterwards would only be checking startup state and would stay green while broken;
- this one **runs on chromium only**: editing a page file once makes the dev server re-send route table updates to every connected browser, so three engines editing and watching at the same time would only generate noise for each other, and the thing being protected is engine-independent.

## Tab pages

Tab page state moved out of the components into a store, so drag-to-reorder, the context menu, and maximizing are reusable across modes; the rendering layer is split into small components (one tab, the dropdown add button, and the context menu each get their own file), and the shell only assembles them.

- **Style**: `TabStyle = card | chrome | line | plain | rounded` (`chrome` is the Google-style pill).
- **Ordering**: drag to reorder, the state is written back to the store, and switching layout modes doesn't lose it.
- **Context menu**: pin / maximize / reload / new window / close left / close right / close others / close all.
- **Caching**: wired up to `keep-alive`, so pinned tabs and pages marked "cache" don't re-request when you switch back to them.
- **External links**: menu items with `isExternal` don't enter the tab pages.

::: warning One trap to avoid when sweeping The shell's own multi-tab bar renders as `a[href^="#/..."]`. When writing a case, anything that "counts links in the content area" has to be scoped into `<main>` first, otherwise you always count a few extra — that's exactly how the overview page's card wall came out above 1 when filtered down to empty. :::

## Breadcrumb

The breadcrumb is derived from the menu tree (`breadcrumb.ts` in `@antdv/layouts`), so its icons and levels match the menu by construction: a first-level menu with no children doesn't get a level invented for it, and nodes marked `hidden`, such as "Personal Center", stay out of the breadcrumb. Entering a page for the first time must produce the breadcrumb immediately — the bug used to be that you had to click a menu entry once before it appeared, because the derivation was computed lazily.

## Scrollbar

Content scrolling across the whole app goes through the self-drawn `Scrollbar` from `@antdv/common-ui` instead of each page writing its own `overflow: auto` + `::-webkit-scrollbar`: the latter behaves inconsistently on Firefox / Safari, while `Scrollbar` is one shared set of DOM and styles, which is the only way the three engines can get the same end-to-end result.
