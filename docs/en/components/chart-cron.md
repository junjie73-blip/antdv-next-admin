# Chart and Cron

This page documents two demo routes: `/components/chart` (menu "图表" / Chart, `apps/backend-mock/server/api/menus.get.ts:305-310`) and `/components/cron` (menu "Cron 表达式" / Cron Expression, `menus.get.ts:299-304`).

## Chart: `/components/chart`

### What problem it solves

The `ECharts` wrapper (`apps/web/src/components/common/ECharts/index.vue`) collapses the "mount container → init → setOption → resize → dispose" boilerplate so a page only feeds it an `option`. It is auto-registered by unplugin-vue-components (see the `ECharts` entry in `apps/web/types/components.d.ts`); the demo template uses `<ECharts />` with no import statement, which is not a missing import.

### The real API

There are **exactly three props**, no events, and nothing exposed via `defineExpose` (`ECharts/index.vue:8-15`):

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `option` | `echarts.EChartsOption` | required | chart configuration |
| `height` | `string` | `'320px'` | container height; width is always 100% (`:58`) |
| `loading` | `boolean` | `false` | mapped to ECharts' own `showLoading/hideLoading` overlay (`:38-44`) — no page-level Spin needed |

Behaviour, line by line against the source:

- **Updating `option` replaces, it does not merge**: the component deep-watches `option` and calls `setOption(opt, true)` (`ECharts/index.vue:30-36`) — the second argument is `notMerge`, so **every change re-sets the whole option**. If you want "change only the data, keep everything else", don't mutate a sub-field in place; the demo's pattern is to produce a complete new option from a `computed` each time (`views/components/chart/index.vue:104-158`).
- **Who owns resize**: the component itself listens to `window` `resize` and calls `chart.resize()` (`ECharts/index.vue:26-28,48`). **There is no ResizeObserver**: when the window stays still but only the container changes (sidebar collapse, split panes), nothing recalculates.
- **When it is destroyed**: `onBeforeUnmount` removes the resize listener and calls `dispose()` (`ECharts/index.vue:51-54`).
- **No theme wiring**: `echarts.init(el.value)` is called without a theme argument (`ECharts/index.vue:22`) and the wrapper **has no `theme` prop** — registered ECharts themes and the app's dark preference do not reach the chart automatically.

::: warning Dark mode is the demo page's own doing The chart demo's approach: derive `isDark` from `appStore.resolvedTheme` (`chart/index.vue:21`; store side at `apps/web/src/stores/modules/app.ts:42`), and write every color as an option field inside `computed` values (text/axis/tooltip colors each have a light and dark variant, `chart/index.vue:23-50`). When the theme flips, the computed re-runs and the component's notMerge re-render repaints the chart (the page's own comment, `chart/index.vue:19-21`). That is the full extent of what the wrapper gives you here: any other "dark theme" work has to happen inside your option. :::

### A full-featured composable that exists but is not wired in

The repo also ships `packages/composables/src/echarts/useEcharts.ts`: `isDark` (rebuilds the chart on theme change, `:297-310`), `resizeStrategy` (none/raf/debounce/throttle, `:130-150`), a ResizeObserver on the container (`:313-342`), `setData` deep-merging patches (`:254-262`), and init-with-retry (`:201-215`). Its comments even record fixing "`setData` used to be a silent no-op function" (`:245-252`). However it has **no consumer inside `apps/web`** (only its own tests and dist output), and `/components/chart` uses the three-prop thin wrapper above. Do not blend the two capability sets in one description.

### What the demo page shows

Five cards, all data are in-page constants, zero requests (the page alert states this verbatim, `chart/index.vue:417-425`): a line chart whose "刷新数据" (refresh) button rotates through three built-in datasets (`:96-102`); a bar chart with a grouped/stacked switch that only toggles `series.stack` (`:164-211`); a doughnut pie chart with clickable legend and label templates; a dual-axis combo chart (bar + line, `:282-351`); and loading / empty-data states (an empty-array option still renders the axis skeleton, `:357-412`).

## Cron: `/components/cron`

### What problem it solves

`CronEditor` (`apps/web/src/components/common/CronEditor/index.vue`) gives cron configuration a visual surface — preset buttons plus six dropdown fields — with a live Chinese human-readable description via `cronstrue`, consuming and producing a plain expression string.

### The real API

Props and events (`CronEditor/index.vue:12-26`):

| Name | Type | Notes |
| --- | --- | --- |
| `modelValue` | `string` | the expression, works with `v-model`; in custom mode the fields are re-parsed from it (`:154-162`) |
| `disabled` | `boolean` | disables all buttons and selects |
| `change` event | `(value: string) => void` | emitted on preset selection (`:226-229`), field changes (`:232-236`), and mode-switch default fill (`:211-223`) |

There is no validation function, no `valid` event, and no exposed instance methods — expression legality only shows up in the description area.

### Expression format: 6 segments, "second minute hour day month week"

- The output side always emits **6 segments**, joined in `fields` order (`CronEditor/index.vue:57-106,165-167`): second, minute, hour, day-of-month, month, day-of-week; all 12 built-in presets are 6-segment too (`:32-45`). Think "Quartz-style, but only the first six segments".
- **Not strict Quartz**: there is no year segment, day-of-month and day-of-week are not mutually exclusive and no `?` placeholder is ever produced, and the week field ranges over **0~6** (`:99-105`). A Quartz-based backend (which typically requires exactly one of day-of-month / day-of-week to be `?` and a 1-based day-of-week) will need a conversion you must write yourself — the wrapper guarantees none of that, so don't document it as a "native Quartz editor".
- The parsing side (inbound `modelValue`): `parseCron` accepts **5 or 6 segments**, padding a `0` second for 5-segment input (`CronEditor/index.vue:119-151`); **any other segment count silently resets the fields to the default `0 0 0 * * *`** without raising an error — bad input is swallowed.
- Field choices are enumerated by dropdowns: `*` / single values per range / stepping options only for second & minute (`*/5 */10 */15 */30`) and hour (`*/2 */4 */6 */12`) — see `getFieldOptions` (`:170-199`). Day/month/week have no stepping options.

### Validation rules: one layer of try/catch, and nothing else

The component's notion of "validation" is feeding the generated expression to `cronstrue.toString(expr, { locale: 'zh_CN' })` and replacing the description with "表达式无效" (invalid expression) when it throws (`CronEditor/index.vue:202-208`) — **it does not block output**; `change` is still emitted. The demo page layers its own `check()` on top, normalizing errors into `{ text, error }` (`views/components/cron/index.vue:34-43`) and marking red / warning when invalid (`:48-53,88-96`).

::: warning The component cannot be typed into The `a-input` that displays the expression is `readonly` (`CronEditor/index.vue:323-330`); the `handleInputChange` defined in the script (`:239-243`) **has no binding anywhere in the template** — it is dead code. To enter an expression by hand, do what card 3 of the demo does and place your own input. :::

### One of the known type-check error files: a type-level hazard, not a runtime fault

`CronEditor` is a confirmed type-check error file (type-check is currently non-blocking in this repo). Reading the source, the cause is clear: `apps/web/tsconfig.app.json:21` enables `noUncheckedIndexedAccess`, so `presets[0].value` (`CronEditor/index.vue:219-220`) and the `parseCron` assignments of `parts[0]`-style index results into a `Record<string, string>` (`:123-139`) are inferred as possibly `undefined` and flagged. Every actual execution path is guarded — `presets` is a non-empty literal array, and indexing happens inside `parts.length === 5 / 6` branches — so **current runtime behavior is unaffected**. The hazard is forward-looking: those length checks are what makes the code safe, and deleting them in a refactor would leave the type system as the only (currently non-blocking) alarm.

### How the demo page uses it: inline on the page, not inside a modal

All four cards of `/components/cron` each mount `CronEditor` inline (explicit import; usages at `cron/index.vue:8,134,163,216,233`), demonstrating four patterns: `v-model` + live description; preset buttons writing values with validation; a draft → apply/reset controlled-vs-uncontrolled fallback (`:83-104`); and splitting an expression into its 5/6 fields plus the textual description. The alert atop card 4 honestly states: the project **only has cronstrue (text descriptions), no cron-parser-style scheduling library that could compute "next run time", and no backend** — so the page refuses to fake an execution timetable (source comment `cron/index.vue:107-108`, alert text at `:223-229`).

## Live examples

- **`http://localhost:6080/#/components/chart`** — sidebar "组件示例 → Chart". Press "刷新数据" to see the whole-option replacement re-render; toggle the bar chart's stacked switch; click pie legend entries to hide a slice; press "显示 Loading" on the loading/empty card to see the wrapper's built-in overlay. Flip the global light/dark theme (see [Theme](/en/guide/in-depth/theme)) and confirm the colors recompute — that is the page's computeds, not the wrapper.
- **`http://localhost:6080/#/components/cron`** — sidebar "Cron 表达式". Switch between 常用预设 / 自定义 (presets / custom), change the six dropdowns and observe that the emitted expression is always 6 segments; on card 3 type `* * *` to see the draft flagged red, then press "应用" to watch the invalid value get rejected.

## Related

- [Component examples overview](/en/components/)
- [Table](/en/components/table)
- [Form](/en/components/form)
- [Theme](/en/guide/in-depth/theme) — the `resolvedTheme` the chart's light/dark option colors depend on
- [Styles](/en/guide/essentials/styles) — where the demo pages' `cn()` class-name convention comes from
