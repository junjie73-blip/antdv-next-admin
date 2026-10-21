# Internationalization

In one sentence: **message tables live in `apps/web/src/locales/`, the only source of truth for the current locale is the preferences store, and one function — `useLocaleSync` — expands a locale into the three things the UI actually consumes (i18n, `<html lang>`, dayjs).** The calendar's own typography is not one of those three: it follows the `ConfigProvider` injection, see [Date typography takes its own path](#date-typography-takes-its-own-path).

## Two message files, one truth source

```
locales/index.ts        createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'zh-CN' })
  ├── lang/zh-CN.ts     // default export: one nested object (common / system / ...)
  └── lang/en-US.ts
appStore.locale         // the `locale` field in preferences (@antdv/preferences defaults: 'zh-CN')
```

The header comment of `locales/index.ts` states the split: it only **registers messages** and reads no storage. When two places each kept their own locale, they drifted — the classic symptom was "menu switched to English, the pagination widget stayed Chinese".

## applyLocale: one locale, three effects

`packages/core/hooks/src/use-locale.ts` (function `:41-56`, the three assignments at `:46-48`):

```ts
i18nLocale.value = locale; // 1. our own messages (writes the global composer — the same ref as i18n.global.locale)
document.documentElement.lang = locale; // 2. accessibility / SEO
dayjs.locale(DAYJS_LOCALE_MAP[locale]); // 3. date formatting (zh-CN → 'zh-cn', lowercase short code)
```

There used to be a fourth: `antdLocale.value = await loadLocale(locale)`, handing antd's locale object to `ConfigProvider :locale`. Removing the antd dependency deleted that whole chain — including the lazy loader table `apps/web/src/settings/locale.ts` — so `useLocaleSync()` now **returns nothing**; the motive is recorded in the source comment at `:34-37`.

::: warning One provider layer owns the built-in strings `Popconfirm`'s confirm/cancel labels and the `Empty` / `EmptyState` / `Transfer` empty copy read `@antdv/common-ui`'s `ConfigProvider`: `apps/web/src/App.vue:48-51` mounts the provider and `:41-44` builds `globalConfig` from `appStore.locale` / `appStore.componentSize`. That is the only layer — mount a second `ConfigProvider` inside a subtree without `locale` and you get the half-switched state: chrome in English, package components still in Chinese. See [Shared components](/en/components/common-ui) for the API. :::

`useLocaleSync()` is the **only** place performing this expansion (called from App.vue); no component should write `i18n.global.locale` itself.

## Date typography takes its own path

None of those three effects reach the month heading or the weekday header inside a calendar — those are set by the **reka primitives**, which read the `locale` that `@antdv/common-ui`'s `ConfigProvider` passes down to the reka base: provider → reka injection → `useLocale(propLocale)` inside each root (explicit prop wins, otherwise the injected value, otherwise `'en'`), and only then does the root hand the resolved locale to `useDateFormatter` for `Intl` formatting, watching for language changes. Covered: `CalendarRoot` / `RangeCalendarRoot` / `DateField` / `DatePicker` / `MonthPicker` / `YearPicker` (plus their Range variants) and `TimeField` / `NumberField` / `ColorField`.

- **Field shells must not hardcode `locale`.** `FDatePicker` used to put `locale="zh-CN"` on `<Calendar>` / `<RangeCalendar>` and kept its own Chinese month-name array — that pair is what produced "the button switched to English, the calendar stayed Chinese". It now passes no `locale` and derives the twelve labels from `useLocale()` (`packages/core/ui-kit/form-ui/src/fields/FDatePicker.vue:161-173`).
- **`useDateFormatter()` does not read the injection itself** (its argument is a plain string), so a wrapper that builds its own formatter sits outside this path: `calendar/Calendar.vue:27` in `@antdv/shadcn-ui` is `useDateFormatter(props.locale ?? 'en')`, and that formatter only serves the `month-and-year` / `month-only` / `year-only` `NativeSelect` layouts. The default branch's `<CalendarHeading />` and weekday header are the injected ones. To make the month/year dropdowns follow the language in `layout` mode, pass `locale` into that wrapper explicitly.
- E2E anchor: `apps/web/e2e/config-provider.spec.ts` — after switching to `en-US` it asserts the heading goes from `2026年10月` to `Oct 2026` and the weekday header from `一 二 … 日` to `S M T W T F S`.

The component-side story is in [Shared components · Date typography goes through reka's injection](/en/components/common-ui#date-typography-goes-through-reka-s-injection).

## One write path only

```ts
const { setLocale } = useLocale();
setLocale('en-US'); // really: appStore.updateSetting({ locale })
```

Persistence belongs to `@antdv/preferences`; a `watch(appStore.locale)` keeps the effects in sync. The language switcher UI lives in its own widget at `packages/layouts/src/widgets/language-toggle/index.vue` (the app injects the candidate list via `apps/web/src/plugins/layouts-host.ts`) and writes the same `locale` field — do not bypass `setLocale` and patch preferences directly.

## Adding a language

This section used to document on-demand antd locale chunks: `apps/web/src/settings/locale.ts` lazily imported `antdv-next/locale/zh_CN | en_US | zh_TW` through `LOCALE_LOADERS` and fell back to the default language when a chunk failed. **That file is gone with the antd dependency** — `apps/web/src/settings/` now contains only `index.ts` (the preferences entry). Neither `@antdv/common-ui`'s `ConfigProvider` nor reka needs an external locale bundle, only the `'en-US' | 'zh-CN'` string, so adding a language is now four places kept in step:

| Where | What |
| --- | --- |
| `packages/core/hooks/src/use-locale.ts:13` | extend `LocaleType` with the new BCP 47 code |
| same file, `:16-19` / `:22-25` | both `localeLabels` (endonyms — English is not translated) and `DAYJS_LOCALE_MAP` (dayjs wants the lowercase short code `zh-cn`) need the key; the first is the name shown in the dropdown, missing the second only means dates stop following |
| `apps/web/src/locales/` | add `lang/<code>.ts` and register it in `createI18n({ messages … })` at `index.ts:11-19` — `availableLocales` is derived from the `messages` keys, there is no second list; the two language files must stay aligned key by key (see [Conventions](/en/guide/project/protocol)) |
| `apps/web/src/plugins/layouts-host.ts:35-38` | nothing to change — the candidate list comes straight from `i18n.global.availableLocales` and the labels from `localeLabels`, so registering a message file adds the menu entry |

The component built-in text layer additionally consults `textsByLocale` on `@antdv/common-ui`'s `ConfigProvider` (a language with no key there falls back to English); API and rules in [Shared components](/en/components/common-ui).

## Menu titles

The backend menu's `menuName` is a Chinese constant, not an i18n key. `localizeMenus()` at `packages/utils/src/menu.ts:474` looks up `menu.<Name>` (keyed by the stable route `name`), and its consumer is `packages/layouts/src/hooks/use-menu-tree.ts` (translation goes through `layoutRuntime.translateMenu`, injected by the host; `te(key) ? t(key) : undefined`). A missing translation renders the backend title as-is — a brand-new menu item shows readable Chinese rather than a literal `menu.NewPage`.

## Build-time pairing

`internal/vite-config/src/plugins/vue.ts` imports `@intlify/unplugin-vue-i18n/vite` at `:8` and registers it at `:76-80` with `compositionOnly / runtimeOnly: true`; `createI18n({ legacy: false })` must match it.

## Common mistakes

| Symptom | Root cause |
| --- | --- |
| `$t` output ignores the switch | Something wrote `i18n.global.locale` outside `useLocaleSync` — that ref is assigned in exactly one place, any other writer is a second copy of the state |
| Shared-package widget text ignores the switch | An inner `@antdv/common-ui` `ConfigProvider` was mounted without `locale`, or a component hardcodes its copy instead of reading `useGlobalConfig()` |
| Dates stay in English under Chinese | dayjs locale names are lowercase short codes (`zh-cn`), not BCP 47; the mapping is `DAYJS_LOCALE_MAP` |
| The calendar stays Chinese after switching | A field shell or wrapper hardcodes `locale`, or the `layout` month/year dropdowns were never handed one — see [Date typography takes its own path](#date-typography-takes-its-own-path) |
| Some strings stay Chinese in the English UI | The key only exists in `zh-CN.ts`; keeping the two language files aligned key by key is a hard rule (see [Conventions](/en/guide/project/protocol)) |
| A literal `menu.XXX` appears in the navigation | It should not — `localizeMenus` falls back to the backend title when the key is missing, so seeing one means someone changed the fallback |

## Related pages

- Theming and CSS variables: [Theming & preferences](/en/guide/in-depth/theme)
- Time formatting and time zones: `useAppStore`'s `timezone` is likewise preference-driven (see [State management](/en/guide/essentials/stores))
