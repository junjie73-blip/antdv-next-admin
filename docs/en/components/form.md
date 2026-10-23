# Form

`BasicForm` is a "schema-driven + imperative instance" form container: field config comes in as `schemas`, values live in the underlying form instance, and the page gets the set of `useForm()` methods back through `@register` to read, write and validate. The base is `@tanstack/vue-form` (`useForm` / `useField` own the values, the field meta and the validation scheduling), while the label, the grid row, the error text and some twenty field controls are all rendered by this package itself — it no longer borrows `a-form` / `a-form-item`'s DOM or rule engine. What it still removes are the three repeated chores of admin forms: grid layout, field visibility / linkage, and value assembly.

Source: `packages/core/ui-kit/form-ui/src/`. The rendering layer is `components/form-render/form.vue` (254 lines, only contract declarations + hook assembly + layout), `form-field.vue` (289 lines), `form-label.vue`, `components/form-actions.vue` and the sixteen field controls in `fields/F*.vue`; the logic layer is `components/form-render/hooks/` (9 files) and `components/form-render/helpers/` (4 files); outside of those sit `types.ts`, `use-antdv-form.ts`, `config.ts`, `rule-registry.ts` and `schema.ts` / `helper.ts` / `utils.ts` / `context.ts` under `form-render/`. The public surface is `packages/core/ui-kit/form-ui/src/index.ts:1-43`: `BasicForm` / `FormItem` (which is really `form-field.vue`) / `useForm` / `componentMap` / `addComponent` / `getComponent` / `runRule` / `compileFieldValidator` / `deepMerge` / `formatDateFields` / `handleRangeValue`, plus that batch of types — the hooks and helpers are not exported; they are internal layering, not a swappable public API.

## Internal structure: the 13 files around `form.vue`

The assembly order is literally the writing order of `form.vue:71-182`, and the dependency graph is one-way: `schemaRef` is the most upstream, `useFormExpose` the most downstream.

| File | Responsibility | Key exits |
| --- | --- | --- |
| `hooks/useFormModel.ts` (179 lines) | the value layer: the TanStack instance, `defaults`, `submitAttempted`, the `formModel` proxy used by slots | `initFormModel` `:96-105`, `collectValues` `:108-117`, read/write/reset/clear `:119-154`, `allFieldNames` `:157-161` |
| `hooks/useFormConfig.ts` (78 lines) | merges `props` (template) with `propsRef` (`setProps`) into the config in force | `explicitPropKeys` `:38-48`, `getProps` `:51-61`, `setProps` `:63-73` |
| `hooks/useFormSchema.ts` (88 lines) | the declarative source of schemas plus imperative add/remove/update | `watch` `:29-38`, `updateSchema` `:40-56`, `remove` `:58-63`, `append` `:65-83` |
| `hooks/useFormGrid.ts` (92 lines) | column count, gutters, row container style, `labelCol` / `wrapperCol` | `effectiveCols` `:41-47`, `gridColSpan` `:50-52`, `rowStyle` `:69-75` |
| `hooks/useFormRows.ts` (86 lines) | row grouping + collapse state + the action area's host row | `needCollapse` `:39-44`, `displayRows` `:46-52`, `rowsWithActions` `:58-62`, `actionsSpan` `:64` |
| `hooks/useFormValidate.ts` (119 lines) | runs validation field by field and folds the result into an antd-shaped failure | `scrollToField` `:49-59`, `validate` `:61-109`, `validateFields` `:112-114` |
| `hooks/useFormSubmit.ts` (70 lines) | submit and reset orchestration (parent hooks first) | `handleSubmit` `:36-51`, `handleReset` `:53-65` |
| `hooks/useFormButtons.ts` (43 lines) | captions/icons merge for the three buttons | `:28-39` |
| `hooks/useFormExpose.ts` (81 lines) | assembles the outward `FormActionType` plus the mount flag | `isMountedRef` `:59`, `formActionType` `:61-65`, `onMounted` `:69-72` |
| `helpers/grid.ts` (87 lines) | pure grid functions: responsive columns, gutter conversion, row style, label column | `pickResponsiveCols` `:21-28`, `buildRowStyle` `:52-68`, `resolveLabelCol` `:71-80` |
| `helpers/rows.ts` (78 lines) | cutting schemas into 24-grid rows, Divider owning a row, action-area width | `groupSchemasIntoRows` `:27-64`, `pickActionsSpan` `:73-78` |
| `helpers/validate.ts` (34 lines) | failure object assembly and error-message de-duplication | `buildValidateError` `:16-30`, `readErrorMessages` `:32-34` |
| `helpers/buttons.ts` (40 lines) | the three button defaults | `:4-31` |

::: tip

The one constraint of the split: outward behaviour is unchanged. The ASCII dependency diagram in `form.vue:46-54` is the acceptance criterion for the split — every hook only consumes upstream output, nothing points back, and the order of `provide` / `defineExpose` (inject `formActionTypeRef` first, assign afterwards) is preserved. Behaviour is guarded by the six files in `form-ui/__tests__/`: `BasicForm.test.ts`, `fields.test.ts`, `form-actions-layout.test.ts`, `form-props-merge.test.ts`, `helper.test.ts`, `useForm.test.ts`. :::

## useForm: registration and instance

```ts
// packages/core/ui-kit/form-ui/src/types.ts:116-119
export type UseFormReturnType = [
  register: (instance: FormActionType) => void,
  methods: FormActionType,
];
```

Unlike the table's `useTable`: the second return value is **the method object itself**, not a `Ref`, so it can be destructured directly (`views/components/form/basic/index.vue:175-176`).

```vue
<script setup lang="ts">
import type { FormSchema } from '@antdv/form-ui';
import { BasicForm, useForm } from '@antdv/form-ui';

const schemas: FormSchema[] = [
  {
    field: 'username',
    label: '用户',
    component: 'Input',
    required: true,
    colProps: { span: 12 },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    defaultValue: 'active',
  },
];

const [register, { validate, setFieldsValue, getFieldsValue }] = useForm({
  schemas,
  labelWidth: 100,
  showAdvancedButton: true,
  alwaysShowLines: 2,
});
</script>

<template>
  <BasicForm @register="register" @submit="(values) => console.log(values)" />
</template>
```

`register` is only emitted once the component reaches `onMounted` (`hooks/useFormExpose.ts:69-72`), and the same instance is also exposed through `defineExpose` (`form.vue:184`), so a template ref reaches the identical method bag. The moment `useForm` receives the instance it does three things: records the reference, pushes the initial config accumulated by `useForm(props)` in through `setProps`, and flushes the values queued before mount (`use-antdv-form.ts:32-41`).

::: tip

The pending queue: `setFieldsValue` before mount is not lost either `useForm` first checks whether the instance is still on the component tree before `setFieldsValue` / `resetFields` (the live-instance check at `use-antdv-form.ts:25-30`, based on the component's `isMounted`: declared at `hooks/useFormExpose.ts:59`, exposed at `:64`, set true at `:70`, set false at `:75`); with a dead instance the values **accumulate** in `pendingValues` first (`use-antdv-form.ts:53-64`, the comment at `:17-23`) and get written on the next `register`. `resetFields` clears the queue first (`use-antdv-form.ts:66-73`) so the next mount is not stamped over with stale data. This queue exists precisely to rescue the "fill the values first, then `openModal`" pattern: modals destroy their content by default, so writing into the dead object from the previous `register` fails silently. The behaviour is unit-tested (`form-ui/__tests__/useForm.test.ts:37,52,67,76`). :::

::: warning

The queue only protects writes, not validation or reads Only `setFieldsValue` / `resetFields` go through the live-instance check; `getFieldsValue`, `validate`, `validateFields`, `updateSchema` and the rest use `getFormInstance()`, which does not look at mount state (`use-antdv-form.ts:43-45,47-136`). With the form not mounted, **`validate()` does not throw — it returns `{}`** (`:75-81`), so using it as the "validation passed" condition is always true. :::

**There is no `useModalForm` / `useDrawerForm`.** The form module ships no modal / drawer bridge (nothing in `src/index.ts:1-43`, and neither name can be found anywhere in the repository); what `views/system/*` does is have each page write its own schema and attach it as a template prop.

## Frequently used FormProps

The types are at `types.ts:38-71`; only 8 keys carry a runtime default (`form.vue:29-38`): `showActionButtonGroup` / `showSubmitButton` / `showResetButton` / `submitOnReset` / `autoSubmitOnEnter` / `labelAlign: 'right'` / `colon: false` / `scrollToFirstError: true`.

| Prop | Default | Notes |
| --- | --- | --- |
| `schemas` | — | field config; `setProps` pulls it out of the merge logic separately and replaces it wholesale (`hooks/useFormConfig.ts:64-72`) |
| `grid` | — | `{ cols, gutter }`; `cols` only accepts 1-4, out of range it silently falls back to the responsive column count (`hooks/useFormGrid.ts:41-47`), the breakpoints are hardcoded Tailwind values (`helpers/grid.ts:21-28`: `<sm` 1 column / `<md` 2 columns / `<xl` 3 columns / everything else 4), and `responsive` is read by nobody |
| `labelWidth` / `labelCol` | `labelCol: { span: 4 }` | give `labelWidth` and it becomes `style.width`, `labelCol` being ignored (`helpers/grid.ts:71-80`); `labelCol.span` is turned into a percentage width (`form-field.vue:175-182`) |
| `wrapperCol` | `{ span: 18 }` | it only enters the context (`hooks/useFormGrid.ts:78` → `form.vue:153`), and **field rendering does not read it** — what takes effect is `itemProps.wrapperCol.style` (`form-field.vue:168-171`) |
| `size` | — | declared at `types.ts:51` and read by nobody in the module; control sizing has to be done per field through `componentProps` |
| `disabled` | — | form-level disabling, OR-ed with `dynamicDisabled` (`form-field.vue:74-84`), and it disables the two action buttons (`form.vue:232`) |
| `showActionButtonGroup` / `showSubmitButton` / `showResetButton` | all `true` | the whole action area and its two buttons (`form.vue:224-251`, `form-actions.vue:61-105`) |
| `submitButtonOptions` / `resetButtonOptions` | text `查询` / `重置`, icons `carbon:search` / `carbon:restart` | **`text` / `preIcon` / `disabled` take effect** (defaults merged at `hooks/useFormButtons.ts:28-39`, the pure functions at `helpers/buttons.ts:4-31`, bound at `form-actions.vue:67-93`); `loading` / `postIcon` / `iconSize` / `onClick` are declared at `schema.ts:65-73` but read by nobody |
| `actionColOptions` | — | only `style` is ever read (`form.vue:229`); it is the last layer of styling applied to the action area's grid cell (`form-actions.vue:56`), so `width` / `margin-left` here override the default inline-at-end placement |
| `submitOnReset` | `true` | submits once more automatically after a reset (`hooks/useFormSubmit.ts:53-65`) |
| `resetFunc` | — | **given, it runs and the function returns right there**, with no reset and no submit (`hooks/useFormSubmit.ts:54-57`) |
| `showAdvancedButton` / `alwaysShowLines` | off / `3` | collapsing counts **rows**, not fields (`hooks/useFormRows.ts:32,39-52`) |
| `fieldMapToTime` | — | `[field, [start, end], format?]`, splits a range into two fields and deletes the original one (`utils.ts:65-96`); the third component accepts `timestamp` and `timestampStartDay`, and by default emits strings in `YYYY-MM-DD` |
| `submitFunc` | — | on submit it wins over `@submit`, but it still sits behind the template's `onFinish` (`hooks/useFormSubmit.ts:36-47`) |
| `baseRowStyle` | — | spread onto the row container's `:style` (`hooks/useFormGrid.ts:69-75` → `helpers/grid.ts:52-68`, spread last so it overrides everything above) |
| `gutter` related | horizontal 24 / row gap 16 | the row container takes the negative margins and each field takes half of that as padding (`helpers/grid.ts:31-43,52-68`, `form-field.vue:137-151`); a single `gutter` value means the vertical component is 0, hence the `DEFAULT_ROW_GAP_PX = 16` fallback (`helpers/grid.ts:9,39-43`) |

::: warning

Declared but never read The fields below are legal `FormProps` entries in `types.ts:38-71`, yet no usage of them can be found anywhere in the module (`autoSubmitOnEnter` appears only in the defaults at `form.vue:34`; there is no keydown listener):

- `model` — form values always live in the underlying `@tanstack/vue-form` instance; the initial object you pass in is neither read nor synced back.
- `baseColProps`, `autoFocusFirstItem`, `compact`, `autoSetPlaceHolder`, `autoAdvancedLine`, `mergeDynamicData`, `size`.
- Top-level `rulesMessageJoinLabel` — the one that takes effect is **the copy on the schema** (`helper.ts:156,185`, see also `rule-registry.ts:161-164`).

`colon` and `scrollToFirstError` are no longer dead fields: the former enters the context and decides whether a colon is appended after the label (`form-field.vue:186`, `form-label.vue:57`), the latter decides whether a validation failure scrolls to the first error field (`hooks/useFormValidate.ts:91-94`, the scrolling itself at `:49-59`). Both can be changed with `setProps`. :::

## Config merging and `deepMerge`'s "target wins"

`deepMerge` backs every merge in this module, and its conflict rule is written in the file header comment (`utils.ts:5-11`, the `deepMerge` body at `:20-55`): **keep the target**. Four practical consequences:

| Situation | Result | Source |
| --- | --- | --- |
| the target has no such key (or its value is `undefined`) | written (arrays / plain objects shallow-copied) | `utils.ts:32-39` |
| the target already holds a scalar/function, source supplies a new value | **the new value is ignored** | `utils.ts:5-11` (the loop falls through to the end and nothing happens) |
| the target already holds an array | **the old array is kept**, even when the source gives a new one | `utils.ts:41` |
| the target has no array and the source gives one | replaced with the source's array | `utils.ts:43-46` |
| both sides are plain objects | merged recursively (same rules inside) | `utils.ts:48-51` |

"Target wins" is neutral on its own — **which side is the target is the whole question**, and the two call sites pick opposite sides:

- `setProps` makes the target **the patch that just arrived**: `deepMerge({ ...rest }, propsRef)` (`hooks/useFormConfig.ts:63-73`, with the reason spelled out in the inline comment at `:66-67`). So scalars, arrays and functions from `useForm(options)` / `setProps` do override the previous round of config and the `withDefaults` defaults; `setProps({ disabled: true })` followed by `setProps({ disabled: false })` switches back off.
- When `getProps` layers `propsRef` over the template props it skips only the keys the parent **actually bound** (`hooks/useFormConfig.ts:38-48,51-61`) — Vue casts a Boolean prop the parent never passed to `false` and `withDefaults` writes into that same object, so without `explicitPropKeys`, switches such as `useForm({ showAdvancedButton: true })` could never open.
- `updateSchema` makes the target **the old schema**: `deepMerge(schemaRef.value[index], item)` (`hooks/useFormSchema.ts:50-53`). So renaming `label`, swapping the `ifShow` function or handing over a whole new `rules` array all lose to the old values — only **new keys** and nested plain objects actually get written.

::: tip

The precedence in force is **explicit template bindings > `setProps` (including `useForm(options)`) > component defaults**, and all three legs are pinned by unit tests (`form-ui/__tests__/form-props-merge.test.ts:28-62`: `:29` proves the boolean switches take effect, `:44` proves template bindings win, `:53` proves a later `setProps` overrides an earlier one). To replace a whole field set, recompute the entire `schemas` array and `setProps({ schemas })` (exactly what the step form does, `views/components/form/steps/index.vue:135,202,227`) — `schemas` is the only key pulled out for wholesale replacement (`hooks/useFormConfig.ts:64-72`); or bind a `computed` as a template prop (`views/components/form/validation/index.vue`'s four schemas are four independent constants). :::

## FormSchema: the field config

Defined at `schema.ts:86-136` (`BaseFormSchema` 86-126, `FormSchema` 128-136 adding `component` / `componentProps`). Every callback receives `{ schema, values, model, field }` (`RenderCallbackParams`, `schema.ts:58-63`).

| Field | When it takes effect, and where |
| --- | --- |
| `field` | required; a schema without `field` that is not a `Divider` is **dropped outright** by the row grouping (`helpers/rows.ts:44`) |
| `component` | a string key looked up in `componentMap` (next section) |
| `componentProps` | object or function; **written as a function it goes through `helper.ts:69-76` and returns directly, so no automatic placeholder / allowClear** |
| `required` | the repository's only built-in "rule shorthand", expanded into one `{ required: true, message }` inserted at the front of the rules (`helper.ts:181-189`), and it also drives the asterisk (`form-field.vue:110-114`) |
| `rulesMessageJoinLabel` | when true the required message becomes `${label}不能为空`, otherwise `'该项为必填项'` (`helper.ts:185`, `rule-registry.ts:86`) |
| `rules` | executed rule by rule by this package's own `runRule` (`rule-registry.ts:73-147`); a rule whose `pattern` is not a RegExp is **dropped with a console.warn** (`helper.ts:169-179`) |
| `dynamicRules` | in function form it **takes over the field's rules completely**, `rules` and `required` no longer participate (`helper.ts:158-165`) |
| `ifShow` | a falsy value keeps the root node's `v-if` from rendering (`form-field.vue:225`) — but the field is still in the underlying form and **still takes part in validation** (the validation candidates come from `schemas`: `hooks/useFormModel.ts:157-161` → `hooks/useFormValidate.ts:62-66`) |
| `show` | just `v-show` (`form-field.vue:226`), validated the same way |
| `dynamicDisabled` | the result is bound as the control's `disabled` (`form-field.vue:74-84,261`); when it is absent it evaluates to `false`, which then overrides `componentProps.disabled` (the explicit binding follows the `v-bind` spread) |
| `colProps.span` | defaults to `floor(24 / effective cols)` (`hooks/useFormGrid.ts:50-52`, `form-field.vue:142-145`) and is converted into a `width: span/24` percentage (`:147-155`) |
| `itemProps` | **only three keys are useful**: `required` (adds the asterisk, `form-field.vue:112`), `style` (merged into the root node's style, `:152`), `wrapperCol.style` (merged into the control column, `:163-173`). The type is the permissive `Record<string, any>` (`schema.ts:56`); the other keys (including `validateTrigger`) land nowhere |
| `fullRowAlign` | **only takes effect when `grid.cols > 1` and the field occupies a whole row** (`form-field.vue:157-173`); the real effect is `wrapperStyle.maxWidth = calc(100% - gutter)` |
| `suffix` | rendered into the control's `#suffix` (`form-field.vue:121-135,265-269`); among the field controls **only the `FInput` family declares this slot**, the others simply do not show it. `slot` fields and `Divider` never get it |
| `helpMessage` | string or array (arrays joined with `\n`, `form-label.vue:43-47`), rendered as a tooltip after the label; `helpComponentProps` (`schema.ts:75-84`) is **never read**, and the tooltip width is a hardcoded 280px (`form-label.vue:66-71`) |
| `slot` | the field's content is replaced by the page slot of that name, with scoped params `{ model, field }` (`form-field.vue:247-253`); `model` is a **proxy**, and writing to it goes through the underlying `setFieldValue` (`hooks/useFormModel.ts:69-93`), forwarded along `form.vue:162` → `:213-220` |
| `defaultValue` | re-applied on mount, on **every** `setProps({ schemas })` and by `appendSchemaByField` (`hooks/useFormModel.ts:96-105`, call sites `hooks/useFormConfig.ts:71` and `hooks/useFormSchema.ts:34,82`), and it is also the target of `resetFields` (`hooks/useFormModel.ts:129-132`) |

::: warning

These schema fields are dead `subLabel`, `emptySpan`, `disabledLabelWidth`, `render`, `renderColContent`, `renderComponentContent`, `colSlot`, `isAdvanced`, `children`, `changeEvent`, `helpComponentProps` — all present in `schema.ts:86-126`, none of them read by `form.vue` / `form-field.vue` / `helper.ts`. In particular, do not import vue-vben-admin habits and write `render` / `colSlot`: this `form-field.vue` has exactly one custom render path, `slot` (`form-field.vue:247-253`), and a `render` function produces neither an error nor any output. The rule-level `trigger` is likewise only a compatibility field: this implementation runs rules at two moments only, change (and only after the first submit) and submit (`schema.ts:39-40`, `form-field.vue:38-45`). :::

## How `component` strings resolve: `componentMap` only

The `component` string has **one resolution path**: the `componentMap` table — `getComponentInstance` → `getComponent(schema.component)` (`form-field.vue:116-119` → `config.ts:107-109`). The built-in keys are the 28 members of `ComponentType` (`config.ts:22-50`, registry at `:67-101`).

::: tip

Nothing to do with `types/components.d.ts` `apps/web/types/components.d.ts` is the **template tag** artifact produced by `unplugin-vue-components` scanning directories; schema resolution never goes through it. Write `component: 'AInput'` or any name absent from the table and `getComponent` returns `undefined`: no error, no warning — the field degrades into one line of plain text <code v-pre>{{ formModel[field] }}</code> (`form-field.vue:274-276`, value retrieval and serialization at `:215-220`, objects going through `JSON.stringify`). :::

A few points that are easy to get wrong:

- **The aliases really are aliases now**: `MonthPicker` / `WeekPicker` / `RangePicker` / `TimeRangePicker` / `RadioButtonGroup` / `CheckboxGroup` / `InputPassword` / `InputSearch` are each a base control wrapped by `withProps` (`config.ts:52-65`) with fixed props — the month panel and the week panel come from `{ picker: 'month' | 'week' }` (`:87,89`), the ranges from `{ range: true }` (`:88,91`), so you no longer have to write them into `componentProps` yourself. `InputGroup` and `InputTextArea` are pure renames without fixed props (`InputGroup: FInput` at `:69`, `InputTextArea: FTextarea` at `:72`).
- **`Divider` never reaches `componentMap`**: the row grouping pulls `component === 'Divider'` out separately (`helpers/rows.ts:46-50`), and the template renders it as `Separator` + caption (`form.vue:195-205`, `Separator` coming from `@antdv/shadcn-ui`, `form.vue:10`), so the registry entry at `config.ts:95` is used by nobody. **The divider now stays where you put it** (it flushes the current row and is inserted into `rows`); its `label` becomes the divider caption, and `componentProps` is not read on this path.
- **Registering your own field**: `addComponent(name, component)` (`config.ts:103-105`). The table is a module-level singleton, so one registration is referenceable everywhere, and there is **no unregister API**; a new key is not part of the `ComponentType` union, so it needs a one-off cast exactly like the demo does (`views/components/form/custom-component/index.vue:40`, registered at `:96`). The only contract a field component has to meet: accept a `value` prop and emit `update:value` (`form-field.vue:257-264`; compare `views/components/form/custom-component/components/TagPickerField.vue`).
- **A lone checkbox is usable now**: `FCheckbox` branches on whether `options` is an array — without `options` it reads the boolean state `value === true` and emits `update:value` (`fields/FCheckbox.vue:24-35`), so routing around it through `slot` is no longer needed. `Switch` works the same way (`fields/FSwitch.vue`).
- **`ASelect` / `ATreeSelect` have no `api` now**: these two keys are the **downgraded shells** of `FSelect` / `FTreeSelect` in the table (`config.ts:97-99`, whose comment says the web side will override them through `addComponent` with a data-fetching wrapper, but repo-wide only `TagPickerField` has ever been registered by a demo page and there is no data-fetching wrapper at all). The `ApiSelectProps` interface at `types.ts:125-134` (`api` / `resultField` / `labelField` / `valueField` / `numberToString` / `immediate`) appears repo-wide only at its own definition, and no implementation reads it — options always come from `componentProps.options`, and for asynchronous loading you have to feed the result into `componentProps` in the page yourself or register a wrapper component.

**Editable table cells do not share this table.** `BasicColumn.editComponent` is the Table module's own `ComponentType` union (17 keys, `packages/core/ui-kit/table-ui/src/types.ts:90-107`), and the editable cell looks the component up by name, falling back to `Input` when the lookup misses (`getComponent(name) ?? getComponent('Input')` at `TableEditableCell.vue:80`). The two unions are only name-aligned (the comment at `:89` of the table's says exactly that), so writing half of the form's 28 keys into a table column silently turns into a text input.

## Values, validation and submit

The method set `FormActionType` (`types.ts:81-114`) is assembled at `form.vue:71-184` out of five hooks (values → `useFormModel`, validation → `useFormValidate`, submit → `useFormSubmit`, schemas → `useFormSchema`, the outward object → `useFormExpose`):

| Method | Behaviour |
| --- | --- |
| `validate(nameList?)` / `validateFields(nameList?)` | the candidate fields come from `schemas` (not "the fields currently rendered"); each runs the underlying `validateField(field, 'submit')`, then `meta.errors` are collected and de-duplicated (`hooks/useFormValidate.ts:62-87`); `validateFields` is just that (`:112-114`); **you can feed it only part of the field names** (`collectValues`, `hooks/useFormModel.ts:108-117`), which is how the step form does its "validate this step" |
| Validation failure | throws an antd-shaped `{ errorFields, message, outOfDate, values }` (`hooks/useFormValidate.ts:91-99` plus `helpers/validate.ts:16-30`), where `errorFields[i].name` is an **array**; unless `scrollToFirstError` is `false` it first scrolls to the first error field (`hooks/useFormValidate.ts:92-94`) |
| Validation success | the returned value has its ranges split per `fieldMapToTime` **first** and only then gone through `formatDateFields` (`hooks/useFormValidate.ts:102-108`; the reason for that order is the comment at `:103-104` — Safari cannot parse `'YYYY-MM-DD HH:mm:ss'`) |
| `submit()` | equivalent to clicking the submit button, runs `handleSubmit` (`hooks/useFormSubmit.ts:36-51`, exported at `form.vue:178`) |
| `getFieldsValue()` | a shallow copy of the underlying `state.values` (`hooks/useFormModel.ts:119-121`) |
| `setFieldsValue(values)` | `setFieldValue` key by key (`hooks/useFormModel.ts:123-127`), no requirement that the field is currently rendered |
| `resetFields()` | `form.reset({ ...defaults })` falls back to `defaultValue`, and clears the "has submitted" flag (`hooks/useFormModel.ts:129-132`) |
| `clearValidate(name?)` | flattens `errorMap` / `errors` / `isTouched` / `isBlurred` per field (`hooks/useFormModel.ts:140-154`; `errors` derives from `errorMap`, so clearing `errors` alone does nothing) |
| `scrollToField(name, options?)` | queries the node by `[data-field="…"]` and calls `scrollIntoView`, defaulting to `{ behavior: 'smooth', block: 'center' }` (`hooks/useFormValidate.ts:49-59`; the root node is handed over at `form.vue:60,128`) |
| `updateSchema` / `removeSchemaByField` / `appendSchemaByField` | mutate `schemaRef` (`hooks/useFormSchema.ts:40-83`); `updateSchema` is bound by the old-value-wins rule; `remove`/`append` locate by `field`, and if the prefix field is not found they do nothing, while `append` re-applies the default values afterwards (`:82`) |
| `getForm()` | hands back the underlying `@tanstack/vue-form` instance (`hooks/useFormExpose.ts:63`, the type comment is right at `types.ts:106-107`) |
| `setProps(partial)` | see the section above (`hooks/useFormConfig.ts:63-73`) |
| `isMounted()` | the mount flag consumed by `useForm` (`hooks/useFormExpose.ts:59,64,70,75`) |

- **Two validation moments**: `onSubmitAsync` runs every time; `onChangeAsync` runs **only after the first submit** (`form-field.vue:38-45`). The reason is in the comment: when a drawer/modal opens, `setFieldsValue` stamps the fields as touched, and running change validation immediately fills the screen with "该项为必填项". The error text is shown when `isTouched || isBlurred || submitAttempted` (`form-field.vue:188-195`).
- **`runRule` covers the common subset of async-validator**: `required` (with `whitespace`), `transform`, a custom `validator` (both the rejecting and the callback style are accepted, and **it also runs on empty values** — cross-field consistency and "something must be selected" rely entirely on this path, `rule-registry.ts:89-108`), non-required empty values skip the following built-in rules (`:110-111`), `type` (`email` / `url` / `number` / `integer` / `float` / `array` / `object` / `regexp` / `string` / `boolean`, `:19-60`), `pattern`, and `len` / `min` / `max` (numbers compare magnitude, strings and arrays compare length, `:125-144`). The default messages are the Chinese "该项为必填项 / ${label}类型不正确 / ${label}格式不正确 / 不得少于 N 个字符".
- **Submit precedence**: the template-passed `onFinish` > `submitFunc` > `emit('submit', values)` (`hooks/useFormSubmit.ts:40-46`, the ordering rationale in the file header at `:16-24`). A validation failure is swallowed by `catch` and only written to the console as `console.error('Form submit error:', …)` (`:48-50`), **never rethrown**, so to get the failure details you have to `await validate()` yourself instead of relying on `@submit`.
- **Reset**: `resetFunc` is looked at first (given, only it runs), otherwise a value snapshot before the change is taken → `resetFields()` → `submitOnReset` decides between submitting again and `emit('reset', snapshot)` (`hooks/useFormSubmit.ts:53-65`).
- **Date values**: `formatDateFields` only applies to the 6 component names in `DATE_COMPONENTS` (`utils.ts:98-105,128-165`), taking the format from `componentProps.valueFormat` → `format` → `'YYYY-MM-DD HH:mm:ss'`; both dayjs and `Date` are accepted (`isDayjsOrDate` `:111-122`); `RangePicker` / `TimeRangePicker` are **explicitly skipped** (`:151-153`), ranges being left to `fieldMapToTime`.
- **`fieldMapToTime` only takes effect when the value is exactly an array of length 2**, and it `delete`s the original field (`utils.ts:71-93`).
- **Three events only**: `register` / `submit` / `reset` (`form.vue:40-44`).
- **Action-area slots**: `#submitBefore`, `#resetBefore`, `#actionAfter` (`form-actions.vue:66,79,104`, forwarded at `form.vue:242-250`); the built-in button order is submit → reset → expand/collapse.
- **The action area is a grid cell, not a row of its own**: it is mounted inside the last visible row container and its width is whatever that row has left over (`actionsSpan = 24 - span already taken by the last row`, `hooks/useFormRows.ts:58-64` → `helpers/rows.ts:73-78`), so while the fields do not fill a row the buttons sit right at its end. When the last row already spans the full 24 — or is a `Divider` — the area takes 24 and `margin-left: auto` right-aligns it onto a line of its own. If the leftover span cannot fit the buttons, `min-width: max-content` plus the row container's `flex-wrap` drops the whole block onto the next line instead of squashing the buttons (`form-actions.vue:48-57`). Collapsed and expanded both read the same last entry of `rowsWithActions`: toggling only changes how many rows are visible, there is no second positioning rule to switch between, so the layout cannot jitter.
- **Configuration precedence: explicit template bindings > `setProps` (including `useForm(options)`) > component defaults.** Vue casts a Boolean prop the parent never passed to `false`, and `withDefaults` writes into the very same object, so `hooks/useFormConfig.ts:38-48` first uses `vnode.props` to pick out the keys the parent really bound and hands every other key over to `setProps` (the merge itself at `:51-61`) — without that step, switches such as `useForm({ showAdvancedButton: true })` could never open.

::: warning

Three methods have no caller anywhere in the repository `validateFields`, `scrollToField`, and `updateSchema` / `appendSchemaByField` / `removeSchemaByField` turn up in `apps/web/src` nowhere but their type declarations and their own implementations (the three corresponding forwarders on the table instance are literally empty functions — see below). They are usable APIs, but **no demo or business page has ever exercised them**. :::

## Relationship with the table search area

`BasicTable` mounts a `BasicForm` inside itself (imported at `packages/core/ui-kit/table-ui/src/BasicTable.vue:24`, mounted at `:569-575`), with `hooks/useTableForm.ts` as the middle layer:

- **`useSearchForm` alone set to `true` is not enough**; the search area renders only when `useSearchForm && formConfig` are both truthy (`BasicTable.vue:480-482`).
- `formConfig` is spread wholesale into the form props on top of a default set (`useTableForm.ts:132-146`), where `autoSubmitOnEnter: true` (line 138) belongs to the "read by nobody" list above.
- When `useSearchForm` is true the table injects `submitFunc` / `resetFunc` (`useTableForm.ts:143-146`), and **both genuinely take effect now**: `submitFunc` runs through `hooks/useFormSubmit.ts:42-43`; `resetFunc` takes the early-return branch at `hooks/useFormSubmit.ts:54-57`, so the table's `handleReset` can also clear "the search conditions the table remembered" after a reset — the comment at `useTableForm.ts:255-276` (including the historical note that "when `submitOnReset` was falsy it used to leave the state untouched") describes exactly this fixed chain.
- When the form configuration changes, a `setProps` is pushed into `useForm` (`useTableForm.ts:149-158` and `:284-291`, two `watch` calls): `setProps` itself is patch-wins (`hooks/useFormConfig.ts:63-73`), so a repeated `setProps` does take; the leg that really loses to the old value is `updateSchema` (`hooks/useFormSchema.ts:50-53`).
- Of the form methods forwarded by the table instance (`hooks/useTableApi.ts:118-127`), `appendFormSchema` / `removeFormSchema` / `updateFormSchema` are **empty functions** `() => {}` (`:119,122,126`) — calling them has no effect at all; `getFormValues` / `setFormValues` / `resetForm` / `submitForm` / `validateForm` / `getForm` are wired.

## Live examples

| Route | Contents |
| --- | --- |
| `#/components/form/basic` | one 14-field form (`views/components/form/basic/index.vue:14-174`): the `required` shorthand, `rules`, a two-column layout via `colProps.span`, collapsing via `showAdvancedButton` + `alwaysShowLines: 2`, and `fieldMapToTime` splitting `timeRange` (`:176-190`). Four buttons demonstrate `validate()` / `resetFields()` / `setFieldsValue()` / `getFieldsValue()` one by one (`:175,200-235`), and the result JSON is printed in the second card (`:251-255`). Neither card on this page writes `variant="borderless"` (`:238,251`), contrary to the convention stated on the chapter index |
| `#/components/form/steps` | four segments, all **running the whole flow on one `BasicForm` instance**, switching steps with `setProps({ schemas })` (`views/components/form/steps/index.vue:22-23,135,202,227`): ① "next" gated by the current step, ending in a local summary; ② "next" without validation plus drafts; ③ a clickable step bar with the bottom buttons moved into `#submitBefore` / `#actionAfter`; ④ `slot` fields for a table-style multi-select and a read-only summary |
| `#/components/form/validation` | four cards, four schemas: required & format (`:394`), length & numeric range (`:429`), async & cross-field validation (`:470`), validation timing & result (`:509`) |
| `#/components/form/custom-component` | four cards: the built-in `MarkdownEditor` extension (`:239`, the field value is decided by `FMarkdown` and stores Markdown source), `addComponent('TagPickerField', …)` (`:254`, registered at `:96`), `ifShow`/`show`/`dynamicDisabled`/`dynamicRules` linkage (`:278`), and a custom `validator` blocking submit (`:295`) |

::: warning

The step form's draft uses key names invented by the demo page The key `demo:form-steps:draft` is defined in `views/components/form/steps/index.vue:62`, and writing/reading/deleting are this page's own `saveDraft`, `readStoredDraft` / `restoreDraft` and `clearDraft` (the block at `:539-599`, reading and writing `localStorage` directly). **`BasicForm` has no draft capability at all** and `FormProps` has no related field; the draft stores the `JSON.stringify` of `{ savedAt, step, values }` and only lives in this browser. Likewise, "submit" only runs a whole-form validation and prints the values — it issues no request at all. :::

::: tip Two hard rules for step forms

1. **Do not write `defaultValue` on step schemas** — every `setProps({ schemas })` re-runs `initFormModel()` and stamps the fields back to their defaults (`hooks/useFormModel.ts:96-105`, triggered from `hooks/useFormConfig.ts:71`); instead seed the initial values once with `setFieldsValue` before mount, which works thanks to the pending-write queue (`steps/index.vue:98`, mechanism at `use-antdv-form.ts:17-23,53-64`). The page spells the same rule out in its own script comment (`steps/index.vue:69-71`).
2. **A whole-form check must re-assemble every step's schemas before validating**: the candidate fields of `validate()` come from the current `schemaRef` (`hooks/useFormModel.ts:157-161` → `hooks/useFormValidate.ts:62-66`), and switching steps has already replaced it wholesale with `setProps({ schemas })`, so the page assembles the schemas of all steps into one temporary full table and adds `show: false` to the non-current steps (`steps/index.vue:195-202`), and on failure looks up which step to jump back to through `errorFields[0].name[0]` (`:211-214`). Note that `ifShow: false` and `show: false` **both take part in validation** (they differ only in rendering) — candidates are taken from the schema list, not from the fields currently mounted; what really does not get validated are collapsed rows (`hooks/useFormRows.ts:46-52` cuts the rows off entirely, so no `FormField` is created) and fields already removed from `schemas`. :::

**Which rules on the validation page are home-grown**: the repository ships exactly one "rule preset", the `required` shorthand (`helper.ts:181-189`). Everything else is a native field of `Rule` (`schema.ts:17-42`): `type: 'email'` / `type: 'url'` / `type: 'number'`, `min` / `max`, `pattern` (in the several schemas of `validation/index.vue`), plus three validators written in the page itself — username duplication (`setTimeout(600ms)` plus the local array `OCCUPIED_NAMES`, **no endpoint**, `validation/index.vue:168,227-241`), password strength regex (`:256-264`), and password confirmation with province/city/district cross-field consistency (`:275-341`, through `dynamicRules`).

::: warning

The "validation timing" card demonstrates two spellings that no longer do anything The fourth card switches timing with `itemProps: { validateTrigger: 'blur' | 'change' }` and a rule-level `trigger: 'blur'` (`validation/index.vue:358-385`), but only `required` / `style` / `wrapperCol.style` of `itemProps` are ever read (`form-field.vue:112,152,168`), and the rule-level `trigger` is declared as a compatibility field (`schema.ts:39-40`). The actual timing is decided by `submitAttempted` (`form-field.vue:38-45`): before the first submit only submit runs, and after one submit change corrects in real time. Seeing no difference when the switch is toggled is **what the implementation does**, not a bug reproduction. :::

## The form designer was removed together with `antdv-next`

The former `#/components/form-designer` rendered a single third-party component (`<fc-designer>` from `@form-create/antd-designer`), and its templates were compiled before publication — they look components up at runtime through `resolveComponent('a-…')`. Serving it meant hand-registering a batch of `a-*` global components at the entry point (`registerVendorAntdComponents`). That page, that registration table and the `antdv-next` dependency are all gone now: every `a-*` in this repository has always gone through its own explicit import per file (a local binding), so the global table was scaffolding for a third-party template only, and keeping it around suggested it was a pattern to copy.

To bring drag-and-drop form building back, the missing piece is not a registration table but a mapping: the designer emits form-create's own rule JSON (`type` / `field` / `title` / `validate`), **not this repository's `FormSchema` (`component` / `rules`, `schema.ts:86-136`)** — the field names are not the same set, so feeding it to `BasicForm` means writing the converter yourself.

## Related

- [Component examples](/en/components/)
- [Table](/en/components/table)
- [Mock server (Nitro)](/en/guide/essentials/mock)
- [Internationalization](/en/guide/in-depth/internationalization) — the form module contains no i18n call at all (grepping the whole package for `useI18n` / `t(` returns zero hits): the automatic placeholder templates (`helper.ts:42-58`), the required and type messages (`helper.ts:185`, `rule-registry.ts:86-143`) and the default button captions (`helpers/buttons.ts:4-31`) are all hardcoded Chinese.
