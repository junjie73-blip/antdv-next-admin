<script setup lang="ts">
import type { ComputedRef, Ref } from 'vue';

import type { FormSchema, Recordable } from '../types';

import { computed, inject, unref } from 'vue';

import { IconifyIcon } from '@antdv/icons/icon';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@antdv/shadcn-ui';
import { useField } from '@tanstack/vue-form';

import { getComponent } from '../componentMap';
import {
  getDynamicDisabled,
  getDynamicRules,
  getShow,
  setComponentProps,
} from '../helper';
import { runRule } from '../rules';

interface FormContext {
  form: any;
  getProps: ComputedRef<any>;
  labelCol: ComputedRef<any>;
  wrapperCol: ComputedRef<any>;
  grid: {
    cols?: ComputedRef<number>;
    span?: ComputedRef<number>;
    gutter?: ComputedRef<[number, number] | number>;
  };
  formActionTypeRef: Ref<any>;
  submitAttempted?: Ref<boolean>;
  getValues: () => Recordable;
}

const props = defineProps<{ schema: FormSchema }>();

const ctx = inject<FormContext>('formContext');

const form = ctx?.form;

const field = useField({
  name: props.schema.field,
  form,
  validators: {
    onChangeAsync: async ({ value }: { value: any }) =>
      runCurrentRules(value, 'change'),
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

const isRequired = computed(() =>
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

const labelAlignClass = computed(() => {
  const align = ctx?.getProps.value.labelAlign ?? 'right';
  return align === 'left' ? 'justify-start text-left' : 'justify-end text-right';
});

const colon = computed(() => ctx?.getProps.value.colon ?? false);

const errorMessage = computed(() => {
  const meta = field.state.meta;
  const shown =
    meta.isTouched ||
    meta.isBlurred ||
    !!ctx?.submitAttempted?.value;
  if (!shown) return '';
  const errors = meta.errors ?? [];
  return errors.length ? String(errors[0]) : '';
});

const getHelpMessage = computed(() => {
  const { helpMessage } = props.schema ?? {};
  if (Array.isArray(helpMessage)) return helpMessage.join('\n');
  return helpMessage;
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
    <div class="flex flex-wrap items-start gap-y-1">
      <label
        v-if="schema.label !== undefined && schema.label !== ''"
        class="form-item-label flex min-h-9 shrink-0 flex-wrap items-center gap-1 pt-1 text-sm leading-none whitespace-normal"
        :class="labelAlignClass"
        :style="labelStyle"
      >
        <span v-if="isRequired" class="text-destructive" aria-hidden="true">
          *
        </span>
        <span class="break-all">{{ schema.label }}</span>
        <span v-if="colon">:</span>
        <TooltipProvider v-if="schema.helpMessage">
          <Tooltip>
            <TooltipTrigger as-child>
              <IconifyIcon
                icon="carbon:information"
                class="cursor-help text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              />
            </TooltipTrigger>
            <TooltipContent
              side="top"
              :style="{ maxWidth: '280px', wordBreak: 'break-word' }"
            >
              <span>{{ getHelpMessage }}</span>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </label>
      <div
        class="form-item-control flex min-w-0 flex-1 flex-col gap-1"
        :style="wrapperStyle"
      >
        <template v-if="schema.slot">
          <slot
            :name="schema.slot"
            :model="ctx?.getValues()"
            :field="schema.field"
          ></slot>
        </template>

        <template v-else-if="getComponentInstance">
          <div class="flex min-h-9 items-center" @focusout="handleBlurMark">
            <component
              :is="getComponentInstance"
              v-bind="getComponentPropsValueComputed"
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
