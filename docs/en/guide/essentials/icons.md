# Icons

Three icon channels coexist here, each with its own use case and its own failure mode:

| Channel | Dependency | How you write it | State in this repo |
| --- | --- | --- | --- |
| Offline Iconify sets | `@iconify/vue` `^5.0.3` + five `@iconify-json/*` sets | `<Icon icon="carbon:search" />` | the workhorse: 444 `carbon:`, 99 `ant-design:` and 7 `lucide:` literals. The counting method matches the audit test — whole quoted literals only, scanned over `.ts/.tsx/.vue` under `apps/backend-mock/server`, `apps/web/src` and `packages`; almost all `lucide:` hits sit in `IconPicker` and `@iconify`'s own loaders |
| antdv-next's own icon components | `@antdv-next/icons` `^1.1.2` | `import { FullscreenOutlined } from '@antdv-next/icons'` | one source file left: `apps/web/src/views/screen/components/ScreenHeader.vue:4` (plus one spec, `views/screen/__tests__/screen-header.spec.ts`). Login, register, import/export and tenant select switched to Iconify long ago |
| Local SVG sprite | `vite-plugin-svg-icons` `^2.0.1` | `<SvgIcon name="logo" />` | wired up: `apps/web/src/assets/icons` holds `github / google / qq / wechat` (the login page's social buttons use them — see [Login and auth](/en/guide/in-depth/login)) |

Versions come from the catalog in `pnpm-workspace.yaml`; don't read a sub-package manifest to find one.

## Iconify: offline data by default

Offline serving comes from `@tomjs/vite-plugin-iconify` (`internal/vite-config/src/plugins/auto-import.ts:30-32`):

```ts
iconifyOffline({
  local: ['carbon', 'ant-design', 'lucide', 'fa6-regular', 'mdi'],
});
```

Each set listed in `local` is read from `@iconify-json/<name>/icons.json` and handed to `@iconify/vue` at build time, so the browser **never** calls the Iconify API. Which five are installed: `packages/core/base/icons/package.json` lists all five (`:27-31`); `apps/web` carries `carbon` in dependencies (`:48`) and `ant-design` / `fa6-regular` / `lucide` / `mdi` in devDependencies (`:116-119`).

`mdi` has only two sources of references: `IconPicker`'s own collection loader table (`packages/core/base/icons/src/icon/IconPicker.vue:80`) and three sample literals in `common-ui/__tests__/auth.test.ts:183,184,215`. `fa6-regular` has **no code references at all**. They exist so users can browse them in `IconPicker`. In other words, the offline list equals "sets the picker can search", not "sets the app uses".

::: warning

A set outside that list fails silently A typo like `<Icon icon="carbon:card" />` produces no Vue error. During the build an unknown name renders an **empty span**; if the lookup falls through to runtime it becomes a network request that our CSP usually blocks. The visible symptom is "some menu rows have icons, some have a blank square, and the labels no longer line up" — it looks like a CSS bug and is actually bad data.
:::

`vite-plugin-iconify-offline` (catalog `^0.4.3`) is also in `apps/web` devDependencies but is **imported nowhere**; the plugin doing the work is the `@tomjs/*` one above.

## Which component to use

| Component | Source | When to reach for it |
| --- | --- | --- |
| `<Icon>` | `@iconify/vue` — you **must write `import { Icon } from '@iconify/vue'` explicitly** (`IconifyResolver` was withdrawn together with the auto-import setup) | first choice; every file that writes a bare `<Icon>` now imports it in its own header |
| `IconifyIcon` | `packages/core/base/icons/src/icon/IconifyIcon.vue`, `import { IconifyIcon } from '@antdv/icons/icon'` | when you want that wrapper's `size` default of `16`, `mode`, flips and `rotate` |
| `IconPicker` | `packages/core/base/icons/src/icon/IconPicker.vue` (shadcn-ui implementation: `Popover` + `Select` + `Input` + `Tooltip`, scroll area from `@antdv/common-ui`) | letting a human pick an icon in a form (menu management `views/system/menu/index.vue`, demo page `views/components/icon-picker/index.vue`) |
| `SvgIcon` | `packages/core/base/icons/src/icon/SvgIcon.vue` | brand marks and multicolor glyphs (Iconify handles multicolor poorly); renders `<use xlink:href="#icon-xxx">` |

`IconifyIcon` deliberately assigns no defaults to its optional props (the file header explains why): supplying `''` or `0` turns "not set" into "explicitly set to empty", which overrides `@iconify/vue`'s own fallbacks (color inheriting `currentColor`, size falling back to `size`).

`IconPicker` loads its name lists **lazily**: each of the five sets is a `() => import('@iconify-json/<name>/icons.json')` (`IconPicker.vue:75-86`), so Vite splits them into separate chunks and nothing is fetched until you switch to that category. Offline does not mean "all five sets in the first paint": only components actually rendered pull icon data, and the full JSON appears on demand in the picker (`mdi`'s single JSON is about 3 MB — the audit test's timeout comment at `:90` calls this out).

::: tip Adding a set touches five places

1. add `@iconify-json/<name>` to the catalog in `pnpm-workspace.yaml` and reference it with `"catalog:"` in the consuming package;
2. the `local` array at `auto-import.ts:31`;
3. `IconPicker.vue` — the `Prefix` union (`:53`), `COLLECTIONS` (`:62`) and `COLLECTION_LOADERS` (`:75`) (miss this and the set can neither be selected nor searched);
4. `apps/web/test/icon-names.test.ts` — `COLLECTIONS` and the collection alternation in `LITERAL`;
5. run `pnpm --filter @antdv/web build` once to confirm the data really is in the output.
:::

## The icon-name audit test (a hard constraint here)

`apps/web/test/icon-names.test.ts` collects **every** `'collection:name'` literal in source and requires it to exist in `@iconify-json/<collection>/icons.json`, counting both `icons` and `aliases` (`loadCollection()`, `:55-64`).

| Design decision | Implementation | Rationale |
| --- | --- | --- |
| the mock server is in scope | `SCAN_ROOTS = ['apps/backend-mock/server', 'apps/web/src', 'packages']` (`:45`) | menu icons come from the backend; the biggest cluster of typos lives in `server/api/menus.get.ts` (58 `carbon:` references). Scanning only the frontend would miss it |
| only whole quoted literals | the `LITERAL` regex (`:52-53`), which requires surrounding quotes | `carbon:` mentioned in prose or comments does not count |
| `*.test.ts` files are skipped | `!entry.name.endsWith('.test.ts')` inside `walk()` (`:74`) | sample names inside tests are not real references |
| zero hits fails the build | `expect(checked).toBeGreaterThan(100)` (`:122`) | a wrong path or extension must not "pass" by finding nothing |
| 60 s timeout on both cases | `60_000` passed to both `it(...)` calls (`:86`, `:129`) | parsing five sets and walking three trees exceeds the 5 s default once `turbo run test:unit` queues disk I/O |

The motivation is recorded in the file header: before one sweep, the repository contained **45** nonexistent icon names (`carbon:cards`, `carbon:form`, `carbon:layout`, …) spanning the menu seed data, the layout shell and eight demo pages. Neither frontend nor backend tests caught them — they only asserted "I passed the icon down"; whether the glyph exists was knowledge only a real browser had.

How to run it: `pnpm test:unit` (whole repository through turbo) or `pnpm --filter @antdv/web test:unit` (app only, which includes this file).

::: warning

Class-based icon names do not work in this repository `apps/web/src/views/system/micro-app/index.vue` still contains four UnoCSS-style `class="i-carbon-search"` / `i-carbon-application` spans (`:195`, `:333`, `:408`, `:450`; `MicroAppContainer` moved into `@antdv/common-ui` and its copy of that markup went with it). There is no UnoCSS here and no plugin compiling `i-*` into CSS (styling is Tailwind v4, see [Design tokens and global styles](/en/guide/essentials/design)), so those spans render **empty**. New code always writes the component form: `<Icon icon="carbon:search" />`.
:::

## Where icon names come from

Two runtime sources, neither hardcoded inside a component:

- **Menu data**: the `icon` field of each entry returned by `GET /menus` (mock seed in `apps/backend-mock/server/api/menus.get.ts`), normalized into `MenuConfig.icon`. The rail consumes it with a fallback — `packages/core/ui-kit/layout-ui/src/components/layout-sidebar/nav-rail.vue:90` uses `menu.icon || 'carbon:category'`.
- **Route `meta.icon`**: written on conventional or static routes, typed in `packages/core/base/typings/src/app-router.ts`; tabs and the breadcrumb read it too (`packages/layouts/src/breadcrumb.ts`).

The breadcrumb's handling of the empty value is worth copying: `toText()` (`packages/layouts/src/breadcrumb.ts:49-51`) folds "not a non-empty string" into `undefined`, and the view then decides whether to render `<Icon>` at all via `v-if="showIcon && entry.icon"` (`packages/layouts/src/widgets/breadcrumb.vue:111-113`) — an empty string never reaches `<Icon :icon>`, so there is no "icon slot occupies a cell but draws nothing" misalignment.

Icons used _inside_ antdv-next components (form validation, the select arrow, and so on) come from `@antdv-next/icons` and are unrelated to the pipeline above. The only antd DOM left on a page is the form designer, so the one place business code still takes that package is the pair of fullscreen arrows in the big-screen header (`views/screen/components/ScreenHeader.vue:4`); everywhere else, go through Iconify.

## Related pages

- The styling pipeline and `cn()`: [Design tokens and global styles](/en/guide/essentials/design)
- Full semantics of menu and `meta` fields: [Routes and menu](/en/guide/essentials/route)
- What the CI gate runs: [Testing strategy](/en/guide/project/testing)
