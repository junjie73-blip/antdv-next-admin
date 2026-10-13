# Form

`BasicForm` wraps antdv-next's `a-form` into a schema-driven component with an imperative instance: field config comes in as `schemas`, values live in the component's internal `formModel`, and the page gets the `useForm()` method bag back through `@register` to read, write and validate. It removes the three repeated chores of admin forms — grid layout, field visibility/linkage, and value assembly.

Source: `apps/web/src/components/business/Form/` (`BasicForm.vue` / `useForm.ts` / `types.ts` / `componentMap.ts` / `helper.ts` / `components/FormItem.vue`). The public surface is 8 lines: `Form/index.ts:1-8`.

## useForm: registration and instance

```ts
// apps/web/src/components/business/Form/types.ts:192-195
export type UseFormReturnType = [
  register: (instance: FormActionType) => void,
  methods: FormActionType,
];
```

Unlike `useTable` for tables, the second element is **the method object itself**, not a `Ref`, so it can be destructured directly (`views/components/form/basic/index.vue:172`).

```vue
<script setup lang="ts">
import type { FormSchema } from '~/components/business/Form';
import { BasicForm, useForm } from '~/components/business/Form';

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

`register` is only emitted in the component's `onMounted` (`BasicForm.vue:438-441`); the moment it receives the instance it merges the initial `useForm(props)` config via `setProps` and flushes the values queued before mount (`useForm.ts:46-55`). The same object is exposed with `defineExpose` (`BasicForm.vue:447`), so a template ref reaches the identical method bag.

::: tip The pending queue: `setFieldsValue` before mount is not lost `useForm` checks whether the instance is still on the component tree before `setFieldsValue` / `resetFields` (`useForm.ts:40-44` + `BasicForm.vue:405,422,443-445`); a dead instance means the values accumulate in `pendingValues` and get written when a real instance registers (`useForm.ts:67-84`). This exists precisely for the site-wide pattern "fill the values first, then `openModal`": modals destroy their content when closed, so writing into the object from the previous `register` fails silently. The behaviour is unit-tested (`Form/__tests__/use-form.spec.ts:63-163`). :::

::: warning The queue only protects writes, not validation or reads Only `setFieldsValue` / `resetFields` use the live-instance check. `getFieldsValue`, `validate`, `validateFields`, `updateSchema` and friends go through `getFormInstance()`, which does not look at mount state (`useForm.ts:57-65,86-129`). With no form mounted, **`validate()` does not reject — it returns `{}`** (`useForm.ts:86-92`), so treating its result as "validation passed" is always truthy. :::

**There is no `useModalForm` / `useDrawerForm`.** The Form module ships no modal/drawer bridge (not in `Form/index.ts:1-8`, and neither name exists anywhere in the repo); `views/system/*` simply declares a `modalFormSchemas` variable per page and binds it as a template prop (`views/system/dept/index.vue:201,641`).

## Frequently used FormProps

Declared at `Form/types.ts:122-153`; only six keys carry runtime defaults (`BasicForm.vue:35-44`).

| Prop | Default | Notes |
| --- | --- | --- |
| `schemas` | — | field config; `setProps` handles it separately as a whole-array replacement (`BasicForm.vue:384-392`) |
| `grid` | — | `{ cols, gutter }`; `cols` only accepts 1-4 — anything else silently falls back to the responsive column count (`BasicForm.vue:93-98`), and `responsive` is never read (`types.ts:119`) |
| `labelWidth` / `labelCol` | `labelCol: { span: 4 }` | when `labelWidth` is set it becomes `style.width` and `labelCol` is ignored (`BasicForm.vue:204-210`) |
| `wrapperCol` | `{ span: 18 }` when cols>1 | single-column mode swaps it for flex when `labelWidth` is present (`BasicForm.vue:212-221`) |
| `size` / `disabled` | — | bound straight onto `a-form` (`BasicForm.vue:457-458`) |
| `showActionButtonGroup` / `showSubmitButton` / `showResetButton` | all `true` | the action area and its two buttons (`BasicForm.vue:495-518`) |
| `submitButtonOptions` / `resetButtonOptions` | text `查询` / `重置`, icons `carbon:search` / `carbon:restart` | **only `text` and `preIcon` are honoured** (`BasicForm.vue:224-234,502-518`); `loading` / `disabled` / `postIcon` / `iconSize` / `onClick` exist in `types.ts:39-47` with no reader |
| `submitOnReset` | `true` | re-submits after a reset (`BasicForm.vue:296-304`) |
| `showAdvancedButton` / `alwaysShowLines` | off / `3` | collapsing counts **rows**, not fields (`BasicForm.vue:152-157`) |
| `fieldMapToTime` | — | `[field, [start, end], format?]` splits a range into two fields and deletes the original (`helper.ts:196-227`) |
| `submitFunc` | — | takes precedence over `@submit` (`BasicForm.vue:282-288`) |
| `baseRowStyle` | — | spread onto `<a-row>` (`BasicForm.vue:196-202`) |

::: warning Declared, never read Each of these is a legal `FormProps` entry in `types.ts:122-153` with no usage anywhere in the module (`autoSubmitOnEnter` only appears as a default at `BasicForm.vue:40` — there is no keydown listener):

- `model` — form values always live in the internal `formModel` (`BasicForm.vue:72,242-244`); the object you pass in is neither read nor synced back.
- `baseColProps`, `actionColOptions` — the grid is derived from `grid.cols` (`BasicForm.vue:101,171-180`).
- `autoFocusFirstItem`, `compact`, `autoSetPlaceHolder`, `autoAdvancedLine`, `mergeDynamicData`, `resetFunc`.
- Top-level `rulesMessageJoinLabel` — the one that works is the **per-schema** copy (`helper.ts:158,188`).
- `grid.responsive` — the breakpoints are hardcoded Tailwind values (`BasicForm.vue:62-69`).

`colon` and `scrollToFirstError` are the reverse case: they appear in `withDefaults` (`BasicForm.vue:42-43`) but are **not** fields of `FormProps`; the template hardcodes `:colon="false"` (`BasicForm.vue:459`) and `getProps` binds only five keys to `a-form`. So native attributes like these only work **written on the `<BasicForm>` tag**, where they travel through `useAttrs()` passthrough (`BasicForm.vue:87-90,460`) — `setProps({ … })` cannot reach them. :::

## What `setProps` can and cannot change

`deepMerge` backs every merge in this module and its tie-break rule is **keep the target** (`helper.ts:317-359`; the comment on lines 354-355 literally reads "其它情况：目标优先" — "otherwise the target wins"). Four consequences:

| Situation | Result | Source |
| --- | --- | --- |
| key absent from target | written | `helper.ts:332-338` |
| target holds a scalar/function, source supplies a new one | **new value ignored** | `helper.ts:354-355` |
| target holds an array, source supplies a new array | **old array kept** | `helper.ts:340-341` |
| both sides are plain objects | merged recursively (same rules inside) | `helper.ts:350-353` |

`BasicForm.setProps` uses the **previous `propsRef`** as the target (`BasicForm.vue:384-392`), and `getProps` uses the **template props** as the target (`BasicForm.vue:79-84`), which means:

- The keys that `withDefaults` already gave a value — `showActionButtonGroup`, `showSubmitButton`, `showResetButton`, `submitOnReset`, `labelAlign` — can **never** be changed through `setProps` / `useForm(props)`; pass them as template props instead. The step-form demo prints this warning in its own UI (`views/components/form/steps/index.vue:65-67`, `918-920`).
- A second `setProps` of the same key is also a no-op, and array-valued config (e.g. `fieldMapToTime`) can never be swapped after the first write.
- `schemas` is unaffected: it is replaced wholesale (`BasicForm.vue:388-391`).
- `updateSchema` inherits the same trap — it is `deepMerge(oldSchema, patch)` (`BasicForm.vue:344-356`), so renaming `label`, replacing the `ifShow` function or handing over a new `rules` array all lose to the old values. Only **new keys** and nested plain objects get written.

::: tip How to actually change something that already has a value Recompute the whole `schemas` array and `setProps({ schemas })` (that is exactly what the step form does, `views/components/form/steps/index.vue:114-124`), or bind a `computed` array as a template prop (`views/components/form/validation/index.vue:347-380`, `timingSchemas` + `:schemas`). :::

## FormSchema: the field config

Defined at `Form/types.ts:61-111` (the generic inference of `component` / `componentProps` is 104-111). Every callback receives `{ schema, values, model, field }` (`types.ts:32-37`).

| Field | When it takes effect |
| --- | --- |
| `field` | required, the key in `formModel`; `Divider` may omit it (`BasicForm.vue:124`) |
| `component` | a string key looked up in `componentMap` (next section) |
| `componentProps` | object or function; **the function form returns early (`helper.ts:70-77`), so no automatic placeholder / allowClear** |
| `required` | the only rule shorthand this repository provides; expanded into one `{ required: true, message }` (`helper.ts:183-191`) |
| `rulesMessageJoinLabel` | with it, the message becomes `${label}不能为空`, otherwise `'该项为必填项'` (`helper.ts:188`) |
| `rules` | handed verbatim to `a-form-item` (`FormItem.vue:160`); rules whose `pattern` is not a RegExp are **dropped with a console.warn** (`helper.ts:171-181`) |
| `dynamicRules` | in function form it **takes the field's rules over completely** — `rules` and `required` no longer participate (`helper.ts:160-167`) |
| `ifShow` | falsy means the `a-form-item` is not rendered at all → the field is not validated (`FormItem.vue:155`) |
| `show` | plain `v-show`; the field stays in the form registry and **is still validated** (`FormItem.vue:156`) |
| `dynamicDisabled` | bound as the component's `disabled` (`FormItem.vue:192`); when absent it evaluates to `false`, which overrides `componentProps.disabled` because the explicit binding follows the `v-bind` spread |
| `colProps.span` | defaults to `floor(24 / effective cols)` (`BasicForm.vue:101,171-180`) |
| `itemProps` | spread onto `a-form-item` (`FormItem.vue:109,158`) — that is how `validateTrigger` is passed |
| `fullRowAlign` | **only when `grid.cols > 1` and the field occupies a full row** (`FormItem.vue:108-137`); the real effect is `wrapperCol.style.maxWidth`, and the accompanying `form-item-full-row-align` class has no stylesheet anywhere in the repo |
| `suffix` | rendered into the component's `#suffix` (`FormItem.vue:196-200`), i.e. only meaningful for controls that have that slot; `slot` fields and `Divider` never see it |
| `helpMessage` | string or array (joined with `\n`, `FormItem.vue:139-145`), shown as a tooltip after the label; `helpComponentProps` (`types.ts:49-58`) is **never read** — the tooltip's width and placement are hardcoded (`FormItem.vue:169-172`) |
| `slot` | the control is replaced by a page slot of that name, scoped params `{ model, field }` (`FormItem.vue:184-186`, forwarded by `BasicForm.vue:472-478`) |
| `defaultValue` | re-applied on mount and on **every** `setProps({ schemas })` (`BasicForm.vue:246-254,388-391`) |

::: warning These schema fields are dead `subLabel`, `emptySpan`, `disabledLabelWidth`, `render`, `renderColContent`, `renderComponentContent`, `colSlot`, `isAdvanced`, `children`, `changeEvent` — all present in `types.ts:61-101`, none read by `FormItem.vue` / `BasicForm.vue` / `helper.ts`. In particular, do not import vben habits and write `render` / `colSlot`: this `FormItem.vue` has exactly one custom-render path, `slot` (`FormItem.vue:184-206`); a `render` function produces no error and no output. :::

## How `component` strings resolve: `componentMap` only

The string in `component` has **one resolution path**: a lookup in the `componentMap` table — `getComponentInstance` → `getComponent(schema.component)` (`FormItem.vue:76-79` → `componentMap.ts:126-128`). The built-in keys are the 28 members of `ComponentType` (`componentMap.ts:30-58`, registered on lines 91-120).

::: tip Nothing to do with `types/components.d.ts` `apps/web/types/components.d.ts` is the `unplugin-vue-components` artifact for **template tags**, produced by scanning the `src/components` directory (with the resolvers withdrawn it now contains only this repository's local components); schema resolution never touches it. `component: 'AInput'`, or any name absent from the table, makes `getComponent` return `undefined`: no error, no warning — the field degrades into the plain text <code v-pre>{{ formModel[field] }}</code> (`FormItem.vue:204-206`). :::

Details worth knowing:

- **Four keys are only aliases**: `MonthPicker` / `WeekPicker` → `DatePicker`, `TimeRangePicker` → `TimePicker` (not a range picker), `RadioButtonGroup` → `RadioGroup`, `InputTextArea` → `TextArea` (`componentMap.ts:96,101,107-111`). `component: 'MonthPicker'` does not give you a month panel by itself — pass `picker: 'month'` in `componentProps`.
- **`Divider` never reaches the table**: `BasicForm` splits it out while grouping rows (`BasicForm.vue:127-135,189-193`) and renders it in a separate `v-for` loop (`BasicForm.vue:483-492`), so the `Divider` entry at `componentMap.ts:115` is unused. Side effect: **every `Divider` renders after all fields** (loop order), so a divider placed in the middle of the schema does not stay where you put it; its `label` becomes the caption and `componentProps` is spread onto `a-divider`.
- **Registering your own field**: `addComponent(name, component)` (`componentMap.ts:122-124`). The table is a module-level singleton, so one registration is visible to every form, and there is **no way to unregister**; a new key is not part of the `ComponentType` union, so it needs a one-off cast exactly like the demo does (`views/components/form/custom-component/index.vue:40`, registered on line 94). The contract for the field component is a single pair of names: accept a `value` prop, emit `update:value` (`FormItem.vue:193-194`; compare `views/components/form/custom-component/components/TagPickerField.vue:8-22`).
- **A lone checkbox cannot use `component: 'Checkbox'`**: `FormItem` only feeds `value` / `update:value`, while antdv-next keeps the checked state in `checked` (`antdv-next/dist/checkbox/Checkbox.d.ts:9-13,31-33`) — clicking it does nothing. `Switch` works because it exposes `value` as an alias of `checked` and emits `update:value` too (`antdv-next/dist/switch/index.d.ts:26-31,58-59`). For a single checkbox, use `slot`.

::: warning The `api` of `ASelect` / `ATreeSelect` is not a request function The two components registered in `componentMap` (lines 117-118) really take `api: string` — a URL handed to `useRequest`, whose result is used **directly as the options array** (`Form/components/ApiSelect.vue:7-9,19`, `ATreeSelect.vue:7-9,20`). There is no `resultField` / `labelField` / `valueField` / `numberToString` / `immediate` support: the `ApiSelectProps` interface at `types.ts:201-210` appears nowhere else in the repository and no implementation reads it. Also, `watchDebounced(api, …)` (`ApiSelect.vue:15` / `ATreeSelect.vue:16`) watches the **destructured string**, not a ref or getter, so changing the URL later does not refetch — behaviour read from the source that no demo exercises, so do not rely on it. The export names disagree with the keys as well: `Form/index.ts:3-4` exports these files as `ASelect` and **`ApiTreeSelect`**, while the schema key is `ATreeSelect`. :::

**Editable table cells do not share this table.** `BasicColumn.editComponent` uses the Table module's own `ComponentType` union (`Table/types.ts:81-98,134`), and `TableEditableCell.tsx:119-182` is a `switch` with branches for only `Input` / `InputNumber` / `Select` / `DatePicker` / `Switch`, whose `default` renders `<Input>`. The remaining 12 names in that union (including `ApiSelect`, `ApiTreeSelect`, `ApiCascader`, `ApiRadioGroup`, `Checkbox`, `Radio`, `RangePicker`, `TimePicker`, `TreeSelect`) therefore produce an editable cell that silently degrades into a text input.

## Values, validation and submit

The `FormActionType` contract (`types.ts:155-190`) is implemented in `BasicForm.vue:257-423`:

| Method | Behaviour |
| --- | --- |
| `validate(nameList?)` / `validateFields(nameList?)` | call the `a-form` counterparts (`antdv-next/dist/form/Form.d.ts:104-105`), then `formatDateFields` + `handleRangeValue` (`BasicForm.vue:257-271`); **a partial field list is supported**, which is how the step form validates one step |
| `submit()` | same as clicking submit, runs `handleSubmit` (`BasicForm.vue:274-293`) |
| `getFieldsValue()` | shallow copy `{ ...formModel }` (`BasicForm.vue:327-329`) |
| `setFieldsValue(values)` | writes keys into `formModel` (`BasicForm.vue:321-325`); triggers no validation and does not require the field to be rendered |
| `resetFields()` | `a-form.resetFields()` first, then each key falls back to its `defaultValue` (`BasicForm.vue:312-319`) |
| `clearValidate(name?)` / `scrollToField(name, options?)` | forwarded (`BasicForm.vue:331-342`) |
| `updateSchema` / `removeSchemaByField` / `appendSchemaByField` | mutate `schemaRef` (`BasicForm.vue:344-382`); `updateSchema` is bound by the target-wins rule; remove/append locate by `field` and do nothing if the prefix field is missing |
| `getForm()` | returns the antd `FormInstance` (`BasicForm.vue:394-396`) |
| `setProps(partial)` | see the section above |
| `isMounted()` | mount flag consumed by `useForm` (`BasicForm.vue:405,422`) |

::: warning Methods with no caller in the repository `validateFields`, `scrollToField`, `updateSchema` / `appendSchemaByField` / `removeSchemaByField` appear in `apps/web/src` only as the type declaration plus their own implementation. They are real APIs, but **no demo or business page has ever exercised them** (the corresponding forwarders on the table instance are literally empty functions — see below). :::

- **Submit precedence**: an `@finish` attribute (`onFinish` from the attrs passthrough) > `submitFunc` > `emit('submit', values)` (`BasicForm.vue:282-288`). A validation failure is swallowed by `catch` and only logged as `console.error('Form submit error:', …)` (`BasicForm.vue:290-292`) — **it is never rethrown**, so to read the failure details you must `await validate()` yourself instead of relying on `@submit`.
- **Reset**: after `resetFields()`, `submitOnReset` decides between re-submitting and `emit('reset', snapshot-before-reset)` (`BasicForm.vue:296-304`; line 297 captures the pre-reset `formModel`).
- **Date values**: `formatDateFields` only applies to the six names in `DATE_COMPONENTS` (`helper.ts:233-240,259-296`), taking the format from `componentProps.valueFormat` → `format` → `'YYYY-MM-DD HH:mm:ss'`; `RangePicker` / `TimeRangePicker` are **explicitly skipped** (`helper.ts:282-284`) and left to `fieldMapToTime`.
- **`fieldMapToTime` only fires when the value is exactly a 2-element array**, and it `delete`s the original key (`helper.ts:202-224`).
- **Three events only**: `register` / `submit` / `reset` (`BasicForm.vue:46-50`).
- **Action-area slots**: `#submitBefore`, `#resetBefore`, `#actionAfter` (`BasicForm.vue:501-523`); the built-in order is submit → reset → expand/collapse.

## Relationship with the table search area

`BasicTable` mounts a `BasicForm` inside itself (`Table/BasicTable.vue:686-688`), with `Table/hooks/useTableForm.ts` as the adapter:

- **`useSearchForm: true` alone is not enough** — the search area renders only when `useSearchForm && formConfig` are both truthy (`Table/BasicTable.vue:401-403`).
- `formConfig` is spread into the form props on top of a default set (`useTableForm.ts:150-171`), where `autoSubmitOnEnter: true` (line 160) belongs to the never-read list above.
- When `useSearchForm` is on, the table injects `submitFunc` / `resetFunc` (`useTableForm.ts:165-168`): `submitFunc` genuinely runs (`BasicForm.vue:284-285`); **`resetFunc` is never called** (nothing in `BasicForm.vue` reads it), so the comment and implementation of `useTableForm.ts:277-297` — "reset must clear the searchInfo the table remembered" — are dead code; the reset path actually goes through `submitOnReset` → `submitFunc`.
- Of the form methods forwarded by the table instance (`Table/BasicTable.vue:649-659`), `updateFormSchema` / `appendFormSchema` / `removeFormSchema` are **empty functions** `() => {}` (`BasicTable.vue:656-658`) — calling them does nothing; `getFormValues` / `setFormValues` / `resetForm` / `submitForm` / `validateForm` / `getForm` are wired.

## Live examples

| Route | Contents |
| --- | --- |
| `#/components/form/basic` | one 14-field form: `required` shorthand, `rules`, two-column layout via `colProps.span`, collapsing via `showAdvancedButton` + `alwaysShowLines: 2`, and `fieldMapToTime` splitting `timeRange` (`views/components/form/basic/index.vue:11-192`). Four buttons demonstrate `validate()` / `resetFields()` / `setFieldsValue()` / `getFieldsValue()`, with the result JSON in the second card (233-252). Note this page's cards omit `variant="borderless"` (235, 248), unlike the convention stated on the chapter index |
| `#/components/form/steps` | four segments, all running the whole flow on **one `BasicForm` instance**, switching steps with `setProps({ schemas })` (`views/components/form/steps/index.vue:10-16,114-124`): ① gated "next" plus a local summary (790); ② free switching plus drafts (843); ③ clickable step bar with the buttons moved into `#submitBefore` / `#actionAfter` (907); ④ `slot` fields for a table-style multi-select and a read-only summary (966) |
| `#/components/form/validation` | four cards, four schemas: required & format (385), length & numeric range (416), async & cross-field (448), validation timing & result (479) |
| `#/components/form/custom-component` | four cards: the built-in `MarkdownEditor` extension (236), `addComponent('TagPickerField', …)` (251), `ifShow`/`show`/`dynamicDisabled`/`dynamicRules` linkage (270), and a custom `validator` blocking submit (287) |
| `#/components/form-designer` | a third-party designer — see the next section |

::: warning The step form's draft belongs to the demo page, not the component The key `demo:form-steps:draft` is defined in `views/components/form/steps/index.vue:55`, written/read/deleted by that page's own `saveDraft` (498-510), `readStoredDraft` + `restoreDraft` (477-523) and `clearDraft` (525-529). **`BasicForm` has no draft capability at all** and `FormProps` has no related field. The payload is `JSON.stringify({ savedAt, step, values })` and it only lives in this browser. Likewise, "submit" only runs a full-form validation and prints the values — no request is made (`372-377`, `545-550`, `775-780`). :::

::: tip Two hard rules for step forms

1. **Do not put `defaultValue` on step schemas** — every `setProps({ schemas })` re-runs `initFormModel()` and stamps the defaults back over what the user typed; seed the values with `setFieldsValue` before mount instead (`steps/index.vue:62-64`; mechanism at `BasicForm.vue:388-391`, queue at `useForm.ts:67-75`).
2. **A full-form check must re-mount the other steps with `show: false`.** `validate()` without a field list only covers the currently rendered fields: previous steps' `a-form-item`s are unmounted and absent from the form registry, so dirty values pass silently (`steps/index.vue:165-203`). `ifShow: false` really unmounts, i.e. no validation at all (`FormItem.vue:155`). :::

**Which rules on the validation page are home-grown**: the repository ships exactly one rule preset — the `required` shorthand (`helper.ts:183-191`). Everything else is an antd-native rule field handed straight to `a-form-item`: `type: 'email'` / `type: 'url'` / `type: 'number'` (`validation/index.vue:96,114,143`), `min` / `max` (133, 154-157), `pattern` (105, 377), `trigger` (377), `validateTrigger` (356, through `itemProps`). The page writes three validators itself: username duplication (`setTimeout(600ms)` plus the local array `OCCUPIED_NAMES`, **no backend**, 224-241), password strength regex (252-264), and password confirmation plus province/city/district consistency (274-339, through `dynamicRules`).

## The form designer is not `BasicForm`

`#/components/form-designer` is 39 lines and renders a single third-party component: `<fc-designer ref="designerRef" height="100%" :config="designerConfig" />` (`views/components/form-designer/index.vue:37`), provided by `@form-create/antd-designer` and installed globally at the entry point (`apps/web/src/main.ts:11,46,63-64`).

- `designerConfig` is nothing but those 15 switches (14 `show*` flags plus `autoActive`, `form-designer/index.vue:11-27`); nothing in the page consumes the designer's output.
- It depends on `registerVendorAntdComponents(app)` (`main.ts:53`): every `a-*` in this repository goes through each file's own explicit import (`import { Card as ACard } from 'antdv-next'`), which is a **local binding**. The designer's templates were compiled before publication and only call `resolveComponent('a-layout-sider')` at runtime, so local bindings cannot help them — without that global registration the page shows no error yet renders as empty tags (the comment in `plugins/vendor-antd-components.ts:44-58`, `main.ts:48-52`).
- What the designer produces is form-create's own rule JSON (`type` / `field` / `title` / `validate`), **not this repository's `FormSchema` (`component` / `rules`, `Form/types.ts:61-111`)**. There is no converter and no save logic in the page — wiring it to `BasicForm` means writing the mapping yourself.

## Related

- [Component examples](/en/components/)
- [Table](/en/components/table)
- [Mock server (Nitro)](/en/guide/essentials/mock)
- [Internationalization](/en/guide/in-depth/internationalization) — the Form module contains no i18n calls: the auto placeholder templates (`helper.ts:43-59`), the required message (`helper.ts:188`) and the default button captions (`BasicForm.vue:224-239`) are hardcoded Chinese.
