# Design tokens and global styles (`@antdv/design`)

Styles have exactly **one path**: Tailwind CSS v4 + the CSS variable tokens of `@antdv/design` + a very thin layer of custom CSS. The repo has no SCSS / Less source files, and no second global style entry.

`@antdv/design` (`packages/core/base/design`) **is** that token-and-style layer; its boundary is stated in the `description` field of `packages/core/base/design/package.json:4`: **variables and CSS only — no component logic, and no awareness of any component library**. A component's own styles travel with the component, in `packages/core/ui-kit/*` and `packages/core/base/icons`; this package only registers their Tailwind scan paths (see the `@source` section below).

## What it contains

There are exactly two second-level directories, split on **variable or rule**: `token/` holds the CSS variables shadcn-vue needs, `css/` holds the rules.

```
packages/core/base/design/
├─ package.json              named @antdv/design, exports are .css-granular
└─ src/
   ├─ index.css         ← the only entry, imported once in apps/web/src/main.ts:45
   ├─ token/                 theme tokens — variable declarations only
   │  ├─ default.css         light: `:root` / `.light` + 13 `[data-theme]` preset palettes
   │  ├─ dark.css            dark: `.dark` + the same 13 `[data-theme]` preset palettes
   │  └─ index.css           imports both sets + the `@theme inline` mapping `--app-*` → `--color-*`
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
- **No component-library awareness**: it imports no JS from any component library and no style compatibility layer either — every token and rule is owned by this package, so renaming or swapping a component library never requires a change here. The one leftover is the pair of `.ant-upload` cursor rules in `css/base.css:128-134` (antd leaves `cursor: pointer` off its upload trigger; deletable once that DOM is gone from the page).
- **No business styling**: thin shells that need a store (for instance `apps/web/src/components/common/Loading/PageLoading.vue`) stay in the app and are never moved here. :::

## The layer order is declared explicitly

`packages/core/base/design/src/index.css:27-52`:

```css
@layer theme, base, components, utilities;
@import 'tailwindcss';
@import 'tw-animate-css';
@import './token/index.css';   /* which in turn imports ./default.css + ./dark.css */
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
- `apps/web` keeps no `global.css` of its own; the reason is in the comment at `main.ts:42-45`: global styles belong to `@antdv/design`.

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
| Seed variables | `token/default.css:24` (`:root` / `.light` / `.light[data-theme=…]`), `token/dark.css:13` (`.dark` / `.dark[data-theme=…]`) | `--app-background` / `--app-foreground` / `--app-card` / `--app-popover` / `--app-primary` / `--app-secondary` / `--app-muted` / `--app-accent` / `--app-destructive` / `--app-border` / `--app-input` / `--app-ring`, plus a whole `--app-sidebar-*` set and the four scale variables |
| Tailwind tokens | the `@theme inline` block, `token/index.css:22-51` | maps each `--app-*` onto a `--color-*`, which is what makes `bg-popover`, `text-muted-foreground` and `border-input` exist as classes |

Three decisions here must not be reverted:

- **Values are self-contained literals and never read `var(--ant-color-*)`**: antd's CSS variables hang off the scoped class generated by `ConfigProvider`, while reka/shadcn popovers portal to `body` (outside `.ant-app`) and would resolve to nothing but a transparent background. Both light and dark value sets are pinned to the root element, so overlays in `body` and content inside the page resolve identically.
- **Derived colors are written as `var(--app-*)`, never repeated literals**: `--app-ring`, `--app-sidebar-primary` and `--app-sidebar-ring` all point at the block's own `--app-primary`. A custom color inlines one `--app-primary` on `<html>` (a preset instead takes the whole `[data-theme]` palette and gets no inline value) and everything else follows on the same element.
- **`@theme inline`, not `@theme`**: inline makes the utility class inline `var(--app-*)`, so the `.dark` and `[data-theme]` overrides apply; the non-inline form `--color-x: var(--app-x)` is evaluated once at `:root` and the dark switch freezes on light values.

The 13 `[data-theme]` presets (`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`) write out all 27 semantic colors on both the light and the dark side — switching a theme moves the whole canvas temperature, not one button. `__tests__/design.test.ts` pins the contract: every preset complete, no two presets identical, light and dark genuinely different, and the preset names match `THEME_PRESETS` from `@antdv/shared` exactly.

Two ways to consume them:

```vue
<template>
  <!-- 1. utility classes (preferred): the token name is the class name -->
  <div class="rounded-lg border border-input bg-popover text-muted-foreground" />

  <!-- 2. reference the variable directly when you need it inside style / as a value -->
  <span class="bg-[var(--app-primary)]" :style="{ color: 'var(--app-foreground)' }" />
</template>
```

The sidebar has its own set (`--app-sidebar-*`): a dark sidebar is a deliberate preference, not dark mode, so its values must stay independently tunable. In dark mode the neutral colors are translucent overlays (the `.08` / `.12` steps are the secondary and hover feedback levels) rather than pinned hex values, while presets deliberately use solid backgrounds because the whole colour temperature has to move together — the reasoning is in the header of `token/dark.css`.

How the theme color lands on these variables is covered in [Theming](/en/guide/in-depth/theme).

## How components write styles

The convention is **utilities + `cn()`**, where `cn()` = clsx + tailwind-merge (`packages/core/base/shared/src/utils/cn.ts`).

| Goal | How |
| --- | --- |
| Conditional class names / merging an incoming class | `cn('base', cond && 'x', props.class)` |
| Theme colors | this package's bare token names `bg-primary` / `text-muted-foreground` / `border-input`; in inline styles or passed params, `bg-[var(--app-primary)]`. **Not** the antd compatibility layer's `*-ant-*` — those utilities are no longer generated |
| Small reusable chunks | the shared classes `.icon`, `.outline-box`, `.outline-box-active` (`css/base.css:70-80`) |
| Transitions / keyframes | only then open a `<style scoped>` |

::: warning Tailwind only understands literal class names

- A class name must be **a complete string as it appears in the source**. Concatenation (`text-${color}-500`), building a step name out of variables, or writing classes in a directory that `@source` does not cover all produce **no CSS and no error**.
- Do not write `cn(...)` in a template attribute with a **trailing comma**; the form used across the component packages is to collapse it into a `computed` in `<script setup>` and let the template reference the variable — that is how every component in `packages/core/ui-kit/common-ui` does it, which keeps expressions out of the template and keeps the class strings literal.
- Status-to-color mappings go through a **lookup table** (`Record<string, string>` whose values are full class strings), never `cn('text-' + tone)`. See the `STATUS_DOT` / `CIRCLE` / `PRESET` constants in `packages/core/ui-kit/common-ui/src/components/badge/Badge.vue`, `steps/Steps.vue` and `tag/Tag.vue`. :::

::: warning Do not pad the outer container of a route page. Content padding belongs to the layout; a page that adds its own layer doubles it when the layout shape changes. See [Local development](/en/guide/essentials/development) and [Layout and tabs](/en/guide/in-depth/layout). :::

Do not pin colors. Under dark mode the component library **recomputes the primary color** on `.ant-app`, so overrides belong on the seed variables on `html`, and test assertions must not name concrete color values — a trap this repository has already fallen into; details in [Theming](/en/guide/in-depth/theme).

## stylelint status

The rule package exists (`internal/lint-configs/stylelint-config/index.mjs`: `stylelint-config-standard` + `recess-order`, `order/order`, a BEM-style `selector-class-pattern`, and the Vue `global`/`deep` allow-list) and `vsh lint` calls it (`scripts/vsh/src/lint/index.ts`). But **neither the repository root nor `apps/web` has a `stylelint.config.*` / `.stylelintrc*` file on disk**, and the stylelint step in lefthook is commented out (`lefthook.yml`). In other words: CSS ordering discipline is voluntary today, so do not claim in a PR that "stylelint will catch it".

## Icons

Icons are not part of this package. The Iconify + SVG sprite setup, the collection list, the offline bundles and the steps for adding a collection are covered in [Icons](/en/guide/essentials/icons).

## Related pages

- [Tailwind CSS](/en/guide/project/tailwindcss) — how this package is wired in as the only entry
- [Theming](/en/guide/in-depth/theme) — who writes the `data-theme` tier and the `--app-*` / `--ant-*` variables
- [Access control](/en/guide/in-depth/access) — what triggers `permission-disabled` in `permission.css`
- [Examples: shared components](/en/components/common-ui) — how `@antdv/common-ui` consumes these tokens
- [External modules](/en/guide/essentials/external) — why source-published packages (this one included) have no build step
