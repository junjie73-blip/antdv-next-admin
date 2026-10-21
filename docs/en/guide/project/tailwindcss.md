# Tailwind CSS

In one sentence: **Tailwind v4, CSS-first — there is no `tailwind.config.*` anywhere in the repo; the entry is `packages/core/base/design/src/index.css`, compiled by `@tailwindcss/vite`, and every theme color flows through the shadcn-vue tokens owned by `@antdv/design` instead of hardcoded palettes.**

## Versions and wiring

| Item | Value | Evidence |
| --- | --- | --- |
| Tailwind | `^4.3.3` (catalog `pnpm-workspace.yaml:198`, `@tailwindcss/vite` at the same level `:57`) | The version is pinned in the catalog only; every consumer writes `catalog:` (`apps/web/package.json:47-49,144`, `internal/vite-config/package.json:35`, `packages/core/base/design/package.json:32-35`) |
| Vite plugin | `@tailwindcss/vite ^4.3.3`, registered as `tailwindcss()` at `internal/vite-config/src/plugins/vue.ts:35` | shared plugin assembly for apps and libraries |
| Animations | `tw-animate-css ^1.4.0` (catalog `:202`; **not** the v3-era tailwindcss-animate) | the `@import 'tw-animate-css'` at `index.css:30` |
| Plugins | `@plugin "@tailwindcss/typography"`, `@plugin "@tailwindcss/nesting"` (`index.css:39-40`) | catalog `:56` / `:55` |
| Entry | one line at `main.ts:43`: `import '@antdv/design'` — the only global stylesheet | the app keeps no global.css; `@antdv/design`'s `main` _is_ `src/index.css` |

## The three key things in the entry CSS

```css
@layer theme, base, components, utilities; /* :27 explicit layer order */
@import 'tailwindcss'; /* :29 */
@import 'tw-animate-css'; /* :30 */
@import './token/index.css'; /* :31 shadcn-vue tokens → --color-* */
@import './css/base.css'; /* :32-36 base / nprogress / a11y / permission / scrollbar */
@plugin "@tailwindcss/typography"; /* :39-40 */
@source '../../../ui-kit/common-ui/src'; /* :47-56 the ten package scan paths */
@custom-variant dark (&:where(.dark, .dark *)); /* :58 dark mode: class strategy */
```

- **The layer order is deliberate**: `utilities` comes last so template utility classes can override `components`-layer rules (the hand-drawn Scrollbar and layout shell rely on it).
- `@source` (`:47-56`, ten entries) has to register every component package that ships utility classes: v4's content detection scans down from the **build root** (`apps/web`), while `@antdv/*` all live under the repo-root `packages/` (symlinked into `node_modules`, also outside detection). A missing entry shows up as "the component rendered but has no styles" — and no error. `__tests__/design.test.ts:628-660` reverse-checks the list against the ui-kit directory listing, so a forgotten registration turns that test red first.
- `@custom-variant dark` (`:58`) binds `dark:` to the `.dark` class, which `applyPreferencesToDom()` (`packages/core/preferences/src/update-css-variables.ts:39`) toggles (`theme: 'auto'` is first resolved through `matchMedia`). **Dark mode is not the media strategy** — otherwise the settings-drawer switch would be dead. Full theming chain: [Theming & preferences](/en/guide/in-depth/theme).

## One style pipeline

The antd runtime styling (`@antdv-next/cssinjs`'s `StyleProvider` + `autoPrefixTransformer / px2remTransformer`) is gone along with the dependency. `App.vue` now mounts only `ConfigProvider` from `@antdv/common-ui` (`apps/web/src/App.vue:48-51`) plus two `Toaster`s (`:60-70`); no component library appends styles to the end of `<head>` at runtime, so the classic "preflight wipes component-library styles" conflict does not exist here, and there is no "whoever injected last wins" ordering problem either.

`:deep()` therefore has exactly one legitimate use left: reaching _inside_ a third-party component's DOM (third priority in `CODE_STANDARD.md:169-174`; `<style scoped>` is the fourth). Three files in the whole repo use it — `markdown-editor/MarkdownEditor.vue` (tiptap's `ProseMirror`), `micro-app-container/MicroAppContainer.vue` (the micro-app custom element) and `apps/web/src/views/components/drag-layout/index.vue` (the splitter bar). To style your own component, go back to utility classes instead of treating `:deep()` as a side door.

**Colors have exactly one path**: `token/index.css:30-82` maps this package's own `--*` variables onto Tailwind tokens through `@theme inline` — the values are `hsl(var(--x))` (`:31-49` the 19 base semantic colors + `:51-58` the 8 sidebar ones = 27, plus `:61-63` the three status colors `success/warning/info`), so:

```ts
cn('bg-primary text-primary-foreground shadow-primary/30'); // always follows the primary color
```

The scale tokens come from the same block: `:75-81` takes `--radius` as the `lg` step and derives `--radius-xs … --radius-3xl` with the ratios `0.25 / 0.5 / 0.75 / 1 / 1.5 / 2 / 3`. The base is pinned at **1rem** (`token/default.css:75`, `token/dark.css:51` — not the official boilerplate's `0.5rem`), and every step is a multiplication rather than `calc(- 4px)`: a subtraction step yields a negative radius at step 0, the browser drops that declaration, and "no rounding" stops being clean. **Radii are always rem, never px** — the preference slider is converted by `radiusToRem()` (`packages/core/base/shared/src/utils/radius.ts:13`, written at `update-css-variables.ts:106`), so radii scale together with `--font-size`.

::: danger

Don't use `*-ant-primary`. That family comes from antdv-next's Tailwind compatibility layer (`@antdv-next/tailwind/compat.css`), which was removed from the dependencies long ago (guard: `packages/core/base/design/__tests__/design.test.ts:585-588`), and this package's own CSS may not even contain the string `-ant-` (`:459-465`). The failure is not a wrong colour — it is **the utility never being generated at all**, silently. :::

Hardcoded `bg-blue-600` / `#1677ff` breaks on primary change or dark mode. The contract that used to pin this — `views/login/__tests__/login-styles.spec.ts` — was deleted when the login page was rebuilt, so the rule is a convention only now (searching `apps/web/src/views` for `bg-blue-*` / `text-blue-*` / `#1677ff` still hits 98 lines across 33 files — known debt being cleared incrementally, same warning as the theme page).

## Responsive rules and house style

- Use the default `sm/md/lg/xl` breakpoints. The login page's brand/form split is pure utility classes. `packages/core/ui-kit/common-ui/src/components/auth/AuthPageLayout.vue` is the reference: the brand column is `hidden` + `lg:flex` (`:101`) and disappears entirely on narrow screens, the form column swaps width via `lg:w-[54%]` (`:192`), and the logo sits in an `absolute` header at the top-left (`:46-48`) at every width. `views/login/index.vue` only passes props and slots and writes no breakpoints.
- Anything over one line or conditionally combined goes through `cn()` (`packages/core/base/shared/src/utils/cn.ts:6-8`, literally `twMerge(clsx(inputs))`; twMerge guarantees "the later conflicting class wins", which is what makes `setProps` able to override style classes in the register-props components).
- Long class strings are extracted into the module's `constants.ts` (`CODE_STANDARD.md:176-188`, rule 7.2); templates only reference the variable.
- The rare raw-CSS cases (default border colour, `::selection`, view transitions) live in `packages/core/base/design/src/css/base.css`. Only the border fallback at `:17-23` _must_ stay inside `@layer base` — outside it, it would crush the border colours of utilities like `border-gray-700`. Everything else deliberately stays unlayered: unlayered rules outrank every layer, so `html/body` sizing cannot be accidentally overridden by utilities. The reasoning is in the file header, `:4-7`.

## Common mistakes

| Symptom | Cause |
| --- | --- |
| `dark:` stops working on a new page | Code checks `themeMode === 'dark'` while the setting is `auto`; read `resolvedTheme` (see the theme page) |
| A class isn't generated, styles "vanish randomly" | v4 scans sources on demand; a new directory got ignored or the dev CSS cache is stale — restart dev and confirm the file is under the scan root |
| Primary color changes but Tailwind colors don't | Page used a dead color value; switch to this package's `*-primary` / `*-muted` tokens |
| `*-ant-primary` does nothing | Those utilities need antdv-next's Tailwind compatibility layer, which is no longer a dependency (`design.test.ts:585-588` pins it); use this package's tokens |
| `:deep()` used to style your own component | `:deep()` is reserved for third-party internals (third priority, `CODE_STANDARD.md:169-174`); your own components go back to utility classes or `cn()` |
| You wrote a `tailwind.config.ts` and nothing happened | The project is CSS-first — configure through `@theme/@plugin` in the entry; real tokens belong in the styles package, not a v3-style config file |

## Related pages

- Theme variables and preference persistence: [Theming & preferences](/en/guide/in-depth/theme)
- The four-level style precedence: [Design tokens and global styles](/en/guide/essentials/design)
