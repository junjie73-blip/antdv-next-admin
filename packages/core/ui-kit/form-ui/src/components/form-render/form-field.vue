<script setup lang="ts">
import type { FormContext } from './context';
import type { FormSchema } from './schema';

import { computed, inject, unref, useId } from 'vue';

import { useField } from '@tanstack/vue-form';

import { getComponent } from '../../config';
import { runRule } from '../../rule-registry';
import { FORM_CONTEXT_KEY } from './context';
import FormLabel from './form-label.vue';
import {
  getDynamicDisabled,
  getDynamicRules,
  getShow,
  setComponentProps,
} from './helper';

defineOptions({ name: 'FormField' });

const props = defineProps<{ schema: FormSchema }>();

/**
 * 标签与控件的关联点：`for` 指向控件的 `id`，字段组件把这个 `id` 落在自己的
 * `data-field-control` 节点上（`<input>` / `role=combobox` 的按钮才是可关联控件）。
 */
const controlId = useId();

const ctx = inject<FormContext>(FORM_CONTEXT_KEY);

const form = ctx?.form;

const field = useField({
  name: props.schema.field,
  form,
  validators: {
    // 首次提交前不跑规则：抽屉/弹窗打开时 `setFieldsValue` 灌初值会把字段标成
    // touched，change 校验一跑就是一屏"该项为必填项"。提交过之后才实时纠正。
    onChangeAsync: async ({ value }: { value: any }) =>
      ctx?.submitAttempted?.value
        ? runCurrentRules(value, 'change')
        : undefined,
    onSubmitAsync: async ({ value }: { value: any }) =>
      runCurrentRules(value, 'submit'),
  },
} as any);

async function runCurrentRules(
  value: any,
  _cause: string,
): Promise<string | undefined> {
  if (!props.schema) return undefined;
  const values = ctx?.getValues() ?? {};
  const rules =
    getDynamicRules(props.schema, values, ctx?.formActionTypeRef.value) ?? [];
  const joinLabel = props.schema.rulesMessageJoinLabel;
  const label = props.schema.label || props.schema.field;
  for (const rule of rules) {
    const error = await runRule(rule, value, { joinLabel, label });
    if (error) return error;
  }
  return undefined;
}

const getShowState = computed(() => {
  if (!props.schema) return { show: false, ifShow: false };
  return getShow(
    props.schema,
    ctx?.getValues() ?? {},
    ctx?.formActionTypeRef.value,
  );
});

const getDisabled = computed(() => {
  if (!props.schema) return false;
  return (
    !!ctx?.getProps.value.disabled ||
    getDynamicDisabled(
      props.schema,
      ctx?.getValues() ?? {},
      ctx?.formActionTypeRef.value,
    )
  );
});

const getComponentPropsValueComputed = computed(() => {
  if (!props.schema) return {};
  return setComponentProps(
    props.schema,
    ctx?.getValues() ?? {},
    ctx?.formActionTypeRef.value,
  );
});

const getRulesValue = computed(() => {
  if (!props.schema) return [];
  return (
    getDynamicRules(
      props.schema,
      ctx?.getValues() ?? {},
      ctx?.formActionTypeRef.value,
    ) ?? []
  );
});

/**
 * 星号的两条来路：`schema.required`（helper 会折成一条 required 规则，同时参与校验）
 * 与 `itemProps.required`（只标记，不改校验，页面用它给自定义 validator 的那类字段补星号）。
 */
const isRequired = computed(
  () =>
    !!props.schema?.itemProps?.required ||
    getRulesValue.value.some((r: any) => !!r.required),
);

const getComponentInstance = computed(() => {
  if (!props.schema?.component) return null;
  return getComponent(props.schema.component);
});

const getSuffixValue = computed(() => {
  if (!props.schema) return null;
  const { suffix } = props.schema;
  if (!suffix) return null;
  const values = ctx?.getValues() ?? {};
  if (typeof suffix === 'function') {
    return suffix({
      schema: props.schema,
      values,
      model: values,
      field: props.schema.field,
    });
  }
  return suffix;
});

const gutterPx = computed(() => {
  const raw = unref(ctx?.grid.gutter);
  return Array.isArray(raw) ? (raw[0] ?? 24) : (raw ?? 24);
});

const spanValue = computed(() => {
  const defaultSpan = unref(ctx?.grid.span) ?? 24;
  return props.schema?.colProps?.span ?? defaultSpan;
});

const rootStyle = computed(() => {
  const span = spanValue.value;
  const style: Record<string, any> = {
    width: `${(span / 24) * 100}%`,
    paddingInline: `${gutterPx.value / 2}px`,
    ...props.schema?.itemProps?.style,
  };
  return style;
});

const isFullRow = computed(() => {
  const cols = unref(ctx?.grid.cols) ?? 1;
  if (cols <= 1) return false;
  return spanValue.value === 24 || !!props.schema?.fullRowAlign;
});

const wrapperStyle = computed(() => {
  const style: Record<string, any> = {};
  if (isFullRow.value) {
    style.maxWidth = `calc(100% - ${gutterPx.value}px)`;
  }
  const itemWrapperCol = props.schema?.itemProps?.wrapperCol;
  if (itemWrapperCol?.style) {
    Object.assign(style, itemWrapperCol.style);
  }
  return style;
});

const labelStyle = computed(() => {
  const labelCol = unref(ctx?.labelCol);
  if (labelCol?.style) return { ...labelCol.style };
  if (typeof labelCol?.span === 'number') {
    return { width: `${(labelCol.span / 24) * 100}%` };
  }
  return { width: '25%' };
});

const labelAlign = computed(() => ctx?.getProps.value.labelAlign ?? 'right');

const colon = computed(() => ctx?.getProps.value.colon ?? false);

const errorMessage = computed(() => {
  const meta = field.state.meta;
  const shown =
    meta.isTouched || meta.isBlurred || !!ctx?.submitAttempted?.value;
  if (!shown) return '';
  const errors = meta.errors ?? [];
  return errors.length > 0 ? String(errors[0]) : '';
});

function handleValueChange(value: any) {
  if (!props.schema) return;
  field.api.setValue(value);
  form?.setFieldMeta?.(props.schema.field, (meta: any) => ({
    ...meta,
    isTouched: true,
  }));
}

function handleBlurMark() {
  if (!props.schema) return;
  form?.setFieldMeta?.(props.schema.field, (meta: any) => ({
    ...meta,
    isTouched: true,
    isBlurred: true,
  }));
}

const displayValue = computed(() => {
  const value = field.state.value;
  if (value === undefined || value === null) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
});
</script>

<template>
  <div
    v-if="getShowState.ifShow"
    v-show="getShowState.show"
    :data-field="schema.field"
    class="form-item shrink-0 box-border"
    :style="rootStyle"
  >
    <!-- 标签与控件之间留横向间隙：只写 gap-y 时两者是贴在一起的，右侧对齐的标签会直接顶到输入框 -->
    <div class="flex flex-wrap items-start gap-x-2 gap-y-1">
      <FormLabel
        v-if="schema.label !== undefined && schema.label !== ''"
        :align="labelAlign"
        :colon="colon"
        :help-message="schema.helpMessage"
        :html-for="getComponentInstance ? controlId : undefined"
        :label="schema.label"
        :required="isRequired"
        :style="labelStyle"
      />
      <div
        class="form-item-control flex min-w-0 flex-1 flex-col gap-1"
        :style="wrapperStyle"
      >
        <template v-if="schema.slot">
          <slot
            :name="schema.slot"
            :model="ctx?.model ?? {}"
            :field="schema.field"
          ></slot>
        </template>

        <template v-else-if="getComponentInstance">
          <div class="flex min-h-9 items-center" @focusout="handleBlurMark">
            <component
              :is="getComponentInstance"
              v-bind="getComponentPropsValueComputed"
              :id="controlId"
              :disabled="getDisabled"
              :value="field.state.value"
              @update:value="handleValueChange"
            >
              <template v-if="getSuffixValue" #suffix>
                <span class="ml-2 text-gray-500 dark:text-gray-400">{{
                  getSuffixValue
                }}</span>
              </template>
            </component>
          </div>
        </template>

        <template v-else>
          <span class="min-h-9 leading-9">{{ displayValue }}</span>
        </template>

        <div
          v-if="errorMessage"
          class="form-item-error text-sm leading-tight text-destructive"
          data-error
        >
          {{ errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>
