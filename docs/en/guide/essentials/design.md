# Design tokens and global styles (`@antdv/design`)

Styles have exactly **one path**: Tailwind CSS v4 + the CSS variable tokens of `@antdv/design` + a very thin layer of custom CSS. The repo has no SCSS / Less source files, and no second global style entry.

`@antdv/design` (`packages/core/base/design`) **is** that token-and-style layer; its boundary is stated in the `description` field of `packages/core/base/design/package.json:4`: **variables and CSS only — no component logic, and no awareness of any component library**. A component's own styles travel with the component, in `packages/core/ui-kit/*` and `packages/core/base/icons`; this package only registers their Tailwind scan paths (see the `@source` section below).

## What it contains

There are exactly two second-level directories, split on **variable or rule**: `token/` holds the CSS variables shadcn-vue needs, `css/` holds the rules.

```
packages/core/base/design/
├─ package.json              named @antdv/design, exports are .css-granular
└─ src/
   ├─ index.css         ← the only entry, imported once in apps/web/src/main.ts:43
   ├─ token/                 theme tokens — variable declarations only
   │  ├─ default.css         light: `:root` / `.light` + 13 `[data-theme]` preset palettes
   │  ├─ dark.css            dark: `.dark` + the same 13 `[data-theme]` preset palettes
   │  └─ index.css           imports both sets + the `@theme inline` mapping `--*` → `--color-*`
   └─ css/                   shared styles, one file per concern
      ├─ base.css            document root / selection / view transitions / shared interaction classes
      ├─ nprogress.css       the route progress bar on top
      ├─ a11y.css            color-weak and gray modes (the classes are put on <html> by @antdv/preferences)
      ├─ permission.css      degraded no-permission styling (the class comes from v-permission in @antdv/directives)
      └─ scrollbar.css       fallback beautification of system scrollbars inside third-party scroll areas
```

Light and dark are **two independent value sets**, not "light with a few tweaks": the name lists must line up entry by entry (one missing dark declaration and switching to dark gives you a white-background, black-text overlay), while the values themselves may differ completely. The mapping exists once, in `token/index.css` — the theme files know nothing about the Tailwind contract, and adding a variable while forgetting its mapping fails silently exactly like a missing `@source` registration. That is why three invariants (list parity, variable ↔ mapping bijection, "variables only" inside `token/`) are pinned in `__tests__/design.test.ts`.

`src/index.css` imports the token entry plus the five css parts (the CSS spec only allows `@import` before ordinary rules, which is why they must come ahead of `@layer` / `@source` / `@plugin` — see the comment at `index.css:25`). Each part can also be pulled on its own: the `exports` map in `package.json` publishes `.`, `./index.css`, `./token`, `./token/index.css`, `./token/default.css`, `./token/dark.css`, `./css/base.css`, `./css/nprogress.css`, `./css/a11y.css`, `./css/permission.css`, `./css/scrollbar.css` and `./package.json`, so `@antdv/design/token` works when you want the variables but not the entry.

::: warning What `@antdv/design` does not contain

- **No components**: the package has not a single `.vue` file and no `src/index.ts`. The shared display components (Card, Tag, Steps …) live in `@antdv/common-ui`, the icon atoms in `@antdv/icons`; the comment at `index.css:18` states exactly this boundary.
- **No component-library awareness**: it imports no JS from any component library and no style compatibility layer either — every token and rule is owned by this package, so renaming or swapping a component library never requires a change here. The two leftover `.ant-upload` cursor rules (antd forgot `cursor: pointer` on its upload trigger) retired together with that DOM, and the boundary is now **nailed shut from the other side**: outside comments, `.ant-` may not appear in the global partials (`__tests__/design.test.ts:528-529`), with separate guards for `--ant-` and the `-ant-` utility family (`:461`, `:464`). Every clickable element's cursor is attached by this package, by tag and by `role` (`css/base.css:123-129` buttons, `:154-164` checkbox/radio/select, `:175-192` the ARIA role group, `:144-148` `<a href>`), so nothing relies on a browser user-agent stylesheet any more.
- **No business styling**: thin shells that need a store (for instance `packages/layouts/src/basic/content/page-loading.vue`) stay in the app and are never moved here. :::

## The layer order is declared explicitly

`packages/core/base/design/src/index.css:27-52`:

```css
@layer theme, base, components, utilities;
@import 'tailwindcss';
@import 'tw-animate-css';
@import './token/index.css'; /* which in turn imports ./default.css + ./dark.css */
@import './css/base.css';
/* …css/nprogress · css/a11y · css/permission · css/scrollbar */

@source '../../icons/src';
@source '../../../ui-kit/common-ui/src';
/* …form-ui / layout-ui / menu-ui / popup-ui / shadcn-ui / table-ui / tabs-ui */

@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/nesting";

@custom-variant dark (&:where(.dark, .dark *));
```

- The layer list has **no slot for a component library**: this package yields to none. `utilities` comes last, which is what lets utility classes in templates override `components`-layer rules (the self-drawn `Scrollbar` and the layout shells both depend on it).
- The `dark` variant is bound to the `.dark` class (written on `html` by the preferences), not to a media query — so under `theme: 'auto'` Tailwind and the component library see the same result.
- `apps/web` keeps no `global.css` of its own; the reason is in the comment at `main.ts:39-42`: global styles belong to `@antdv/design`.

Tailwind is wired in through `@tailwindcss/vite` (`internal/vite-config/src/plugins/vue.ts`), with the version coming from the catalog (`pnpm-workspace.yaml`).

## `@source`: why every component package has to be registered

Tailwind v4's automatic content detection starts at the **build root**, and the app-side build root is `apps/web`, while every `@antdv/*` package sits in `packages/` at the repository root (symlinked into `node_modules`, and therefore outside detection). So the utility classes inside component packages must be **registered package by package** in the entry CSS (the comment at `index.css:20-23` records the symptom).

- What a missing registration looks like: "the component renders but has no styles" — the sidebar stays white and un-indented, the tab bar collapses into one line — **with no error at all**.
- What is registered today: `packages/core/base/icons/src` plus the eight `src` directories under `packages/core/ui-kit/*`.
- Adding a new ui-kit sub-package, or writing a fresh set of utility classes into an existing one, **means editing this `@source` list in the same change**; adding the package without the registration is the laziest way to get "the build passes and the page is unstyled". `__tests__/design.test.ts` cross-checks the registrations against the directory listing and compares **resolved absolute paths** — after a package move a stale `@source` would point at nothing, and comparing the literal relative strings would happily pass.
- Conversely, a package that expands its utility classes into equivalent native CSS inside `@layer components` — the way `Scrollbar` does in the `<style>` block of `packages/core/ui-kit/common-ui/src/components/scrollbar/Scrollbar.vue` — does not depend on this registration, which is exactly what makes it safe to consume standalone.

## How to use the variable tokens

`token/` is a **bare-name semantic palette** following the shadcn-vue naming spec: `bg-popover`, `text-muted-foreground`, `border-input`. Tailwind v4 generates utilities only for tokens declared in `@theme`, so a missing declaration is not "the style got overridden" but **the class is never generated at all**; the visible result is popovers with no background, secondary text with no grey and hover with no feedback.

The chain has two links:

| Link | Location | Contents |
| --- | --- | --- |
| Seed variables | `token/default.css:25-78` (`:root` / `.light` / `.light[data-theme=…]`), `token/dark.css:13-54` (`.dark` / `.dark[data-theme=…]`) | `--background` / `--foreground` / `--card` / `--popover` / `--primary` / `--secondary` / `--muted` / `--accent` / `--destructive` / `--border` / `--input` / `--ring`, plus a whole `--sidebar-*` set (27 semantic colors across the two blocks), the three status colors `--success / --warning / --info` and the three scale variables `--radius / --font-size / --filter` |
| Tailwind tokens | the `@theme inline` block, `token/index.css:30-82` | maps each `--*` onto a `--color-*`, which is what makes `bg-popover`, `text-muted-foreground` and `border-input` exist as classes |

Three decisions here must not be reverted:

- **Colour values are self-contained channel triplets (`H S% L%`) and never read an external variable**: the rule dates from antd's CSS variables hanging off the scoped class generated by `ConfigProvider`, while reka/shadcn popovers portal to `body` (outside that scope) and would resolve to nothing but a transparent background. The library is gone, the discipline is pinned in reverse by the tests — `__tests__/design.test.ts:459-465` asserts the whole package (comments stripped) contains no `--ant-`, no `@antdv-next/` and no `-ant-x` utility, and `:467-471` checks the base block again. Both light and dark value sets are pinned to the root element, so overlays in `body` and content inside the page resolve identically.
- **Derived colors are written as `var(--*)`, never repeated literals**: `--ring`, `--sidebar-primary` and `--sidebar-ring` all point at the block's own `--primary`. A custom color inlines one `--primary` on `<html>` (a preset instead takes the whole `[data-theme]` palette and gets no inline value) and everything else follows on the same element.
- **`@theme inline`, not `@theme`**: inline makes the utility class inline `hsl(var(--*)`, so the `.dark` and `[data-theme]` overrides apply; the non-inline form `--color-x: var(--x)` is evaluated once at `:root` and the dark switch freezes on light values.

The 13 `[data-theme]` presets (`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`) write out all 27 semantic colors on both the light and the dark side — switching a theme moves the whole canvas temperature, not one button. `__tests__/design.test.ts` pins the contract: every preset complete, no two presets identical, light and dark genuinely different, and the preset names match `THEME_PRESETS` from `@antdv/shared` exactly.

Two ways to consume them:

```vue
<template>
  <!-- 1. utility classes (preferred): the token name is the class name -->
  <div
    class="rounded-lg border border-input bg-popover text-muted-foreground"
  />

  <!-- 2. reference the variable directly when you need it inside style / as a value -->
  <span
    class="bg-[hsl(var(--primary))]"
    :style="{ color: 'hsl(var(--foreground))' }"
  />
</template>
```

The sidebar has its own set (`--sidebar-*`): a dark sidebar is a deliberate preference, not dark mode, so its values must stay independently tunable. In dark mode the neutral colors are translucent overlays (the `.08` / `.12` steps are the secondary and hover feedback levels) rather than pinned hex values, while presets deliberately use solid backgrounds because the whole colour temperature has to move together — the reasoning is in the header of `token/dark.css`.

How the theme color lands on these variables is covered in [Theming](/en/guide/in-depth/theme).

## How components write styles

The convention is **utilities + `cn()`**, where `cn()` = clsx + tailwind-merge (`packages/core/base/shared/src/utils/cn.ts`).

| Goal | How |
| --- | --- |
| Conditional class names / merging an incoming class | `cn('base', cond && 'x', props.class)` |
| Theme colors | this package's bare token names `bg-primary` / `text-muted-foreground` / `border-input`; in inline styles or passed params, `bg-[hsl(var(--primary))]`. The antd compatibility layer's `*-ant-*` utilities are no longer generated — writing them silently drops the style, which `__tests__/design.test.ts:464` guards |
| Small reusable chunks | the shared classes `.icon`, `.outline-box`, `.outline-box-active` (`css/base.css:96-107`) |
| Transitions / keyframes | only then open a `<style scoped>` |

::: warning

Tailwind only understands literal class names

- A class name must be **a complete string as it appears in the source**. Concatenation (`text-${color}-500`), building a step name out of variables, or writing classes in a directory that `@source` does not cover all produce **no CSS and no error**.
- Do not write `cn(...)` in a template attribute with a **trailing comma**; the form used across the component packages is to collapse it into a `computed` in `<script setup>` and let the template reference the variable — that is how every component in `packages/core/ui-kit/common-ui` does it, which keeps expressions out of the template and keeps the class strings literal.
- Status-to-color mappings go through a **lookup table** (`Record<string, string>` whose values are full class strings), never `cn('text-' + tone)`. See the `STATUS_DOT` / `CIRCLE` / `PRESET` constants in `packages/core/ui-kit/common-ui/src/components/badge/Badge.vue`, `steps/Steps.vue` and `tag/Tag.vue`. :::

::: warning

Do not pad the outer container of a route page. Content padding belongs to the layout; a page that adds its own layer doubles it when the layout shape changes. See [Local development](/en/guide/essentials/development) and [Layout and tabs](/en/guide/in-depth/layout). :::

Do not pin colors. There is now exactly **one** primary-colour chain: the preference is folded into `--primary` on `<html>` by `applyPreferencesToDom()` (`packages/core/preferences/src/update-css-variables.ts:39`) — only a hand-picked colour is inlined, a preset hands the whole palette to `[data-theme]` — and `@theme inline` maps it onto the `bg-primary` family, so content inside the page and overlays portalled to `body` resolve the same value; one screen cannot contain two oranges. Test assertions must still not name concrete color values — assert under light mode, or assert the _same-source relation_ (two elements' computed colours are equal). Details in [Theming](/en/guide/in-depth/theme).

## The admin page shell (header / sections / surfaces)

The layout pass distilled "what an admin page looks like" into four rules. 17 business pages (all of `system`, plus `security/dashboard`, `account/center`, `account/settings`, `dashboard/analysis`) and 4 page-private components already follow them, and the rules are **written as a source contract**:

| Rule | What it means in practice |
| --- | --- |
| One source for the page header | Every page puts `<PageHeader>` at its root; the `<h1>` is rendered by it, and a hand-written `<h1>` in the page template turns the guard red. Right-side actions go into `#extra`, the note into `description`, the badge into `icon` (the primary-tinted chip only renders when it is given). Component details in [Shared components · page shell](/en/components/common-ui) |
| Sections are `Card`, not bare `div` | Several blocks on one page are separated by `Card` (default `outlined`); the page name is already stated in the header, so card titles do not repeat it |
| Neutral surfaces always use tokens | Backgrounds, borders and body greys come only from the `bg-background` / `bg-card` / `bg-muted` / `border-border` / `text-muted-foreground` family; `bg-white`, `text-gray-*`, `border-slate-*`, `bg-zinc-*`, pure white and pure black may not appear in the listed files' source — switch to dark or to a preset and a hard-coded grey scale is exactly how "white text on white" happens. **Categorical colours are exempt** (a `blue` / `violet` / `emerald` / `amber` / `cyan` palette labels "things of the same kind", it is not status semantics, and squeezing it into the four status colours would flatten the distinction; the exempt family is the `CATEGORICAL` list at `page-shell-convention.spec.ts:32-33`, which also covers indigo / sky / teal / rose / orange / fuchsia / purple / green / red / yellow), but they **must be paired with a `dark:` step** or dark mode smudges the same way |
| One owner for vertical rhythm | The page root container writes no padding (content padding belongs to the layout — see the warning above), and the gaps between pages and between blocks come from the root's `space-y-*` / `gap`. The **root elements of `PageHeader` / `PageToolbar` carry no margin or padding** — whoever adds a step there breaks the guard, because double spacing is the symptom this pass removed |

The guarding is split in two, each covering the dimension the other cannot:

- Source side: `apps/web/src/views/__tests__/page-shell-convention.spec.ts` — whether the listed pages and their private components use only token greys, whether categorical colours come in pairs, whether `<PageHeader>` + `data-page-view` are mounted, whether a hand-written `<h1>` slipped into the template, and whether the two shell components' root elements grew spacing. End-to-end cannot judge these: the browser sees the whole subtree and counts the utility classes the shared components bring themselves (shadcn's destructive button literally says `text-white dark:bg-destructive/60`).
- Rendered side: `apps/web/e2e/page-shell.spec.ts` plus `apps/web/src/views/__tests__/page-root-padding.spec.ts` — in the real DOM whether the header renders, whether there is exactly one `h1`, whether the content background equals the current theme's `--muted`, whether narrow screens stack as intended.

::: warning Known debt (not in the list, not covered by the sweep)

Outside the list there are still **38 files / 289 lines** of hard-coded neutral utilities (measured with the guard's own criteria: same regex, comments stripped first, same file list) — concentrated in the `views/components/**` example pages, worst first: editor 37 lines, upload 28, loading 26, modal-drawer 26, image-crop 19, drag-layout 16, scroll 14, count-to 12 — plus 13 lines across `views/error/{403,404,503}.vue`, 8 in `views/micro-app/SubAppView.vue` and 10 in `views/screen/**`. Those are examples and error pages, deliberately left out of this pass. A new business page should start from the skeleton the listed pages use (`apps/web/src/views/system/user/index.vue` is the reference page) and add its path to `PAGES` in `page-shell-convention.spec.ts`. :::

## stylelint status

The rule package exists (`internal/lint-configs/stylelint-config/index.mjs`: `stylelint-config-standard` + `recess-order`, `order/order`, a BEM-style `selector-class-pattern`, and the Vue `global`/`deep` allow-list) and `vsh lint` calls it (`scripts/vsh/src/lint/index.ts`). But **neither the repository root nor `apps/web` has a `stylelint.config.*` / `.stylelintrc*` file on disk**, and the stylelint step in lefthook is commented out (`lefthook.yml`). In other words: CSS ordering discipline is voluntary today, so do not claim in a PR that "stylelint will catch it".

## Icons

Icons are not part of this package. The Iconify + SVG sprite setup, the collection list, the offline bundles and the steps for adding a collection are covered in [Icons](/en/guide/essentials/icons).

## Related pages

- [Tailwind CSS](/en/guide/project/tailwindcss) — how this package is wired in as the only entry
- [Theming](/en/guide/in-depth/theme) — who writes the `data-theme` tier and the `--primary` / `--radius` / `--font-size` / `--filter` variables
- [Access control](/en/guide/in-depth/access) — what triggers `permission-disabled` in `permission.css`
- [Examples: shared components](/en/components/common-ui) — how `@antdv/common-ui` consumes these tokens
- [External modules](/en/guide/essentials/external) — why source-published packages (this one included) have no build step
