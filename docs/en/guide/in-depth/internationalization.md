# Internationalization

In one sentence: **message tables live in `apps/web/src/locales/`, the only source of truth for the current locale is the preferences store, and one function — `useLocaleSync` — expands a locale into the four things the UI actually consumes.** The calendar's own typography is not one of those four: it follows the `ConfigProvider` injection, see [Date typography takes its own path](#date-typography-takes-its-own-path).

## Two message files, one truth source

```
locales/index.ts        createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'zh-CN' })
  ├── lang/zh-CN.ts     // default export: one nested object (common / system / ...)
  └── lang/en-US.ts
appStore.locale         // the `locale` field in preferences (@antdv/preferences defaults: 'zh-CN')
```

The header comment of `locales/index.ts` states the split: it only **registers messages** and reads no storage. When two places each kept their own locale, they drifted — the classic symptom was "menu switched to English, the pagination widget stayed Chinese".

## applyLocale: one locale, four effects

From `apps/web/src/composables/useLocale.ts`:

```ts
i18n.global.locale.value = locale; // 1. our own messages
document.documentElement.lang = locale; // 2. accessibility / SEO
dayjs.locale(DAYJS_LOCALE_MAP[locale]); // 3. date formatting (zh-CN → 'zh-cn', lowercase short code)
antdLocale.value = await loadLocale(locale); // 4. antd built-in strings
```

The lesson behind step 4 is recorded in the source comment: it used to be commented out, `antdLocale` stayed undefined, and `ConfigProvider` fell back to English — inside an otherwise-Chinese app the built-in strings and table empty states came out in English. `App.vue` now feeds it into `ConfigProvider :locale`.

::: warning Two provider layers own the built-in strings
`Popconfirm`'s confirm/cancel labels and the `Empty` / `EmptyState` / `Transfer` empty copy read `@antdv/common-ui`'s `ConfigProvider` (`apps/web/src/App.vue:76-79`, also driven by `appStore.locale`) — nothing to do with antd, whose provider now only still serves the form designer. Both layers take the same preference, so switching language moves them together. Conversely, an inner provider mounted without `locale` produces the half-switched state: chrome in English, package components still in Chinese. See [Shared components](/en/components/common-ui) for the API.
:::

`useLocaleSync()` is the **only** place performing this expansion (called from App.vue); no component should write `i18n.global.locale` itself.

## Date typography takes its own path

None of those four effects reach the month heading or the weekday header inside a calendar — those are set by the **reka primitives**, which read the `locale` that `@antdv/common-ui`'s `ConfigProvider` passes down to the reka base: provider → reka injection → `useLocale(propLocale)` inside each root (explicit prop wins, otherwise the injected value, otherwise `'en'`), and only then does the root hand the resolved locale to `useDateFormatter` for `Intl` formatting, watching for language changes. Covered: `CalendarRoot` / `RangeCalendarRoot` / `DateField` / `DatePicker` / `MonthPicker` / `YearPicker` (plus their Range variants) and `TimeField` / `NumberField` / `ColorField`.

- **Field shells must not hardcode `locale`.** `FDatePicker` used to put `locale="zh-CN"` on `<Calendar>` / `<RangeCalendar>` and kept its own Chinese month-name array — that pair is what produced "the button switched to English, the calendar stayed Chinese". It now passes no `locale` and derives the twelve labels from `useLocale()` (`packages/core/ui-kit/form-ui/src/fields/FDatePicker.vue:161-174`).
- **`useDateFormatter()` does not read the injection itself** (its argument is a plain string), so a wrapper that builds its own formatter sits outside this path: `calendar/Calendar.vue:27` in `@antdv/shadcn-ui` is `useDateFormatter(props.locale ?? 'en')`, and that formatter only serves the `month-and-year` / `month-only` / `year-only` `NativeSelect` layouts. The default branch's `<CalendarHeading />` and weekday header are the injected ones. To make the month/year dropdowns follow the language in `layout` mode, pass `locale` into that wrapper explicitly.
- E2E anchor: `apps/web/e2e/config-provider.spec.ts` — after switching to `en-US` it asserts the heading goes from `2026年10月` to `Oct 2026` and the weekday header from `一 二 … 日` to `S M T W T F S`.

The component-side story is in [Shared components · Date typography goes through reka's injection](/en/components/common-ui#date-typography-goes-through-reka-s-injection).

## One write path only

```ts
const { setLocale } = useLocale();
setLocale('en-US'); // really: appStore.updateSetting({ locale })
```

Persistence belongs to `@antdv/preferences`; a `watch(appStore.locale)` keeps the effects in sync. The language switcher UI lives in its own widget at `packages/layouts/src/widgets/language-toggle/index.vue` (the app injects the candidate list via `apps/web/src/plugins/layouts-host.ts`) and writes the same `locale` field — do not bypass `setLocale` and patch preferences directly.

## On-demand antd locale chunks

`apps/web/src/settings/locale.ts`:

- `LOCALE_LOADERS` lazily imports `antdv-next/locale/zh_CN | en_US | zh_TW` (`:12-16`); these are **legitimate** `antdv-next` references — the language packs themselves come from antd, and the preferences package only stores the `locale` string without knowing where antd's locale files live;
- `loadLocale()` (`:26-38`) **falls back to the default language** when a chunk fails, never a blank page;
- note the two different scopes: the loader knows three languages, while `useLocale.ts:12` declares `LocaleType = 'en-US' | 'zh-CN'`. Adding a language means touching both plus a new file under `locales/lang/`.

## Menu titles

The backend menu's `menuName` is a Chinese constant, not an i18n key. `localizeMenus()` at `packages/utils/src/menu.ts:474` looks up `menu.<Name>` (keyed by the stable route `name`), and its consumer is `packages/layouts/src/hooks/use-menu-tree.ts` (translation goes through `layoutRuntime.translateMenu`, injected by the host; `te(key) ? t(key) : undefined`). A missing translation renders the backend title as-is — a brand-new menu item shows readable Chinese rather than a literal `menu.NewPage`.

## Build-time pairing

`internal/vite-config/src/plugins/vue.ts` imports `@intlify/unplugin-vue-i18n/vite` at `:6` and registers it at `:56-60` with `compositionOnly / runtimeOnly: true`; `createI18n({ legacy: false })` must match it.

## Common mistakes

| Symptom | Root cause |
| --- | --- |
| antd widget text ignores the switch | Something wrote `i18n.global.locale` outside `useLocaleSync`, so `ConfigProvider :locale` never got the new object |
| Shared-package widget text ignores the switch | An inner `@antdv/common-ui` `ConfigProvider` was mounted without `locale`, or a component hardcodes its copy instead of reading `useGlobalConfig()` |
| Dates stay in English under Chinese | dayjs locale names are lowercase short codes (`zh-cn`), not BCP 47; the mapping is `DAYJS_LOCALE_MAP` |
| The calendar stays Chinese after switching | A field shell or wrapper hardcodes `locale`, or the `layout` month/year dropdowns were never handed one — see [Date typography takes its own path](#date-typography-takes-its-own-path) |
| A new language half-works | Only one of the two lists (`LOCALE_LOADERS` vs `LocaleType`) was extended |
