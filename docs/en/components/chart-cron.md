# Chart and Cron

This page documents two demo routes: `/components/chart` (menu "图表" / Chart, `apps/backend-mock/server/api/menus.get.ts:305-310`) and `/components/cron` (menu "Cron 表达式" / Cron Expression, `menus.get.ts:299-304`).

## Chart: `/components/chart`

### What problem it solves

The `ECharts` wrapper (`packages/core/ui-kit/common-ui/src/components/charts/ECharts.vue`) collapses the "mount container → init → setOption → resize → dispose" boilerplate so a page only feeds it an `option`. It is **not in the root barrel** — import it from the subpath: `import { ECharts } from '@antdv/common-ui/charts'` (the `exports` map in `packages/core/ui-kit/common-ui/package.json` only lists `.` and `./charts`, because this chart drags in the entire echarts registry).

### The real API

There are **exactly three props**, no events, and nothing exposed via `defineExpose` (`charts/ECharts.vue:18-21`):

| Prop | Type | Default | Notes |
| --- | --- | --- | --- |
| `option` | `echarts.EChartsOption` | required | chart configuration |
| `height` | `string` | `'320px'` | container height; width is always 100% (`:64`) |
| `loading` | `boolean` | `false` | mapped to ECharts' own `showLoading/hideLoading` overlay (`:44-50`) — no page-level Spin needed |

Behaviour, line by line against the source:

- **Updating `option` replaces, it does not merge**: the component deep-watches `option` and calls `setOption(opt, true)` (`charts/ECharts.vue:36-42`) — the second argument is `notMerge`, so **every change re-sets the whole option**. If you want "change only the data, keep everything else", don't mutate a sub-field in place; the demo's pattern is to produce a complete new option from a `computed` each time (`views/components/chart/index.vue:104-164`).
- **Who owns resize**: the component itself listens to `window` `resize` and calls `chart.resize()` (`charts/ECharts.vue:32-34,54`). **There is no ResizeObserver**: when the window stays still but only the container changes (sidebar collapse, split panes), nothing recalculates.
- **When it is destroyed**: `onBeforeUnmount` removes the resize listener and calls `dispose()` (`charts/ECharts.vue:57-60`).
- **No theme wiring**: `echarts.init(el.value)` is called without a theme argument (`charts/ECharts.vue:28`) and the wrapper **has no `theme` prop** — registered ECharts themes and the app's dark preference do not reach the chart automatically.

::: warning

Dark mode is the demo page's own doing The chart demo's approach: derive `isDark` from `appStore.resolvedTheme` (`chart/index.vue:22`; store side at `packages/stores/src/app.ts:44`), and write every color as an option field inside `computed` values (text/axis/tooltip colors each have a light and dark variant, `chart/index.vue:24-51`). When the theme flips, the computed re-runs and the component's notMerge re-render repaints the chart (the page's own comment, `chart/index.vue:20-21`). That is the full extent of what the wrapper gives you here: any other "dark theme" work has to happen inside your option. :::

### A full-featured composable that exists but is not wired in

The repo also ships `packages/core/hooks/src/echarts/use-echarts.ts` (subpath `@antdv/hooks/echarts`): `isDark` (rebuilds the chart on theme change, `:296-310`), `resizeStrategy` (none/raf/debounce/throttle, `:129-151`), a ResizeObserver on the container (`:313-342`), `setData` deep-merging patches (`:254-262`), and init-with-retry (`:201-215`). Its comments even record fixing "`setData` used to be a silent no-op function" (`:245-252`). However it has **no consumer inside `apps/web`** (only `packages/core/hooks/__tests__/echarts.test.ts`), and `/components/chart` uses the three-prop thin wrapper above. Do not blend the two capability sets in one description.

### What the demo page shows

Five cards, all data are in-page constants, zero requests (the page alert states this verbatim, `chart/index.vue:447-456`): a line chart whose "刷新数据" (refresh) button rotates through three built-in datasets (`:79-102`); a bar chart with a grouped/stacked switch that only toggles `series.stack` (`:170-223`); a doughnut pie chart with clickable legend and label templates; a dual-axis combo chart (bar + line, `:294-369`); and loading / empty-data states (an empty-array option still renders the axis skeleton, `:375-443`).

## Cron: `/components/cron`

### What problem it solves

`CronEditor` (`packages/core/ui-kit/common-ui/src/components/cron-editor/CronEditor.vue`, a named export of `@antdv/common-ui`) gives cron configuration a visual surface — preset buttons plus six dropdown fields — with a live Chinese human-readable description via `cronstrue`, consuming and producing a plain expression string.

### The real API

Props and events (`CronEditor.vue:27-33`):

| Name | Type | Notes |
| --- | --- | --- |
| `modelValue` | `string` | the expression, works with `v-model`; in custom mode the fields are re-parsed from it (`:151-159`) |
| `disabled` | `boolean` | disables all buttons and selects |
| `change` event | `(value: string) => void` | emitted on preset selection (`:224-227`), field changes (`:230-240`), and mode-switch default fill (`:208-221`) |

There is no validation function, no `valid` event, and no exposed instance methods — expression legality only shows up in the description area.

### Expression format: 6 segments, "second minute hour day month week"

- The output side always emits **6 segments**, joined in `fields` order (`CronEditor.vue:54-103,162-164`): second, minute, hour, day-of-month, month, day-of-week; all 12 built-in presets are 6-segment too (`:38-51`). Think "Quartz-style, but only the first six segments".
- **Not strict Quartz**: there is no year segment, day-of-month and day-of-week are not mutually exclusive and no `?` placeholder is ever produced, and the week field ranges over **0~6** (`:95-102`). A Quartz-based backend (which typically requires exactly one of day-of-month / day-of-week to be `?` and a 1-based day-of-week) will need a conversion you must write yourself — the wrapper guarantees none of that, so don't document it as a "native Quartz editor".
- The parsing side (inbound `modelValue`): `parseCron` accepts **5 or 6 segments**, padding a `0` second for 5-segment input (`CronEditor.vue:116-148`); **any other segment count silently resets the fields to the default `0 0 0 * * *`** without raising an error — bad input is swallowed.
- Field choices are enumerated by dropdowns: `*` / single values per range / stepping options only for second & minute (`*/5 */10 */15 */30`) and hour (`*/2 */4 */6 */12`) — see `getFieldOptions` (`:167-196`). Day/month/week have no stepping options. The dropdowns are the reka composite `Select`, whose values are strings only, so selections are bridged back through `String()` (`:237-240`).

### Validation rules: one layer of try/catch, and nothing else

The component's notion of "validation" is feeding the generated expression to `cronstrue.toString(expr, { locale: 'zh_CN' })` and replacing the description with "表达式无效" (invalid expression) when it throws (`CronEditor.vue:199-205`) — **it does not block output**; `change` is still emitted. The demo page layers its own `check()` on top, normalizing errors into `{ text, error }` (`views/components/cron/index.vue:49-61`) and marking red / warning when invalid (`:63-71,84-98`).

::: warning

The component cannot be typed into The `Input` that displays the expression is `readonly` (`CronEditor.vue:330-336`); the old antd-era `handleInputChange` — dead code with no template binding — was removed when the component moved into `@antdv/common-ui`. To enter an expression by hand, do what card 3 of the demo does and place your own input. :::

### A former type-check error file, resolved by the migration

The in-app `CronEditor` used to be a confirmed type-check error file (type-check is currently non-blocking in this repo): under `noUncheckedIndexedAccess`, `presets[0].value` and the `parseCron` assignments of `parts[0]`-style index results into a `Record<string, string>` were inferred as possibly `undefined` and flagged. The common-ui package tsconfig enables the same strict flag, and the migration guarded those accesses (`?? ''`, destructuring with an existence check) so the errors are gone; the `parts.length === 5 / 6` branches are kept verbatim — don't delete them in a refactor. One same-origin TS2769 still exists in the demo page's `previewFields` (`views/components/cron/index.vue:129`), left untouched by this migration.

### How the demo page uses it: inline on the page, not inside a modal

All four cards of `/components/cron` each mount `CronEditor` inline (named import from `@antdv/common-ui`, `cron/index.vue:4`; usages at `:168,206,268,287`), demonstrating four patterns: `v-model` + live description; preset buttons writing values with validation; a draft → apply/reset controlled-vs-uncontrolled fallback (`:102-122`); and splitting an expression into its 5/6 fields plus the textual description. The alert atop card 4 honestly states: the project **only has cronstrue (text descriptions), no cron-parser-style scheduling library that could compute "next run time", and no backend** — so the page refuses to fake an execution timetable (source comment `cron/index.vue:125-126`, alert text at `:275-281`).

## Live examples

- **`http://localhost:6080/#/components/chart`** — sidebar "组件示例 → Chart". Press "刷新数据" to see the whole-option replacement re-render; toggle the bar chart's stacked switch; click pie legend entries to hide a slice; press "显示 Loading" on the loading/empty card to see the wrapper's built-in overlay. Flip the global light/dark theme (see [Theme](/en/guide/in-depth/theme)) and confirm the colors recompute — that is the page's computeds, not the wrapper.
- **`http://localhost:6080/#/components/cron`** — sidebar "Cron 表达式". Switch between 常用预设 / 自定义 (presets / custom), change the six dropdowns and observe that the emitted expression is always 6 segments; on card 3 type `* * *` to see the draft flagged red, then press "应用" to watch the invalid value get rejected.

## Related

- [Component examples overview](/en/components/)
- [Table](/en/components/table)
- [Form](/en/components/form)
- [Theme](/en/guide/in-depth/theme) — the `resolvedTheme` the chart's light/dark option colors depend on
- [Design tokens and global styles](/en/guide/essentials/design) — where the demo pages' `cn()` class-name convention comes from
