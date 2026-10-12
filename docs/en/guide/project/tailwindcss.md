# Tailwind CSS

In one sentence: **Tailwind v4, CSS-first — there is no `tailwind.config.*` anywhere in the repo; the entry is `packages/styles/src/index.css`, compiled by `@tailwindcss/vite`, and every theme color flows through antd CSS variables instead of hardcoded palettes.**

## Versions and wiring

| Item | Value | Evidence |
| --- | --- | --- |
| Tailwind | `^4.3.3` (catalog) | `pnpm-workspace.yaml` |
| Vite plugin | `@tailwindcss/vite ^4.3.3`, registered as `tailwindcss()` in `internal/vite-config/src/plugins/vue.ts` | shared plugin assembly for apps and libraries |
| Animations | `tw-animate-css ^1.4.0` (**not** the v3-era tailwindcss-animate) | catalog + `@import 'tw-animate-css'` |
| Plugins | `@plugin "@tailwindcss/typography"`, `@plugin "@tailwindcss/nesting"` | `index.css` |
| Entry | one line in `main.ts`: `import '@antdv/styles'` — the only global stylesheet | no app-side global.css anymore |

## The three key things in the entry CSS

```css
@layer theme, base, antd, components, utilities; /* explicit layer order */
@import 'tailwindcss';
@import '@antdv-next/tailwind/compat.css'; /* antd palette → Tailwind theme vars */
@import 'tw-animate-css';
@custom-variant dark (&:where(.dark, .dark *)); /* dark mode: class strategy */
```

- **The layer order is deliberate**: `utilities` comes last so template utility classes can override `components`-layer rules (the hand-drawn Scrollbar and layout shell rely on it). The `antd` slot is a reserved placeholder — antdv-next's own styles are injected at runtime by cssinjs and never land in these layers.
- `@custom-variant dark` binds `dark:` to the `.dark` class, which `applyPreferencesToDom()` from `@antdv/preferences` toggles (`themeMode: auto` is first resolved through `matchMedia`). **Dark mode is not the media strategy** — otherwise the settings-drawer switch would be dead. Full theming chain: [Theming & preferences](/en/guide/in-depth/theme).

## Coexisting with antdv-next

antd styles come from the `@antdv-next/cssinjs` runtime (`StyleProvider` in App.vue plus `autoPrefixTransformer / px2remTransformer`); **no static antd CSS is ever imported**, so the classic "preflight wipes component styles" conflict doesn't exist here. antd components carry their own cssinjs specificity; to override them from utilities you go through `:deep()` — the fourth priority in `CODE_STANDARD.md` section 7.

**Colors have exactly one path**: `@antdv-next/tailwind/compat.css` maps antd tokens to Tailwind variables (`--color-ant-primary: var(--ant-color-primary)`, plus the full hover/active/bg/border/text family), so:

```ts
cn('bg-ant-primary text-white shadow-ant-primary/30'); // always follows the primary color
```

The login page pins this as a source contract: `views/login/__tests__/login-styles.spec.ts` asserts accent colors may only come from `*-ant-primary` or `var(--ant*)`. Hardcoded `bg-blue-600` / `#1677ff` breaks on primary change or dark mode (roughly 38 view files still carry legacy hardcoded blues — known debt, same warning as the theme page).

## Responsive rules and house style

- Use the default `sm/md/lg/xl` breakpoints. The login page's brand/form split is pure utility classes (`views/login/index.vue` is the reference: the `data-auth="brand"` section hides on narrow screens, the logo collapses into the card).
- Anything over one line or conditionally combined goes through `cn()` (`packages/shared/src/cn.ts` — clsx + tailwind-merge; twMerge guarantees "the later conflicting class wins", which is what makes `setProps` able to override style classes in the register-props components).
- Long class strings are extracted into the module's `constants.ts` (`CODE_STANDARD.md` 7.2); templates only reference the variable.
- The rare raw-CSS cases (view transitions, `::selection`) live in `packages/styles/src/base.css` **outside any @layer** — unlayered rules outrank every layer, so `html/body` sizing can't be accidentally overridden by utilities.

## Common mistakes

| Symptom | Cause |
| --- | --- |
| `dark:` stops working on a new page | Code checks `themeMode === 'dark'` while the setting is `auto`; read `resolvedTheme` (see the theme page) |
| A class isn't generated, styles "vanish randomly" | v4 scans sources on demand; a new directory got ignored or the dev CSS cache is stale — restart dev and confirm the file is under the scan root |
| Primary color changes but Tailwind colors don't | Page used a dead color value; switch to the `*-ant-primary` family |
| You wrote a `tailwind.config.ts` and nothing happened | The project is CSS-first — configure through `@theme/@plugin` in the entry; real tokens belong in the styles package, not a v3-style config file |

## Related pages

- Theme variables and preference persistence: [Theming & preferences](/en/guide/in-depth/theme)
- The four-level style precedence: [Styles](/en/guide/essentials/styles)
