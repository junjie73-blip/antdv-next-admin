<script setup lang="ts">
import type { FormActionType, FormProps } from '../../types';
import type { FormContext } from './context';
import type { FormSchema, Recordable } from './schema';

import { provide, ref, useAttrs } from 'vue';

import { Separator } from '@antdv/shadcn-ui';

import FormActions from '../form-actions.vue';
import { FORM_CONTEXT_KEY } from './context';
import FormField from './form-field.vue';
import { useFormButtons } from './hooks/useFormButtons';
import { useFormConfig } from './hooks/useFormConfig';
import { useFormExpose } from './hooks/useFormExpose';
import { useFormGrid } from './hooks/useFormGrid';
import { useFormModel } from './hooks/useFormModel';
import { useFormRows } from './hooks/useFormRows';
import { useFormSchema } from './hooks/useFormSchema';
import { useFormSubmit } from './hooks/useFormSubmit';
import { useFormValidate } from './hooks/useFormValidate';

defineOptions({
  name: 'BasicForm',
});

const props = withDefaults(defineProps<FormProps>(), {
  showActionButtonGroup: true,
  showResetButton: true,
  showSubmitButton: true,
  submitOnReset: true,
  autoSubmitOnEnter: true,
  labelAlign: 'right',
  colon: false,
  scrollToFirstError: true,
});

const emit = defineEmits<{
  register: [instance: FormActionType];
  reset: [values: Recordable];
  submit: [values: Recordable];
}>();

/**
 * 本文件只做三件事：**声明契约**（props / emits）、**装配 hook**、**排版**。
 * 具体逻辑都在同级的 `hooks/`（有状态的行为）与 `helpers/`（纯函数）里，
 * 每个 hook 只吃它需要的上游产物，依赖顺序就是下面这段的书写顺序：
 *
 *   schemaRef ─┬─ useFormModel ──────────────┬─ useFormValidate ─┐
 *              ├─ useFormConfig → useFormGrid ┴─ useFormRows ────┼─ useFormButtons
 *              └─ useFormSchema                                  ┴─ useFormSubmit → useFormExpose
 */

// ============ 组件自身状态（跨 hook 共享的三份） ============
/** 实际参与渲染的 schema，命令式增删改都落在这里，不回写 `props.schemas` */
const schemaRef = ref<FormSchema[]>([]);
/** 表单根节点：`scrollToField` 从它往下找字段 */
const rootRef = ref<HTMLFormElement>();
/**
 * 对外实例的引用。
 *
 * 它在装配 `formActionType` 之前就要存在，因为 `provide` 要把它注给字段；
 * 真正的赋值发生在文件末尾 `useFormExpose` 里（和原实现同一顺序：先 provide 再填）。
 */
const formActionTypeRef = ref<FormActionType | null>(null);

const attrs = useAttrs();

// ============ 值：TanStack 实例 + 默认值 + 插槽代理 ============
const {
  allFieldNames,
  clearValidate,
  collectValues,
  form,
  formModel,
  getFieldsValue,
  getValues,
  initFormModel,
  resetFields,
  setFieldsValue,
  submitAttempted,
} = useFormModel({ schemaRef });

// ============ 配置：props 与 setProps 的合并 ============
const { getProps, setProps } = useFormConfig({
  onSchemasReplaced: initFormModel,
  props,
  schemaRef,
});

// ============ schema 的声明式来源与命令式操作 ============
const { appendSchemaByField, removeSchemaByField, updateSchema } =
  useFormSchema({
    onSchemasChanged: initFormModel,
    schemaRef,
    sourceSchemas: () => props.schemas,
  });

// ============ 排版：列数、间距、标签列 ============
const {
  effectiveCols,
  gridColSpan,
  gutter,
  gutterPx,
  labelCol,
  rowStyle,
  wrapperCol,
} = useFormGrid({ getProps });

// ============ 行分组与折叠 ============
const {
  actionsSpan,
  isAdvanced,
  isDividerRow,
  needCollapse,
  rowsWithActions,
  toggleAdvanced,
} = useFormRows({ getProps, gridColSpan, schemaRef });

// ============ 校验与滚动定位 ============
const { scrollToField, validate, validateFields } = useFormValidate({
  collectValues,
  form,
  getAllFieldNames: allFieldNames,
  getProps,
  getRoot: () => rootRef.value,
  schemaRef,
  submitAttempted,
});

// ============ 提交与重置 ============
const { handleReset, handleSubmit } = useFormSubmit({
  attrs,
  emitReset: (values) => emit('reset', values),
  emitSubmit: (values) => emit('submit', values),
  getFieldsValue,
  getProps,
  resetFields,
  validate,
});

// ============ 按钮配置 ============
const { advancedButtonOptions, resetButtonOptions, submitButtonOptions } =
  useFormButtons({ getProps, isAdvanced });

// ============ 注入给字段的隐式契约 ============
provide<FormContext>(FORM_CONTEXT_KEY, {
  form,
  getProps,
  labelCol,
  wrapperCol,
  grid: {
    cols: effectiveCols,
    span: gridColSpan,
    gutter,
  },
  formActionTypeRef,
  submitAttempted,
  getValues,
  model: formModel,
});

// ============ 对外 API ============
const { formActionType } = useFormExpose({
  appendSchemaByField,
  clearValidate,
  form,
  formActionTypeRef,
  getFieldsValue,
  onRegister: (instance) => emit('register', instance),
  removeSchemaByField,
  resetFields,
  scrollToField,
  setFieldsValue,
  setProps,
  submit: handleSubmit,
  updateSchema,
  validate,
  validateFields,
});

defineExpose(formActionType);
</script>

<template>
  <form ref="rootRef" @submit.prevent="handleSubmit">
    <div
      v-for="(row, rowIndex) in rowsWithActions"
      :key="`row-${rowIndex}`"
      class="form-row"
      :style="rowStyle"
    >
      <template v-if="isDividerRow(row)">
        <div class="w-full shrink-0 box-border" :style="rowStyle">
          <div class="flex min-h-9 items-center gap-2">
            <Separator class="flex-1" />
            <span class="text-sm text-muted-foreground">{{
              row.schemas[0]?.label
            }}</span>
            <Separator class="flex-1" />
          </div>
        </div>
      </template>

      <template v-else>
        <FormField
          v-for="schema in row.schemas"
          :key="schema.field"
          :schema="schema"
        >
          <template
            v-for="(_, slotName) in $slots"
            :key="slotName"
            #[slotName]="slotProps"
          >
            <slot :name="slotName" v-bind="slotProps"></slot>
          </template>
        </FormField>
      </template>

      <!-- 操作按钮：挂在最后一个可见行里，占该行的剩余栅格 -->
      <FormActions
        v-if="
          getProps.showActionButtonGroup &&
          rowIndex === rowsWithActions.length - 1
        "
        :action-col-style="getProps.actionColOptions?.style"
        :advanced-options="advancedButtonOptions"
        :collapse="needCollapse"
        :disabled="getProps.disabled"
        :gutter-px="gutterPx"
        :reset-options="resetButtonOptions"
        :show-reset="getProps.showResetButton"
        :show-submit="getProps.showSubmitButton"
        :span="actionsSpan"
        :submit-options="submitButtonOptions"
        @reset="handleReset"
        @toggle-advanced="toggleAdvanced"
      >
        <template #submitBefore>
          <slot name="submitBefore"></slot>
        </template>
        <template #resetBefore>
          <slot name="resetBefore"></slot>
        </template>
        <template #actionAfter>
          <slot name="actionAfter"></slot>
        </template>
      </FormActions>
    </div>
  </form>
</template>
