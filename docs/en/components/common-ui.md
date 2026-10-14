# Shared Components (`@antdv/common-ui`)

This page documents `packages/ui-kit/common-ui` — the route-agnostic, cross-page presentational components: 34 exported values. Every one of them is **composed from primitives in `@antdv/shadcn-ui`** (reka-ui); the package does not know antdv-next exists and does not know the app exists — no store, no router, no `~/...` alias inside.

The refactor landed in code before it landed in docs, so this page is the catch-up: `Description` and `CountTo`, which used to live in `apps/web/src/components/business/`, are now in this package, and a second batch (Badge, Steps, Result, Transfer, Image, Upload, Tabs …) was extracted from demo pages that each kept their own copy.

::: tip APIs only, no narrative
Every props / events / slots / instance-method line below is copied from the real `defineProps` / `defineEmits` / `defineExpose` in the source, with file:line. For "what do I click and what happens", use the routes listed under [Component examples](/en/components/); for the CSS variables these components consume, see [Design tokens and global styles](/en/guide/essentials/design).:::

## How to import: the root entry only

`packages/ui-kit/common-ui/package.json` declares exactly two `exports` keys: `.` (→ `./src/index.ts`) and `./package.json`. **There are no subpath exports**, so `@antdv/common-ui/components/badge` fails at Node resolution with `ERR_PACKAGE_EXPORTS` — it is not "allowed but discouraged".

```ts
// ✅ named imports, always from the package barrel
import { Card, Popconfirm, Tag } from '@antdv/common-ui';

// ❌ this subpath does not exist
import { Badge } from '@antdv/common-ui/components/badge';
```

ESLint enforces `vue/component-name-in-template-casing: PascalCase` (`internal/lint-configs/eslint-config/src/configs/vue.ts:71`), so templates read `<Card>` / `<Popconfirm>` — no `as ACard` alias, that was the old convention for kebab-case `a-*` tags.

Directory layout is **one kebab-case directory per component**:

```text
packages/ui-kit/common-ui/src/components/<kebab>/
 ├── <PascalCase>.vue   # the component
 ├── index.ts       # named + default export (the barrel only takes the named one)
 ├── types.ts       # optional: props / emits / data shapes
 └── context.ts      # optional: provide / inject keys
```

Internal cross-references use relative paths (`status-tag/StatusTag.vue:6` imports `../tag`); consumers only ever see the barrel.

## Full export list

The 34 value exports from `src/index.ts`, grouped by purpose:

| Group | Exports |
| --- | --- |
| Containers & layout | `Card`, `Divider`, `Space`, `Empty`, `EmptyState`, `ErrorBoundary` |
| Status & identity | `Badge`, `Tag`, `StatusTag`, `Alert`, `Result`, `Steps` |
| Data display | `Description`, `Descriptions`, `DescriptionsItem`, `Statistic`, `CountTo`, `Image`, `Timeline`, `TimelineItem`, `Tooltip` |
| Interaction & switching | `Tabs`, `TabPane`, `Segmented`, `Popconfirm`, `Transfer`, `Tree` |
| Upload | `Upload`, `UploadDragger`, `UploadList` |
| Skeletons | `PageSkeleton`, `TableSkeleton` |
| Editors | `CronEditor` |
| Injection key | `DESCRIPTION_DICT_RESOLVER` |

Type exports: `CountToEvents` / `CountToInstance` / `CountToProps`, `CronEditorEmits` / `CronEditorProps` / `CronField` / `CronPreset`, `DescriptionInstance` / `DescriptionItem` / `DescriptionLayout` / `DescriptionProps` / `DescriptionSize` / `DictResolver`, `TabPaneProps`, `TransferDirection` / `TransferItem` / `TransferKey`, `NormalTreeNode` / `TreeContext` / `TreeFieldNames` / `TreeKey`, `UploadChangeParam` / `UploadFile` / `UploadListType` / `UploadRequestOptions`.

::: warning `UploadProps` is not exported
`components/upload/index.ts` declares `export type { UploadProps }`, but the re-export block in `src/index.ts:60-65` does not include it. To type Upload props in a page, compose `import type { UploadFile, UploadChangeParam } from '@antdv/common-ui'` instead — or leave it untyped.:::

## Badge

`components/badge/Badge.vue` (109 lines); props and defaults at `:10-35`.

| prop | default | behaviour |
| --- | --- | --- |
| `count` | `0` | numeric bubble; shows `${max}+` when `> max` (`:57-59`) |
| `max` | `99` | upper bound |
| `dot` | `false` | dot mode, ignores the `count` display |
| `show` | `true` | visibility; `visible = show && (dot \|\| count > 0)` (`:53-55`) — with `count: 0` and no `dot` the bubble is not rendered |
| `status` | — | `'default' \| 'error' \| 'processing' \| 'success' \| 'warning'`; **supplying it switches the render mode** (`statusMode`, `:48`) |
| `text` | — | only shown next to the dot in `status` mode |
| `color` / `numberStyle` / `offset` / `title` | — | custom colour / bubble style / offset / native `title` |

The two modes are mutually exclusive: with `status` you get dot + `text` + default slot; without it you get the default slot plus a `<sup>` bubble. **With no default slot the bubble degrades to standalone inline display** (`standalone`, `:50-51`). Events: none.

Status dot colours are a **literal class table** `STATUS_DOT` (`:37-44`, e.g. `processing: 'animate-pulse bg-blue-500'`) — Tailwind only scans literals, so this table must not become string interpolation.

Real usage: `apps/web/src/views/security/dashboard/components/SecurityTimeline.vue:11`.

## Steps

`components/steps/Steps.vue` (160 lines); props `:9-26`, emits `:28`.

| prop | default | behaviour |
| --- | --- | --- |
| `current` | `0` | index of the active step; works with `v-model:current` |
| `items` | `[]` | `StepItem[] = { title?, description? }` (`:30-33`) — **those two fields only**; no per-item antd `status` / `icon` |
| `direction` | `'horizontal'` | `'horizontal' \| 'vertical'` |
| `size` | `'default'` | `'default' \| 'small'`; icon 12px vs 14px (`:47-49`) |
| `status` | — | `'error' \| 'finish' \| 'process'`, **rewrites only the current step**, the rest is still derived from `current` (`stateOf`, `:51-56`) |
| `clickable` | `false` | renders each step as a `<button>` (`aria-label` from `item.title`); only then do clicks emit |

Emits: `change: [number]`, `update:current: [number]`. `select()` is guarded: **with `clickable: false` clicking a step emits nothing**. Colours come from the literal table `CIRCLE` (`:37-43`, four states `error` / `finish` / `process` / `wait`); finished steps show `carbon:checkmark`.

Real usage: `apps/web/src/views/components/form/steps/index.vue:16` (paired with `Result` for the submit-success screen).

## Result

`components/result/Result.vue` (72 lines); props `:9-20`.

| prop | default | behaviour |
| --- | --- | --- |
| `status` | `'info'` | `'403' \| '404' \| '500' \| 'error' \| 'info' \| 'success' \| 'warning'` (`:22-29`) |
| `title` / `subTitle` | — | both optional text nodes |

Slots: `default` (description area), `extra` (action buttons, `:69`). Events: none. Icon and colour per status live in `PRESET` (`:31-40`): `403` → amber `carbon:warning`, `404` → blue `carbon:document`, `500` → red `carbon:fire`, `error` → `carbon:close-outline`, `info` → `carbon:information`, `success` → emerald `carbon:checkmark-outline`, `warning` → `carbon:warning-alt`. An unknown `status` falls back to `info` (`:42-44`).

## Transfer

`components/transfer/Transfer.vue` (275 lines); props `:15-37`, emits `:38-41`, types in `transfer/types.ts`.

| prop | default | behaviour |
| --- | --- | --- |
| `dataSource` | `[]` | `TransferItem[] = { key, disabled?, title?, [k: string]: any }` |
| `targetKeys` (`v-model:target-keys`) | `[]` | `defineModel<TransferKey[]>('targetKeys')` (`:43`); the right panel follows this order, the left keeps `dataSource` order |
| `oneWay` | `false` | keeps only the "→" button |
| `operation` | `['>', '<']` | button labels |
| `titles` | `['源列表', '目标列表']` | panel headers (Chinese defaults are intentional — this is a Chinese-first admin template) |
| `showSearch` | `false` | search box on top of each panel |
| `render` | — | `(item) => string`; falls back to `item.title` |
| `disabled` / `listStyle` | `false` / — | |

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
| `rootClassName` / `class` / `style` | — | |

Emits: `update:previewVisible: [boolean]` (`:42`). The preview layer is shadcn `Dialog` + `DialogContent` + `DialogTitle` + `DialogDescription`.

::: warning The three `preview` spellings differ
- omitted or `true` → clickable, uncontrolled.
- `preview={{ visible }}` (`visible` is a boolean)→ **controlled**; pair it with `@update:preview-visible`.
- `preview={{ visible: false }}` with no `onVisibleChange` → treated as **statically disabled**, the preview affordance is not rendered at all (`showPreview`, `:55-60`); `preview=false` behaves the same.
This mirrors the pre-migration "hide preview" usage: `preview={false}` and `preview={{ visible: false }}` are equivalent, while `preview={{}}` is clickable.:::

## Upload / UploadDragger / UploadList

`components/upload/`: `Upload.vue` 307 lines (props `:13-46`), `UploadDragger.vue` 11 lines, `UploadList.vue` 136 lines (props `:12-26`), `types.ts`.

| prop | default | behaviour |
| --- | --- | --- |
| `fileList` (`v-model:file-list`) | `[]` | `defineModel<UploadFile[]>('fileList')` (`:56`) |
| `accept` / `multiple` | — / `false` | handed to `useFileDialog` through computeds (`:61-62`), so the hidden `input` refreshes when the props change |
| `listType` | `'text'` | `'text' \| 'picture' \| 'picture-card'` |
| `autoUpload` | `true` | turn it off and call the instance method `upload()` yourself |
| `beforeUpload` | — | `(file, list) => any`: **returning `false` skips the upload** (a rejected promise skips too; returning a Blob/File replaces it) |
| `customRequest` | — | `({ file, filename, onSuccess, onError, onProgress }) => (() => void) \| void`; the returned function acts as the abort handle |
| `maxCount` | — | `=== 1` clears the list on each pick; files beyond the limit are skipped |
| `disabled` / `drag` / `showUploadList` / `previewFile` | `false` / `false` / `true` / — | |

Emits: `change: [UploadChangeParam]`, `drop: [DragEvent]`, `preview: [UploadFile, MouseEvent]`, `remove: [UploadFile]`. `UploadChangeParam = { file, fileList, event? }`; removal also fires `change` with `status: 'removed'`.

Instance methods (`defineExpose`, `:272`): **`upload()`** and `reset()`.

::: warning Two things that no longer exist
1. **There is no `action`.** The only upload hook is `customRequest`; omit it and you get a local simulation — `onSuccess({})` after 300ms (`:162`), so progress, success and failure all run with no backend at all. Do not document or copy it as a real upload.
2. **There is no `<a-upload>` `submit()`.** With `autoUpload=false` you call `upload()` (`components/upload/Upload.vue:247`).:::

File picking goes through `useFileDialog` from `@vueuse/core` (`:7`, from `:71`), injected into the hidden `<input data-common-upload-input>` in the template — the comment at `:63-67` explains why an explicit element is passed: unit tests can drive `change` on that input directly in jsdom. The app-side `AvatarUploader` and `ImportExport` use the same hook (`apps/web/src/components/business/ImportExport.vue`, top imports).

- `UploadDragger` is a thin shell: `<Upload drag v-bind="$attrs"><slot /></Upload>` with `defineOptions({ name: 'UploadDragger', inheritAttrs: false })`. Write your own drag-zone copy in the default slot.
- `UploadList` works standalone: props `items` (`[]`), `listType` (`'text'`), `showRemoveIcon` (`true`), `disabled` (`false`); emits `preview` / `remove` / `retry`. `picture-card` renders 96px (`size-24`)squares with click-to-preview; progress uses shadcn `Progress`; status colours are uploading blue / error red / done green, and failed items show a retry action.
- Thumbnails come from `URL.createObjectURL`, tracked per `uid` in a Map and revoked on `remove` / `reset` / unmount.

Real usage: `apps/web/src/views/components/upload/index.vue:6` (`Card, Image, Upload`), `apps/web/src/views/system/file/index.vue:16` (`UploadDragger`). Details on [Editors & File Upload](/en/components/editor-upload).

## Tabs / TabPane

`components/tabs/`: `Tabs.vue` 108 lines (props `:15-25`, emits `:28`), `TabPane.vue` 38 lines, `context.ts` (`TABS_KEY`).

| Tabs prop | default | behaviour |
| --- | --- | --- |
| `activeKey` | — | controlled; without it the component keeps `innerActive` |
| `defaultActiveKey` | — | uncontrolled initial value; **if omitted, the first pane that registers becomes active** (`register()`, `:35-39`) |
| `type` | `'line'` | `'line' \| 'card'` |

Tabs emits: `change: [number | string]`, `update:activeKey: [number | string]` (clicking the active key emits nothing — `activate()` compares with `String()`, `:33-37`).

| TabPane prop | default | behaviour |
| --- | --- | --- |
| `value` | **required** | `number \| string` — the pane's identity |
| `label` / `tab` | — | both supported: `tab` wins, `label` is the fallback (both spellings existed before the migration) |
| `disabled` | `false` | |

::: warning Three differences from antdv-next — all three were hit in practice
1. **The pane prop is `value`, not `key`.** Writing `<TabPane key="a">` makes Vue consume `key` as a vnode diff key; the pane registers `undefined`, so the tab header appears but clicking does nothing.
2. **There is no `add` event and no `edit`.** antdv-next's `Tabs` has `edit(key | MouseEvent, 'add' | 'remove')`; this `Tabs` only emits `change` and `update:activeKey` (`Tabs.vue:28`). Editable tabs need your own "+" and "×" buttons outside the component.
3. **Panes mount lazily and keep state.** `TabPane.vue:25-29`: a pane mounts on first activation, then is hidden with a `hidden` class instead of being unmounted by `v-if` — form content and scroll position survive switching back. If you want a fresh pane every time, reset it yourself in `@change`.:::

Real usage: `apps/web/src/views/account/center/index.vue:13-14`, `apps/web/src/views/system/notice/index.vue:14-15`, `apps/web/src/views/components/editor/index.vue:14-15`.

## Tooltip

`components/tooltip/Tooltip.vue` (75 lines); props `:13-34`.

| prop | default | behaviour |
| --- | --- | --- |
| `title` | — | tooltip text; `#title` slot also works |
| `placement` | `'top'` | the twelve antd placements: `top` / `topLeft` / `topRight` / `bottom` / `bottomLeft` / `bottomRight` / `left` / `leftTop` / `leftBottom` / `right` / `rightTop` / `rightBottom` |

`PLACEMENT` (`:36-53`)maps those twelve onto reka-ui's `side` + `align`. The default slot is the trigger, rendered through `TooltipTrigger as-child`, so **no extra DOM wrapper is added** — but the trigger must be focusable itself: an icon button is fine, a bare `<div>` needs `tabindex`.

::: warning No content means no tooltip layer
The template only wraps `TooltipProvider` when there is content; otherwise it emits a bare `<slot v-else>`. So `:title="row.remark"` with an empty string simply renders no tooltip (usually what you want) — but there is no empty bubble to hang asynchronous content on, so "content arrives on hover" needs your own guard.:::

## CronEditor

`components/cron-editor/` (`CronEditor.vue` 344 lines + `types.ts`).

| prop | default | behaviour |
| --- | --- | --- |
| `v-model` (`modelValue`) | `''` | a six-field cron expression |
| `disabled` | `false` | |

Emits: `update:modelValue`, `change` (both `(value: string)`).

Internally the expression is split into six fields (second / minute / hour / day / month / week, typed as `CronField`: `{ key, label, min, max, allowEvery, defaultValue }`), plus 12 Chinese presets from `每分钟` = `'0 * * * * *'` to `每年 1 月 1 日` = `'0 0 0 1 1 *'`. Human-readable descriptions come from `cronstrue` + `cronstrue/locales/zh_CN`; the expression `Input` is `readonly` — you change the value through the field panels or the presets.

Real usage: `apps/web/src/views/components/cron/index.vue:4`; demo details on [Charts & Cron](/en/components/chart-cron).

## CountTo

`components/count-to/CountTo.vue` (126 lines); defaults `:9-21` (type `CountToProps` lives in `types.ts:4-78`).

| prop | default | behaviour |
| --- | --- | --- |
| `startVal` / `endVal` | `0` / `0` | range |
| `duration` | `2000` | milliseconds |
| `autoplay` | `true` | plays on mount; **only `endVal` changes replay automatically** |
| `decimals` | `0` | `toFixed` digits |
| `decimal` / `separator` | `'.'` / `','` | decimal char / thousands separator |
| `prefix` / `suffix` | `''` | |
| `useEasing` | `true` | `false` → linear |
| `easingFn` | `'easeOutExpo'` | **only three values**: `easeInOutCubic` / `easeOutExpo` / `linear` (`:29-34`); anything else resolves to `undefined` |
| `className` / `style` | — | applied to the output `<span class="count-to">` |

Emits: `change` (**once per frame** — do not do heavy work in the listener), `finished`. Instance methods (`defineExpose<CountToInstance>`, `:114`): `start()` / `pause()` / `reset()` / `getCurrentValue()`.

The animation is driven by `useRafFn` (not `setInterval`): frame rate follows the browser, hidden tabs stop naturally, unmount pauses automatically. `start()` begins with `if (isActive) return`, so **you can pause but you cannot resume**: after `pause()` the only path is `reset()` + `start()` from the beginning — `resume` is not exposed.

Real usage: `apps/web/src/views/components/count-to/index.vue:7`, `apps/web/src/views/screen/components/RealtimeNumber.vue:3`, `apps/web/src/views/security/dashboard/components/SecurityScoreCard.vue:10`. The old `apps/web/src/components/business/CountTo/` directory is deleted.

## Description / Descriptions

Two components solve the same job: `Descriptions` + `DescriptionsItem` are **declarative** (you write the markup), `Description` is **configuration-driven** (`schema` + `data`).

`Descriptions` (`descriptions/Descriptions.vue`, 57 lines): props `title`, `column`(3), `layout`(`'horizontal'`), `bordered`(false), `size`(`'default' | 'middle' | 'small'`); slots `title` (defaults to `props.title`, `:46`), `extra`, `default`.
`DescriptionsItem` (73 lines): props `label`, `span`(1); slots `label` (`:67`), `default`.

`Description` (`description/Description.vue`, 221 lines): defaults `:22-29`, types in `types.ts`:

| prop | default | behaviour |
| --- | --- | --- |
| `data` | — | value source |
| `schema` | — | `DescriptionItem[]`; items with `show === false` are filtered out |
| `column` | `3` | **`number` only** — no breakpoint object; compute responsive columns outside |
| `size` | — | `DescriptionSize = 'large' \| 'middle' \| 'small'` (`types.ts:15`) — **`'default'` was removed**; the comment explains why: the old library had deprecated `default`. Omitting = component default, and `large` renders the same as omitting. Internally it maps onto `Descriptions`' `'default' \| 'middle' \| 'small'` (`Description.vue:62`) |
| `layout` / `bordered` / `colon` | `'horizontal'` / `false` / `true` | |
| `loading` | `false` | renders its own spinner placeholder |
| `emptyText` | `'-'` | replaces `null` / `undefined` / `''` (`:69`) |
| `title` / `className` / `style` | — | |

`DescriptionItem` resolution priority (`render` branch at `:126`): `#<field>` slot → `render(value, data)` → built-in `type` → plain text. Labels follow `#<field>-label` → `renderLabel` → `label` → `field`. `type` supports `'date' \| 'datetime' \| 'dict' \| 'image' \| 'images' \| 'tag' \| 'text'`, with `dictType` / `dateFormat` / `imageSize`.

::: warning Four limits, each verified against behaviour
- **`type: 'tag'` does not render a Tag**: `case 'tag'` falls through into the same default branch as `case 'text'` (`:166-167`). Use `render` with `h(Tag,...)` instead.
- **`type: 'dict'` no longer reads the pinia dictionary store**: it is injection-based now — the host calls `provide(DESCRIPTION_DICT_RESOLVER, fn)` (`description/context.ts:16`; the comment records that a shared component package may not import pinia or `~/...`). Without a provider, `dictResolver?.(...) ?? String(value)` (`:38-41`)means **the raw value is shown**, and empty values show `-`. As of this update nothing in the repo provides the key (only the unit test does), so `type: 'dict'` currently only echoes raw values in the app — provide a resolver if you need real dictionaries.
- **`setData()` is a stub**: its implementation only calls `console.warn('[Description] setData 不支持在只读模式下使用')` (`:178-180`). The component is read-only; the only usable instance method is `getData()` (`:177`, `defineExpose` at `:182`).
- **`DescriptionBordered` (`types.ts:25`)is used nowhere** — a leftover type; recorded so nobody reaches for it.:::

Real usage: `apps/web/src/views/components/description/index.vue:19`, `apps/web/src/views/system/online/index.vue:24` (`Description as DetailDescription`).

## StatusTag / EmptyState / ErrorBoundary / Skeletons

Four components the app used to re-implement per page; all are in the package now.

**StatusTag** (`status-tag/StatusTag.vue`, 54 lines): props `status` (**required**, `string`), `type?: 'export' | 'instance' | 'task' | 'workflow'`. The semantic table `MAP` (`:15-26`): `'0'` 处理中 / `'1'` 已完成 / `'2'` 已终止 / `'3'` 已挂起, plus `pending` / `processing` / `completed` / `failed` / `cancelled` / `timeout`; `PRESET_BY_SEMANTIC` (`:33-39`)then aligns those semantics onto `Tag`'s preset colour names (processing→blue, success→green, error→red, warning→gold, default→default). **An unknown status is shown verbatim with the default colour** (`:41-45`, `isNil` instead of `??` so an empty string is not swallowed). It renders a `<Tag :color>`.

**EmptyState** (`empty-state/EmptyState.vue`, 31 lines): props `title` (`'暂无数据'`), `description` (`''`), `icon` (`'ant-design:inbox-outlined'`, an Iconify name)+ default slot for actions. Versus `Empty`: `Empty` is the component-library "no data" placeholder (`description?: false | string`, `image?: false | string`), while `EmptyState` is the page-level "nothing here — and here is what you can do".

**ErrorBoundary** (`error-boundary/ErrorBoundary.vue`, 143 lines): props `fallback?: (error: Error, reset: () => void) => VNode`, `resetOnError`(true), `maxStackDepth`(5); emits `error: [Error]`, `reset: []`. Mechanism: `onErrorCaptured` prefixes the message with `[${info}]` and returns `false` to stop propagation (`:30-42`); in DEV it also prints a `console.group` + `console.trace` (from `:44`); the default fallback UI is "⚠️ 出错了 / 🔄 重试 / expandable stack", with the stack area wrapped in `Scrollbar root-class="max-h-32"`; children are wrapped in `<Suspense>` whose `#fallback` uses the `loading` slot; remount on retry happens by changing `<slot :key="errorId">`.

::: warning `maxStackDepth` has no effect path
It is declared in `interface Props` (`:10-14`)with a default of 5, but the implementation only renders `error.stack` in full — there is no code that trims frames. Passing `:max-stack-depth` changes nothing; this page records it as "declared, unused" rather than documenting it as an API.:::

**PageSkeleton / TableSkeleton** (`skeleton/`): both build on shadcn `Skeleton`, with the placeholder colour in `cn('bg-gray-200 dark:bg-gray-700', 'rounded-sm')` (`PageSkeleton.vue:30`, `TableSkeleton.vue:30`).

| component | props (defaults) |
| --- | --- |
| `PageSkeleton` | `loading`(true), `variant`(`'page'`; the other values are `'card' \| 'detail' \| 'form'`), `rows`(5, page variant only), `showTitle`(true), `showActions`(true), `showSidebar`(false), `class` |
| `TableSkeleton` | `loading`(true), `columns`(5), `rows`(8), `showHeader`(true), `showActions`(true), `showPagination`(true), `class` |

Real usage: `apps/web/src/views/components/loading/index.vue:6-14` (all five used together).

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

## Six conventions for this package

Getting these wrong produces no error — only silent breakage. Each line was verified against behaviour.

| convention | why |
| --- | --- |
| `Checkbox` / `Switch` always use `:model-value` + `@update:model-value` (or plain `v-model`) | Those two primitives are **not in this barrel**; they come from `@antdv/shadcn-ui` (`src/index.ts:15`, `:58`), and the wrappers simply `useForwardPropsEmits` onto reka-ui's `CheckboxRoot` / `SwitchRoot`, whose model name in reka v2 is `modelValue`. Writing `:checked` is ignored (the control stays at its initial value)and `@change` never fires. The correct in-repo example is `apps/web/src/views/account/settings/index.vue:283-286`. The confusion comes from antdv-next's `Switch`, which does use `:checked` — and only `SettingDrawer/**` still uses it |
| `<TabPane value="...">`, never `key` | The required prop in `TabPane.vue:13` is `value`; `key` is eaten by Vue and the pane registers as `undefined` (see the Tabs section) |
| `Popconfirm` uses `danger`, not `ok-type="danger"` | `popconfirm/Popconfirm.vue:17`; there is no `ok-type` prop, so passing it neither errors nor works |
| `Modal.confirm` → `confirm()`; `message` also comes from `@antdv/popup-ui` | `packages/ui-kit/popup-ui/src/index.ts` is four `export *` lines (alert, drawer, message, modal) plus types. 49 app files import `@antdv/popup-ui`; the typical line is `import { confirm, message } from '@antdv/popup-ui'` (e.g. `apps/web/src/views/account/center/index.vue:19`) |
| Tailwind only understands **literal class strings** | Status→colour always goes through a lookup table (`STATUS_DOT` in `Badge.vue:37-44`, `CIRCLE` in `Steps.vue:37-43`, `PRESET` in `Tag.vue`); never `bg-${color}-500`, and do not expect the scanner to see dynamic strings |
| Do not write `cn(...)` in templates, especially with a trailing comma | `<div :class="cn('a', 'b',)">` breaks template expression parsing. Keep `cn()` calls in `<script setup>` as `computed` values or constants and reference the variable — every demo page follows this shape |

## Relationship to antdv-next

This package **does not import antdv-next**. Its `dependencies` stop at `@antdv/icons`, `@antdv/scrollbar-ui`, `@antdv/shadcn-ui`, `@antdv/shared`, plus `@vueuse/core`, `cronstrue`, `es-toolkit`, `vue` (`packages/ui-kit/common-ui/package.json`). Any host project that installs those workspace packages can use it — see [External Modules](/en/guide/essentials/external).

No page under `apps/web/src/views/**` imports antdv-next for its own UI any more. What still imports it:

| location | why |
| --- | --- |
| `apps/web/src/plugins/vendor-antd-components.ts` + the `ConfigProvider` / `StyleProvider` in `App.vue` | **The only still-legal legacy exception**: `@form-create/antd-designer` ships templates compiled before publication, which look components up at runtime via `resolveComponent('a-…')`. Hence 36 manually registered kebab-case names (plus `a-form-item-rest`). It exists for a third-party dependency — it is not a pattern for new code |
| `apps/web/src/layouts/components/SettingDrawer/**` (7 files) | The settings drawer still uses antdv-next controls (`ColorPicker` / `Slider` / `InputNumber` …) — migration debt, see below |

::: warning Where docs and code still disagree
1. That `SettingDrawer` dependency is a **fact of the current code, not a recommendation**, yet `en/guide/essentials/external.md` still describes it as "explicit imports at the top of 100+ `.vue` files in the app". Both the number and the conclusion are stale (measured: 9 non-test files).
2. `apps/web/src/views/system/settings/index.vue:94` and the lines below it still render `<a-tag>` inside JSX, which only resolves thanks to that global registration. New code should write `import { Tag } from '@antdv/common-ui'`.:::

## Related pages

- [Component examples](/en/components/) — demo routes and how to open them
- [Design tokens and global styles](/en/guide/essentials/design) — the `--app-*` variables these components use, and the `@source` registration rules
- [Data & Display](/en/components/display) — the `Description` / `CountTo` demo pages and their traps
- [Editors & File Upload](/en/components/editor-upload) — the `Upload` / `Image` / cropping demos
- [Charts & Cron](/en/components/chart-cron) — the `CronEditor` demo
- [Modals & Drawers](/en/components/modal-drawer) — `confirm()` / `message` from `@antdv/popup-ui`
- [Table](/en/components/table) — `Tag` / `Space` / `Popconfirm` in the action column
