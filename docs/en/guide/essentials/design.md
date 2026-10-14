# Design tokens and global styles (`@antdv/design`)

Styles have exactly **one path**: Tailwind CSS v4 + the CSS variable tokens of `@antdv/design` + a very thin layer of custom CSS. The repo has no SCSS / Less source files, and no second global style entry.

`@antdv/design` (`packages/design`) **is** that token-and-style layer; its boundary is stated in the `description` field of `packages/design/package.json:4`: **variables and CSS only — no component logic, and no awareness of any component library**. A component's own styles travel with the component, in `packages/ui-kit/*` and `packages/icons`; this package only registers their Tailwind scan paths (see the `@source` section below).

## What it contains

```
packages/design/
├─ package.json          named @antdv/design, exports are .css-granular
├─ src/index.css     ← the only entry, imported once in apps/web/src/main.ts:44
│   ├─ tokens.css        the shadcn semantic palette: --app-* variables + @theme inline mapping
│   ├─ base.css          document root / selection / view transitions / shared interaction classes
│   ├─ nprogress.css     the route progress bar on top
│   ├─ a11y.css          color-weak and gray modes (the classes are put on <html> by @antdv/preferences)
│   ├─ permission.css    degraded no-permission styling (the class comes from v-permission in @antdv/directives)
│   └─ scrollbar.css     fallback beautification of system scrollbars inside third-party scroll areas
```

`index.css` imports all six parts (the CSS spec only allows `@import` before ordinary rules, which is why they must come ahead of `@layer` / `@source` / `@plugin` — see the comment at `index.css:22`). Each part can also be pulled on its own: the `exports` map in `package.json` publishes the keys `.`, `./tokens.css`, `./base.css`, `./index.css`, `./nprogress.css`, `./permission.css`, `./a11y.css` and `./package.json`, so `@antdv/design/tokens.css` works when you want the variables but not the entry.

::: warning What `@antdv/design` does not contain

- **No components**: the package has not a single `.vue` file and no `src/index.ts`. The shared display components (Card, Tag, Steps …) live in `@antdv/common-ui`, the icon atoms in `@antdv/icons`; the comment at `index.css:15` states exactly this boundary.
- **No component-library awareness**: it imports no JS from any component library, so renaming or swapping a component package never requires a change here. Its only two contact points with antd are **style** dependencies: `@import '@antdv-next/tailwind/compat.css'` (maps the antd palette onto `--color-ant-*` utilities, `index.css:27`) and the two `.ant-upload` cursor rules in `base.css:111-117` (antd leaves `cursor: pointer` off its upload trigger). Those two only become meaningless once the component library goes away.
- **No business styling**: thin shells that need a store (for instance `apps/web/src/components/common/Loading/PageLoading.vue`) stay in the app and are never moved here. :::

## The layer order is declared explicitly

`packages/design/src/index.css:24-52`:

```css
@layer theme, base, antd, components, utilities;
@import 'tailwindcss';
@import '@antdv-next/tailwind/compat.css';
@import 'tw-animate-css';
@import './tokens.css';
/* …base / nprogress / a11y / permission / scrollbar */

@source '../../icons/src';
@source '../../ui-kit/common-ui/src';
/* …form-ui / layout-ui / loading-ui / menu-ui / popup-ui / scrollbar-ui /
   shadcn-ui / table-ui / tabs-ui */

@plugin "@tailwindcss/typography";
@plugin "@tailwindcss/nesting";
@custom-variant dark (&:where(.dark, .dark *));
```

- `antd` is placed in the layer list, so overriding the component library's default styles **needs no `!important`**; the layer order is the precedence.
- `utilities` comes last, which is what lets utility classes in templates override `components`-layer rules (the self-drawn `Scrollbar` and the layout shells both depend on it).
- The `dark` variant is bound to the `.dark` class (written on `html` by the preferences), not to a media query — so under `theme: 'auto'` Tailwind and the component library see the same result.
- `apps/web` keeps no `global.css` of its own; the reason is in the comment at `main.ts:40-43`: global styles belong to `@antdv/design`.

Tailwind is wired in through `@tailwindcss/vite` (`internal/vite-config/src/plugins/vue.ts`), with the version coming from the catalog (`pnpm-workspace.yaml`).

## `@source`: why every component package has to be registered

Tailwind v4's automatic content detection starts at the **build root**, and the app-side build root is `apps/web`, while every `@antdv/*` package sits in `packages/` at the repository root (symlinked into `node_modules`, and therefore outside detection). So the utility classes inside component packages must be **registered package by package** in the entry CSS (the comment at `index.css:17-20` records the symptom).

- What a missing registration looks like: "the component renders but has no styles" — the sidebar stays white and un-indented, the tab bar collapses into one line — **with no error at all**.
- What is registered today: `packages/icons/src` plus the ten `src` directories under `packages/ui-kit/*` (including `common-ui`).
- Adding a new ui-kit sub-package, or writing a fresh set of utility classes into an existing one, **means editing this `@source` list in the same change**; adding the package without the registration is the laziest way to get "the build passes and the page is unstyled".
- Conversely, a package that expands its utility classes into equivalent native CSS inside `@layer components` — the way `Scrollbar` does in the `<style>` block of `packages/ui-kit/scrollbar-ui/src/Scrollbar.vue` — does not depend on this registration, which is exactly what makes it safe to consume standalone.

## How to use the variable tokens

`tokens.css` adds a **bare-name semantic palette**. The reason is in the file header (`tokens.css:4-7`): `@antdv-next/tailwind/compat.css` only exports the `--color-ant-*` namespace, whereas the vendored shadcn components are written against bare names — `bg-popover`, `text-muted-foreground`, `border-input`. Tailwind v4 generates utilities only for tokens declared in `@theme`, so a missing declaration is not "the style got overridden" but **the class is never generated at all**; the visible result is popovers with no background, secondary text with no grey and hover with no feedback.

The chain has two links:

| Link | Location | Contents |
| --- | --- | --- |
| Seed variables | `tokens.css:20-50` (`:root`), `:57-86` (`.dark`) | `--app-background` / `--app-foreground` / `--app-card` / `--app-popover` / `--app-primary` / `--app-secondary` / `--app-muted` / `--app-accent` / `--app-destructive` / `--app-border` / `--app-input` / `--app-ring`, plus a whole `--app-sidebar-*` set |
| Tailwind tokens | the `@theme inline` block, `tokens.css:88-117` | maps each `--app-*` onto a `--color-*`, which is what makes `bg-popover`, `text-muted-foreground` and `border-input` exist as classes |

Three decisions here must not be reverted:

- **Values do not read `var(--ant-color-*)`** (the primary color excepted): antd's CSS variables hang off the scoped class generated by `ConfigProvider`, while reka/shadcn popovers portal to `body` (outside `.ant-app`) and would resolve to nothing but a transparent background. Both light and dark value sets are pinned to the root element, so overlays in `body` and content inside the page resolve identically.
- **The primary color is the exception**: the preferences panel rewrites `--ant-color-primary` on `html` live, so `--app-primary` / `--app-ring` / `--app-sidebar-primary` are written as `var(--ant-color-primary, #1677ff)` and must follow it.
- **`@theme inline`, not `@theme`**: inline makes the utility class inline `var(--app-*)`, so the `.dark` overrides apply; the non-inline form `--color-x: var(--app-x)` is evaluated once at `:root` and the dark switch freezes on light values.

Two ways to consume them:

```vue
<template>
  <!-- 1. utility classes (preferred): the token name is the class name -->
  <div class="rounded-lg border border-input bg-popover text-muted-foreground" />

  <!-- 2. reference the variable directly when you need it inside style / as a value -->
  <span class="bg-[var(--app-primary)]" :style="{ color: 'var(--app-foreground)' }" />
</template>
```

The sidebar has its own set (`--app-sidebar-*`): a dark sidebar is a deliberate preference, not dark mode, so its values must stay independently tunable. In dark mode the neutral colors are translucent overlays (the `.08` / `.12` steps matching antd's `fillTertiary` / `fillSecondary`) rather than pinned hex values — the reasoning is at `tokens.css:52-56`.

How the theme color lands on these variables is covered in [Theming](/en/guide/in-depth/theme).

## How components write styles

The convention is **utilities + `cn()`**, where `cn()` = clsx + tailwind-merge (`packages/shared/src/cn.ts`).

| Goal | How |
| --- | --- |
| Conditional class names / merging an incoming class | `cn('base', cond && 'x', props.class)` |
| Theme colors | bare token names `bg-primary` / `text-muted-foreground`, or the antd bridge `bg-ant-primary` / `bg-[var(--ant-color-primary)]` |
| Small reusable chunks | the shared classes `.icon`, `.outline-box`, `.outline-box-active` (`base.css:53-64`) |
| Transitions / keyframes | only then open a `<style scoped>` |

::: warning Tailwind only understands literal class names

- A class name must be **a complete string as it appears in the source**. Concatenation (`text-${color}-500`), building a step name out of variables, or writing classes in a directory that `@source` does not cover all produce **no CSS and no error**.
- Do not write `cn(...)` in a template attribute with a **trailing comma**; the form used across the component packages is to collapse it into a `computed` in `<script setup>` and let the template reference the variable — that is how every component in `packages/ui-kit/common-ui` does it, which keeps expressions out of the template and keeps the class strings literal.
- Status-to-color mappings go through a **lookup table** (`Record<string, string>` whose values are full class strings), never `cn('text-' + tone)`. See the `STATUS_DOT` / `CIRCLE` / `PRESET` constants in `packages/ui-kit/common-ui/src/components/badge/Badge.vue`, `steps/Steps.vue` and `tag/Tag.vue`. :::

::: warning Do not pad the outer container of a route page. Content padding belongs to the layout; a page that adds its own layer doubles it when the layout shape changes. See [Local development](/en/guide/essentials/development) and [Layout and tabs](/en/guide/in-depth/layout). :::

Do not pin colors. Under dark mode the component library **recomputes the primary color** on `.ant-app`, so overrides belong on the seed variables on `html`, and test assertions must not name concrete color values — a trap this repository has already fallen into; details in [Theming](/en/guide/in-depth/theme).

## stylelint status

The rule package exists (`internal/lint-configs/stylelint-config/index.mjs`: `stylelint-config-standard` + `recess-order`, `order/order`, a BEM-style `selector-class-pattern`, and the Vue `global`/`deep` allow-list) and `vsh lint` calls it (`scripts/vsh/src/lint/index.ts`). But **neither the repository root nor `apps/web` has a `stylelint.config.*` / `.stylelintrc*` file on disk**, and the stylelint step in lefthook is commented out (`lefthook.yml`). In other words: CSS ordering discipline is voluntary today, so do not claim in a PR that "stylelint will catch it".

## Icons

Icons are not part of this package. The Iconify + SVG sprite setup, the collection list, the offline bundles and the steps for adding a collection are covered in [Icons](/en/guide/essentials/icons).

## Related pages

- [Tailwind CSS](/en/guide/project/tailwindcss) — how this package is wired in as the only entry
- [Theming](/en/guide/in-depth/theme) — who writes `--ant-color-primary` / `--app-*`
- [Access control](/en/guide/in-depth/access) — what triggers `permission-disabled` in `permission.css`
- [Examples: shared components](/en/components/common-ui) — how `@antdv/common-ui` consumes these tokens
- [External modules](/en/guide/essentials/external) — why source-published packages (this one included) have no build step
