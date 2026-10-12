# Data and display

This page covers six demo routes — `/components/description`, `/components/count-to`, `/components/relative-time`, `/components/icon-picker`, `/components/loading`, `/components/scroll/basic`. They are unrelated features, but one thread runs through them: **the first two are business wrappers living in `apps/web`, while the remaining four are implemented in `packages/ui` (the stateless atom package) or only inside the page itself**. Reading this page therefore also draws the line between "what belongs in `packages/ui`" and "what stays in the app".

::: warning Three things to say up front

1. **There is no `RelativeTime` component**: no such directory under `apps/web/src/components/business/`, and no import of `RelativeTime` anywhere in the repository. `/components/relative-time` is just a page built from `a-timeline` plus **absolute timestamps** (see [relative time](#relative-time-pages-components-relative-time)).
2. **`Description`'s `setData()` is a stub** that only calls `console.warn` (`apps/web/src/components/business/Description/Description.vue:156-158`).
3. **The text prop of `Loading` is `tip`, not `description`**, and `useLoading` needs an explicit `target` (selector / element / ref / getter) — otherwise the overlay silently never mounts (`packages/ui/src/loading/overlay.ts:101-105`). :::

## Why these six pages are all second-level menu entries

`apps/backend-mock/server/api/menus.get.ts:166-181` is a comment block that states the hierarchy rules; use it together with the table below:

| Rule | Source |
| --- | --- |
| "Only **Form** and **Table** keep a third level; everything else is a second-level leaf" | `menus.get.ts:166` |
| The old shape was "component gallery → category → page"; the sidebar needed two clicks to reach anything, so it was flattened | `menus.get.ts:168-169` |
| **Count-to, image crop and relative time used to hang under the "Table" category** and were each promoted to second level (they demo `CountTo`, the cropper and timestamp rendering — nothing to do with tables) | `menus.get.ts:178-179` |
| Modal-inner scrolling and drawer-inner scrolling were merged into "Modal and drawer" | `menus.get.ts:180-181` |
| This section holds only **components this repository wrote itself**; the pure-antd showcase pages were deleted | `menus.get.ts:172-175` |

The six menu entries and their `name` (keep-alive matches on it):

| Menu label | Route | `name` | Location |
| --- | --- | --- | --- |
| 描述列表 (Description list) | `/components/description` | `DemoDescription` | `menus.get.ts:264-269` |
| 数字滚动 (Count to) | `/components/count-to` | `DemoTableCountTo` | `menus.get.ts:270-275` |
| 相对时间 (Relative time) | `/components/relative-time` | `DemoTableRelativeTime` | `menus.get.ts:276-281` |
| 加载与骨架 (Loading and skeleton) | `/components/loading` | `DemoLoading` | `menus.get.ts:312-317` |
| 图标选择器 (Icon picker) | `/components/icon-picker` | `DemoIconPicker` | `menus.get.ts:318-323` |
| 滚动区域 (Scroll area) | `/components/scroll/basic` | `DemoScrollBasic` | `menus.get.ts:324-329` |

`count-to` and `relative-time` still carry the `DemoTable` prefix — that is their pre-move name. Renaming would drag keep-alive and the i18n keys along with it (`apps/web/src/locales/lang/zh-CN.ts:101`), so it was left alone.

## Description

### What problem it solves

The label/value grid on detail pages. Using antdv-next's `Descriptions` directly means assembling `items` yourself; `Description` splits that into two configurations — `schema` (`DescriptionItem[]`, defining labels, how a value is obtained, and column span) and `data` (the field values) — and adds built-in date formatting, image preview and dictionary translation (`apps/web/src/components/business/Description/types.ts:93-160`).

### The real API

Component defaults are at `Description/Description.vue:21-28`; the value-resolution chain is at `:37-136`.

| Prop | Default | Behaviour / location |
| --- | --- | --- |
| `title` | none | passed through to antd `Descriptions` (`:176`) |
| `data` | none | where field values come from; an internal `computed` falls back to `{}` (`:32`) |
| `schema` | none | configuration array; items with `show === false` are filtered out (`:33-35`) |
| `column` | `3` | **typed as `number` only** — none of antd's responsive breakpoint object (`:178`) |
| `size` | none | maps to only two values; see the warning below (`:150-152`) |
| `layout` | `'horizontal'` | passed through (`:180`) |
| `bordered` | `false` | passed through (`:181`) |
| `colon` | `true` | passed through (`:182`) |
| `loading` | `false` | renders the component's own spinner placeholder and `v-else`s the entire `Descriptions` away (`:165-175`) |
| `emptyText` | `'-'` | replaces `null` / `undefined` / `''` (`:40`) |
| `className` / `style` | none | bound to the outermost `div.description-wrapper` (`:164`) |

The fields of `DescriptionItem` (`types.ts:30-88`) and their **value-resolution priority**:

| Order | Mechanism | Location |
| --- | --- | --- |
| 1 | Named slot `#<field>` | `:85-86` |
| 2 | `render(value, data)` — a returned string/number gets wrapped in a `span` | `:88-93` |
| 3 | `type` built-in renderer (`date` / `datetime` / `image` / `images` / `dict` / `text`) | `:95-135` |
| 4 | Plain text | `:128-134` |

Labels work the same way: `#<field>-label` slot → `renderLabel` → `label` → `field` (`:44-50`). The remaining fields: `value` supplies a literal value (`:39`, and takes precedence over `data[field]`, see `:38-39`); `span` defaults to 1 (`:144`); `labelStyle` / `contentStyle` pass through per item (`:145-146`); `dateFormat` defaults to `YYYY-MM-DD` and `YYYY-MM-DD HH:mm:ss` (`:115`, `:124`); `imageSize` defaults to 60 (`:105`, `:108`).

::: warning Four limitations, stated plainly

- **`size="large"` and `"default"` render identically**: `antSize` only tests for `small` and returns `'default'` for everything else (`Description.vue:150-152`), even though `DescriptionSize` declares three levels (`types.ts:8`). The demo's size switcher consequently offers only `default` / `small` buttons and prints that fact in its own body text (`views/components/description/index.vue:382-383`, `:396-402`).
- **`type: 'tag'` does not render a Tag**: `case 'tag'` falls into the same default branch as `case 'text'` (`:128-134`). For a tag you must use `render` and `h(Tag, ...)` yourself — which is exactly what the demo does (`index.vue:101-107`).
- **`type: 'dict'` depends on the dictionary store**: it goes through `getDictLabel` / `getDictLabels` from `~/utils/dict` (`:19`, `:96-103`), and falls back to the raw text when `dictType` is missing (`:97`); multi-value detection is "array, or string containing a comma" (`:98`). The demo page **never uses `dict`** — the body text mentions it once (`index.vue:57`) but there is nothing clickable to show it.
- **`setData()` is empty**: declared in the type (`types.ts:165-174`), implemented as `console.warn('[Description] setData 不支持在只读模式下使用')` (`Description.vue:156-158`). The component is read-only: to change data, replace `data` (the demo drives its masking switch with a `computed` data source, `index.vue:133-145`). The only usable instance method is `getData()` (`:155`; `defineExpose` at `:160`).

For the record, the type `DescriptionBordered = 'bordered' | 'none' | boolean` at `types.ts:18` is not used anywhere (`DescriptionProps.bordered` is a plain `boolean`, `types.ts:131`) — a leftover, documented here so nobody reaches for it. :::

### Live example: `/components/description`

`http://localhost:6080/#/components/description`, source `apps/web/src/views/components/description/index.vue` (437 lines, 4 sections). All data on the page is local `ref` / `computed`; "refresh detail" is a 700ms `setTimeout` (`:158-166`) with no backend request at all.

| Section | What to click | What you see |
| --- | --- | --- |
| Basic list (`:270-284`) | just look | a three-column grid; `type: 'date'` / `'datetime'` format themselves, and the `span: 3` address row takes the whole line with its own `labelStyle` (schema at `:60-75`) |
| Value rendering and slots (`:286-330`) | click the avatar | `type: 'image'` + `imageSize: 64` produces a previewable `Image` (`:99`); "employment status" goes through `render` returning a `Tag` (`:100-107`); "certifications" uses `type: 'images'` (`:108`); email and skill stack use `#<field>` slots |
| Dynamic switching (`:332-373`) | "show sensitive fields" | items with `show: false` disappear entirely (schema `:152-153`) |
|  | "mask phone / ID card" | the values themselves change — the data source is a `computed`, so masking happens at page level (`:133-145`) |
|  | `layout` segmented control | horizontal / vertical |
|  | "refresh detail" | the component spins first (the `:loading` at `:364-371`), then swaps in new values after 700ms and fires a message |
|  | "call getData()" | the message reports how many fields it read and their names (`:168-176`) — the **only** instance method that works |
| Responsive columns and grouping (`:375-435`) | `columnMode` control + narrow the window | `column` is computed by `useBreakpoints` and passed as a number (`:249-261`): 1 column below `md`, 2 below `xl`; the current value shows on a blue `a-tag` (`:411`) |
|  | `size` / `bordered` / `colon` | live switching; `size` only offers two levels, for the reason above |

## CountTo

### What problem it solves

Rolling numbers on KPI cards and dashboards. The core decision is that **it is driven by `requestAnimationFrame`**, not `setInterval`: `useRafFn` (from `@vueuse/core`) supplies the frame timestamp, progress is `(timestamp - start) / duration`, and an easing function is applied to it (`apps/web/src/components/business/CountTo/CountTo.vue:54-76`). What that buys you in practice: the frame rate follows the browser, rAF stops by itself when the tab is hidden, and `useRafFn` pauses on unmount (the component comment is at `:111`).

### The real API

Defaults at `CountTo/CountTo.vue:9-21`, types at `CountTo/types.ts:4-78`.

| Prop | Default | Behaviour / location |
| --- | --- | --- |
| `startVal` / `endVal` | `0` / `0` | the range; progress is `startVal + (endVal - startVal) * eased` (`:65-66`) |
| `duration` | `2000` | milliseconds, used directly as the denominator (`:57-59`) |
| `autoplay` | `true` | plays on mount (`:107-109`) and replays when `endVal` changes (`:97-105`) |
| `decimals` | `0` | number of `toFixed` digits (`:42`) |
| `decimal` | `'.'` | the decimal separator character (`:47`) |
| `separator` | `','` | thousands separator, inserted by regex (`:43-46`) |
| `prefix` / `suffix` | `''` | concatenated around the formatted result (`:48`) |
| `useEasing` | `true` | when `false`, progress is linear (`:61-63`) |
| `easingFn` | `'easeOutExpo'` | **only three valid values**: `easeOutExpo` / `linear` / `easeInOutCubic` (`:29-34`) |
| `className` / `style` | none | bound to the output `<span class="count-to">` (`:122`) |

Events (`:23-26`):

| Event | Payload | Fires |
| --- | --- | --- |
| `change` | the current number | **once per frame** (`:67`) — do not do heavy work in the listener |
| `finished` | none | progress reaches 1; the value is pinned to `endVal` and `pause()` is called (`:69-73`) |

Instance methods (`defineExpose`, `:113-118`): `start()` / `pause()` / `reset()` / `getCurrentValue()`.

::: warning Interruptibility: it pauses, it does not resume

- The first thing `start()` does is `if (isActive.value) return` (`:80`): calling it while an animation is running **does nothing**.
- Immediately after that guard, `start()` writes `currentValue` back to `startVal` and resets the timestamp (`:81-82`).
- `useRafFn`'s `resume()` is **never exposed** (`:54` destructures `pause` / `resume` / `isActive`, but the outside world only gets the four methods at `:113-118`). So "pause → continue from where it stopped" does not exist: after `pause()` your only option is `reset()` + `start()` (from the beginning). The demo's "🔄 replay animation" button is exactly those two steps (`views/components/count-to/index.vue:151-157`). :::

::: tip Only endVal auto-replays The `watch` tracks `props.endVal` (`:97-105`) — changing `startVal` or `duration` does not restart the animation. "🎲 generate a new value" replays by itself only because it touches `dynamicEndVal` and nothing else (`index.vue:143-146`, `:540-547`). :::

### Live example: `/components/count-to`

`http://localhost:6080/#/components/count-to`, source `apps/web/src/views/components/count-to/index.vue` (564 lines, 8 sections, all static data, no requests).

| Section | What to look at |
| --- | --- |
| Basic (`:170-184`) | an integer rolling from 0 to the target in 2.5s |
| Decimal precision (`:186-230`) | four blocks comparing `decimals` 0/1/2 and `decimal` set to `,` |
| Prefix and suffix (`:232-302`) | combinations such as `prefix="¥"` / `suffix="%"`, to check the formatting order |
| Thousands separator (`:304-338`) | `separator` as `,`, space, or `.` |
| Positive and negative (`:340-406`) | a negative `endVal` and sign switching |
| Easing comparison (`:409-485`) | `linear` / `easeInOutCubic` / `easeOutExpo` in one block each, the fourth block being `useEasing=false` (`:468-483`) — those three easings are the only ones; any other name resolves to `undefined` |
| Dashboard panel (`:487-531`) | several `CountTo` instances assembled into KPI cards, closest to real usage |
| Dynamic target (`:533-562`) | "random" → `endVal` changes and it replays automatically; "replay" → template ref calls `reset()` then `start()` 100ms later (`:151-157`) |

## The relative-time page: `/components/relative-time` {#relative-time-pages-components-relative-time}

::: warning This section has no component to document There is **no `RelativeTime` directory** under `apps/web/src/components/business/`, and no import or usage of `RelativeTime` anywhere in the repository. The menu entry is called "相对时间" (relative time) (`apps/backend-mock/server/api/menus.get.ts:276-281`), but the page is built as **a timeline plus absolute timestamps**:

- The first card, "basic usage", prints `item.time` as the **raw ISO string** (`apps/web/src/views/components/relative-time/index.vue:96-108`, data at `:11-57`).
- The second card, "custom colors and position", hardcodes date text (`:111-135`).
- The third card, "relative time in a table", renders `new Date(record.time).toLocaleString('zh-CN')` (`:144-148`) — a **localized absolute time**, not a relative one.

The page contains no `fromNow()` from dayjs, no `relativeTime` plugin, and no timer of any kind. So the question "what drives the refresh" has no answer here: nothing needs refreshing. To copy relative-time code, go to the places that actually implement it (table below). :::

Where relative time really comes from in this repository:

| Location | What it does |
| --- | --- |
| `packages/shared/src/dayjs.ts:10`, `:23` | a single `dayjs.extend(relativeTime)` — the plugin is installed in the shared package |
| `apps/web/src/layouts/widgets/components/NoticeItem.vue:49-50` | `dayjs(sendTime).fromNow()`, rendered in the notice item (`:141`) |
| `apps/web/src/views/system/notice/index.vue:23`, `:361` | the page calls `extend` again on its own; the table column uses `fromNow(true)` (bare duration, no "ago/from now") |
| `apps/web/src/views/system/online/index.vue:20`, `:93` | same pattern, for the "online for" column |

What drives the refresh: **no timer at all**. `fromNow()` sits inside a `computed`, so it only re-evaluates when its data dependency changes; the text will not update itself while you stay on the page. For "changes every minute" behaviour you have to attach an interval yourself.

## IconPicker

### What problem it solves

Letting a _user_ (rather than a developer) pick an icon name — the common case is assigning icons to menu entries in menu management (real usage: `apps/web/src/views/system/menu/index.vue`). It is a `packages/ui` component, and **its icon sets come from offline-bundled `@iconify-json/*`** packages: they are in the build output, so nothing queries the Iconify API at runtime. The mechanism and the steps to add a collection are in the [icons guide](/en/guide/essentials/icons).

### The real API

Source `packages/ui/src/icon/IconPicker.vue`, defaults at `:16-22`.

| Prop | Default | Behaviour / location |
| --- | --- | --- |
| `v-model` (`defineModel<string>`) | `''` | the value is the icon name in `prefix:name` form (`:30`, `:109`) |
| `currentIcon` | `''` | legacy entry point: the current value is `modelValue \|\| currentIcon` (`:78`), so with both supplied `v-model` wins |
| `placeholder` | `'选择图标'` | placeholder of the trigger input (`:288`) |
| `disabled` | `false` | disables the popover and the input together (`:201`, `:289`) |
| `size` | `'middle'` | passed to `a-input` only (`:290`) |
| `allowClear` | `true` | with a value selected, the suffix shows `lucide:x` and clears on click (`:297-304`) |

Events (`:24-27`):

| Event | Payload | Fires |
| --- | --- | --- |
| `change` | the icon name, `''` when cleared | both selection (`:168`) and clearing (`:176`) |
| `select` | the icon name | **selection only** (`:169`) — clearing does not emit it, so a `@select` listener for "the value changed" misses the clear case |

Internals:

| Item | Detail | Location |
| --- | --- | --- |
| Collection list | five prefixes: `lucide` / `mdi` / `ant-design` / `fa6-regular` / `carbon` | `:35`, `:44-50` |
| Lazy loading | one `() => import('@iconify-json/<name>/icons.json')` per collection; Vite emits a separate chunk per collection, so an untouched category is never downloaded | `:57-66` |
| Deduplication | a prefix already loaded or in flight is skipped | `:85-99` |
| Load failure | `console.error` plus an empty array for that category; the UI shows the "no icons" empty state | `:93-96`, `:241-245` |
| Search | **scoped to the current category**; switching category clears the search term and resets to page 1 | `:102-110`, `:136-144` |
| Pagination | 108 icons per page, a 12-column grid; the pager renders only past one page | `:32`, `:112-115`, `:247`, `:268-281` |
| Preload | on page change the visible icons are fed to `loadIcons`, debounced 50ms | `:123-133` |
| Popover | `a-popover` with click trigger, 560px content width, fixed 360px scroll area | `:197-205`, `:33`, `:231-234` |

::: tip Why bare `<a-popover>` works inside the package `IconPicker.vue` imports no antd component at all, yet the template writes `a-popover` / `a-select` / `a-input` / `a-pagination` / `a-tooltip` / `a-empty` / `a-spin` directly. The host provides them: `a-*` is injected at **compile time** by `unplugin-vue-components` + `AntdvNextResolver` (the comment at `apps/web/src/plugins/vendor-antd-components.ts:47-49` explains the mechanism; the plugin config is at `internal/vite-config/src/plugins/auto-import.ts:85-93`). Drop this package into a project without that plugin pair and those tags fail to resolve — it is currently `@antdv/ui`'s only implicit dependency on an external component resolver. :::

### Live example: `/components/icon-picker`

`http://localhost:6080/#/components/icon-picker`, source `apps/web/src/views/components/icon-picker/index.vue` (134 lines, 5 sections, no requests).

| Section | What to click | What you see |
| --- | --- | --- |
| Basic (`:42-59`) | the input | the popover opens on the default `lucide` category; after a pick the icon shows as the input prefix, the blue info bar prints `已选：xxx` (`:52-57`) and a `已选择图标：…` message fires (`:27-29`) |
| Default value (`:61-73`) | just look | `v-model` is pre-set to `carbon:star-filled` (`:21`) — no extra prop is needed for a default |
| Disabled (`:75-86`) | the input | it does not open; `:disabled` (`:80-84`) |
| Multiple instances (`:88-118`) | pick one in each | the two selectors stay independent (`leftIcon` / `rightIcon`, `:24-25`) |
| Change events (`:120-132`) | pick one, then click the `x` suffix | picking raises a message; clearing only emits `change` (the value becomes `(已清除)`) and no `select` — see the events table above |

## The loading family and scroll areas

### The `Loading` component (`packages/ui`)

A mask that serves both fullscreen and container modes; inside it is a single antdv-next `Spin` (`packages/ui/src/loading/Loading.vue:86-97`). Props: `loading/types.ts:16-51`; defaults: `Loading.vue:14-19` — `loading` `false`, `tip` none, `size` `'default'`, `absolute` `false`, `theme` `'light'`, `background` none.

| Item | Actual behaviour | Location |
| --- | --- | --- |
| Mode switch | `absolute: false` → `fixed inset-0 h-screen w-screen` (fullscreen); `true` → `absolute inset-0 size-full` (inside a container, **which must be a positioned element**) | `:44`, `:46` |
| Background | if `background` is given it wins as an inline style and no theme class is added | `:25-31`, `:51-66` |
| Size | `small` / `large` are `transform: scale(0.8/1.2)`, not a different spinner | `:48-49`, `:101-107` |
| Spin size | this package's `'default'` is mapped to antd's `'medium'` — passing `'default'` straight through prints a deprecation warning | `:71-83` |
| Text | **`tip`** — there is no `description` field in `LoadingProps` | `types.ts:16-20` |
| Show/hide | `v-show` plus a 300ms `loading-fade` transition | `:87-96`, `:110-118` |

### `useLoading` / `createLoading` / `v-loading`

All three share one overlay implementation, `createOverlay` (`packages/ui/src/loading/overlay.ts:60-187`), whose key property is **lazy mounting**: `createApp` inserts DOM only when `loading` flips `false` → `true`, and flipping back waits `LEAVE_DURATION` (300ms, `:14`) before removing it (`:151-168`).

| Entry point | Signature and defaults | Location |
| --- | --- | --- |
| `useLoading(options?)` | composable; `body` defaults to `true` (mount on `document.body`); container mode **requires** `body: false` + `target`; returns `open / close / setLoading / setTip / destroy`; calling it inside a component auto-registers `tryOnUnmounted(destroy)` | `loading/useLoading.ts:30-51` |
| `createLoading(options?)` | usable anywhere (route guards, interceptors); `{ body: true, ...rest }` — note the spread order, so an explicit `body: false` still wins; additionally supports `onClose`, and **only `close()` triggers it** | `loading/createLoading.ts:44-61`; the comment at `:49-52` records the earlier `{...rest, body: true}` form that clobbered container mode |
| `createFullscreenLoading(tip?, options?)` / `createContainerLoading(target, tip?, options?)` | two shorthands; the second pins `body: false` | `:66-71`, `:76-82` |
| `v-loading` directive | targets the element itself by default (`target: el`, `body: false`); the `.body` / `.fullscreen` modifier switches to fullscreen-on-body; configuration via the `loading-tip` / `loading-size` / `loading-theme` / `loading-background` attributes | `loading/directive.ts:33-39`, `:58-61`, `:69-86` |

Instance-method semantics: `close()` waits for the fade-out and then cleans the DOM itself, while `destroy()` removes it immediately and **does not fire `onClose`** (comment in `loading/types.ts:53-84`). The difference between `setVisible(true)` and writing `loading.value = true` directly: when the state is already `true`, `setVisible` still **retries the mount** (`overlay.ts:40-47`, `:179-184`) — that is the recovery path for container-mode targets that appear later than `open()`.

::: warning How to actually get the target in container mode `resolveContainer` accepts a CSS selector string, an element, a ref or a getter; if it resolves to nothing it prints `console.warn('[@antdv/ui] loading: target 容器不存在，覆盖层未挂载')` and **nothing else happens** (`overlay.ts:78-87`, `:101-105`). Section 5 of the demo turns this into an in-file comment (source comments quoted verbatim):

```ts
// views/components/loading/index.vue:292-301
/**
 * key 必须显式传给 `useTemplateRef`：无参写法在这个 Vue 版本里解析不出变量名，
 * `target` 拿到 undefined，`open()` 静默什么都不做（这条就是本页最早"点了没反应"的坑）。
 */
const hookContainerRef = useTemplateRef<HTMLElement>('hookContainerRef');
const hookLoading = useLoading({
  target: () => hookContainerRef.value!,
  body: false,
  tip: 'Hook 控制加载...',
});
```

Passing a getter as `target` is safe: resolution is deferred until the moment the overlay actually wants to display (comment in `loading/types.ts:89-108`), so referencing a not-yet-mounted template ref during setup does not throw. :::

::: warning Three real bugs this family used to have (all fixed as of now)

1. **The text prop was written as `description`** — `Loading` only has `tip`, and the demo keeps that lesson in a code comment: `<!-- tip 才是 Loading 组件的文案属性（没有 description 这个 prop） -->` (`views/components/loading/index.vue:951`).
2. **`useLoading()` could not find its target** — see the warning above; `useTemplateRef` must be given the key explicitly (`index.vue:292-296`).
3. **Passing a snapshot at instance creation made `open()` a no-op** — `createApp(Loading, { loading: loading.value })` hands over the value of that instant, so later writes to the ref produce no visual change. The fix reads the refs inside `render()` so Vue can establish the dependency (`overlay.ts:120-133`; the comment states outright that this was the original bug fixed during extraction). The same class of issue once in `v-loading`: instances are cached and reused on a `WeakMap` (`directive.ts:45`, `:70-73`), so **changing `loading-size` / `loading-theme` / `loading-background` after the element is mounted is not re-read**; only `binding.arg` (`v-loading:文本=`) is synced into the tip on `updated` (`:93-99`). One more: the comment at `directive.ts:17` claims "priority: attribute > directive argument", which is the opposite of the code — `:81` reads `tip: binding.arg ?? attributeProps.tip`, so **the directive argument wins**. :::

::: tip What does not exist `@antdv/ui/loading` has **no `delay` prop** and no throttling or debouncing. The "PageLoading and delayed mask" card in the demo hand-rolls that behaviour with two real timers (a request finishing under 300ms cancels the mask before it ever lights up), and its body text says explicitly that the delay policy belongs to the caller (`index.vue:319-350`, `:969-971`). :::

### `Scrollbar`

A self-drawn scrollbar that replaces the system one — a hard convention in this repository (modals, drawers and the menu all use it). Source `packages/ui/src/scrollbar/Scrollbar.vue`, prop types at `scrollbar/types.ts:25-40`, defaults at `Scrollbar.vue:22-41`.

| Prop | Default | Behaviour / location |
| --- | --- | --- |
| `native` | `false` | `true` hands scrolling back to the browser and the self-drawn `Bar` block is not rendered at all |
| `rootClass` | none → `'h-full'` | root class name; omit it and you get `h-full` (`:270`) |
| `wrapClass` / `wrapStyle` / `viewClass` / `viewStyle` | `''` | applied to the scroll layer and the content layer respectively (`:274-289`) |
| `maxHeight` | none | **only writes a `max-height` inline style when supplied** (`:94-100`); the value is computed responsively — see the warning below |
| `always` | `false` | `true` keeps the bar visible instead of fading it out |
| `hideDelay` | `800` | delay before the bar hides after scrolling stops (`:73-79`) |
| `minSize` | `20` | minimum bar length |
| `tag` | `'div'` | tag of the content layer (`:282-289`) |
| `noresize` / `scrollHeight` | `false` / `0` | declared in the type; no demo uses them |

There is exactly one event: `@scroll`, payload `{ scrollTop, scrollLeft }` (`:43-45`, `:127`). Instance methods: `wrap` (the scroll container element ref), `update`, `setScrollTop`, `setScrollLeft`, `scrollTo`, `handleScroll` (`defineExpose` at `:256-263`). `setScrollTop/Left` reject `NaN` and non-finite values — the comment explains why: assigning `NaN` to `scrollTop` is silently treated as `0` by the browser (`:235-250`).

::: warning Do not use `max-height` casually `maxHeight` is used as the _base value_ for `useResponsiveMaxHeight` (base default 495), and that hook's `min` floor defaults to **712px** with exponent 1.938 against a 1080 reference height (`packages/ui/src/scrollbar/useResponsiveMaxHeight.ts:44-52`). So on a 1080-high window, `:max-height="400"` goes through `clamp(400, 712, ∞)` and becomes **712px** — the shorter box you asked for is unreachable. For a genuinely smaller fixed height, use a class like the drawer demo does: `root-class="h-60"` (`apps/web/src/views/components/modal-drawer/index.vue:540-543`, `:577-580`). :::

::: warning Its styles do not depend on the host Tailwind The `<style>` block in `Scrollbar.vue` deliberately avoids `@apply` and expands the utility classes into equivalent native CSS inside `@layer components` (`:310-321`; the comment gives the reason: a standalone SFC has no `@import 'tailwindcss'`, so the build fails with `Cannot apply unknown utility class`). This is precisely what lets the component live in `packages/ui`. :::

As for registration, `Scrollbar` can be imported explicitly (`views/components/scroll/basic/index.vue:5` does) or used as a bare tag (`BasicDrawer.vue:262`, `ModalWrapper.vue:70`), because `unplugin-vue-components` lists it in `apps/web/types/components.d.ts`.

### Live examples: `/components/loading` and `/components/scroll/basic`

`http://localhost:6080/#/components/loading` — source `apps/web/src/views/components/loading/index.vue` (1187 lines, **12 sections**; the first five demo thin shells on the application side, which are not part of `packages/ui`). Every "load duration" here is a `setTimeout` inside the page — there is no backend. The script opens with a timer registry plus unmount cleanup (`:38-66`), and leaving the page explicitly `destroy()`s even the fullscreen mask (`:60-66`).

| Section | What to click / look at |
| --- | --- |
| Skeleton screens (PageSkeleton / TableSkeleton) `:421-524` | a switch toggles skeleton vs real content; `variant` (card/detail/form/page), row count, sidebar toggle; cancelling mid-flight **cancels the previous timer**, otherwise the delayed reveal would cut short a re-opened skeleton (`:88-113`) |
| Empty state (EmptyState) `:526-606` | the application-side generic empty-state shell |
| Error boundary (ErrorBoundary) `:608-666` | a button throws inside child content, to show how the boundary catches it |
| Status tag (StatusTag) `:668-739` | status → colour mapping |
| Spin loaders `:741-844` | plain antdv-next `Spin` in three styles (circle/dot/grid) plus tip |
| Skeleton `:846-907` | plain antdv-next `Skeleton` |
| `Loading` component (project wrapper) `:909-961` | sizes `small/default/large` × themes `light/dark`; "触发 Loading" shows the in-container mask; the `tip="组件式加载中..."` line and its `description` correction comment are at `:951-958` |
| PageLoading and delayed mask `:963-1012` | left: `PageLoading` over a container — it reads `resolvedTheme` from the app store to decide light/dark (`apps/web/src/components/common/Loading/PageLoading.vue:6`, `:22-24`), the textbook example of "a shell that needs a store stays in the app"; right: "fast request 150ms" never flashes the mask, "slow request 1800ms" does |
| `v-loading` directive `:1014-1058` | three blocks: default light (`v-loading="directiveLoading"`), dark + large + the `loading-tip` attribute, and `v-loading.fullscreen` for the whole page; the directive is registered in `apps/web/src/main.ts:100` |
| `useLoading` hook `:1060-1103` | "触发 useLoading" → an in-container mask for 2.5s; the section also prints a `target / body / tip` snippet |
| Button loading state `:1105-1149` | antdv-next `Button`'s own `loading` prop — unrelated to this project |
| Global mask `:1151-1185` | "模拟 API 请求 (全屏遮罩)" → `createLoading` opens fullscreen, `setTip('即将完成...')` at 1.5s, `close()` at 3s (`:400-415`) |

`http://localhost:6080/#/components/scroll/basic` — source `apps/web/src/views/components/scroll/basic/index.vue` (201 lines, 3 sections; each wraps content in a fixed-height `overflow-hidden` container so scrolling is entirely delegated to `Scrollbar`):

| Section | What to click | What you see |
| --- | --- | --- |
| Basic Scroll (`:94-134`) | drag the list | 30 items scrolling inside an `h-80` box via the self-drawn bar; it fades out 800ms after you stop |
|  | **click "Add Item"** | **nothing happens at all** — see the warning below |
| Horizontal Scroll (`:136-155`) | drag sideways | 10 framework cards, `flex min-w-max` forces horizontal overflow and the horizontal bar appears (the `hasHorizontal` branch, `Scrollbar.vue:293-298`) |
| Chat Scroll (`:157-199`) | Enter in the input, or Send | messages append to `chatMessages` (a `ref`, `:29-73`), bubbles aligned left/right; `Scrollbar class="flex-1 p-4"` (`:162`) fills the remaining height of the flex column |

::: warning "Add Item" is the only broken button on these pages `basicItems` is declared as a **plain array constant** — neither `ref` nor `reactive`:

```ts
// views/components/scroll/basic/index.vue:10
const basicItems = Array.from({ length: 30 }, (_, i) => ({/* ... */}));
```

The button runs `basicItems.push(...)` (`:96-106`). With no reactive proxy behind it, `v-for="item in basicItems"` (`:113`) never re-renders, so clicking leaves the list the same length and raises no error. For contrast, the chat section on the same page uses `ref([])` (`:29`) and its Send works. Wrapping `basicItems` in a `ref` would fix it; this page documents the current state only. :::

## The `packages/ui` package boundary

The four atoms on this page (`IconPicker`, `Loading`, `Scrollbar`, plus the `Spin` that `Loading` renders) all live in `packages/ui`, and the boundary is written into the package manifest itself:

| Convention | Source |
| --- | --- |
| "does not depend on pinia, vue-router, business stores or application configuration — shells that need those stay in the app" | `packages/ui/package.json:4` (the `description` field) |
| Export style is subpaths: `@antdv/ui/icon`, `@antdv/ui/loading`, `@antdv/ui/scrollbar`, plus a `createUiInstaller()` for global registration (components + the `v-loading` directive) | the `exports` field of `packages/ui/package.json`, `packages/ui/src/index.ts:15-44` |
| No implicit auto-import globals inside the package: `useResponsiveMaxHeight.ts` imports `toValue` / `MaybeRefOrGetter` explicitly, and the comment notes that another host would fail with `toValue is not defined` | `packages/ui/src/scrollbar/useResponsiveMaxHeight.ts:8-12` |
| Configuration stays out of the package: `native` is passed in by the caller, the package never reads app config | `packages/ui/src/scrollbar/Scrollbar.vue:23-28` |
| Styles are self-contained, independent of the host Tailwind | `Scrollbar.vue:310-321` |
| Conversely, application-side shells should read stores when they need to: `PageLoading` reads `useAppStore().resolvedTheme` | `apps/web/src/components/common/Loading/PageLoading.vue:6`, `:22-24` |

## Related

- [Component examples](/en/components/) — chapter index, how to open the demos, shared conventions
- [Modal and drawer](/en/components/modal-drawer) — `ModalWrapper` and the drawer body both use the `Scrollbar` documented here
- [Table](/en/components/table) — `Description` usually pairs with the table to make a detail page
- [Icons guide](/en/guide/essentials/icons) — offline Iconify collections and how to add one
- [Loading system](/en/guide/in-depth/loading) — how route-level loading splits duties with the components on this page
