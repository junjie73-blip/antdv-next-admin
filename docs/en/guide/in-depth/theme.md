# Theme and preferences

In one sentence: **the single source of truth for preferences is `@antdv/preferences`, there is exactly one chain for the primary color, and the visual layer only understands CSS variables.**

## One chain, one outlet

```
User changes the primary color in the settings drawer
        │
        ▼
preferences store (persisted)
        │
        └──► applyPreferencesToDom() ──► CSS variables on documentElement ──► component and shell styles
```

There is exactly one outlet, reading the **same preference fields** (`primaryColor / borderRadius / fontSize`); components and the shell share those variables, so no second chain exists (`apps/web/src/App.vue:37` says as much in its comments — historically the other half-chain was the antd `<ConfigProvider :theme>` token object, which kept its own JS copy of `colorPrimary` and produced "changed the primary color, the progress bar is still blue"; it was deleted with the dependency). The styles we **wrote ourselves** for the sidebar, tab pages, login page and NProgress have to go through CSS variables, otherwise you get "the primary color changed, the components changed, the shell didn't". On the DOM side `applyPreferencesToDom()` in `packages/core/preferences/src/update-css-variables.ts` (`:39`) — with its internal `writeThemeCssVars()` (`:87`) — is what lands the writes. The variable allow-list lives in `packages/core/base/shared/src/constants/css-vars.ts` (`PREFERENCE_CSS_VARS`):

| What lands on `<html>` | Purpose |
| --- | --- |
| `class` `dark` / `color-weak` / `gray-mode` + `style.colorScheme` | Light/dark and accessibility switches. Miss `colorScheme` and you get "the page is dark, the scrollbar is still white" |
| `data-theme="…"` | The theme tier. `THEME_PRESETS` (`@antdv/shared/constants`) has 14 entries: `default` uses the base block, the other 13 each ship a complete `--*` palette for light and dark in `@antdv/design`'s `token/default.css` / `token/dark.css` |
| `--primary` (**custom colour only**) | A colour picked in the colour picker is in no palette, so it has to be inlined; for a preset this would push the primary back down to its light-mode value even in the dark tier (`css-vars.ts:33-5`). The value is an **HSL channel triplet** (`215.02 100% 54.31%`) produced by `convertToHslCssVar()` |
| `--radius` / `--font-size` / `--filter` | Radius multiplier folded into **rem** (`radiusToRem()` is the single px→rem outlet; px radii are banned), body px folded into a root-font-size percentage, and the colour-weak/gray filter chain |

::: warning

The four `--ant-*` bridges are gone. `--ant-color-primary`, `--ant-primary-color`, `--ant-border-radius` and friends used to be the bridge for the antd components on the page; once antd's DOM left, they became "a few unread declarations every theme change writes". They were removed with the allow-list (`css-vars.ts:17` records the rule: **only names with a live reader belong here**). The contract test `packages/core/preferences/__tests__/update-css-variables.test.ts:80-82` pins the other direction — the inline style must not carry these names. :::

## Writing the primary color with Tailwind

The design spec has exactly one set of tokens — shadcn-vue's. `@theme inline` wires `--*` into utilities, so accent colors always come from them and always follow the primary color:

```ts
// Accent colors use *-primary; neutral colors must be paired with dark:
cn('bg-primary text-primary-foreground shadow-lg shadow-primary/30');
cn('bg-primary/10 text-primary ring-1 ring-primary/20');
```

::: danger

Never write `*-ant-primary` again That family came from antdv-next's Tailwind compatibility layer (`@antdv-next/tailwind/compat.css`), which `@antdv/design` no longer imports — the failure is not "wrong colour", it is **the utility is never generated at all**, so the element ends up with no background and no border. No package depends on `@antdv-next/tailwind` any more (the catalog entry `^1.1.2` is still at `pnpm-workspace.yaml:24`, but there are zero importers), and tests pin it: `design.test.ts:399-405` asserts the token source never mentions `--ant-` or `-ant-[a-z]`, `:527` asserts the dependency list must not include `@antdv-next/tailwind`. :::

::: warning

Don't hardcode blue Hardcoded values like `bg-blue-600`, `text-blue-500` and `#1677ff` look right in light mode and give themselves away when you switch the primary color or enter dark mode. New pages should take accent colours only from the primary tokens. (Pre-existing debt: some view files still contain `blue-*` / `#1677ff`, cleaned up progressively; the old `views/login/__tests__/login-styles.spec.ts` contract was removed once the login page moved onto `@antdv/shadcn-ui`.) :::

## Every theme is a complete palette

The 13 `[data-theme]` presets (`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`) each write out all 27 colour tokens on both the light and the dark side — this is not "just a different primary". `background / card / popover / border / foreground / sidebar-*` are all re-valued in that theme's hue, so switching a theme moves the overlay backgrounds, dividers and the sidebar together. `packages/core/base/design/__tests__/design.test.ts` holds the contract: every preset complete, no two presets identical, light and dark genuinely different.

## Accent colour has exactly one chain: semantic tokens

"Changed the theme colour, one spot is still blue" used to have three sources: `colorLink` pinned to `#1677ff` instead of deriving from the seed colour, the menu **ancestor of the selected item** carrying its own hard-coded value, and the timezone widget's selected row shipping a blue of its own. Once antd's theme algorithm left the repo, all three read the semantic tokens — `text-primary` / `bg-primary` — which `@theme inline` expands into `hsl(var(--primary))`, so the browser has one source left to resolve.

`apps/web/e2e/theme-primary.spec.ts` samples those places: the CSS variable (resolved through a probe element), the selected ancestor, and the link button in the row actions. They must all move together, and the test also pins that they were _not_ that colour beforehand.

## Light, dark and `auto`

`ThemeMode = 'auto' | 'dark' | 'light'`. The system side is subscribed by `createSystemDark()` on `matchMedia('(prefers-color-scheme: dark)')` (SSR / legacy browsers without support stay light, `packages/utils/src/theme-mode.ts:43`), then `resolveThemeMode(mode, isSystemDark)` (`:14`) collapses `auto` into the mode that is actually in effect. Both functions come out of `@antdv/utils` and `~/settings` re-exports them.

::: warning

Use the resolved value to ask "is it dark right now" `appStore.themeMode === 'dark'` is **always false** in `auto` mode, even when the system is already dark. Code that branches on light/dark (ECharts colors, the big-screen background) has to read `resolvedTheme`, not `themeMode`. :::

The DOM-side class is added and removed by `applyPreferencesToDom()` (default `dark`, pass `darkClass` to override); Tailwind's `dark:` variant and the dark rules in `@antdv/design` both hang off this class.

## Only one `ThemeStyle` value still has a reader

The type still lists 11 values (`default / compact / dark / geek / glass / bootstrap / cartoon / illustration / mui / shadcn / skeuomorphism`, `packages/core/base/typings/src/app.ts:68-79`), but the "style → antd ThemeConfig" registry retired together with the dependency: there is no `registerThemePreset()` and no `<ConfigProvider :theme>`, so preferences reach the DOM through one chain only. Today just `geek` is read — the tab bar folds it into `tone.geek` (`packages/layouts/src/basic/layout.vue:88`). The remaining values exist so already-persisted preferences still parse; picking one neither throws nor changes the look.

## Corner radius is a multiplier, font size is px

`borderRadius` in preferences stores a multiplier (`0 / 0.25 / 0.5 / 0.75 / 1`, default `1`, see `DEFAULT_PREFERENCES` in `packages/core/preferences/src/config.ts`) against the 16px baseline (`BORDER_RADIUS_BASE`). One outlet converts it: `writeThemeCssVars()` multiplies the baseline and hands the result to `radiusToRem()` (`@antdv/shared/utils/radius`), writing the rem string into `--radius` — the default tier is `1rem`. **No px radius is allowed anywhere** — when a component needs an absolute value (`ConfigProvider`'s `theme.radius`, `BorderBeam`'s `radius`, the lock-screen card) it goes through the same `radiusToRem()`, so the multiplier, sub-tree overrides and the first-paint snapshot share one unit. Tailwind's `rounded-*` reads the `--radius-*` tiers derived from `--radius`, which is why it is a scale variable rather than a colour one (its value carries no `hsl()`; the scale cases in `design.test.ts` pin that). `fontSize` stores px directly (default `14`): in `themeOverridesFrom()` a `0`/`NaN` falls back to the 16px baseline so the component tree cannot collapse to zero-size text. On the CSS side what gets written is not px but a root-font-size percentage (`--font-size`) — body text uses `text-sm` = 0.875rem, and writing px there would shrink every rem-based size along with it.

## Accessibility switches

Gray mode and color-weak mode run on CSS filters (`--filter` plus an inline `filter`, and the `gray-mode` / `color-weak` classes): inline rather than stylesheet-only, so the switch takes effect immediately even without the stylesheet. Rules for focus visibility, `prefers-reduced-motion` and the like live in `css/a11y.css` in `@antdv/design`.

## The fixed routine for adding a preference switch

1. Add the field to `AppSetting` in `@antdv/types` (`packages/core/base/typings/src/app.ts`);
2. Give it a default value in `DEFAULT_PREFERENCES` at `packages/core/preferences/src/config.ts`;
3. If it has to reach the DOM, write the variable / class in `update-css-variables.ts` and add the name to `css-vars.ts` in `@antdv/shared/constants` (`PREFERENCE_CSS_VARS` is the cleanup list `clearPreferencesFromDom()` walks — logout, unmount and test teardown all rely on it; miss one and stale values leak into the next run);
4. Add the control to the settings drawer;
5. Add a unit test asserting "change the preference → the matching variable/class is on the DOM", then click the real switch once end-to-end (e2e).
