# Styles and icons

Styles have exactly **one path**: Tailwind CSS v4 + antdv-next tokens + a very thin layer of custom CSS. The repo has no SCSS / Less source files, and no second global style entry.

## One file holds the global styles

```
packages/styles/src/index.css      ← the only entry, imported once in apps/web/src/main.ts:43
  ├─ base.css            base resets, shared classes
  ├─ nprogress.css       progress bar
  ├─ a11y.css            accessibility (focus-visible, prefers-reduced-motion)
  ├─ permission.css      permission-related visibility
  └─ scrollbar.css      scrollbar
```

What matters is that **the layer order is declared explicitly** (`packages/styles/src/index.css:18-32`):

```css
@layer theme, base, antd, components, utilities;
@import 'tailwindcss';
@import '@antdv-next/tailwind/compat.css';
@import 'tw-animate-css';
@plugin '@tailwindcss/typography';
@plugin '@tailwindcss/nesting';
@custom-variant dark (&:where(.dark, .dark *));
```

- `antd` is placed in the layer list, so overriding the component library's default styles **needs no `!important`**; the layer order is the precedence.
- The `dark` variant is bound to the `.dark` class (written on `html` by the preferences), not to a media query — so under `theme: 'auto'` Tailwind and antd see the same result.
- `apps/web` keeps no `global.css` of its own; the reason is in the comment at `main.ts:39-43`: global styles belong to `@antdv/styles`.

Tailwind is wired in through `@tailwindcss/vite` (`internal/vite-config/src/plugins/vue.ts:48`), with the version taken from the catalog (`^4.3.3`).

## Writing styles in components

The convention is **utilities + `cn()`**, where `cn()` = clsx + tailwind-merge (`packages/shared/src/cn.ts:1-7`, and 106 `.vue` files import it).

```vue
<template>
  <div
    class="flex items-center gap-2 rounded-lg bg-[var(--ant-color-primary)]"
  />
</template>
```

| What you want to do | How | Basis |
| --- | --- | --- |
| conditional class names / merging an incoming class | `cn('base', cond && 'x', props.class)` | `packages/shared/src/cn.ts` |
| use the theme color | `bg-ant-primary` (the compat bridge) or `bg-[var(--ant-color-primary)]` | `packages/styles/src/base.css:9`, `layouts/components/LayoutNavRail.vue:115` |
| small reusable pieces of styling | the shared classes `.icon`, `.outline-box` | `packages/styles/src/base.css:53-64` |
| transitions / keyframes | only then open a `<style scoped>` | 19 of the 153 `.vue` files do this, e.g. `LayoutSidebar.vue:340` |

::: warning No padding on the outer container of a route page The content area's inner padding is the layout's job. A page that adds its own padding gets it doubled when the layout form changes. See [Development conventions and environment variables](/en/guide/essentials/development) and [Layout, menu, and tab pages](/en/guide/in-depth/layout). :::

Don't pin colors down. In dark mode antdv-next **recomputes the primary color** on `.ant-app`, so override values belong on the seed variables on `html`, and assertions should not name a concrete color either — this is a testing pit this repo has already hit, details in [Theme and preferences](/en/guide/in-depth/theme).

### stylelint status

The rules package exists (`internal/lint-configs/stylelint-config/index.mjs`: `stylelint-config-standard` + `recess-order`, `order/order` `:83-104`, a BEM-style `selector-class-pattern` `:144-145`, a `global`/`deep` allow-list for Vue `:15-28`), and `vsh lint` calls it (`scripts/vsh/src/lint/index.ts:122,131`). But **there is no `stylelint.config.*` / `.stylelintrc*` file on disk under the root or `apps/web`**, and the stylelint step in lefthook is commented out (`lefthook.yml:16-18`). In other words: CSS ordering rules currently rely on self-discipline, so don't claim in a PR that "stylelint will catch it".

## Icons: Iconify first, sprite second

### Iconify (the default choice)

Five collections are bundled offline so the runtime never touches the network: `carbon`, `ant-design`, `lucide`, `fa6-regular`, `mdi` (`internal/vite-config/src/plugins/auto-import.ts:55-57`, dependencies at `apps/web/package.json:46,131-134` and `packages/icons/package.json:28-32`).

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue';
</script>

<template>
  <Icon icon="carbon:search" class="text-lg" />
</template>
<!-- apps/web/src/layouts/widgets/WidgetSearch.vue:2,17 -->
```

`<Icon>` / `<IconifyIcon>` / `<SvgIcon>` all require an **explicit import** — the component resolvers were withdrawn (`auto-import.ts:12-25` records why), and a page that omits the import is left with an empty tag plus one runtime warning. `IconifyIcon` is the `@antdv/icons` wrapper (`packages/icons/src/icon/IconifyIcon.vue:8,50-62`).

::: tip Only these five prefixes are allowed A new collection means changing the catalog dependency and the offline list in `auto-import.ts` at the same time; otherwise the build passes while the production bundle **carries no data for those icons**, which shows up in production as empty squares. :::

### SVG sprite

`vite-plugin-svg-icons` points at `apps/web/src/assets/icons` with `symbolId: 'icon-[name]'` (`internal/vite-config/src/plugins/svg-icons.ts:7-12`), registered in `plugins/index.ts:70`, active at runtime through the `import 'virtual:svg-icons-register'` in `main.ts:38`, and consumed by `packages/icons/src/icon/SvgIcon.vue` (`:41`, `<use xlink:href="#icon-xxx">`).

**`src/assets/icons` is an empty directory right now**, meaning the sprite path is wired up but no custom icon uses it. Take this road only when you need brand artwork / multicolor icons (Iconify's multicolor support is poor).

### Icon picker and menu integration

`IconPicker` searches with pagination across the five prefixes (`packages/icons/src/icon/IconPicker.vue:53-86`), and it is what the `icon` field of the menu management page uses (`views/system/menu/index.vue:8,898`). Places that consume `meta.icon`: the sidebar and the icon rail (`packages/ui-kit/layout-ui/src/components/LayoutNavRail.vue:93`), tab pages (`apps/web/src/layouts/composables/useTabs.ts`), the breadcrumb (`packages/layouts/src/breadcrumb.ts:42,62,111`). The tab action buttons moved to `@antdv/tabs-ui` and their icons go through `IconifyIcon` (`packages/ui-kit/tabs-ui/src/components/TabActions.vue:6`), no longer straight from `@antdv-next/icons`.

## The shared UI packages (`@antdv/icons` + `@antdv/ui-kit/*`)

What used to be one `@antdv/ui` is now split by responsibility into independent sub-packages, each with its own barrel and its own dependencies — whoever needs it imports it:

| Package | Contents | Entry |
| --- | --- | --- |
| `@antdv/icons` | `IconifyIcon` / `IconPicker` / `SvgIcon`, plus `createIconInstaller()` | `packages/icons/src/index.ts` and the `./icon` subpath |
| `@antdv/loading-ui` | `Loading.vue`, `useLoading`, `createContainerLoading` / `createFullscreenLoading` / `createLoading` and the `vLoading` directive | `packages/ui-kit/loading-ui/src/index.ts` |
| `@antdv/scrollbar-ui` | `Scrollbar` plus the self-drawn `Bar`; styles travel with the component (no host Tailwind) | `packages/ui-kit/scrollbar-ui/src/index.ts` |
| `@antdv/shadcn-ui` | the shadcn-vue atoms (`Popover` / `Dialog` / `Select` / `Input`…) that the three packages above are built on | `packages/ui-kit/shadcn-ui/src/index.ts` |
| `@antdv/{form,table,popup,layout,menu,tabs}-ui` | forms / tables / modal & drawer / layout shell / menu / tabs | each `src/index.ts` |

- The app **imports the named exports explicitly** (`import { Scrollbar } from '@antdv/scrollbar-ui'`, `import { vLoading } from '@antdv/loading-ui'` (`main.ts:8`), `import { IconPicker } from '@antdv/icons/icon'`), which keeps tree-shaking.
- `createIconInstaller()` is **never called** in the app — it serves external consumers that want the icon components registered globally.
