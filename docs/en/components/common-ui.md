# Shared Components (`@antdv/common-ui`)

This page documents `packages/core/ui-kit/common-ui` — the route-agnostic, cross-page presentational components: 56 exported values. Every one of them is **composed from primitives in `@antdv/shadcn-ui`** (reka-ui); the package does not know antdv-next exists and does not know the app exists — no store, no router, no `~/...` alias inside.

The refactor landed in code before it landed in docs, so this page is the catch-up: `Description` and `CountTo`, which used to live in `apps/web/src/components/business/`, are now in this package, and a second batch (Badge, Steps, Result, Transfer, Image, Upload, Tabs …) was extracted from demo pages that each kept their own copy.

::: tip APIs only, no narrative

Every props / events / slots / instance-method line below is copied from the real `defineProps` / `defineEmits` / `defineExpose` in the source, with file:line. For "what do I click and what happens", use the routes listed under [Component examples](/en/components/); for the CSS variables these components consume, see [Design tokens and global styles](/en/guide/essentials/design). :::

## How to import: the root entry plus one charts subpath

`packages/core/ui-kit/common-ui/package.json` declares exactly three `exports` keys: `.` (→ `./src/index.ts`), `./charts` (→ `./src/components/charts/index.ts`) and `./package.json`. Apart from `./charts` **there are no subpath exports**, so `@antdv/common-ui/components/badge` fails at Node resolution with `ERR_PACKAGE_EXPORTS` — it is not "allowed but discouraged".

`ECharts` is the one exception and it is **deliberately kept out of the root barrel**: the component does `import * as echarts from 'echarts'`, which pulls the chart library's full registry into the module graph, and putting it in the root entry would make every `from '@antdv/common-ui'` consumer pay for parsing it (same reasoning as `@antdv/hooks/echarts`; the comment is at `components/charts/index.ts:1-5`).

```ts
// ✅ named imports, always from the package barrel
import { Card, MicroAppContainer, Popconfirm, Tag } from '@antdv/common-ui';

// ✅ the chart only exists on the subpath
import { ECharts } from '@antdv/common-ui/charts';

// ❌ this subpath does not exist
import { Badge } from '@antdv/common-ui/components/badge';
```

ESLint enforces `vue/component-name-in-template-casing: PascalCase` (`internal/lint-configs/eslint-config/src/configs/vue.ts:71`), so templates read `<Card>` / `<Popconfirm>` — no `as ACard` alias, that was the old convention for kebab-case `a-*` tags.

Directory layout is **one kebab-case directory per component**:

```text
packages/core/ui-kit/common-ui/src/components/<kebab>/
 ├── <PascalCase>.vue   # the component
 ├── index.ts       # named + default export (the barrel only takes the named one)
 ├── types.ts       # optional: props / emits / data shapes
 └── context.ts      # optional: provide / inject keys
```

Internal cross-references use relative paths (`status-tag/StatusTag.vue:6` imports `../tag`); consumers only ever see the barrel.

## Full export list

The 56 value exports from `src/index.ts`, grouped by purpose:

| Group | Exports |
| --- | --- |
| Containers & layout | `Card`, `Divider`, `Space`, `Empty`, `EmptyState`, `ErrorBoundary` |
| Status & identity | `Badge`, `Tag`, `StatusTag`, `Alert`, `Result`, `Steps` |
| Data display | `Description`, `Descriptions`, `DescriptionsItem`, `Statistic`, `CountTo`, `Image`, `Listy`, `Timeline`, `TimelineItem`, `Tooltip` |
| Interaction & switching | `Tabs`, `TabPane`, `Segmented`, `Popconfirm`, `Transfer`, `Tree` |
| Micro-frontend | `MicroAppContainer` |
| Upload | `Upload`, `UploadDragger`, `UploadList` |
| Skeletons & loading | `PageSkeleton`, `TableSkeleton`, `Loading`, `createContainerLoading`, `createFullscreenLoading`, `createLoading`, `useLoading`, `vLoading`, `Scrollbar` |
| Editors | `CronEditor`, `MarkdownEditor` |
| Auth page chrome | `AuthColorPresets`, `AuthFormPanel`, `AuthPageLayout`, `AuthSocialLogin` |
| Toast container | `Toaster` |
| Global config | `ConfigProvider`, `DEFAULT_GLOBAL_CONFIG`, `GLOBAL_CONFIG_KEY`, `normalizeComponentSize`, `textsByLocale`, `useGlobalConfig` |
| Decorative motion | `BorderBeam` |
| Injection key | `DESCRIPTION_DICT_RESOLVER` |

Type exports: `BorderBeamProps`, `CountToEvents` / `CountToInstance` / `CountToProps`, `CronEditorEmits` / `CronEditorProps` / `CronField` / `CronPreset`, `DescriptionInstance` / `DescriptionItem` / `DescriptionLayout` / `DescriptionProps` / `DescriptionSize` / `DictResolver`, `ComponentSizeOption` / `Direction` / `GlobalConfig` / `GlobalTheme` / `LocaleKey` / `ResolvedComponentSize` / `ResolvedGlobalConfig`, `ListyEmits` / `ListyItem` / `ListyItemHeight` / `ListyProps` / `ListyRow` / `ListyScrollState` / `ListyScrollToOptions` / `ListySize`, `LoadingProps` / `LoadingSize` / `LoadingTheme` / `LoadingInstance` / `CreateLoadingOptions` / `UseLoadingOptions` / `LoadingDirectiveBinding`, the ten `markdown-editor` types (seven `MarkdownEditor*` plus `ImageUploadConfig` / `UploadResponse` / `VideoUploadConfig`), `MicroAppContainerProps` / `MicroAppContainerEmits`, `ScrollbarProps` / `ScrollbarStyle` / `ScrollbarType`, `TabPaneProps`, `ToasterProps` (vue-sonner's type, re-exported), `TransferDirection` / `TransferItem` / `TransferKey`, `NormalTreeNode` / `TreeContext` / `TreeFieldNames` / `TreeKey`, `UploadChangeParam` / `UploadFile` / `UploadListType` / `UploadRequestOptions`, plus the `Auth*Props` types with `AuthColorPreset` / `AuthFeatureItem` / `AuthSocialItem`. `EChartsProps` is not on this list — it only leaves through `@antdv/common-ui/charts`.

::: warning `UploadProps` is not exported

`components/upload/index.ts` declares `export type { UploadProps }`, but the re-export block in `src/index.ts:144-150` does not include it. To type Upload props in a page, compose `import type { UploadFile, UploadChangeParam } from '@antdv/common-ui'` instead — or leave it untyped. :::

## ConfigProvider (global config)

`components/config-provider/ConfigProvider.vue` (215 lines). The prop shape lives in `config-provider/types.ts:58-84`, the fallback values in `:118-128`, the injection key `GLOBAL_CONFIG_KEY` in `:114-115`.

**The base is reka-ui's own `ConfigProvider`** (`ConfigProvider.vue:194-201`), wrapped in a `display: contents` `<div>` that carries the theme variables and the mode/preset attributes (`:202-213`). This is not a slot-forwarding shell: all six reka parameters — `dir` / `locale` / `scrollBody` / `nonce` / `teleportTo` / `useId` — are wired to real readers (see below), and on top of that we add the three things reka does not own: **built-in copy, the component size scale, and sub-tree theme variables**.

| prop | default | behaviour |
| --- | --- | --- |
| `locale` | `'zh-CN'` | Drives the built-in copy (`okText` / `cancelText` / `emptyText`) and is handed to the reka base, where the date and number primitives read it through `useLocale()` for `Intl` typography — see [Date typography goes through reka's injection](#date-typography-goes-through-reka-s-injection) |
| `okText` / `cancelText` / `emptyText` | expanded from `locale` | `textsByLocale` (`types.ts:131-139`) ships exactly two locales; passing one explicitly overrides that word |
| `placeholder` | `'-'` | Empty-value placeholder, used by `Description` and when a dictionary lookup misses |
| `componentSize` | `'medium'` | Size scale. `'middle'` is the legacy alias in `@antdv/types`, folded into `'medium'` while resolving (`normalizeComponentSize`, `types.ts:141-146`), so readers only ever see three levels |
| `dir` | `'ltr'` | Text direction — passed to reka (popup placement, typography) and written as the container's `dir` attribute |
| `theme` | `{}` | Sub-tree theme override: `mode` (`dark` / `light` / `system`), `preset`, `primary`, `radius` — see `GlobalTheme` (`types.ts:29-50`) |
| `cssVars` | `{}` | Escape hatch for arbitrary CSS variables, written **last**, so it wins over the variables derived from `theme` |
| `scrollBody` / `nonce` / `teleportTo` / `useId` | unset | Passed straight through to the reka base: body-scroll lock, CSP nonce, default portal container, id generator (SSR hydration stability) |

The host's own `class` / `style` / listeners are merged onto that same element (`inheritAttrs: false` + `useAttrs()`, `ConfigProvider.vue:21`, `:162-188`), so `<ConfigProvider class="foo" @click="…">` loses nothing. `data-common-config-provider` / `data-config-locale` / `data-config-size` are the handles for debugging and e2e.

### Why the container is `display: contents`

The first entry of `wrapperClass` is `'contents'` (`:164-173`): that `<div>` **generates no box**, so children lay out exactly as if the provider were not there — otherwise wrapping a direct child of a `Grid` / `Flex` container in a provider would collapse the grid into a single column. CSS custom properties inherit down the DOM tree regardless of boxes, so the variables still reach the children. A host that wants to reuse the element can override `contents` with an inline `style="display:flex"` and the variable plumbing survives.

### Who reads it

`useGlobalConfig()` (`use-global-config.ts:18-20`) returns the merged reactive config and works without a provider (it falls back to `DEFAULT_GLOBAL_CONFIG`). Because the value is reactive, **destructuring loses reactivity** — read it as `config.okText`.

| Reader | Reads | Where |
| --- | --- | --- |
| `Popconfirm` | `okText` / `cancelText` | `popconfirm/Popconfirm.vue:45-46` |
| `Empty` / `EmptyState` | `emptyText` | `empty/Empty.vue:34`, `empty-state/EmptyState.vue:23` |
| `Transfer` | `emptyText` (right column) | `transfer/Transfer.vue:261` |
| `Description` | `placeholder` + `componentSize` | `description/Description.vue:70` |
| `Loading` | `componentSize` | `loading/Loading.vue:31-33` |
| `Segmented` | `componentSize` | `segmented/Segmented.vue:50-52` |
| `Steps` | `componentSize` (only `small` has its own visuals) | `steps/Steps.vue:52` |

Every one of those components defaults its `size` / copy props to `undefined` — hardcoding `'default'` would make the global scale unreadable. The families do not share vocabulary, so `medium` maps into each one's own name: `Loading` → `default`, `Segmented` → `middle`, `Description` → `default` (that family only gets tighter at `small` / `middle`).

::: warning The size has to reach child items reactively, not as a snapshot `Segmented`'s scale travels one level further: `ToggleGroup` in `@antdv/shadcn-ui` hands it to every `ToggleGroupItem` through `provide('toggleGroup', …)`. That provide used to pass a **plain object**, i.e. a snapshot taken at setup — switching the scale updated the group's own `data-size` but left the buttons at the old height, so it looked as if "the scale only wrote an attribute". It is now a getter-based `reactive()` (`toggle-group/ToggleGroup.vue:24-33`), so each item re-reads on every render. **The same applies to any scale you plumb across levels yourself.** :::

### Date typography goes through reka's injection

`dayjs` only covers strings we format ourselves; the month heading and the weekday header inside a calendar are set by the **reka primitives**, which read the `locale` our provider passes down to the reka base. The chain is two hops: provider → reka `ConfigProvider`'s injection → `useLocale(propLocale)` inside each root (explicit prop wins, otherwise the injected value, otherwise `'en'`), and only then does that root feed the resolved locale into `useDateFormatter` for `Intl` formatting, watching for language changes.

- **Roots covered**: `CalendarRoot` / `RangeCalendarRoot` / `DateFieldRoot` / `DatePickerRoot` / `MonthPickerRoot` / `YearPickerRoot` and their Range variants, plus `TimeField` / `NumberField` / `ColorField`.
- **Field shells must not hardcode `locale`.** `FDatePicker` (`packages/core/ui-kit/form-ui/src/fields/FDatePicker.vue`) used to put `locale="zh-CN"` on `<Calendar>` / `<RangeCalendar>` and kept its own hardcoded Chinese month-name array, so switching language produced "the button changed, the calendar stayed Chinese". It now passes no `locale` at all and derives the twelve labels from `useLocale()` through `Intl.DateTimeFormat` (`:161-174`).
- **`useDateFormatter()` itself does not read the injection** — its argument is a plain string, and it is the roots that pass the resolved value down. So a wrapper that builds its own formatter is outside the bridge: `calendar/Calendar.vue:27` in `@antdv/shadcn-ui` is `useDateFormatter(props.locale ?? 'en')`, and that formatter only serves the `month-and-year` / `month-only` / `year-only` `NativeSelect` layouts. The default branch renders `<CalendarHeading />` and the weekday header, which do follow the injection. To make the month/year dropdowns follow the language in `layout` mode, pass `locale` into that wrapper explicitly.

E2E anchor: `apps/web/e2e/config-provider.spec.ts` — after switching to `en-US` it asserts the heading goes from `2026年10月` to `Oct 2026` and the weekday header from `一 二 … 日` to `S M T W T F S`.

::: warning Do not read theme or variables through `useGlobalConfig()` `theme` / `cssVars` are already applied by the provider as CSS variables plus `.dark` / `.light` on the container, so components keep using `var(--*)` and `bg-primary`. Branching on the JS values as well would mean "styles follow CSS variables, logic follows JS values" — two sources of truth (`use-global-config.ts:14-16`). :::

### Sub-tree theming, not a second global write side

`applyPreferencesToDom()` in `@antdv/preferences` remains the only place that writes the global theme (`--primary`, `.dark`, `data-theme` on `<html>` — see [Design tokens and global styles](/en/guide/essentials/design)). `ConfigProvider` only overrides **inside its own sub-tree**: `themeVars` (`:144-150`) writes just the keys this override actually provided, and omits the rest, so the sub-tree re-inherits from `<html>` — "leave it unset = don't override", not "override with the default".

Sub-tree overrides work because `@antdv/design/src/token/index.css` declares its tokens with `@theme inline`: the value is inlined, so utilities compile to the `hsl(var(--primary))` **expression** itself rather than a colour resolved once at `:root` — any non-`:root` ancestor can still change them. `radius` is an **absolute value** (numbers are converted to rem against the 16px `--radius` base, `8` → `0.5rem`; strings pass through verbatim), unlike the preference's multiplier scale (0–1 over a 16px base) — a sub-tree override is for "this block should be squarer", not for re-scaling the global dial.

::: warning Mode class and theme name must land on the same element `@antdv/design` writes dark presets as `.dark[data-theme='violet']` and Tailwind's `dark:` variant is `&:where(.dark, .dark *)`. The class generated from `mode` and the `data-theme` generated from `preset` therefore have to sit on the same node (the implementation does exactly that, `:202-211`); split them across two levels and only half of it applies. :::

::: warning Teleported overlays are not inside this sub-tree `Dialog` / `Popover` / `Select` layers mount on `body` by default, and CSS variables inherit down the DOM tree, so those follow the `<html>` settings rather than the provider's. Point `teleportTo` into the sub-tree when a local theme has to reach the overlay (`scrollBody` / `nonce` / `useId` are unaffected). :::

### Nesting

An inner provider overrides only the fields it explicitly sets and inherits the rest (`ConfigProvider.vue:39-47`, `:53-96`). Two details worth knowing:

- Copy inherits the outer **resolved** value: if the outer provider pins `okText: 'Confirm'`, the inner one does not fall back to "确定 / OK". But an inner provider that changes `locale` re-expands the words for that language — someone switching language wants that language, not an ancestor's custom strings.
- `theme` and `cssVars` merge shallowly: changing only `radius` inside keeps the outer primary colour and mode.

Real usage: `apps/web/src/App.vue:76-79` mounts it at the root with just `component-size` and `locale` (preferences stay the single source). `theme` / `cssVars` are intentionally left empty there, so the primary colour and radius keep being written by `applyPreferencesToDom()` on `<html>` — one write side per concern.

## Badge

`components/badge/Badge.vue` (130 lines); props and defaults at `:10-35`.

| prop | default | behaviour |
| --- | --- | --- |
| `count` | `0` | numeric bubble; shows `${max}+` when `> max` (`:57-59`) |
| `max` | `99` | upper bound |
| `dot` | `false` | dot mode, ignores the `count` display |
| `show` | `true` | visibility; `visible = show && (dot \|\| count > 0)` (`:53`) — with `count: 0` and no `dot` the bubble is not rendered |
| `status` | — | `'default' \| 'error' \| 'processing' \| 'success' \| 'warning'`; **supplying it switches the render mode** (`statusMode`, `:48`) |
| `text` | — | only shown next to the dot in `status` mode |
| `color` / `numberStyle` / `offset` / `title` | — | custom colour / bubble style / offset / native `title` |

The two modes are mutually exclusive: with `status` you get dot + `text` + default slot; without it you get the default slot plus a `<sup>` bubble. **With no default slot the bubble degrades to standalone inline display** (`standalone`, `:50-51`). Events: none.

Status dot colours are a **literal class table** `STATUS_DOT` (`:37-44`, e.g. `processing: 'animate-pulse bg-blue-500'`) — Tailwind only scans literals, so this table must not become string interpolation.

Real usage: `apps/web/src/views/security/dashboard/components/SecurityTimeline.vue:11`.

## Steps

`components/steps/Steps.vue` (163 lines); props `:9-26`, emits `:28`.

| prop | default | behaviour |
| --- | --- | --- |
| `current` | `0` | index of the active step; works with `v-model:current` |
| `items` | `[]` | `StepItem[] = { title?, description? }` (`:30-33`) — **those two fields only**; no per-item antd `status` / `icon` |
| `direction` | `'horizontal'` | `'horizontal' \| 'vertical'` |
| `size` | `'default'` | `'default' \| 'small'`; icon 12px vs 14px (`:47-49`) |
| `status` | — | `'error' \| 'finish' \| 'process'`, **rewrites only the current step**, the rest is still derived from `current` (`stateOf`, `:51-56`) |
| `clickable` | `false` | renders each step as a `<button>` (`aria-label` from `item.title`); only then do clicks emit |

Emits: `change: [number]`, `update:current: [number]`. `select()` is guarded: **with `clickable: false` clicking a step emits nothing**. Colours come from the literal table `CIRCLE` (`:37-43`, four states `error` / `finish` / `process` / `wait`); finished steps show `carbon:checkmark`.

Real usage: `apps/web/src/views/components/form/steps/index.vue:12` (paired with `Result` for the submit-success screen).

## Result

`components/result/Result.vue` (70 lines); props `:9-20`.

| prop | default | behaviour |
| --- | --- | --- |
| `status` | `'info'` | `'403' \| '404' \| '500' \| 'error' \| 'info' \| 'success' \| 'warning'` (`:22-29`) |
| `title` / `subTitle` | — | both optional text nodes |

Slots: `default` (description area), `extra` (action buttons, `:66-67`). Events: none. Icon and colour per status live in `PRESET` (`:31-40`): `403` → amber `carbon:warning`, `404` → blue `carbon:document`, `500` → red `carbon:fire`, `error` → `carbon:close-outline`, `info` → `carbon:information`, `success` → emerald `carbon:checkmark-outline`, `warning` → `carbon:warning-alt`. An unknown `status` falls back to `info` (`:42`).

## Transfer

`components/transfer/Transfer.vue` (294 lines); props `:15-36`, emits `:38-41`, types in `transfer/types.ts`.

| prop | default | behaviour |
| --- | --- | --- |
| `dataSource` | `[]` | `TransferItem[] = { key, disabled?, title?, [k: string]: any }` |
| `targetKeys` (`v-model:target-keys`) | `[]` | `defineModel<TransferKey[]>('targetKeys')` (`:43`); the right panel follows this order, the left keeps `dataSource` order |
| `oneWay` | `false` | keeps only the "→" button |
| `operation` | `['>', '<']` | button labels |
| `titles` | `['源列表', '目标列表']` | panel headers (Chinese defaults are intentional — this is a Chinese-first admin template) |
| `showSearch` | `false` | search box on top of each panel |
| `render` | — | `(item) => string`; falls back to `item.title` |
| `disabled` / `listStyle` | `false` / — |  |

Emits: `change: [TransferKey[], TransferDirection, TransferKey[]]`, `select: [TransferDirection, TransferKey[]]`; `TransferDirection = 'left' | 'right'`.

**Keys are compared as strings** (`transferKey()`, `types.ts:12-15`): the mock endpoints mix numeric and string keys, so a raw `Set` comparison would miss items. Passing `[1, '2']` as `targetKeys` is therefore equivalent — but when you assert the `change` payload, type it as `TransferKey`.

Real usage: `apps/web/src/views/system/post/index.vue:14` (roles ↔ posts assignment).

## Image

`components/image/Image.vue` (150 lines); props `:17-40`.

| prop | default | behaviour |
| --- | --- | --- |
| `src` / `alt` / `width` / `height` | — / `''` / — / — | `width` / `height` accept `number \| string` |
| `fallback` | — | used when loading fails (not antd's `onError` callback) |
| `preview` | `true` | `boolean \| { visible?, onVisibleChange? }` (`:44-47`) |
| `rootClassName` / `class` / `style` | — |  |

Emits: `update:previewVisible: [boolean]` (`:42`). The preview layer is shadcn `Dialog` + `DialogContent` + `DialogTitle` + `DialogDescription`.

::: warning The three `preview` spellings differ

- omitted or `true` → clickable, uncontrolled.
- <code v-pre>preview={{ visible }}</code> (`visible` is a boolean)→ **controlled**; pair it with `@update:preview-visible`.
- <code v-pre>preview={{ visible: false }}</code> with no `onVisibleChange` → treated as **statically disabled**, the preview affordance is not rendered at all (`showPreview`, `:55-60`); `preview=false` behaves the same. This mirrors the pre-migration "hide preview" usage: `preview={false}` and <code v-pre>preview={{ visible: false }}</code> are equivalent, while <code v-pre>preview={{}}</code> is clickable. :::

## Upload / UploadDragger / UploadList

`components/upload/`: `Upload.vue` 314 lines (props `:13-46`), `UploadDragger.vue` 11 lines, `UploadList.vue` 128 lines (props `:12-26`), `types.ts`.

| prop | default | behaviour |
| --- | --- | --- |
| `fileList` (`v-model:file-list`) | `[]` | `defineModel<UploadFile[]>('fileList')` (`:56`) |
| `accept` / `multiple` | — / `false` | handed to `useFileDialog` through computeds (`:62-63`), so the hidden `input` refreshes when the props change |
| `listType` | `'text'` | `'text' \| 'picture' \| 'picture-card'` |
| `autoUpload` | `true` | turn it off and call the instance method `upload()` yourself |
| `beforeUpload` | — | `(file, list) => any`: **returning `false` skips the upload** (a rejected promise skips too; returning a Blob/File replaces it) |
| `customRequest` | — | `({ file, filename, onSuccess, onError, onProgress }) => (() => void) \| void`; the returned function acts as the abort handle |
| `maxCount` | — | `=== 1` clears the list on each pick; files beyond the limit are skipped |
| `disabled` / `drag` / `showUploadList` / `previewFile` | `false` / `false` / `true` / — |  |

Emits: `change: [UploadChangeParam]`, `drop: [DragEvent]`, `preview: [UploadFile, MouseEvent]`, `remove: [UploadFile]`. `UploadChangeParam = { file, fileList, event? }`; removal also fires `change` with `status: 'removed'`.

Instance methods (`defineExpose`, `:279`): **`upload()`** and `reset()`.

::: warning Two things that no longer exist

1. **There is no `action`.** The only upload hook is `customRequest`; omit it and you get a local simulation — `onSuccess({})` after 300ms (`:164`), so progress, success and failure all run with no backend at all. Do not document or copy it as a real upload.
2. **There is no `<a-upload>` `submit()`.** With `autoUpload=false` you call `upload()` (`components/upload/Upload.vue:254`). :::

File picking goes through `useFileDialog` from `@vueuse/core` (import `:7`, the call starts at `:70`), injected into the hidden `<input data-common-upload-input>` in the template (`:294-302`; the comment at `:65-69` explains why an explicit element is passed: unit tests can drive `change` on that input directly in jsdom). The app-side `AvatarUploader` (`packages/core/ui-kit/common-ui/src/components/avatar-uploader/AvatarUploader.vue:12`) and `ImportExport` (`packages/core/ui-kit/common-ui/src/components/import-export/ImportExport.vue:13`) use the same hook.

- `UploadDragger` is a thin shell: `<Upload drag v-bind="$attrs"><slot /></Upload>` with `defineOptions({ name: 'UploadDragger', inheritAttrs: false })`. Write your own drag-zone copy in the default slot.
- `UploadList` works standalone: props `items` (`[]`), `listType` (`'text'`), `showRemoveIcon` (`true`), `disabled` (`false`); emits `preview` / `remove` / `retry`. `picture-card` renders 96px (`size-24`)squares with click-to-preview; progress uses shadcn `Progress`; status colours are uploading blue / error red / done green, and failed items show a retry action.
- Thumbnails come from `URL.createObjectURL`, tracked per `uid` in a Map and revoked on `remove` / `reset` / unmount.

Real usage: `apps/web/src/views/components/upload/index.vue:10` (`Card, Image, Scrollbar, Upload`), `apps/web/src/views/system/file/index.vue:20` (`UploadDragger`). Details on [Editors & File Upload](/en/components/editor-upload).

## Tabs / TabPane

`components/tabs/`: `Tabs.vue` 111 lines (props `:15-26`, emits `:28`), `TabPane.vue` 40 lines, `context.ts` (`TABS_KEY`).

| Tabs prop | default | behaviour |
| --- | --- | --- |
| `activeKey` | — | controlled; without it the component keeps `innerActive` |
| `defaultActiveKey` | — | uncontrolled initial value; **if omitted, the first pane that registers becomes active** (`register()`, `:38-42`) |
| `type` | `'line'` | `'line' \| 'card'` |

Tabs emits: `change: [number | string]`, `update:activeKey: [number | string]` (clicking the active key emits nothing — `activate()` compares with `String()`, `:44-49`).

| TabPane prop | default | behaviour |
| --- | --- | --- |
| `value` | **required** | `number \| string` — the pane's identity |
| `label` / `tab` | — | both supported: `tab` wins, `label` is the fallback (both spellings existed before the migration) |
| `disabled` | `false` |  |

::: warning

Three differences from antdv-next — all three were hit in practice

1. **The pane prop is `value`, not `key`.** Writing `<TabPane key="a">` makes Vue consume `key` as a vnode diff key; the pane registers `undefined`, so the tab header appears but clicking does nothing.
2. **There is no `add` event and no `edit`.** antdv-next's `Tabs` has `edit(key | MouseEvent, 'add' | 'remove')`; this `Tabs` only emits `change` and `update:activeKey` (`Tabs.vue:28`). Editable tabs need your own "+" and "×" buttons outside the component.
3. **Panes mount lazily and keep state.** `TabPane.vue:27-31`: `mounted` only flips on first activation, then the template hides the pane with a `hidden` class (`:37`) instead of unmounting it with `v-if` — form content and scroll position survive switching back. If you want a fresh pane every time, reset it yourself in `@change`. :::

Real usage: `apps/web/src/views/account/center/index.vue:13-14`, `apps/web/src/views/system/notice/index.vue:14-15`, `apps/web/src/views/components/editor/index.vue:16-17`.

## Tooltip

`components/tooltip/Tooltip.vue` (78 lines); props `:13-34`.

| prop | default | behaviour |
| --- | --- | --- |
| `title` | — | tooltip text; `#title` slot also works |
| `placement` | `'top'` | the twelve antd placements: `top` / `topLeft` / `topRight` / `bottom` / `bottomLeft` / `bottomRight` / `left` / `leftTop` / `leftBottom` / `right` / `rightTop` / `rightBottom` |

`PLACEMENT` (`:37-56`)maps those twelve onto reka-ui's `side` + `align`. The default slot is the trigger, rendered through `TooltipTrigger as-child`, so **no extra DOM wrapper is added** — but the trigger must be focusable itself: an icon button is fine, a bare `<div>` needs `tabindex`.

::: warning No content means no tooltip layer

The template only wraps `TooltipProvider` when there is content; otherwise it emits a bare `<slot v-else>`. So `:title="row.remark"` with an empty string simply renders no tooltip (usually what you want) — but there is no empty bubble to hang asynchronous content on, so "content arrives on hover" needs your own guard. :::

## CronEditor

`components/cron-editor/` (`CronEditor.vue` 346 lines + `types.ts`).

| prop                     | default | behaviour                   |
| ------------------------ | ------- | --------------------------- |
| `v-model` (`modelValue`) | `''`    | a six-field cron expression |
| `disabled`               | `false` |                             |

Emits: `update:modelValue`, `change` (both `(value: string)`).

Internally the expression is split into six fields (second / minute / hour / day / month / week, typed as `CronField`: `{ key, label, min, max, allowEvery, defaultValue }`), plus 12 Chinese presets from `每分钟` = `'0 * * * * *'` to `每年 1 月 1 日` = `'0 0 0 1 1 *'`. Human-readable descriptions come from `cronstrue` + `cronstrue/locales/zh_CN`; the expression `Input` is `readonly` — you change the value through the field panels or the presets.

Real usage: `apps/web/src/views/components/cron/index.vue:4`; demo details on [Charts & Cron](/en/components/chart-cron).

## CountTo

`components/count-to/CountTo.vue` (128 lines); defaults `:9-21` (type `CountToProps` lives in `types.ts:4-78`).

| prop | default | behaviour |
| --- | --- | --- |
| `startVal` / `endVal` | `0` / `0` | range |
| `duration` | `2000` | milliseconds |
| `autoplay` | `true` | plays on mount; **only `endVal` changes replay automatically** |
| `decimals` | `0` | `toFixed` digits |
| `decimal` / `separator` | `'.'` / `','` | decimal char / thousands separator |
| `prefix` / `suffix` | `''` |  |
| `useEasing` | `true` | `false` → linear |
| `easingFn` | `'easeOutExpo'` | **only three values**: `easeInOutCubic` / `easeOutExpo` / `linear` (`:29-34`); anything else resolves to `undefined` |
| `className` / `style` | — | applied to the output `<span class="count-to">` |

Emits: `change` (**once per frame** — do not do heavy work in the listener), `finished`. Instance methods (`defineExpose<CountToInstance>`, `:116`): `start()` / `pause()` / `reset()` / `getCurrentValue()`.

The animation is driven by `useRafFn` (not `setInterval`): frame rate follows the browser, hidden tabs stop naturally, unmount pauses automatically. `start()` begins with `if (isActive) return`, so **you can pause but you cannot resume**: after `pause()` the only path is `reset()` + `start()` from the beginning — `resume` is not exposed.

Real usage: `apps/web/src/views/components/count-to/index.vue:7`, `apps/web/src/views/screen/components/RealtimeNumber.vue:3`, `apps/web/src/views/security/dashboard/components/SecurityScoreCard.vue:10`. What was deleted is the **app-side business copy** `apps/web/src/components/business/CountTo/` (commit 756a1c91 removed it together with `business/Description/`); the component itself lives in this package at `src/components/count-to/`.

## Description / Descriptions

Two components solve the same job: `Descriptions` + `DescriptionsItem` are **declarative** (you write the markup), `Description` is **configuration-driven** (`schema` + `data`).

`Descriptions` (`descriptions/Descriptions.vue`, 62 lines): props `title`, `column`(3), `layout`(`'horizontal'`), `bordered`(false), `size`(`'default' | 'middle' | 'small'`); slots `title` (defaults to `props.title`, `:46-51`), `extra`, `default`. `DescriptionsItem` (77 lines): props `label`, `span`(1); slots `label` (`:71`), `default`.

`Description` (`description/Description.vue`, 218 lines): defaults `:22-29`, types in `types.ts`:

| prop | default | behaviour |
| --- | --- | --- |
| `data` | — | value source |
| `schema` | — | `DescriptionItem[]`; items with `show === false` are filtered out |
| `column` | `3` | **`number` only** — no breakpoint object; compute responsive columns outside |
| `size` | — | `DescriptionSize = 'large' \| 'middle' \| 'small'` (`types.ts:15`) — **`'default'` was removed**; the comment explains why: the old library had deprecated `default`. Omitting = component default, and `large` renders the same as omitting. Internally it maps onto `Descriptions`' `'default' \| 'middle' \| 'small'` (`Description.vue:59-61`) |
| `layout` / `bordered` / `colon` | `'horizontal'` / `false` / `true` |  |
| `loading` | `false` | renders its own spinner placeholder |
| `emptyText` | `'-'` | replaces `null` / `undefined` / `''` (`:66`) |
| `title` / `className` / `style` | — |  |

`DescriptionItem` resolution priority (the branches of `renderValue()` are at `:120-128`): `#<field>` slot → `render(value, data)` → built-in `type` → plain text. Labels follow `#<field>-label` → `renderLabel` → `label` → `field`. `type` supports `'date' \| 'datetime' \| 'dict' \| 'image' \| 'images' \| 'tag' \| 'text'`, with `dictType` / `dateFormat` / `imageSize`.

::: warning

Four limits, each verified against behaviour

- **`type: 'tag'` does not render a Tag**: `case 'tag'` falls into the same default branch as `case 'text'` (`:163-165`). Use `render` with `h(Tag,...)` instead.
- **`type: 'dict'` no longer reads the pinia dictionary store**: it is injection-based now — the host calls `provide(DESCRIPTION_DICT_RESOLVER, fn)` (`description/context.ts:16`; the comment records that a shared component package may not import pinia or `~/...`). Without a provider, `dictResolver?.(...) ?? String(value)` (`:39-41`)means **the raw value is shown**, and empty values show `-`. As of this update nothing in the repo provides the key (only the unit test does), so `type: 'dict'` currently only echoes raw values in the app — provide a resolver if you need real dictionaries.
- **`setData()` is a stub**: its implementation only calls `console.warn('[Description] setData 不支持在只读模式下使用')` (`:175-177`). The component is read-only; the only usable instance method is `getData()` (`:174`, `defineExpose` at `:179`).
- **`DescriptionBordered` (`types.ts:25`)is used nowhere** — a leftover type; recorded so nobody reaches for it. :::

Real usage: `apps/web/src/views/components/description/index.vue:23`, `apps/web/src/views/system/online/index.vue:24` (`Description as DetailDescription`).

## StatusTag / EmptyState / ErrorBoundary / Skeletons

Four components the app used to re-implement per page; all are in the package now.

**StatusTag** (`status-tag/StatusTag.vue`, 54 lines): props `status` (**required**, `string`), `type?: 'export' | 'instance' | 'task' | 'workflow'`. The semantic table `MAP` (`:15-26`): `'0'` 处理中 / `'1'` 已完成 / `'2'` 已终止 / `'3'` 已挂起, plus `pending` / `processing` / `completed` / `failed` / `cancelled` / `timeout`; `PRESET_BY_SEMANTIC` (`:33-39`)then aligns those semantics onto `Tag`'s preset colour names (processing→blue, success→green, error→red, warning→gold, default→default). **An unknown status is shown verbatim with the default colour** (`:41-45`, `isNil` instead of `??` so an empty string is not swallowed). It renders a `<Tag :color>`.

**EmptyState** (`empty-state/EmptyState.vue`, 32 lines): props `title` (`'暂无数据'`), `description` (`''`), `icon` (`'ant-design:inbox-outlined'`, an Iconify name)+ default slot for actions. Versus `Empty`: `Empty` is the component-library "no data" placeholder (`description?: false | string`, `image?: false | string`), while `EmptyState` is the page-level "nothing here — and here is what you can do". Colours are semantic tokens now (disc `bg-muted`, glyph `text-muted-foreground`, title `text-foreground`) — the hard-coded `bg-gray-50` / `text-gray-900` it used to carry rendered black-on-black in dark mode. `Listy`'s default empty state is this component.

**ErrorBoundary** (`error-boundary/ErrorBoundary.vue`, 145 lines): props `fallback?: (error: Error, reset: () => void) => VNode`, `resetOnError`(true), `maxStackDepth`(5); emits `error: [Error]`, `reset: []`. Mechanism: `onErrorCaptured` prefixes the message with `[${info}]` and returns `false` to stop propagation (`:34-58`); in DEV it also prints a `console.group` + `console.trace` (`:48-55`); the default fallback UI is "⚠️ 出错了 / 🔄 重试 / expandable stack", with the stack area wrapped in `Scrollbar root-class="h-32"` (a fixed height, not `max-h-32`: `max-*` only clips the visible box, so the scroll region never gets a definite height and ends up "half visible, impossible to scroll"); children are wrapped in `<Suspense>` whose `#fallback` uses the `loading` slot; remount on retry happens by changing `<slot :key="errorId">`.

::: warning `maxStackDepth` has no effect path

It is declared in `interface Props` (`:11-14`) with a default of 5 at `:20`, but the implementation only renders `error.stack` in full — there is no code that trims frames. Passing `:max-stack-depth` changes nothing; this page records it as "declared, unused" rather than documenting it as an API. :::

**PageSkeleton / TableSkeleton** (`skeleton/`): both build on shadcn `Skeleton`, with the placeholder colour in `cn('bg-gray-200 dark:bg-gray-700', 'rounded-sm')` (`PageSkeleton.vue:55`, `TableSkeleton.vue:53`).

| component | props (defaults) |
| --- | --- |
| `PageSkeleton` | `loading`(true), `variant`(`'page'`; the other values are `'card' \| 'detail' \| 'form'`), `rows`(5, page variant only), `showTitle`(true), `showActions`(true), `showSidebar`(false), `class` |
| `TableSkeleton` | `loading`(true), `columns`(5), `rows`(8), `showHeader`(true), `showActions`(true), `showPagination`(true), `class` |

Real usage: `apps/web/src/views/components/loading/index.vue:6-17` (all five used together).

## BorderBeam

`components/border-beam/BorderBeam.vue` (119 lines), props and defaults at `:12-22`, types in `border-beam/types.ts` (20 lines). A purely decorative wrapper: it runs a gradient beam around the container's edge while the content stays in the default slot.

| prop | default | notes |
| --- | --- | --- |
| `color` | `'var(--primary)'` | Beam head colour; any CSS colour including `var(...)` |
| `tailColor` | `'transparent'` | Beam tail; transparent makes the head fade out of the background |
| `duration` | `6` | Seconds per revolution → `animation-duration` (`:41-44`) |
| `delay` | `0` | Seconds before the beam starts → `animation-delay`; **negative values pass through**, which is how you make it enter mid-lap |
| `size` | `25` | Arc length as a percentage of the full circle → `--bb-size: ${size}%` |
| `borderWidth` | `2` | Beam thickness; numbers become px (`toLength()`, `:25-27`) |
| `radius` | `'var(--radius)'` | Numbers become px, strings are written verbatim, so `'999px'` or another variable both work |
| `class` / `style` | none | `class` goes through `cn('relative', props.class)`; `style` is spread last on the root, so it can override the component's own variables |

Events: none. Slots: `default` only.

The implementation has three moving parts: the root writes the CSS variables and the radius → `.border-beam__ring` subtracts two mask layers (outer covers the border box, inner stops at the content box, `mask-composite: exclude`) leaving a ring exactly as thick as its padding → `.border-beam__spin` is a square at `inset: -50%`, concentric with the container and twice its size, painted with `conic-gradient(transparent → tail → color)` and rotated `360deg` infinitely. Enlarging and centring that square is what **keeps the rotation centre on the container centre**, so the beam sweeps the top and bottom edges at a uniform speed even when the box is flat. Under `@media (prefers-reduced-motion: reduce)` the animation is dropped: the beam parks, the border stays.

::: warning Two boundaries worth knowing

1. **The ring fills the parent's padding box** (that is what an absolutely positioned `inset: 0` resolves against). If the container also carries `border-*` utilities, the beam sits inside them; let `borderWidth` draw the edge on its own.
2. **The `border-beam` hook class is a static `class`, never inside `cn()`** (the class is at `:49`, `cn('relative', props.class)` only at `:50`; the comment explaining the rule sits **below it**, at `:53-57`, inside the root element): tailwind-merge reads it as the `border-{color}` family, so a caller passing `border-border` deletes the hook class in the conflict resolution, and the ring disappears. Same rule for the template: **do not put a comment before the root element** — dev builds keep comment nodes, which turns the component into a Fragment and breaks automatic `class` / `style` inheritance. :::

Real usage: `apps/web/src/views/components/border-beam/index.vue` (six configurations plus one live statistic card).

## Listy

`components/listy/Listy.vue` (430 lines), props and defaults at `:23-39`, types in `listy/types.ts` (134 lines). The default shell for row-style display: data, loading skeleton, empty state and per-row slots, with business fields carried through on the item object for the slots to read. Flip on `virtual` and the same row template turns into a ten-thousand-row virtual scroller.

| prop | default | notes |
| --- | --- | --- |
| `items` | `[]` | `ListyItem[]`. Only `title` / `description` / `extra` / `icon` / `key` are conventional; anything else rides along (`[field: string]: unknown`) |
| `itemKey` | none | A field name or `(index, item) => key`; falls back to `item.key`, then the index (`rowKey()`, `:222`) |
| `size` | `'middle'` | `'small' \| 'middle' \| 'large'` — row density (`rowClass`, `:202-208`) and title font size |
| `loading` | `false` | Skeleton mode: a `<ul aria-busy="true">` replaces the list |
| `loadingRows` | `3` | How many skeleton rows |
| `selectable` | `false` | Adds the pointer cursor and `hover:bg-accent` to rows |
| `emptyText` / `emptyIcon` | `'暂无数据'` / `'ant-design:inbox-outlined'` | Passed straight to `EmptyState` |
| `virtual` | `false` | Enables virtual scrolling: only the rows inside the viewport are rendered |
| `containerHeight` | `320` | Height of the scroll viewport in virtual mode. Numbers become px, strings are written into the style verbatim (`'50vh'`, `'100%'`) |
| `itemHeight` | `40` | Row height: a number, or `(index, item) => number` (`ListyItemHeight`). Unused in plain mode |
| `measureHeights` | `false` | Measure and feed back: drops the inline height so content decides it, and rows entering the window get measured with a `ResizeObserver`. `itemHeight` degrades to a first-frame estimate |
| `overscan` | `5` | Extra rows rendered above and below the viewport. **Read once at setup** (VueUse destructures the options), so changing it requires a remount |
| `class` / `style` | none | Same as BorderBeam: the `listy` hook class is static, the rest goes through `cn()` |

Two events: `itemClick: [ListyItem, number]` (written `@item-click`) and `scroll: [ListyScrollState]` (written `@scroll`). The latter is a snapshot emitted only when the position changes: `{ startIndex, endIndex, visibleCount, scrollTop, scrollHeight, progress }`. Programmatic scrolling and in-place data swaps take the same path.

Seven slots: `header`, `loading` (replaces the whole skeleton), `empty` (replaces the whole empty state), `item` (the whole row), `item-media` (row head), `item-extra` (row tail), `footer`. `header` / `footer` are gated on `slots.xxx`, so **they render nothing at all when absent** — no stray divider strip. In virtual mode slots receive the **absolute upstream index**, not the position inside the window.

What the instance exposes (`defineExpose`, `:295`): reactive state `visibleItems` / `visibleRange` / `scrollState` / `totalHeight` / `isScrolling` / `directions` / `arrivedState` / `containerElement` — reading `computed(() => listyRef.value?.scrollState)` from the outside keeps you inside the dependency graph — and the methods `scrollToIndex(index, { behavior, block })` / `scrollTo(offset, behavior)` / `scrollToTop()` / `scrollToBottom()` / `recalc()`. Out-of-range indexes are clamped, and calling them on an empty list is a no-op rather than a throw.

Basic usage (20 000 rows, a dozen of them in the DOM):

```vue
<script setup lang="ts">
import type { ListyItem, ListyScrollState } from '@antdv/common-ui';

import { ref } from 'vue';

import { Listy } from '@antdv/common-ui';

const rows: ListyItem[] = Array.from({ length: 20_000 }, (_, index) => ({
  description: `第 ${index} 条`,
  key: index,
  title: `条目 ${index}`,
}));

const listy = ref<InstanceType<typeof Listy> | null>(null);

function onScroll(state: ListyScrollState) {
  // startIndex / endIndex / visibleCount / scrollTop / scrollHeight / progress
  console.log(state.startIndex, state.progress);
}
</script>

<template>
  <Listy
    ref="listy"
    :container-height="320"
    :items="rows"
    :item-height="48"
    item-key="key"
    selectable
    :virtual="true"
    @item-click="(item) => console.log(item.title)"
    @scroll="onScroll"
  />
  <button @click="listy?.scrollToIndex(10_000, { behavior: 'smooth' })">
    跳到第 10 000 行
  </button>
</template>
```

### How the virtual mode works

Three VueUse hooks carry it; none of the scroll arithmetic is hand written: `useVirtualList` owns the window and the offsets, `useScroll` owns position / direction / arrived state, `useResizeObserver` owns the container size and the dynamic row measurements.

- **The `<ul>` is itself the spacer**: `wrapperProps.style` supplies `marginTop` (everything before the window) and `height` (the remainder), and the two always add up to the content height. That is why virtual and plain modes share one `<li>` template instead of needing an "outer spacer + absolutely positioned inner list" scaffolding.
- **`itemHeight` is always handed to VueUse as a function** (`rowHeight()`, `:60`; wired in at `:87`). A number would be frozen at setup, so later prop changes would not recompute; a function re-reads the latest props every pass, at the cost of turning VueUse's offset scan from O(1) into O(n) — measured in the tens of microseconds for 10k uniform rows, which buys "change the prop and it just works".
- **The arithmetic height must equal the real height.** Fixed mode pins it by inlining `height` on the `<li>` (`box-border`, padding included), so DOM and arithmetic share one ruler. When content can wrap, either supply a height function that actually computes it, or turn on `measure-heights`.
- **`measure-heights` observes only the rows currently in the window** (`measuredTargets`, `:158`). VueUse rebuilds the observer when the target array changes, and `observe()` always fires once for a newly added element, so head insertions that shift indexes heal themselves on the next measurement pass — no manual cache invalidation.
- **The first frame computes its own window** (`recalc()` in `onMounted`): `useElementSize` and `ResizeObserver` are both async callbacks, so without this 10k lists would stay empty until the first scroll (and forever in environments without `ResizeObserver`). Container resizes need nothing extra — `totalHeight` plus VueUse's size watch already cover it.

::: warning

`selectable` is explicit, not "auto-cursor when a listener exists" Once a component declares `emits`, its listeners no longer appear in `attrs`, so the implementation cannot sniff whether anyone is listening (that is what the comment at `:199` records). And even if it could, giving hover feedback to a purely informational list would just trick users into clicking something that does nothing. :::

::: warning

Virtual mode needs a box that can actually scroll `container-height: '100%'` requires an ancestor with a height, otherwise the viewport measures 0 and the window collapses to the `overscan` rows. The height function (when you pass one) **must only read**: writing reactive state inside it makes "scroll → recompute → height changed → recompute" self-exciting. :::

Real usage: `apps/web/src/views/components/listy/index.vue` (eight cards: basic, loading, empty, slots, then fixed heights over 20 000 rows, function heights, measured dynamic heights and a plain-mode control). Two unit files: `__tests__/listy.test.ts` (12 cases) and `__tests__/listy-virtual.test.ts` (17 cases — jsdom pins state and styles only). The scroll geometry is measured in the browser by `apps/web/e2e/listy-virtual.spec.ts` (8 cases × three engines): whether rows really come out 48px tall, whether `marginTop + height` equals the content height, and whether the window shrinks when the container does.

## Auth family (login / register chrome)

`components/auth/` ships four pieces: `AuthPageLayout` (three-column shell plus the brand panel), `AuthFormPanel` (title block plus the form slot), `AuthSocialLogin` (the third-party entry row) and `AuthColorPresets` (the theme-colour trigger in the toolbar). This layer knows nothing about stores, routers or i18n — copy and colour swatches are computed by the host and passed in.

`AuthSocialItem.icon` takes two shapes: a **string** resolves as an iconify icon name, a **Vue component** renders as given. The component shape exists for icons that are not in the offline iconify set — brand logos have to come from the host. The four entries on the login and register pages take exactly that route: the SVGs live in `apps/web/src/assets/icons/`, `vite-plugin-svg-icons` bundles them into a sprite under `#icon-<filename>` (registered by `import 'virtual:svg-icons-register'` in `main.ts`), and `SvgIcon` from `@antdv/icons` renders one:

```ts
import type { AuthSocialItem } from '@antdv/common-ui';

import { h } from 'vue';

import { SvgIcon } from '@antdv/icons';

const socialIcon = (name: string) => () => h(SvgIcon, { name, size: 18 });

export const AUTH_SOCIAL_ITEMS: AuthSocialItem[] = [
  { icon: socialIcon('github'), label: 'GitHub', value: 'github' },
];
```

::: warning The component shape sizes itself

`AuthSocialLogin` only puts `size-[18px]` on the outer wrapper, which cannot beat the inline width/height `SvgIcon` writes (16px when `size` is omitted), so the host must pass `size` explicitly. :::

Real usage: `apps/web/src/config/auth-social.ts` (the four sprite entries, shared by login and register) and `apps/web/src/views/login/index.vue`.

## MicroAppContainer (micro-frontend shell)

`components/micro-app-container/MicroAppContainer.vue` wraps the `<micro-app>` custom element from `@micro-zoe/micro-app` in a declarative shell: loading overlay, failure retry, and a placeholder for "no URL configured". At runtime the SDK dispatches four **window** events per instance — `beforeload-${name}` / `mounted-${name}` / `unmount-${name}` / `error-${name}` — which the component collapses into Vue emits via `useEventListener` (`:76-79`, auto-detached on unmount).

props (`types.ts:1-11`, defaults at `MicroAppContainer.vue:20-26`):

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `name` | `string` | required | micro-app instance name, also the event-name prefix |
| `url` | `string` | `undefined` | child app entry; without it a "未配置应用地址" placeholder appears after 800 ms (`:82-92`) |
| `className` | `string` | `undefined` | appended to the root, whose base classes are `micro-app-container relative size-full` |
| `baseroute` | `string` | `undefined` | passed through to `<micro-app>` |
| `keepAlive` | `boolean` | no default | passed through as the `keep-alive` attribute |
| `disableMemoryRouter` | `boolean` | `true` | passed through as `disable-memory-router` |
| `disablePatchRequest` | `boolean` | `false` | passed through as `disable-patch-request` |

Events: `beforeload`, `mounted`, `unmount` take no payload; `error` carries an `Error` (`types.ts:13-18`). The SDK sends a `CustomEvent`, and the component reads `detail.message`, falling back to `子应用 ${name} 加载失败` (`:61-67`).

::: warning

`<micro-app>` is not a component The tag is recognised by the `isCustomElement` hook in `internal/vite-config` (the comment at `MicroAppContainer.vue:17-18`), so it does not need registering in any `componentMap`; declaring it as a local component is what triggers `Failed to resolve component`. **In a host without the micro-app SDK this page is only a shell**: the overlay and the placeholder render normally, `<micro-app>` degrades into an unknown tag and no child app mounts. The retry button only flips local state (`handleRetry` resets `loading`/`hasError`/`retryCount`, `:69-73`); it does not re-trigger the SDK's load pipeline. :::

::: warning

Nobody consumes this component yet The embed page actually running in the app is `apps/web/src/views/micro-app/SubAppView.vue`, which writes `<micro-app>` itself (`:286`) and keeps its own loading/error state (`hasError` at `:29`, the handlers at `:136-164`, the loading/error fallback UI at `:308-332`) without importing this component. `MicroAppContainer` came over from `apps/web/src/components/business/` because it is the reusable shell — but today **nothing reuses it**. Before adopting it, decide whether SubAppView should consume it instead of adding a third variant. :::

## Charts: `@antdv/common-ui/charts`

`ECharts` is this package's only subpath export, with three props (`option` required, `height` defaulting to `'320px'`, `loading` defaulting to `false`), no events, and nothing exposed on the instance. The full behavioural breakdown lives in the chart section of [Charts and Cron](/en/components/chart-cron); what belongs here is why it gets its own entry: `import * as echarts from 'echarts'` drags the whole registry into the module graph, and that cost should not be charged to every `@antdv/common-ui` consumer.

## Toaster (toast container)

`components/toast/Toaster.vue` (201 lines) is a themed shell over vue-sonner's `Toaster`: its props _are_ `ToasterProps` (re-exported from `index.ts`), passed through with `v-bind="props"`, and it only adds three things — the `--normal-*` variable group (`:43-48`), `toastOptions.classes` (`:58-63`, merged entry by entry with the host's), and six "named slot with default content" state badges (`:96-165`). The palette contract, the two-toaster split and how `message` / `notification` relate to it all live in the "Messages and notifications" section of [Modals & drawers](/en/components/modal-drawer); this entry only explains why the layer sits in this package.

::: warning

The styling layer is not in `@antdv/shadcn-ui` That package's `Sonner.vue` hardcodes `rich-colors` _after_ `v-bind` (nothing can pass it in) and hardcodes its state icons inside slots (nothing can pass them out). Replacing either without editing its source means betting our selectors on which lucide icons it picked, and that bet expires on the next upgrade. So this package builds its own shell straight on vue-sonner: `@antdv/shadcn-ui` did not change by a line, and whatever it adds, removes or iterates cannot reach here. Hosts only change where they import from: `import { Toaster } from '@antdv/common-ui'`. :::

## The remaining entries

These are documented where their demos live; only signatures here, to avoid duplication.

| component | props (defaults) | events / slots |
| --- | --- | --- |
| `Alert` | `type`(`'info'`), `message`, `description`, `showIcon`(true), `variant` | slots `title` (defaults to `message`), `default`; error forces the root variant to `destructive` |
| `Card` | `title`, `description`, `variant`(`'outlined' \| 'borderless'`), `bodyClass` | slots `title`, `extra`, `footer`, `default`; the header only renders when title/description/`extra` exist |
| `Divider` | `type`(`'horizontal'`), `dashed`(false), `titlePlacement` | default slot is the divider label |
| `Segmented` | `options`(`(SegmentedOption \| string)[]`), `value`, `size`(`'middle'`), `block`(false), `disabled`(false) | `change`, `update:value`; `SegmentedOption = { label, value, icon?, disabled? }` |
| `Space` | `direction`(`'horizontal'`), `size`(`'small'`, also `'large' \| 'middle' \| number`), `align`, `wrap`(false) | large 24 / middle 16 / small 8 |
| `Statistic` | `title`, `value`, `precision`, `prefix`, `suffix`, `decimalSeparator`(`'.'`), `groupSeparator`(`','`), `loading`(false), `valueStyle` | slots `title`, `prefix`, `suffix`, `formatter`, `default` |
| `Tag` | `color`, `bordered`(true) | a `color` matching a preset name (blue / cyan / default / geekblue / gold / green / lime / magenta / orange / purple / red / volcano) uses that class table; anything else becomes a custom background |
| `Popconfirm` | `title`, `description`, `okText`(`'确定'`), `cancelText`(`'取消'`), `danger`(false), `placement`(`'top'`, only `top \| bottom \| left \| right`), `disabled`, `v-model:open` | `confirm`, `cancel`; slots `title`, `description`, `default` (trigger) |
| `Timeline` / `TimelineItem` | Timeline: `mode`, `labelPlacement`, `pending`(`boolean \| string`), `reverse`. Item: `color`(`'blue'`), `label`, `position` | Item slots `dot`, `label`, `default`; parent/child talk through `TIMELINE_KEY` |
| `Tree` | `treeData`, `checkable`(false), `selectable`(true), `blockNode`(false), `checkedKeys` / `expandedKeys` / `selectedKeys` (all three support `v-model:`)plus the `default*` variants, `defaultExpandAll`(false), `fieldNames` | `check`, `expand`, `select` + the three `update:*Keys`; the recursive child is the internal `tree/TreeNodes.vue` |

## Eight conventions for this package

Getting these wrong produces no error — only silent breakage. Each line was verified against behaviour.

| convention | why |
| --- | --- |
| `Checkbox` / `Switch` always use `:model-value` + `@update:model-value` (or plain `v-model`) | Those two primitives are **not in this barrel**; they come from `@antdv/shadcn-ui` (`src/index.ts:15`, `:58`), and the wrappers simply `useForwardPropsEmits` onto reka-ui's `CheckboxRoot` / `SwitchRoot`, whose model name in reka v2 is `modelValue`. Writing `:checked` is ignored (the control stays at its initial value)and `@change` never fires. The correct in-repo example is `apps/web/src/views/account/settings/index.vue:286-291`. The confusion comes from antdv-next's `Switch`, which does use `:checked` — but nothing in the repo imports `Switch` from `antdv-next` any more (measured: `grep -rn Switch` crossed with `antdv-next` returns zero hits), and the `SettingDrawer/**` directory that used to owe this debt no longer exists; the settings drawer is `packages/layouts/src/widgets/setting-drawer/**` now and takes `Switch` from `@antdv/shadcn-ui` |
| `<TabPane value="...">`, never `key` | The required prop in `TabPane.vue:13` is `value`; `key` is eaten by Vue and the pane registers as `undefined` (see the Tabs section) |
| `Popconfirm` uses `danger`, not `ok-type="danger"` | `popconfirm/Popconfirm.vue:22` declares `danger?: boolean` (default `false` at `:33`); there is no `ok-type` prop in the file, so passing it neither errors nor works |
| `Modal.confirm` → `confirm()`; `message` also comes from `@antdv/popup-ui` | `packages/core/ui-kit/popup-ui/src/index.ts` is four `export *` lines (`:1-4`: alert, drawer, message, modal) plus types, and all four entry points live in that package. On the app side **44 files** import `@antdv/popup-ui` (counting method: `grep -rl "@antdv/popup-ui" apps/web/src \| wc -l` = 44, of which 39 are `.vue`; the spread is views 35 / components 5 / utils 2 / plugins 1 / the root `App.vue` 1), plus 5 more inside `@antdv/layouts`' widgets (`notification`, `account-drawer`, `logout`, `setting-drawer/index.vue`, `setting-drawer/components/setting-footer.vue`). The typical line is `import { confirm, message } from '@antdv/popup-ui'` (e.g. `apps/web/src/views/account/center/index.vue:19`) |
| Tailwind only understands **literal class strings** | Status→colour always goes through a lookup table (`STATUS_DOT` in `Badge.vue:37-44`, `CIRCLE` in `Steps.vue:37-43`, `PRESET` in `Tag.vue`); never `bg-${color}-500`, and do not expect the scanner to see dynamic strings |
| Do not write `cn(...)` in templates, especially with a trailing comma | `<div :class="cn('a', 'b',)">` breaks template expression parsing. Keep `cn()` calls in `<script setup>` as `computed` values or constants and reference the variable — every demo page follows this shape |
| BEM hook classes (`border-beam`, `listy`) live on the static `class`, not inside `cn()` | `twMerge` resolves conflicts per utility family: it reads `border-beam` as the `border-{color}` group and `listy` as the `list-{type}` group. A caller passing `border-border` or `list-none` deletes the hook class outright, and the ring / row styling vanishes. Hook class locations: `BorderBeam.vue:49` (the comment is at `:53-57`), `Listy.vue:314` (the comment is at `:323-326`); regression tests `common-ui/__tests__/border-beam.test.ts:77-79`, `common-ui/__tests__/listy.test.ts:133-136` |
| No comment before the root element in `<template>` | Dev builds preserve comment nodes, so a leading comment turns the template into a Fragment: `wrapper.classes()` comes back empty and non-prop `class` / `style` stop being inherited. Put the explanation inside the root element (both new components learned this the hard way) |

## Relationship to antdv-next

This package **does not import antdv-next**. Its workspace `dependencies` are only `@antdv/icons`, `@antdv/popup-ui`, `@antdv/request`, `@antdv/shadcn-ui`, `@antdv/shared`; the external ones are `@vueuse/core`, `cronstrue`, `es-toolkit`, `marked`, `vue`, `vue-sonner`, `@iconify/vue`, `@lucide/vue`, the tiptap set, and `echarts` — which exists solely for the `./charts` subpath (`packages/core/ui-kit/common-ui/package.json`). `@antdv/request` and `@antdv/popup-ui` appear only on the MarkdownEditor upload/error path (`markdown-editor/utils.ts:1-2`, `MarkdownEditor.vue:20`), and what they bring in is `request` and `message` — not a store, not the router. Any host project that installs those workspace packages can use it — see [External Modules](/en/guide/essentials/external).

No page under `apps/web` imports antdv-next any more. Counting method: run the _import shape_ pattern (`from 'antdv-next'` / `import('antdv-next')` / `@antdv-next/*`) over `*.ts` / `*.mts` / `*.tsx` / `*.vue` / `*.js` in `apps` + `packages` + `internal` — 3 hits, **all of them strings inside `__tests__` directories**: the positive/negative samples fed to the guard itself (`apps/web/src/views/__tests__/gallery-api-usage.spec.ts:156`, `:159`) and one comment (`packages/core/hooks/__tests__/boundary.test.ts:14`). Exclude the test directories and the count is **zero**. All four application-side footholds came apart one by one: `plugins/vendor-antd-components.ts`, which manually registered the 36 `a-*` names for `@form-create/antd-designer`, was deleted together with the form designer; the whole `settings/theme/` directory is gone and `apps/web/src/settings/index.ts` keeps only the "preferences → DOM" leg, its own comment (`:9-14`) stating that nothing is translated into any UI library's `ThemeConfig` any more — component colours go through the shadcn canonical token names and there is a single theme chain; `App.vue:3-7` now takes `ConfigProvider` and `Toaster` from `@antdv/common-ui`; and the fullscreen glyph in `views/screen/components/ScreenHeader.vue:4-5` is an `@iconify/vue` `Icon`. The build layer is clean too: `createOptimizeDeps()` allowlists `['@vueuse/core', 'es-toolkit']` (`internal/vite-config/src/config/application.ts:59-66`), and `internal/vite-config/src/optimize.ts` contains neither `antdv-next` nor a `vendor-ui` bucket.

The remaining literal hits fall into three groups, none of which is a dependency. `'antdv-next-token-*'` in `packages/core/base/shared/src/cache/tokenCrypto.ts:13`, `:60` is a historical cache key (rotating it would log every signed-in user out, so it is kept on purpose, and the boundary guard only catches import shapes anyway). The guard tests — `gallery-api-usage.spec.ts:122` (the combined regex), `packages/core/base/icons/__tests__/icons.test.ts:30-32`, `packages/core/base/design/__tests__/design.test.ts:462`, `:587`, `packages/request/__tests__/structure.spec.ts:46` — name it deliberately as a **counter-example**, as the fuse that stops anyone putting it back. `internal/vite-config/__tests__/config.test.ts:133-137` even keeps an assertion on a `/node_modules/antdv-next/es/button/index.js` path, requiring it to land in the catch-all `vendor` chunk; its comment says outright that this exists "in case someone puts antd back into the build without adding a chunk rule". Beyond that, every `antdv-next.com` in the repo is a mock-menu demo link or a test fixture, and `antdv-next-admin` is the repository name itself.

## Related pages

- [Component examples](/en/components/) — demo routes and how to open them
- [Design tokens and global styles](/en/guide/essentials/design) — the `--*` variables these components use, and the `@source` registration rules
- [Data & Display](/en/components/display) — the `Description` / `CountTo` demo pages and their traps
- [Editors & File Upload](/en/components/editor-upload) — the `Upload` / `Image` / cropping demos
- [Charts & Cron](/en/components/chart-cron) — the `CronEditor` demo
- [Modals & Drawers](/en/components/modal-drawer) — `confirm()` / `message` from `@antdv/popup-ui`
- [Table](/en/components/table) — `Tag` / `Space` / `Popconfirm` in the action column
