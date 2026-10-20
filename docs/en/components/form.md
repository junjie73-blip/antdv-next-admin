# Form

`BasicForm` is a "schema-driven + imperative instance" form container: field config comes in as `schemas`, values live in the underlying form instance, and the page gets the set of `useForm()` methods back through `@register` to read, write and validate. The base is `@tanstack/vue-form` (`useForm` / `useField` own the values, the field meta and the validation scheduling), while the label, the grid row, the error text and some twenty field controls are all rendered by this package itself — it no longer borrows `a-form` / `a-form-item`'s DOM or rule engine. What it still removes are the three repeated chores of admin forms: grid layout, field visibility / linkage, and value assembly.

Source: `packages/core/ui-kit/form-ui/src/` (`components/form-render/form.vue`, 625 lines; `form-field.vue`, 288 lines; `helper.ts` / `utils.ts` / `schema.ts` / `context.ts`; `components/form-actions.vue`; the sixteen field controls in `fields/F*.vue`; `config.ts`; `rule-registry.ts`; `use-antdv-form.ts`; `types.ts`). The public surface is `src/index.ts:1-43`: `BasicForm` / `FormItem` (which is really `form-field.vue`) / `useForm` / `componentMap` / `addComponent` / `getComponent` / `runRule` / `compileFieldValidator` / `deepMerge` / `formatDateFields` / `handleRangeValue`, plus that batch of types.

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

`register` is only emitted once the component reaches `onMounted` (`form.vue:623-626`), and the same instance is also exposed through `defineExpose` (`form.vue:632`), so a template ref reaches the identical method bag. The moment `useForm` receives the instance it does three things: records the reference, pushes the initial config accumulated by `useForm(props)` in through `setProps`, and flushes the values queued before mount (`use-antdv-form.ts:32-41`).

::: tip

The pending queue: `setFieldsValue` before mount is not lost either `useForm` first checks whether the instance is still on the component tree before `setFieldsValue` / `resetFields` (the live-instance check at `use-antdv-form.ts:25-30`, based on the component's `isMounted`: set at `form.vue:589,535`, flipped at `:623-630`); with a dead instance the values **accumulate** in `pendingValues` first (`:53-64`, the comment at `:17-23`) and get written on the next `register`. `resetFields` clears the queue first (`:66-73`) so the next mount is not stamped over with stale data. This queue exists precisely to rescue the "fill the values first, then `openModal`" pattern: modals destroy their content by default, so writing into the dead object from the previous `register` fails silently. The behaviour is unit-tested (`form-ui/__tests__/useForm.test.ts:37,52,67,76`).
:::

::: warning

The queue only protects writes, not validation or reads Only `setFieldsValue` / `resetFields` go through the live-instance check; `getFieldsValue`, `validate`, `validateFields`, `updateSchema` and the rest use `getFormInstance()`, which does not look at mount state (`use-antdv-form.ts:43-45,47-136`). With the form not mounted, **`validate()` does not throw — it returns `{}`** (`:75-81`), so using it as the "validation passed" condition is always true.
:::

**There is no `useModalForm` / `useDrawerForm`.** The form module ships no modal / drawer bridge (nothing in `src/index.ts:1-43`, and neither name can be found anywhere in the repository); what `views/system/*` does is have each page write its own schema and attach it as a template prop.

## Frequently used FormProps

The types are at `types.ts:38-71`; only 8 keys carry a runtime default (`form.vue:36-45`): `showActionButtonGroup` / `showSubmitButton` / `showResetButton` / `submitOnReset` / `autoSubmitOnEnter` / `labelAlign: 'right'` / `colon: false` / `scrollToFirstError: true`.

| Prop | Default | Notes |
| --- | --- | --- |
| `schemas` | — | field config; `setProps` pulls it out of the merge logic separately and replaces it wholesale (`form.vue:572-582`) |
| `grid` | — | `{ cols, gutter }`; `cols` only accepts 1-4, out of range it silently falls back to the responsive column count (`form.vue:163-168`), the breakpoints are hardcoded Tailwind values (`:60-67`: `<sm` 1 column / `<md` 2 columns / `<xl` 3 columns / everything else 4), and `responsive` is read by nobody |
| `labelWidth` / `labelCol` | `labelCol: { span: 4 }` | give `labelWidth` and it becomes `style.width`, `labelCol` being ignored (`form.vue:201-207`); `labelCol.span` is turned into a percentage width (`form-field.vue:175-182`) |
| `wrapperCol` | `{ span: 18 }` | it only enters the context (`form.vue:213`), and **field rendering does not read it** — what takes effect is `itemProps.wrapperCol.style` (`form-field.vue:168-171`) |
| `size` | — | declared at `types.ts:51` and read by nobody in the module; control sizing has to be done per field through `componentProps` |
| `disabled` | — | form-level disabling, OR-ed with `dynamicDisabled` (`form-field.vue:74-84`), and it disables the two action buttons (`form.vue:680`) |
| `showActionButtonGroup` / `showSubmitButton` / `showResetButton` | all `true` | the whole action area and its two buttons (`form.vue:672-699`, `form-actions.vue:61-105`) |
| `submitButtonOptions` / `resetButtonOptions` | text `查询` / `重置`, icons `carbon:search` / `carbon:restart` | **`text` / `preIcon` / `disabled` take effect** (defaults merged at `form.vue:340-350`, bound at `form-actions.vue:67-93`); `loading` / `postIcon` / `iconSize` / `onClick` are declared at `schema.ts:65-73` but read by nobody |
| `actionColOptions` | — | only `style` is ever read (`form.vue:677`); it is the last layer of styling applied to the action area's grid cell (`form-actions.vue:56`), so `width` / `margin-left` here override the default inline-at-end placement |
| `submitOnReset` | `true` | submits once more automatically after a reset (`form.vue:469-481`) |
| `resetFunc` | — | **given, it runs and the function returns right there**, with no reset and no submit (`form.vue:470-473`) |
| `showAdvancedButton` / `alwaysShowLines` | off / `3` | collapsing counts **rows**, not fields (`form.vue:226,281-294`) |
| `fieldMapToTime` | — | `[field, [start, end], format?]`, splits a range into two fields and deletes the original one (`utils.ts:65-96`); the third component accepts `timestamp` and `timestampStartDay`, and by default emits strings in `YYYY-MM-DD` |
| `submitFunc` | — | on submit it wins over `@submit`, but it still sits behind the template's `onFinish` (`form.vue:455-461`) |
| `baseRowStyle` | — | spread onto the row container's `:style` (`form.vue:307-320`) |
| `gutter` related | horizontal 24 / row gap 16 | the row container takes the negative margins and each field takes half of that as padding (`form.vue:172-194`, `form-field.vue:137-151`); a single `gutter` value means the vertical component is 0, hence the `DEFAULT_ROW_GAP_PX = 16` fallback (`:183-194`) |

::: warning

Declared but never read The fields below are legal `FormProps` entries in `types.ts:38-71`, yet no usage of them can be found anywhere in the module (`autoSubmitOnEnter` appears only in the defaults at `form.vue:41`; there is no keydown listener):

- `model` — form values always live in the underlying `@tanstack/vue-form` instance; the initial object you pass in is neither read nor synced back.
- `baseColProps`, `autoFocusFirstItem`, `compact`, `autoSetPlaceHolder`, `autoAdvancedLine`, `mergeDynamicData`, `size`.
- Top-level `rulesMessageJoinLabel` — the one that takes effect is **the copy on the schema** (`helper.ts:156,185`, see also `rule-registry.ts:161-164`).

`colon` and `scrollToFirstError` are no longer dead fields: the former enters the context and decides whether a colon is appended after the label (`form-field.vue:186`, `form-label.vue:57`), the latter decides whether a validation failure scrolls to the first error field (`form.vue:414-416`, `:524-529`). Both can be changed with `setProps`.
:::

## What `setProps` can and cannot change

`deepMerge` backs every merge in this module, and its conflict rule is written in the file header comment (`utils.ts:5-11`, the `deepMerge` body at `:20-55`): **keep the target**. Four practical consequences:

| Situation | Result | Source |
| --- | --- | --- |
| the target has no such key (or its value is `undefined`) | written (arrays / plain objects shallow-copied) | `utils.ts:32-39` |
| the target already holds a scalar/function, source supplies a new value | **the new value is ignored** | `utils.ts:5-11` (the loop falls through to the end and nothing happens) |
| the target already holds an array | **the old array is kept**, even when the source gives a new one | `utils.ts:41` |
| the target has no array and the source gives one | replaced with the source's array | `utils.ts:43-46` |
| both sides are plain objects | merged recursively (same rules inside) | `utils.ts:48-51` |

Because `setProps` makes the target the **previous `propsRef`** (`form.vue:572-582`), while `getProps` makes the target the **template props** (`form.vue:150-160`), it follows that:

- The 8 keys that `withDefaults` already gave a default (`form.vue:36-45`) can **never** be changed by `setProps` / `useForm(props)`; they can only be passed as props on the tag. The step-form demo prints this on its own UI (`views/components/form/steps/index.vue:69-76`).
- The second `setProps` of the same key is also a no-op; array-valued config (`fieldMapToTime`) can never be swapped after the first write.
- `schemas` is unaffected, since it is replaced wholesale (`form.vue:578-581`).
- `updateSchema` falls into the same hole: it is `deepMerge(oldSchema, patch)` (`form.vue:531-543`), so renaming `label`, swapping the `ifShow` function or handing over a whole new `rules` array all lose to the old values — only **new keys** and nested plain objects actually get written.

::: tip

How to actually replace something that already has a value Recompute the whole `schemas` array and `setProps({ schemas })` (that is exactly what the step form does, `views/components/form/steps/index.vue:134,200,225`), or bind a `computed` as a template prop (`views/components/form/validation/index.vue`'s four schemas are four independent constants).
:::

## FormSchema: the field config

Defined at `schema.ts:86-136` (`BaseFormSchema` 86-126, `FormSchema` 128-136 adding `component` / `componentProps`). Every callback receives `{ schema, values, model, field }` (`RenderCallbackParams`, `schema.ts:58-63`).

| Field | When it takes effect, and where |
| --- | --- |
| `field` | required; a schema without `field` that is not a `Divider` is **dropped outright** by the row grouping (`form.vue:259`) |
| `component` | a string key looked up in `componentMap` (next section) |
| `componentProps` | object or function; **written as a function it goes through `helper.ts:69-76` and returns directly, so no automatic placeholder / allowClear** |
| `required` | the repository's only built-in "rule shorthand", expanded into one `{ required: true, message }` inserted at the front of the rules (`helper.ts:181-189`), and it also drives the asterisk (`form-field.vue:110-114`) |
| `rulesMessageJoinLabel` | when true the required message becomes `${label}不能为空`, otherwise `'该项为必填项'` (`helper.ts:185`, `rule-registry.ts:86`) |
| `rules` | executed rule by rule by this package's own `runRule` (`rule-registry.ts:73-147`); a rule whose `pattern` is not a RegExp is **dropped with a console.warn** (`helper.ts:169-179`) |
| `dynamicRules` | in function form it **takes over the field's rules completely**, `rules` and `required` no longer participate (`helper.ts:158-165`) |
| `ifShow` | a falsy value keeps the root node's `v-if` from rendering (`form-field.vue:225`) — but the field is still in the underlying form and **still takes part in validation** (the validation candidates come from `schemas`: `form.vue:383-386`) |
| `show` | just `v-show` (`form-field.vue:226`), validated the same way |
| `dynamicDisabled` | the result is bound as the control's `disabled` (`form-field.vue:74-84,261`); when it is absent it evaluates to `false`, which then overrides `componentProps.disabled` (the explicit binding follows the `v-bind` spread) |
| `colProps.span` | defaults to `floor(24 / effective cols)` (`form.vue:170`, `form-field.vue:142-145`) and is converted into a `width: span/24` percentage (`:147-155`) |
| `itemProps` | **only three keys are useful**: `required` (adds the asterisk, `form-field.vue:112`), `style` (merged into the root node's style, `:152`), `wrapperCol.style` (merged into the control column, `:163-173`). The type is the permissive `Record<string, any>` (`schema.ts:56`); the other keys (including `validateTrigger`) land nowhere |
| `fullRowAlign` | **only takes effect when `grid.cols > 1` and the field occupies a whole row** (`form-field.vue:157-173`); the real effect is `wrapperStyle.maxWidth = calc(100% - gutter)` |
| `suffix` | rendered into the control's `#suffix` (`form-field.vue:121-135,265-269`); among the field controls **only the `FInput` family declares this slot**, the others simply do not show it. `slot` fields and `Divider` never get it |
| `helpMessage` | string or array (arrays joined with `\n`, `form-label.vue:43-47`), rendered as a tooltip after the label; `helpComponentProps` (`schema.ts:75-84`) is **never read**, and the tooltip width is a hardcoded 280px (`form-label.vue:66-71`) |
| `slot` | the field's content is replaced by the page slot of that name, with scoped params `{ model, field }` (`form-field.vue:247-253`); `model` is a **proxy**, and writing to it goes through the underlying `setFieldValue` (`form.vue:97-127`), forwarded along `form.vue:661-667` |
| `defaultValue` | re-applied on mount, on **every** `setProps({ schemas })` and by `appendSchemaByField` (`form.vue:358-367`, call sites `:569,580,617`), and it is also the target of `resetFields` (`:489-492`) |

::: warning

These schema fields are dead `subLabel`, `emptySpan`, `disabledLabelWidth`, `render`, `renderColContent`, `renderComponentContent`, `colSlot`, `isAdvanced`, `children`, `changeEvent`, `helpComponentProps` — all present in `schema.ts:86-126`, none of them read by `form.vue` / `form-field.vue` / `helper.ts`. In particular, do not import vue-vben-admin habits and write `render` / `colSlot`: this `form-field.vue` has exactly one custom render path, `slot` (`:247-253`), and a `render` function produces neither an error nor any output. The rule-level `trigger` is likewise only a compatibility field: this implementation runs rules at two moments only, change (and only after the first submit) and submit (`schema.ts:39-40`, `form-field.vue:38-45`).
:::

## How `component` strings resolve: `componentMap` only

The `component` string has **one resolution path**: the `componentMap` table — `getComponentInstance` → `getComponent(schema.component)` (`form-field.vue:116-119` → `config.ts:107-109`). The built-in keys are the 28 members of `ComponentType` (`config.ts:22-50`, registry at `:67-101`).

::: tip

Nothing to do with `types/components.d.ts` `apps/web/types/components.d.ts` is the **template tag** artifact produced by `unplugin-vue-components` scanning directories; schema resolution never goes through it. Write `component: 'AInput'` or any name absent from the table and `getComponent` returns `undefined`: no error, no warning — the field degrades into one line of plain text <code v-pre>{{ formModel[field] }}</code> (`form-field.vue:274-276`, value retrieval and serialization at `:215-220`, objects going through `JSON.stringify`).
:::

A few points that are easy to get wrong:

- **The aliases really are aliases now**: `MonthPicker` / `WeekPicker` / `RangePicker` / `TimeRangePicker` / `RadioButtonGroup` / `CheckboxGroup` / `InputPassword` / `InputSearch` are each a base control wrapped by `withProps` (`config.ts:52-65`) with fixed props — the month panel and the week panel come from `{ picker: 'month' | 'week' }` (`:87,89`), the ranges from `{ range: true }` (`:88,91`), so you no longer have to write them into `componentProps` yourself. `InputGroup` and `InputTextArea` are pure renames without fixed props (`InputGroup: FInput` at `:69`, `InputTextArea: FTextarea` at `:72`).
- **`Divider` never reaches `componentMap`**: `form.vue` pulls `component === 'Divider'` out separately while grouping rows (`form.vue:261-265`), and the template renders it as `Separator` + caption (`:643-653`, `Separator` coming from `@antdv/shadcn-ui`, `:23`), so the registry entry at `config.ts:95` is used by nobody. **The divider now stays where you put it** (it flushes the current row and is inserted into `rows`); its `label` becomes the divider caption, and `componentProps` is not read on this path.
- **Registering your own field**: `addComponent(name, component)` (`config.ts:103-105`). The table is a module-level singleton, so one registration is referenceable everywhere, and there is **no unregister API**; a new key is not part of the `ComponentType` union, so it needs a one-off cast exactly like the demo does (`views/components/form/custom-component/index.vue:40`, registered at `:96`). The only contract a field component has to meet: accept a `value` prop and emit `update:value` (`form-field.vue:257-264`; compare `views/components/form/custom-component/components/TagPickerField.vue`).
- **A lone checkbox is usable now**: `FCheckbox` branches on whether `options` is an array — without `options` it reads the boolean state `value === true` and emits `update:value` (`fields/FCheckbox.vue:24-35`), so routing around it through `slot` is no longer needed. `Switch` works the same way (`fields/FSwitch.vue`).
- **`ASelect` / `ATreeSelect` have no `api` now**: these two keys are the **downgraded shells** of `FSelect` / `FTreeSelect` in the table (`config.ts:97-99`, whose comment says the web side will override them through `addComponent` with a data-fetching wrapper, but repo-wide only `TagPickerField` has ever been registered by a demo page and there is no data-fetching wrapper at all). The `ApiSelectProps` interface at `types.ts:125-134` (`api` / `resultField` / `labelField` / `valueField` / `numberToString` / `immediate`) appears repo-wide only at its own definition, and no implementation reads it — options always come from `componentProps.options`, and for asynchronous loading you have to feed the result into `componentProps` in the page yourself or register a wrapper component.

**Editable table cells do not share this table.** `BasicColumn.editComponent` is the Table module's own `ComponentType` union (17 keys, `packages/core/ui-kit/table-ui/src/types.ts:90-108`), and the editable cell looks the component up by name, falling back to `Input` when the lookup misses (`getComponent(name) ?? getComponent('Input')` at `TableEditableCell.vue:80`). The two unions are only name-aligned (the comment at `:89` of the table's says exactly that), so writing half of the form's 28 keys into a table column silently turns into a text input.

## Values, validation and submit

The method set `FormActionType` (`types.ts:81-114`) is implemented entirely in `form.vue:357-606`:

| Method | Behaviour |
| --- | --- |
| `validate(nameList?)` / `validateFields(nameList?)` | the candidate fields come from `schemas` (not "the fields currently rendered"); each runs the underlying `validateField(field, 'submit')`, then `meta.errors` are collected and de-duplicated (`form.vue:381-409`); `validateFields` is just that (`:440-442`); **you can feed it only part of the field names** (`collectValues` `:369-378`), which is how the step form does its "validate this step" |
| Validation failure | throws an antd-shaped `{ errorFields, message, outOfDate, values }` (`form.vue:417-430`), where `errorFields[i].name` is an **array**; unless `scrollToFirstError` is `false` it first scrolls to the first error field (`:414-416`) |
| Validation success | the returned value has been through `formatDateFields` and had its ranges split per `fieldMapToTime` (`:365-369`) |
| `submit()` | equivalent to clicking the submit button, runs `handleSubmit` (`form.vue:445-466`) |
| `getFieldsValue()` | a shallow copy of the underlying `state.values` (`form.vue:500-502`) |
| `setFieldsValue(values)` | `setFieldValue` key by key (`form.vue:494-498`), no requirement that the field is currently rendered |
| `resetFields()` | `form.reset({ ...defaults })` falls back to `defaultValue`, and clears the "has submitted" flag (`form.vue:489-492`) |
| `clearValidate(name?)` | flattens `errorMap` / `errors` / `isTouched` / `isBlurred` per field (`form.vue:504-522`; `errors` derives from `errorMap`, so clearing `errors` alone does nothing) |
| `scrollToField(name, options?)` | queries the node by `[data-field="…"]` and calls `scrollIntoView`, defaulting to `{ behavior: 'smooth', block: 'center' }` (`form.vue:524-529`) |
| `updateSchema` / `removeSchemaByField` / `appendSchemaByField` | mutate `schemaRef` (`form.vue:531-570`); `updateSchema` is bound by the target-wins rule; `remove`/`append` locate by `field`, and if the prefix field is not found they do nothing, while `append` re-applies the default values afterwards (`:569`) |
| `getForm()` | hands back the underlying `@tanstack/vue-form` instance (`form.vue:584-586`, the type comment is right at `types.ts:106-107`) |
| `setProps(partial)` | see the section above |
| `isMounted()` | the mount flag consumed by `useForm` (`form.vue:589,535,553-560`) |

- **Two validation moments**: `onSubmitAsync` runs every time; `onChangeAsync` runs **only after the first submit** (`form-field.vue:38-45`). The reason is in the comment: when a drawer/modal opens, `setFieldsValue` stamps the fields as touched, and running change validation immediately fills the screen with "该项为必填项". The error text is shown when `isTouched || isBlurred || submitAttempted` (`form-field.vue:188-195`).
- **`runRule` covers the common subset of async-validator**: `required` (with `whitespace`), `transform`, a custom `validator` (both the rejecting and the callback style are accepted, and **it also runs on empty values** — cross-field consistency and "something must be selected" rely entirely on this path, `rule-registry.ts:89-108`), non-required empty values skip the following built-in rules (`:110-111`), `type` (`email` / `url` / `number` / `integer` / `float` / `array` / `object` / `regexp` / `string` / `boolean`, `:19-60`), `pattern`, and `len` / `min` / `max` (numbers compare magnitude, strings and arrays compare length, `:125-144`). The default messages are the Chinese "该项为必填项 / ${label}类型不正确 / ${label}格式不正确 / 不得少于 N 个字符".
- **Submit precedence**: the template-passed `onFinish` > `submitFunc` > `emit('submit', values)` (`form.vue:455-461`). A validation failure is swallowed by `catch` and only written to the console as `console.error('Form submit error:', …)` (`:463-465`), **never rethrown**, so to get the failure details you have to `await validate()` yourself instead of relying on `@submit`.
- **Reset**: `resetFunc` is looked at first (given, only it runs), otherwise a value snapshot before the change is taken → `resetFields()` → `submitOnReset` decides between submitting again and `emit('reset', snapshot)` (`form.vue:469-481`).
- **Date values**: `formatDateFields` only applies to the 6 component names in `DATE_COMPONENTS` (`utils.ts:98-105,128-165`), taking the format from `componentProps.valueFormat` → `format` → `'YYYY-MM-DD HH:mm:ss'`; both dayjs and `Date` are accepted (`isDayjsOrDate` `:111-122`); `RangePicker` / `TimeRangePicker` are **explicitly skipped** (`:151-153`), ranges being left to `fieldMapToTime`.
- **`fieldMapToTime` only takes effect when the value is exactly an array of length 2**, and it `delete`s the original field (`utils.ts:71-93`).
- **Three events only**: `register` / `submit` / `reset` (`form.vue:47-51`).
- **Action-area slots**: `#submitBefore`, `#resetBefore`, `#actionAfter` (`form-actions.vue:66,79,104`, forwarded at `form.vue:690-698`); the built-in button order is submit → reset → expand/collapse.
- **The action area is a grid cell, not a row of its own**: it is mounted inside the last visible row container and its width is whatever that row has left over (`actionsSpan = 24 - span already taken by the last row`, `form.vue:331-339`), so while the fields do not fill a row the buttons sit right at its end. When the last row already spans the full 24 — or is a `Divider` — the area takes 24 and `margin-left: auto` right-aligns it onto a line of its own. If the leftover span cannot fit the buttons, `min-width: max-content` plus the row container's `flex-wrap` drops the whole block onto the next line instead of squashing the buttons (`form-actions.vue:48-57`). Collapsed and expanded both read the same last entry of `rowsWithActions`: toggling only changes how many rows are visible, there is no second positioning rule to switch between, so the layout cannot jitter.
- **Configuration precedence: explicit template bindings > `setProps` (including `useForm(options)`) > component defaults.** Vue casts a Boolean prop the parent never passed to `false`, and `withDefaults` writes into the very same object, so `form.vue:139-160` first uses `vnode.props` to pick out the keys the parent really bound and hands every other key over to `setProps` — without that step, switches such as `useForm({ showAdvancedButton: true })` could never open.

::: warning

Three methods have no caller anywhere in the repository `validateFields`, `scrollToField`, and `updateSchema` / `appendSchemaByField` / `removeSchemaByField` turn up in `apps/web/src` nowhere but their type declarations and their own implementations (the three corresponding forwarders on the table instance are literally empty functions — see below). They are usable APIs, but **no demo or business page has ever exercised them**.
:::

## Relationship with the table search area

`BasicTable` mounts a `BasicForm` inside itself (`packages/core/ui-kit/table-ui/src/BasicTable.vue:29,1160-1166`), with `hooks/useTableForm.ts` as the middle layer:

- **`useSearchForm` alone set to `true` is not enough**; the search area renders only when `useSearchForm && formConfig` are both truthy (`BasicTable.vue:1031`).
- `formConfig` is spread wholesale into the form props on top of a default set (`useTableForm.ts:132-146`), where `autoSubmitOnEnter: true` (line 138) belongs to the "read by nobody" list above.
- When `useSearchForm` is true the table injects `submitFunc` / `resetFunc` (`useTableForm.ts:143-146`), and **both genuinely take effect now**: `submitFunc` runs through `form.vue:457-458`; `resetFunc` takes the early-return branch at `form.vue:470-473`, so the table's `handleReset` can also clear "the search conditions the table remembered" after a reset — the comment at `useTableForm.ts:255-276` (including the historical note that "when `submitOnReset` was falsy it used to leave the state untouched") describes exactly this fixed chain.
- When the form configuration changes, a `setProps` is pushed into `useForm` (`useTableForm.ts:149-158` and `:284-291`, two `watch` calls), but the target-wins rule means only new keys get written.
- Of the form methods forwarded by the table instance (`BasicTable.vue:1126-1134`), `updateFormSchema` / `appendFormSchema` / `removeFormSchema` are **empty functions** `() => {}` (`:1132-1134`) — calling them has no effect at all; `getFormValues` / `setFormValues` / `resetForm` / `submitForm` / `validateForm` / `getForm` are wired.

## Live examples

| Route | Contents |
| --- | --- |
| `#/components/form/basic` | one 14-field form (`views/components/form/basic/index.vue:14-174`): the `required` shorthand, `rules`, a two-column layout via `colProps.span`, collapsing via `showAdvancedButton` + `alwaysShowLines: 2`, and `fieldMapToTime` splitting `timeRange` (`:176-190`). Four buttons demonstrate `validate()` / `resetFields()` / `setFieldsValue()` / `getFieldsValue()` one by one (`:175,200-235`), and the result JSON is printed in the second card (`:251-255`). Neither card on this page writes `variant="borderless"` (`:238,251`), contrary to the convention stated on the chapter index |
| `#/components/form/steps` | four segments, all **running the whole flow on one `BasicForm` instance**, switching steps with `setProps({ schemas })` (`views/components/form/steps/index.vue:22-23,134,200,225`): ① "next" gated by the current step, ending in a local summary; ② "next" without validation plus drafts; ③ a clickable step bar with the bottom buttons moved into `#submitBefore` / `#actionAfter`; ④ `slot` fields for a table-style multi-select and a read-only summary |
| `#/components/form/validation` | four cards, four schemas: required & format (`:394`), length & numeric range (`:429`), async & cross-field validation (`:470`), validation timing & result (`:509`) |
| `#/components/form/custom-component` | four cards: the built-in `MarkdownEditor` extension (`:239`, the field value is decided by `FMarkdown` and stores Markdown source), `addComponent('TagPickerField', …)` (`:254`, registered at `:96`), `ifShow`/`show`/`dynamicDisabled`/`dynamicRules` linkage (`:278`), and a custom `validator` blocking submit (`:295`) |
| `#/components/form-designer` | a third-party form designer, see the next section |

::: warning

The step form's draft uses key names invented by the demo page The key `demo:form-steps:draft` is defined in `views/components/form/steps/index.vue:62`, and writing/reading/deleting are this page's own `saveDraft`, `readStoredDraft` / `restoreDraft` and `clearDraft` (the block at `:534-595`, reading and writing `localStorage` directly). **`BasicForm` has no draft capability at all** and `FormProps` has no related field; the draft stores the `JSON.stringify` of `{ savedAt, step, values }` and only lives in this browser. Likewise, "submit" only runs a whole-form validation and prints the values — it issues no request at all.
:::

::: tip Two hard rules for step forms

1. **Do not write `defaultValue` on step schemas** — every `setProps({ schemas })` re-runs `initFormModel()` and stamps the fields back to their defaults (`form.vue:358-367,508-511`); instead seed the initial values once with `setFieldsValue` before mount, which works thanks to the pending-write queue (`steps/index.vue:96`, mechanism at `use-antdv-form.ts:17-23,53-64`). This is the page's own comment, printed on the UI (`steps/index.vue:69-76`).
2. **A whole-form check must re-mount the other steps with `show: false` before validating**: the candidate fields of `validate()` come from `schemas` (`form.vue:383-386`), so the page assembles the schemas of all steps into one temporary full table and adds `show: false` to the non-current steps (`steps/index.vue:188-200`), and on failure looks up which step to jump back to through `errorFields[0].name[0]` (`:206-211`). Note that `ifShow: false` and `show: false` **both take part in validation** (they differ only in rendering); the page's comment claiming "switching to `ifShow: false` really unmounts it, i.e. no validation at all" does not match observed behaviour; what really does not get validated are collapsed rows (`form.vue:288-294` skips the FormField entirely) and fields already removed from `schemas`.
:::

**Which rules on the validation page are home-grown**: the repository ships exactly one "rule preset", the `required` shorthand (`helper.ts:181-189`). Everything else is a native field of `Rule` (`schema.ts:17-42`): `type: 'email'` / `type: 'url'` / `type: 'number'`, `min` / `max`, `pattern` (in the several schemas of `validation/index.vue`), plus three validators written in the page itself — username duplication (`setTimeout(600ms)` plus the local array `OCCUPIED_NAMES`, **no endpoint**, `validation/index.vue:168,227-241`), password strength regex (`:256-264`), and password confirmation with province/city/district cross-field consistency (`:275-341`, through `dynamicRules`).

::: warning

The "validation timing" card demonstrates two spellings that no longer do anything The fourth card switches timing with `itemProps: { validateTrigger: 'blur' | 'change' }` and a rule-level `trigger: 'blur'` (`validation/index.vue:358-385`), but only `required` / `style` / `wrapperCol.style` of `itemProps` are ever read (`form-field.vue:112,152,168`), and the rule-level `trigger` is declared as a compatibility field (`schema.ts:39-40`). The actual timing is decided by `submitAttempted` (`form-field.vue:38-45`): before the first submit only submit runs, and after one submit change corrects in real time. Seeing no difference when the switch is toggled is **what the implementation does**, not a bug reproduction.
:::

## The form designer is not `BasicForm`

`#/components/form-designer` is 39 lines in total and renders a single third-party component: `<fc-designer ref="designerRef" height="100%" :config="designerConfig" />` (`views/components/form-designer/index.vue:37`), provided by `@form-create/antd-designer` and installed globally at the entry point (`apps/web/src/main.ts:10-12,50,82-83`).

- `designerConfig` is nothing but those 15 switches (14 `show*` flags plus one `autoActive`, `form-designer/index.vue:12-27`), and no logic anywhere reads the designer's output.
- It depends on `registerVendorAntdComponents(app)` (`main.ts:57`): every `a-*` in this repository goes through its own explicit import in each file, which is a **local binding**, while the designer's templates were compiled before publication and only call `resolveComponent('a-layout-sider')` at runtime, so local bindings cannot help them — without that global registration you get "no error but the whole block is blank" (the comment at `plugins/vendor-antd-components.ts:44-58`, `main.ts:49-57`). This is the only reason `antdv-next` is still kept in `apps/web` after the migration, and also the reason it appears on **this one page** only.
- What the designer produces is form-create's own rule JSON (`type` / `field` / `title` / `validate`), **not this repository's `FormSchema` (`component` / `rules`, `schema.ts:86-136`)** — the field names are not the same set, and the page contains no converter or save logic, so wiring it to `BasicForm` means writing the mapping yourself.

## Related

- [Component examples](/en/components/)
- [Table](/en/components/table)
- [Mock server (Nitro)](/en/guide/essentials/mock)
- [Internationalization](/en/guide/in-depth/internationalization) — the form module contains no i18n call at all (grepping the whole package for `useI18n` / `t(` returns zero hits): the automatic placeholder templates (`helper.ts:42-58`), the required and type messages (`helper.ts:185`, `rule-registry.ts:86-143`) and the default button captions (`form.vue:340-355`) are all hardcoded Chinese.
