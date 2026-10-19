# Theme and preferences

In one sentence: **the single source of truth for preferences is `@antdv/preferences`, there is exactly one chain for the primary color, and the visual layer only understands CSS variables.**

## One chain, two outlets

```
User changes the primary color in the settings drawer
        │
        ▼
preferences store (persisted)
        │
        ├──► getThemeConfig() ──► <ConfigProvider :theme> (from antdv-next) ──► the last antd DOM on the page
        │       └─ only the `@form-create/antd-designer` page still needs it, see apps/web/src/App.vue:8, :67-68
        │
        └──► applyPreferencesToDom() ──► CSS variables on documentElement ──► our own styles
```

Both outlets read the **same preference fields** (`primaryColor / borderRadius / fontSize`), so there is no second chain — the shape a second chain would take is the designer keeping its own palette, and it does not (this is spelled out in the comments at `apps/web/src/App.vue:15-23`). antd's tokens only reach the small slice of antd DOM still on the page (the `@form-create/antd-designer` template, precompiled, resolved through global registration); the styles we **wrote ourselves** for the sidebar, tab pages, login page and NProgress have to go through CSS variables, otherwise you get "the primary color changed, the components changed, the shell didn't". On the DOM side `applyPreferencesToDom()` in `packages/core/preferences/src/update-css-variables.ts` (`:37`) — with its internal `writeThemeCssVars()` (`:85`) — is what lands the writes. The variable allow-list lives in `packages/core/base/shared/src/constants/css-vars.ts` (`PREFERENCE_CSS_VARS`):

| What lands on `<html>` | Purpose |
| --- | --- |
| `class` `dark` / `color-weak` / `gray-mode` + `style.colorScheme` | Light/dark and accessibility switches. Miss `colorScheme` and you get "the page is dark, the scrollbar is still white" |
| `data-theme="…"` | The theme tier. `THEME_PRESETS` (`@antdv/shared/constants`) has 14 entries: `default` uses the base block, the other 13 each ship a complete `--app-*` palette for light and dark in `@antdv/design`'s `token/default.css` / `token/dark.css` |
| `--app-primary` (**custom colour only**) | A colour picked in the colour picker is in no palette, so it has to be inlined; for a preset this would push the primary back down to its light-mode value even in the dark tier (`css-vars.ts:23-27`) |
| `--app-border-radius` / `--app-font-size` / `--app-filter` | Radius multiplier folded into px, body px folded into a root-font-size percentage, and the colour-weak/gray filter chain |

::: warning The four `--ant-*` bridges are gone. `--ant-color-primary`, `--ant-primary-color`, `--ant-border-radius` and friends used to be the bridge for the antd components on the page; once antd's DOM left, they became "a few unread declarations every theme change writes". They were removed with the allow-list (`css-vars.ts:9-11` records the rule: **only names with a live reader belong here**). The contract test `packages/core/preferences/__tests__/update-css-variables.test.ts:74-75` pins the other direction — the inline style must not carry these names. :::

## Writing the primary color with Tailwind

The design spec has exactly one set of tokens — shadcn-vue's. `@theme inline` wires `--app-*` into utilities, so accent colors always come from them and always follow the primary color:

```ts
// Accent colors use *-primary; neutral colors must be paired with dark:
cn('bg-primary text-primary-foreground shadow-lg shadow-primary/30');
cn('bg-primary/10 text-primary ring-1 ring-primary/20');
```

::: danger Never write `*-ant-primary` again That family came from antdv-next's Tailwind compatibility layer (`@antdv-next/tailwind/compat.css`), which `@antdv/design` no longer imports — the failure is not "wrong colour", it is **the utility is never generated at all**, so the element ends up with no background and no border. No package depends on `@antdv-next/tailwind` any more (the catalog entry `^1.1.2` is still at `pnpm-workspace.yaml:24`, but there are zero importers), and tests pin it: `design.test.ts:399-411` asserts the token source never mentions `--ant-` or `-ant-[a-z]`, `:527` asserts the dependency list must not include `@antdv-next/tailwind`. :::

::: warning Don't hardcode blue Hardcoded values like `bg-blue-600`, `text-blue-500` and `#1677ff` look right in light mode and give themselves away when you switch the primary color or enter dark mode. New pages should take accent colours only from the primary tokens. (Pre-existing debt: some view files still contain `blue-*` / `#1677ff`, cleaned up progressively; the old `views/login/__tests__/login-styles.spec.ts` contract was removed once the login page moved onto `@antdv/shadcn-ui`.) :::

## Every theme is a complete palette

The 13 `[data-theme]` presets (`violet / pink / rose / sky-blue / deep-blue / green / deep-green / orange / yellow / zinc / neutral / slate / gray`) each write out all 27 colour tokens on both the light and the dark side — this is not "just a different primary". `background / card / popover / border / foreground / sidebar-*` are all re-valued in that theme's hue, so switching a theme moves the overlay backgrounds, dividers and the sidebar together. `packages/core/base/design/__tests__/design.test.ts` holds the contract: every preset complete, no two presets identical, light and dark genuinely different.

## `colorLink` must be provided together with `colorPrimary`

antd binds `colorLink` to its own `#1677ff` instead of deriving it from `colorPrimary`. If you only override the primary color, `type="link"` buttons, hyperlinks and clickable Typography text all stay untouched — that is the root cause of "changed the theme color, the link buttons are still blue". `getAntdTheme()` sets `colorPrimary` and explicitly provides `colorLink` with it, then leaves `colorLinkHover / colorLinkActive` to the algorithm.

Same reasoning: the **parent of the selected menu item** and the active bar of the horizontal menu must also take their color from CSS variables; changing the token alone is not enough.

## Light, dark and `auto`

`ThemeMode = 'auto' | 'dark' | 'light'`. The system side is subscribed by `createSystemDark()` on `matchMedia('(prefers-color-scheme: dark)')` (SSR / legacy browsers without support stay light, `packages/utils/src/theme-mode.ts:43`), then `resolveThemeMode(mode, isSystemDark)` (`:14`) collapses `auto` into the mode that is actually in effect. Both functions come out of `@antdv/utils` and `~/settings` re-exports them.

::: warning Use the resolved value to ask "is it dark right now" `appStore.themeMode === 'dark'` is **always false** in `auto` mode, even when the system is already dark. Code that branches on light/dark (ECharts colors, the big-screen background) has to read `resolvedTheme`, not `themeMode`. :::

The DOM-side class is added and removed by `applyPreferencesToDom()` (default `dark`, pass `darkClass` to override); Tailwind's `dark:` variant and the dark rules in `@antdv/design` both hang off this class.

## Style presets are registration-based

`ThemeStyle` has 11 values (`default / compact / dark / geek / glass / bootstrap / cartoon / illustration / mui / shadcn / skeuomorphism`, `packages/core/base/typings/src/app.ts:68-78`); antd's side does **not** ship all the visual schemes built in, but leaves an injection point — otherwise the "style" dropdown in the settings panel would be decoration. Note that this registry lives in the **app**, not in `@antdv/preferences`: `apps/web/src/settings/theme/index.ts:57`, exported through `~/settings`.

```ts
import { registerThemePreset } from '~/settings';

registerThemePreset('glass', {
  algorithm: undefined, // omit it and the light/dark algorithm carries over
  token: {/* antd token overrides */},
  components: {/* component-level overrides */},
});
```

Only `compact` is built in (`getAntdTheme()` composes `[baseAlgorithm, theme.compactAlgorithm]`, same file `:90-96`); an unregistered style gets no preset, and when `preset` is `undefined` the code falls back safely to the light/dark algorithm plus the base token table. Today the only real caller of `registerThemePreset()` is `apps/web/src/settings/__tests__/antd-theme.test.ts:89` — the injection point exists, no third-party style uses it yet.

## Corner radius is a multiplier, font size is px

`borderRadius` in preferences stores a multiplier (`0 / 0.25 / 0.5 / 0.75 / 1`, default `1`, see `DEFAULT_PREFERENCES` in `packages/core/preferences/src/config.ts`) against the 8px baseline (`BORDER_RADIUS_BASE`, the `--radius-lg` tier in `@antdv/design`). The conversion has two outlets sharing one source: `themeOverridesFrom()` turns the multiplier into px for the antd tokens (`settings/theme/index.ts:125`), and `writeThemeCssVars()` writes the same px into `--app-border-radius`. Tailwind's `rounded-*` only reads the `--radius-*` table, so this variable is the one exception — it lives in the `--radius-*` namespace, not the colour namespace (see the comment and case at `design.test.ts:123-133`).

`fontSize` stores px directly (default `14`): in `themeOverridesFrom()` a `0`/`NaN` falls back to the 16px baseline so the component tree cannot collapse to zero-size text. On the CSS side what gets written is not px but a root-font-size percentage (`--app-font-size`) — body text uses `text-sm` = 0.875rem, and writing px there would shrink every rem-based size along with it.

## Accessibility switches

Gray mode and color-weak mode run on CSS filters (`--app-filter` plus an inline `filter`, and the `gray-mode` / `color-weak` classes): inline rather than stylesheet-only, so the switch takes effect immediately even without the stylesheet. Rules for focus visibility, `prefers-reduced-motion` and the like live in `css/a11y.css` in `@antdv/design`.

## The fixed routine for adding a preference switch

1. Add the field to `AppSetting` in `@antdv/types` (`packages/core/base/typings/src/app.ts`);
2. Give it a default value in `DEFAULT_PREFERENCES` at `packages/core/preferences/src/config.ts`;
3. If it has to reach the DOM, write the variable / class in `update-css-variables.ts` and add the name to `css-vars.ts` in `@antdv/shared/constants` (`PREFERENCE_CSS_VARS` is the cleanup list `clearPreferencesFromDom()` walks — logout, unmount and test teardown all rely on it; miss one and stale values leak into the next run);
4. Add the control to the settings drawer;
5. Add a unit test asserting "change the preference → the matching variable/class is on the DOM", then click the real switch once end-to-end (e2e).
