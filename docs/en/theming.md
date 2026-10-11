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

antd's tokens only reach the antdv-next components; the styles we **wrote ourselves** for the sidebar,
tab pages, login page and NProgress have to go through CSS variables, otherwise you get "the primary color
changed, the components changed, the shell didn't". So `writeThemeCssVars()` writes two names at once:

| Variable | Who uses it |
| --- | --- |
| `--ant-color-primary` | The name injected by the antdv-next runtime (39 usages in this project); Tailwind's `*-ant-primary` also points at it |
| `--ant-primary-color` | The old name; the progress bar, NProgress and a few other places still read it |

Writing both is deliberate — writing only the new one produces half-updates like "changed the primary color, the progress bar is still blue".

## Writing the primary color with Tailwind

`@antdv-next/tailwind/compat.css` maps antd's palette onto Tailwind theme variables
(`--color-ant-primary: var(--ant-color-primary)`, plus the whole `-hover / -active / -bg / -border / -text` set),
so the visual layer only has to be written like this and it always follows the primary color:

```ts
// Accent colors always use *-ant-primary; never hardcode a color value
cn('bg-ant-primary text-white shadow-lg shadow-ant-primary/30');
cn('bg-ant-primary/10 text-ant-primary ring-1 ring-ant-primary/20');
```

::: danger Don't hardcode blue
Hardcoded values like `bg-blue-600`, `text-blue-500` and `#1677ff` look right in light mode and give themselves away when you
switch the primary color or enter dark mode. The login page pins this with a contract,
`views/login/__tests__/login-styles.spec.ts`: accent colors may only come from `*-ant-primary` or `var(--ant*)`. New pages should follow the same rule.
(Pre-existing debt: about 38 view files still contain `blue-*` / `#1677ff`, cleaned up progressively.)
:::

## `colorLink` must be provided together with `colorPrimary`

antd binds `colorLink` to its own `#1677ff` instead of deriving it from `colorPrimary`. If you only override the primary color,
`type="link"` buttons, hyperlinks and clickable Typography text all stay untouched — that is the root cause of "changed the theme color,
the link buttons are still blue". `getAntdTheme()` sets `colorPrimary` and explicitly provides `colorLink` with it, then leaves
`colorLinkHover / colorLinkActive` to the algorithm.

Same reasoning: the **parent of the selected menu item** and the active bar of the horizontal menu must also take their color from CSS variables; changing the token alone is not enough.

## Light, dark and `auto`

`ThemeMode = 'auto' | 'dark' | 'light'`; `auto` resolves the mode that is actually in effect with
`matchMedia('(prefers-color-scheme: dark)')` (`resolveThemeMode()`).

::: warning Use the resolved value to ask "is it dark right now"
`appStore.themeMode === 'dark'` is **always false** in `auto` mode, even when the system is already dark.
Code that branches on light/dark (ECharts colors, the big-screen background) has to read `resolvedTheme`, not `themeMode`.
:::

The DOM-side class is added and removed by `applyPreferencesToDom()` (default `dark`, pass `darkClass` to override);
Tailwind's `dark:` variant and the dark rules in `@antdv/styles` both hang off this class.

## Style presets are registration-based

`ThemeStyle` has 11 values (`default / compact / dark / geek / glass / bootstrap / cartoon /
illustration / mui / shadcn / skeuomorphism`); the package does **not** ship all the visual schemes built in, but it
leaves an injection point — otherwise the "style" dropdown in the settings panel would be decoration:

```ts
import { registerThemePreset } from '@antdv/preferences';

registerThemePreset('glass', {
  algorithm: undefined,          // omit it and the light/dark algorithm carries over
  token: { /* antd token overrides */ },
  components: { /* component-level overrides */ },
});
```

Only `compact` is built in (antd officially has `compactAlgorithm`); unregistered styles fall back to default safely.

## Corner radius and font size are multipliers, not px

In preferences `borderRadius` stores a multiplier (`0 / 0.25 / 0.5 / 0.75 / 1`); antd's baseline is 8px and the font baseline is 16px,
and the conversion happens in two places, `getThemeConfig` and `writeThemeCssVars` (both land `--ant-*` into `--app-*`).
That way "storing 0.5" derives a consistent hierarchy under both the dark and light algorithms.

## Accessibility switches

Gray mode and color-weak mode run on CSS filters (`--app-filter` plus an inline `filter`, and the `gray-mode` /
`color-weak` classes): inline rather than stylesheet-only, so the switch takes effect immediately even without the stylesheet.
Rules for focus visibility, `prefers-reduced-motion` and the like live in `a11y.css` in `@antdv/styles`.

## The fixed routine for adding a preference switch

1. Add the field to `AppSetting` in `@antdv/types`;
2. Give it a default value in `packages/preferences/src/defaults.ts`;
3. If it has to reach the DOM, write the variable / class in `css-vars.ts` and add it to the cleanup list in
   `clearPreferencesFromDom()` (logout, unmount and test teardown all rely on it — miss one and stale values leak into the next run);
4. Add the control to the settings drawer;
5. Add a unit test asserting "change the preference → the matching variable/class is on the DOM", then click the real switch once end-to-end (e2e).
