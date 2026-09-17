<script setup lang="ts">

import { isFunction } from "es-toolkit";
import { computed, inject, unref } from "vue";

import { getComponent } from "../componentMap";
import { getDynamicDisabled, getDynamicRules, getShow, setComponentProps } from "../helper";

import type { RuleObject } from "antdv-next";

import type { FormSchema, Recordable, RenderCallbackParams } from "../types";



import IconifyIcon from "@/components/common/Icon/IconifyIcon.vue";

type GridContext = { cols?: number; gutter?: number | [number, number] } | undefined | null;
const props = defineProps<Props>();

const gridConfig = inject<GridContext>("formGridContext", null);

interface Props {
  schema: FormSchema;
  formModel: Recordable;
  formActionType: any;
  setFormModel: (key: string, value: any) => void;
}

const getShowState = computed(() => {
  return getShow(props.schema, unref(props.formModel), props.formActionType);
});

const getDisabled = computed(() => {
  return getDynamicDisabled(props.schema, unref(props.formModel), props.formActionType);
});

const getComponentPropsValue = computed(() => {
  return setComponentProps(props.schema, unref(props.formModel), props.formActionType);
});

const getRulesValue = computed((): RuleObject[] | undefined => {
  const rules = getDynamicRules(props.schema, unref(props.formModel), props.formActionType);
  if (!rules) return undefined;
  return rules as RuleObject[];
});

const getComponentInstance = computed(() => {
  const { component } = props.schema;
  if (!component) return null;
  return getComponent(component);
});

const getSuffixValue = computed(() => {
  const { suffix } = props.schema;
  if (!suffix) return null;

  const values = unref(props.formModel) || {};
  const params: RenderCallbackParams = {
    schema: props.schema,
    values,
    model: props.formModel,
    field: props.schema.field,
  };

  if (isFunction(suffix)) {
    return suffix(params);
  }

  return suffix;
});

const getColProps = computed(() => {
  return {
    span: 6,
    ...props.schema.colProps,
  };
});

const mergedItemProps = computed(() => {
  const base = { ...props.schema.itemProps };
  const cols = gridConfig?.cols;
  if (!cols || cols <= 1) return base;

  const span = props.schema.colProps?.span ?? 24;
  const isFullRow = span === 24 || props.schema.fullRowAlign;
  if (!isFullRow) return base;

  const gutterPx = Array.isArray(gridConfig?.gutter)
    ? gridConfig.gutter[0]
    : (gridConfig.gutter ?? 24);

  const existingStyle: Record<string, any> = {};
  const existingWrapperCol = typeof base.wrapperCol === "object" ? base.wrapperCol : {};
  return {
    ...base,
    style: {
      ...existingStyle,
      class: `${existingStyle.class || ""} form-item-full-row-align`.trim(),
    },
    wrapperCol: {
      ...existingWrapperCol,
      style: {
        maxWidth: `calc(100% - ${gutterPx}px)`,
        ...(existingWrapperCol as any)?.style,
      },
    },
  };
});

const getHelpMessage = computed(() => {
  const { helpMessage } = props.schema;
  if (Array.isArray(helpMessage)) {
    return helpMessage.join("\n");
  }
  return helpMessage;
});

function handleValueChange(value: any) {
  props.setFormModel(props.schema.field, value);
}
</script>

<template>
  <template v-if="getShowState.ifShow">
    <a-col v-show="getShowState.show"
v-bind="getColProps">
      <a-form-item v-bind="mergedItemProps"
:name="schema.field"
:rules="getRulesValue">
        <template #label>
          <span class="inline-flex items-center flex-wrap break-all whitespace-normal">
            {{ schema.label }}
            <a-tooltip v-if="schema.helpMessage"
placement="top">
              <template #title>
                <span>{{ getHelpMessage }}</span>
              </template>
              <IconifyIcon
                icon="carbon:information"
                class="ml-1 cursor-help text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              />
            </a-tooltip>
          </span>
        </template>
        <template v-if="schema.slot">
          <slot :name="schema.slot"
:model="formModel"
:field="schema.field" />
        </template>

        <template v-else-if="getComponentInstance">
          <component
            :is="getComponentInstance"
            v-bind="getComponentPropsValue"
            :disabled="getDisabled"
            :value="formModel[schema.field]"
            @update:value="handleValueChange"
          >
            <template v-if="getSuffixValue"
#suffix>
              <span class="ml-2 text-gray-500 dark:text-gray-400">{{ getSuffixValue }}</span>
            </template>
          </component>
        </template>

        <template v-else>
          <span>{{ formModel[schema.field] }}</span>
        </template>
      </a-form-item>
    </a-col>
  </template>
</template>
