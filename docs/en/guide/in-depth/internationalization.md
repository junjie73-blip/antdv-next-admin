# Internationalization

In one sentence: **message tables live in `apps/web/src/locales/`, the only source of truth for the current locale is the preferences store, and one function — `useLocaleSync` — expands a locale into the four things the UI actually consumes.**

## Two message files, one truth source

```
locales/index.ts        createI18n({ legacy: false, locale: 'zh-CN', fallbackLocale: 'zh-CN' })
  ├── lang/zh-CN.ts     // default export: one nested object (common / system / ...)
  └── lang/en-US.ts
appStore.locale         // the `locale` field in preferences (@antdv/preferences defaults: 'zh-CN')
```

The header comment of `locales/index.ts` states the split: it only **registers messages** and reads no storage. When two places each kept their own locale, they drifted — the classic symptom was "menu switched to English, the pagination widget stayed Chinese".

## applyLocale: one locale, four effects

From `src/composables/web/useLocale.ts`:

```ts
i18n.global.locale.value = locale; // 1. our own messages
document.documentElement.lang = locale; // 2. accessibility / SEO
dayjs.locale(DAYJS_LOCALE_MAP[locale]); // 3. date formatting (zh-CN → 'zh-cn', lowercase short code)
antdLocale.value = await loadLocale(locale); // 4. antd built-in strings
```

The lesson behind step 4 is recorded in the source comment: it used to be commented out, `antdLocale` stayed undefined, and `ConfigProvider` fell back to English — inside an otherwise-Chinese app, Popconfirm showed OK/Cancel and table empty states were English. `App.vue` now feeds it into `ConfigProvider :locale`.

`useLocaleSync()` is the **only** place performing this expansion (called from App.vue); no component should write `i18n.global.locale` itself.

## One write path only

```ts
const { setLocale } = useLocale();
setLocale('en-US'); // really: appStore.updateSetting({ locale })
```

Persistence belongs to `@antdv/preferences`; a `watch(appStore.locale)` keeps the effects in sync. The language switcher UI lives in the settings drawer (`layouts/components/SettingDrawer/`) and writes the same `locale` field — do not bypass `setLocale` and patch preferences directly.

## On-demand antd locale chunks

`packages/preferences/src/theme/index.ts`:

- `LOCALE_LOADERS` lazily imports `antdv-next/locale/zh_CN | en_US | zh_TW`;
- `loadLocale()` **falls back to the default language** when a chunk fails, never a blank page;
- note the two different scopes: the loader knows three languages, while `useLocale.ts` declares `LocaleType = 'en-US' | 'zh-CN'`. Adding a language means touching both plus a new file under `locales/lang/`.

## Menu titles

The backend menu's `menuName` is a Chinese constant, not an i18n key. `localizeMenus()` in `src/locales/menu.ts` looks up `menu.<Name>` (keyed by the stable route `name`), and its consumer is `layouts/composables/useMenuTree.ts` (`te(key) ? t(key) : undefined`). A missing translation renders the backend title as-is — a brand-new menu item shows readable Chinese rather than a literal `menu.NewPage`.

## Build-time pairing

`internal/vite-config/src/plugins/vue.ts` registers `@intlify/unplugin-vue-i18n` with `compositionOnly / runtimeOnly: true`; `createI18n({ legacy: false })` must match it.

## Common mistakes

| Symptom | Root cause |
| --- | --- |
| antd widget text ignores the switch | Something wrote `i18n.global.locale` outside `useLocaleSync`, so `ConfigProvider :locale` never got the new object |
| Dates stay in English under Chinese | dayjs locale names are lowercase short codes (`zh-cn`), not BCP 47; the mapping is `DAYJS_LOCALE_MAP` |
| A new language half-works | Only one of the two lists (`LOCALE_LOADERS` vs `LocaleType`) was extended |
