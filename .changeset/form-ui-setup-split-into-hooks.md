---
'@antdv/form-ui': patch
---

refactor: `BasicForm` 的 `setup` 从 696 行压到 254 行，逻辑按职责拆进 `form-render/hooks/` 与 `form-render/helpers/`，对外 API 不变

现象（用户归纳）：`form.vue` 的 `setup` 里同时管着 TanStack 实例、props 合并、响应式栅格、行分组与折叠、校验与滚动定位、提交与重置、按钮文案、注入契约与对外 API，读一遍要跳七八处；要求是**梳理分层、可维护性优先，且不影响任何现有调用方**。

- **分层口径**：`hooks/` 放有状态的行为（要 `ref`/`computed`/生命周期/`provide`），`helpers/` 放纯函数（同样输入必得同样输出，可单测）。`form.vue` 只做三件事 —— 声明契约（props/emits）、按依赖顺序装配 hook、排版；文件顶部留了一张依赖图，装配顺序就是它的书写顺序：`schemaRef ─┬─ useFormModel ─┬─ useFormValidate ─┐ ├─ useFormConfig → useFormGrid ┴─ useFormRows ────┼─ useFormButtons └─ useFormSchema ┘ └─ useFormSubmit → useFormExpose`。
- **9 个 hook**：`useFormModel`（TanStack 实例 + 默认值 + `formModel` 那个可写 Proxy + 取值/设值/重置/清除校验）、`useFormConfig`（`props` 与 `setProps` 的合并优先级：运行时 props 输给模板显式绑定的属性，`schemas` 永远取当前实际 schema）、`useFormSchema`（声明式来源 + `updateSchema`/`appendSchemaByField`/`removeSchemaByField` 三个命令式入口）、`useFormGrid`（断点列数、`gutter`、行容器样式、标签列/内容列）、`useFormRows`（行分组、折叠态、动作区占位）、`useFormValidate`（`validate`/`validateFields`/`scrollToField`，失败时按 `scrollToFirstError` 滚到第一个错误字段）、`useFormSubmit`（`attrs.onFinish` > `props.submitFunc` > `emit('submit')` 三档出口，以及重置的快照-回填与 `submitOnReset`）、`useFormButtons`（提交/重置/展开三个按钮文案与图标）、`useFormExpose`（对外 `FormActionType` 的装配处，兼管 `isMounted` 这件事 —— `useForm()` 靠它把"写进已卸载实例"转成待写入队列）。
- **4 个 helper**：`helpers/grid.ts`（24 格总量、断点取列数、`gutter` 单值/数组取水平与垂直分量、行容器样式、标签列/内容列缺省）、`helpers/rows.ts`（按 `colProps.span` 把 schema 切成行、动作区宽度）、`helpers/validate.ts`（错误项与 TanStack fieldMeta 的读法，以及 `throw` 出去的那份 `FormValidateError` 形状）、`helpers/buttons.ts`（三枚按钮的文案缺省）。
- **口径没有改变的几处**：`schemaRef` 是实际参与渲染的那份，命令式增删不回写 `props.schemas`；`watch(sourceSchemas)` 不加 `deep`（原来就不加，加了会在整表重算时抖一次）；`initFormModel` 仍只由"schema 被替换"这一条路径触发，**没有**顺手补 `onMounted` 里再初始化一次；`formModel` Proxy 的 `set` 仍旧转发到 `form.setFieldValue`，插槽里直接写值仍然有效；`validate()` 不带参数时作用范围仍是 schema 里所有字段名。
- **顺手把三处 `any` 收成声明类型**（不影响运行时）：`resolveLabelCol` / `resolveWrapperCol` 的入参与返回改成 `Partial<ColEx>`（`labelWidth` 走 `{ style: { width } }`，否则 `{ span }`，缺省 4 / 18），注入契约 `FormContext.labelCol` / `wrapperCol` 跟着这条类型走，`useFormExpose` 的 `formActionTypeRef` 改成 `Ref<FormActionType | null>`。字段名往 TanStack 的 path 位上塞的那几个 `as any` 保留 —— `TData` 还是 `Recordable` 时路径类型推不出具体键，这层转换是实例泛型决定的，不是偷懒。
- **对外接口零变化**：`FormProps`、`FormActionType`、`FormSchema`、`emits`（`register`/`submit`/`reset`）、插槽（`schema.slot` 指定的字段插槽由 `form.vue` 整组转发给 `FormField`，外加 `submitBefore` / `resetBefore` / `actionAfter`）一个没动；本包 `src/index.ts` 一贯不导出内部件，所以这次也没有新增导出。`apps/web` 里 15 个页面用 `BasicForm`（14 个走 `useForm()`），一行没改；`table-ui` 的搜索表单走的还是 `getFormProps` + `@register`。

验证：（收尾时补全）
