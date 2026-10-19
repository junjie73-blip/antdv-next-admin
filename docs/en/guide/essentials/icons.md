# Icons

Three icon channels coexist here, each with its own use case and its own failure mode:

| Channel | Dependency | How you write it | State in this repo |
| --- | --- | --- | --- |
| Offline Iconify sets | `@iconify/vue` `^5.0.3` + five `@iconify-json/*` sets | `<Icon icon="carbon:search" />` | the workhorse: 420+ `carbon:` literals and ~110 `ant-design:` under `apps`/`packages`, `lucide:` in single digits (almost all inside `IconPicker`) |
| antdv-next's own icon components | `@antdv-next/icons` `^1.1.2` | `import { SearchOutlined } from '@antdv-next/icons'` | narrow: login, register, import/export, tenant select and the big-screen header — 5 source files (plus one test) |
| Local SVG sprite | `vite-plugin-svg-icons` `^2.0.1` | `<SvgIcon name="logo" />` | wired up, but `apps/web/src/assets/icons` is **empty** |

Versions come from the catalog in `pnpm-workspace.yaml`; don't read a sub-package manifest to find one.

## Iconify: offline data by default

Offline serving comes from `@tomjs/vite-plugin-iconify` (`internal/vite-config/src/plugins/auto-import.ts:55-57`):

```ts
iconifyOffline({
  local: ['carbon', 'ant-design', 'lucide', 'fa6-regular', 'mdi'],
});
```

Each set listed in `local` is read from `@iconify-json/<name>/icons.json` and handed to `@iconify/vue` at build time, so the browser **never** calls the Iconify API. Which five are installed: `packages/core/base/icons/package.json` lists all five (`:28-32`); `apps/web` carries `carbon` in dependencies (`:46`) and `ant-design` / `fa6-regular` / `lucide` / `mdi` in devDependencies (`:131-134`).

`mdi` and `fa6-regular` currently have **no code references at all** (zero literals under `apps`/`packages`) — they exist so users can browse them in `IconPicker`. In other words, the offline list equals "sets the picker can search", not "sets the app uses".

::: warning A set outside that list fails silently A typo like `<Icon icon="carbon:card" />` produces no Vue error. During the build an unknown name renders an **empty span**; if the lookup falls through to runtime it becomes a network request that our CSP usually blocks. The visible symptom is "some menu rows have icons, some have a blank square, and the labels no longer line up" — it looks like a CSS bug and is actually bad data. :::

`vite-plugin-iconify-offline` (catalog `^0.4.3`) is also in `apps/web` devDependencies but is **imported nowhere**; the plugin doing the work is the `@tomjs/*` one above.

## Which component to use

| Component | Source | When to reach for it |
| --- | --- | --- |
| `<Icon>` | `@iconify/vue` — you **must write `import { Icon } from '@iconify/vue'` explicitly** (`IconifyResolver` was withdrawn together with the auto-import setup) | first choice; every file that writes a bare `<Icon>` now imports it in its own header |
| `IconifyIcon` | `packages/core/base/icons/src/icon/IconifyIcon.vue`, `import { IconifyIcon } from '@antdv/icons/icon'` | when you want that wrapper's `size` default of `16`, `mode`, flips and `rotate` |
| `IconPicker` | `packages/core/base/icons/src/icon/IconPicker.vue` (shadcn-ui implementation: `Popover` + `Select` + `Input` + `Tooltip`, with `@antdv/common-ui` for the scroll area) | letting a human pick an icon in a form (menu management `views/system/menu/index.vue`, demo page `views/components/icon-picker/index.vue`) |
| `SvgIcon` | `packages/core/base/icons/src/icon/SvgIcon.vue` | brand marks and multicolor glyphs (Iconify handles multicolor poorly); renders `<use xlink:href="#icon-xxx">` |

`IconifyIcon` deliberately assigns no defaults to its optional props (the file header explains it): supplying `''` or `0` turns "not set" into "explicitly set to empty", which overrides `@iconify/vue`'s own fallbacks (color inheriting `currentColor`, size falling back to `size`).

`IconPicker` loads its name lists **lazily**: each of the five sets is a `() => import('@iconify-json/<name>/icons.json')` (`IconPicker.vue:75-86`), so Vite splits them into separate chunks and nothing is fetched until you switch to that category. Offline does not mean "all five sets in the first paint": only components actually rendered pull icon data, and the full JSON appears on demand in the picker (`mdi`'s single JSON is about 3 MB — the audit test's timeout comment calls this out).

::: tip Adding a set touches five places

1. add `@iconify-json/<name>` to the catalog in `pnpm-workspace.yaml` and reference it with `"catalog:"` in the consuming package;
2. the `local` array at `auto-import.ts:56`;
3. `IconPicker.vue` — the `Prefix` union (`:53`), `COLLECTIONS` (`:62`) and `COLLECTION_LOADERS` (`:75`) (miss this and the set can neither be selected nor searched);
4. `apps/web/test/icon-names.test.ts` — `COLLECTIONS` and the collection alternation in `LITERAL`;
5. run `pnpm --filter @antdv/web build` once to confirm the data really is in the output. :::

## The icon-name audit test (a hard constraint here)

`apps/web/test/icon-names.test.ts` collects **every** `'collection:name'` literal in source and requires it to exist in `@iconify-json/<collection>/icons.json`, counting both `icons` and `aliases` (`loadCollection()`, `:51-60`).

| Design decision | Implementation | Rationale |
| --- | --- | --- |
| the mock server is in scope | `SCAN_ROOTS = ['apps/backend-mock/server', 'apps/web/src', 'packages']` (`:37-41`) | menu icons come from the backend; the biggest cluster of typos lives in `server/api/menus.get.ts` (54 `carbon:` references). Scanning only the frontend would miss it |
| only whole quoted literals | the `LITERAL` regex (`:48-49`) | `carbon:` mentioned in prose or comments does not count |
| `*.test.ts` files are skipped | `walk()` (`:70`) | sample names inside tests are not real references |
| zero hits fails the build | `expect(checked).toBeGreaterThan(100)` (`:118`) | a wrong path or extension must not "pass" by finding nothing |
| 60 s timeout on both cases | the third argument to `it(...)` | parsing five sets and walking three trees exceeds the 5 s default once `turbo run test:unit` queues disk I/O across 21 tasks |

The motivation is recorded in the file header: before one sweep, the repository contained **45** nonexistent icon names (`carbon:cards`, `carbon:form`, `carbon:layout`, …) spanning the menu seed data, the layout shell and eight demo pages. Neither frontend nor backend tests caught them — they only asserted "I passed the icon down"; whether the glyph exists was knowledge only a real browser had.

How to run it: `pnpm test:unit` (whole repository through turbo) or `pnpm --filter @antdv/web test:unit` (app only, which includes this file).

::: warning Class-based icon names do not work in this repository `views/system/micro-app/index.vue` and `components/business/MicroAppContainer.vue` still contain UnoCSS-style `class="i-carbon-search"` / `i-carbon-application` markup. There is no UnoCSS here and no plugin compiling `i-*` into CSS (styling is Tailwind v4, see [Design tokens and global styles](/en/guide/essentials/design)), so those spans render **empty**. Write the component form: `<Icon icon="carbon:search" />`. :::

## Where icon names come from

Two runtime sources, neither hardcoded inside a component:

- **Menu data**: the `icon` field of each entry returned by `GET /menus` (mock seed in `apps/backend-mock/server/api/menus.get.ts`), normalized into `MenuConfig.icon`. The rail consumes it with a fallback — `packages/core/ui-kit/layout-ui/src/components/layout-sidebar/nav-rail.vue:90` uses `menu.icon || 'carbon:category'`.
- **Route `meta.icon`**: written on conventional or static routes, typed in `packages/core/base/typings/src/app-router.ts`; tabs and the breadcrumb read it too (`packages/layouts/src/breadcrumb.ts`).

The breadcrumb's handling of the empty value is worth copying: the comment at `LayoutBreadcrumb.vue:81` explains why it uses `''` instead of `undefined` — `undefined` makes `<Icon :icon>` a type error, while `''` both fails the `v-if` and keeps the prop a `string`.

Icons used _inside_ antdv-next components (form validation, the select arrow, and so on) come from `@antdv-next/icons` and are unrelated to the pipeline above; reach for that package only when you need the same Outlined glyph the library itself uses.

## Related pages

- The styling pipeline and `cn()`: [Design tokens and global styles](/en/guide/essentials/design)
- Full semantics of menu and `meta` fields: [Routes and menu](/en/guide/essentials/route)
- What the CI gate runs: [Testing strategy](/en/guide/project/testing)
