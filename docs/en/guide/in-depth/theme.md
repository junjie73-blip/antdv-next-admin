# Theme and preferences

In one sentence: **the single source of truth for preferences is `@antdv/preferences`, there is exactly one chain for the primary color, and the visual layer only understands CSS variables.**

## One chain, two outlets

```
User changes the primary color in the settings drawer
        │
        ▼
preferences store (persisted)
        │
        ├──► getAntdTheme() ──► <a-config-provider :theme> ──► antdv-next components
        │
        └──► applyPreferencesToDom() ──► CSS variables on documentElement ──► our own styles
```

antd's tokens only reach the antdv-next components; the styles we **wrote ourselves** for the sidebar, tab pages, login page and NProgress have to go through CSS variables, otherwise you get "the primary color changed, the components changed, the shell didn't". On the DOM side `writeThemeCssVars()` in `packages/utils/src/css-vars.ts` lands three things:

| What lands on `<html>` | Purpose |
| --- | --- |
| `data-theme="…"` | The theme tier. `THEME_PRESETS` (`@antdv/shared/constants`) has 14 entries: `default` uses the base block, the other 13 each ship a complete `--app-*` palette for light and dark in `@antdv/design`'s `token/default.css` / `token/dark.css` |
| `--app-primary` (**custom color only**) | A color picked in the colour picker is in no palette, so it has to be inlined; for a preset this would push the primary back down to its light-mode value even in the dark tier |
| `--ant-color-primary` + `--ant-primary-color` | The bridge for antdv-next components. antd's DOM is still on the page and both names are read, so writing only the new one produces "changed the primary color, the progress bar is still blue" |

## Writing the primary color with Tailwind

The design spec has exactly one set of tokens — shadcn-vue's. `@theme inline` wires `--app-*` into utilities, so accent colors always come from them and always follow the primary color:

```ts
// Accent colors use *-primary; neutral colors must be paired with dark:
cn('bg-primary text-primary-foreground shadow-lg shadow-primary/30');
cn('bg-primary/10 text-primary ring-1 ring-primary/20');
```

::: danger Never write `*-ant-primary` again That family came from antdv-next's Tailwind compatibility layer (`@antdv-next/tailwind/compat.css`), which `@antdv/design` no longer imports — the failure is not "wrong colour", it is **the utility is never generated at all**, so the element ends up with no background and no border. :::

::: warning Don't hardcode blue Hardcoded values like `bg-blue-600`, `text-blue-500` and `#1677ff` look right in light mode and give themselves away when you switch the primary color or enter dark mode. The login page pins this with a contract, `views/login/__tests__/login-styles.spec.ts`: accent colors may only come from the primary tokens. New pages should follow the same rule. (Pre-existing debt: some view files still contain `blue-*` / `#1677ff`, cleaned up progressively.) :::

## Every theme is a complete palette

The 13 `[data-theme]` presets (`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`) each write out all 27 colour tokens on both the light and the dark side — this is not "just a different primary". `background / card / popover / border / foreground / sidebar-*` are all re-valued in that theme's hue, so switching a theme moves the overlay backgrounds, dividers and the sidebar together. `packages/core/base/design/__tests__/design.test.ts` holds the contract: every preset complete, no two presets identical, light and dark genuinely different.

## `colorLink` must be provided together with `colorPrimary`

antd binds `colorLink` to its own `#1677ff` instead of deriving it from `colorPrimary`. If you only override the primary color, `type="link"` buttons, hyperlinks and clickable Typography text all stay untouched — that is the root cause of "changed the theme color, the link buttons are still blue". `getAntdTheme()` sets `colorPrimary` and explicitly provides `colorLink` with it, then leaves `colorLinkHover / colorLinkActive` to the algorithm.

Same reasoning: the **parent of the selected menu item** and the active bar of the horizontal menu must also take their color from CSS variables; changing the token alone is not enough.

## Light, dark and `auto`

`ThemeMode = 'auto' | 'dark' | 'light'`; `auto` resolves the mode that is actually in effect with `matchMedia('(prefers-color-scheme: dark)')` (`resolveThemeMode()`).

::: warning Use the resolved value to ask "is it dark right now" `appStore.themeMode === 'dark'` is **always false** in `auto` mode, even when the system is already dark. Code that branches on light/dark (ECharts colors, the big-screen background) has to read `resolvedTheme`, not `themeMode`. :::

The DOM-side class is added and removed by `applyPreferencesToDom()` (default `dark`, pass `darkClass` to override); Tailwind's `dark:` variant and the dark rules in `@antdv/design` both hang off this class.

## Style presets are registration-based

`ThemeStyle` has 11 values (`default / compact / dark / geek / glass / bootstrap / cartoon / illustration / mui / shadcn / skeuomorphism`); the package does **not** ship all the visual schemes built in, but it leaves an injection point — otherwise the "style" dropdown in the settings panel would be decoration:

```ts
import { registerThemePreset } from '@antdv/preferences';

registerThemePreset('glass', {
  algorithm: undefined, // omit it and the light/dark algorithm carries over
  token: {/* antd token overrides */},
  components: {/* component-level overrides */},
});
```

Only `compact` is built in (antd officially has `compactAlgorithm`); unregistered styles fall back to default safely.

## Corner radius is a multiplier, font size is px

`borderRadius` in preferences stores a multiplier (`0 / 0.25 / 0.5 / 0.75 / 1`, default `0.5`) against the 8px baseline (`BORDER_RADIUS_BASE`). The conversion has two outlets and they share one source: `themeOverridesFrom()` turns the multiplier into px for the antd tokens, `writeThemeCssVars()` writes the same px into `--ant-border-radius` / `--app-border-radius`. Missing one gives "the antd components rounded, our own panels didn't".

`fontSize` stores px directly (default `14`): in `themeOverridesFrom()` a `0`/`NaN` falls back to the 16px baseline so the component tree cannot collapse to zero-size text.

## Accessibility switches

Gray mode and color-weak mode run on CSS filters (`--app-filter` plus an inline `filter`, and the `gray-mode` / `color-weak` classes): inline rather than stylesheet-only, so the switch takes effect immediately even without the stylesheet. Rules for focus visibility, `prefers-reduced-motion` and the like live in `css/a11y.css` in `@antdv/design`.

## The fixed routine for adding a preference switch

1. Add the field to `AppSetting` in `@antdv/types`;
2. Give it a default value in `packages/core/preferences/src/defaults.ts`;
3. If it has to reach the DOM, write the variable / class in `css-vars.ts` and add it to the cleanup list in `clearPreferencesFromDom()` (logout, unmount and test teardown all rely on it — miss one and stale values leak into the next run);
4. Add the control to the settings drawer;
5. Add a unit test asserting "change the preference → the matching variable/class is on the DOM", then click the real switch once end-to-end (e2e).
