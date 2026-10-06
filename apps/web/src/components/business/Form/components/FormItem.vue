<script setup lang="ts">
import type { RuleObject } from 'antdv-next';

import type { ComputedRef } from 'vue';

import type { FormSchema, Recordable, RenderCallbackParams } from '../types';

import { computed, inject, unref } from 'vue';

import { isFunction } from 'es-toolkit';
import IconifyIcon from '~/components/common/Icon/IconifyIcon.vue';

import { getComponent } from '../componentMap';
import {
  getDynamicDisabled,
  getDynamicRules,
  getShow,
  setComponentProps,
} from '../helper';

interface Props {
  schema: FormSchema;
  formModel: Recordable;
  formActionType: any;
  setFormModel: (key: string, value: any) => void;
}

const props = defineProps<Props>();

type GridContext =
  | null
  | undefined
  | {
      cols?: ComputedRef<number>;
      span?: ComputedRef<number>;
      gutter?: ComputedRef<[number, number] | number>;
    };

const gridConfig = inject<GridContext>('formGridContext', null);

// ★ 所有依赖 schema 的 computed 都加空值兜底
const getShowState = computed(() => {
  if (!props.schema) return { show: false, ifShow: false };
  return getShow(props.schema, unref(props.formModel), props.formActionType);
});

const getDisabled = computed(() => {
  if (!props.schema) return false;
  return getDynamicDisabled(
    props.schema,
    unref(props.formModel),
    props.formActionType,
  );
});

const getComponentPropsValue = computed(() => {
  if (!props.schema) return {};
  return setComponentProps(
    props.schema,
    unref(props.formModel),
    props.formActionType,
  );
});

const getRulesValue = computed((): RuleObject[] | undefined => {
  if (!props.schema) return undefined;
  const rules = getDynamicRules(
    props.schema,
    unref(props.formModel),
    props.formActionType,
  );
  if (!rules) return undefined;
  return rules as RuleObject[];
});

const getComponentInstance = computed(() => {
  if (!props.schema?.component) return null;
  return getComponent(props.schema.component);
});

const getSuffixValue = computed(() => {
  if (!props.schema) return null;
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
  const defaultSpan = unref(gridConfig?.span) ?? 24;
  return {
    span: defaultSpan,
    ...props.schema?.colProps,
  };
});

const mergedItemProps = computed(() => {
  const base = { ...props.schema?.itemProps };
  const cols = unref(gridConfig?.cols);
  if (!cols || cols <= 1) return base;

  const span = props.schema?.colProps?.span ?? unref(gridConfig?.span) ?? 24;
  const isFullRow = span === 24 || props.schema?.fullRowAlign;
  if (!isFullRow) return base;

  const gutterRaw = unref(gridConfig?.gutter);
  const gutterPx = Array.isArray(gutterRaw) ? gutterRaw[0] : (gutterRaw ?? 24);

  const existingStyle: Record<string, any> = {};
  const existingWrapperCol =
    typeof base.wrapperCol === 'object' ? base.wrapperCol : {};
  return {
    ...base,
    style: {
      ...existingStyle,
      class: `${existingStyle.class || ''} form-item-full-row-align`.trim(),
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
  const { helpMessage } = props.schema ?? {};
  if (Array.isArray(helpMessage)) {
    return helpMessage.join('\n');
  }
  return helpMessage;
});

function handleValueChange(value: any) {
  if (!props.schema) return;
  props.setFormModel(props.schema.field, value);
}
const bodyContainer = () => document.body;
</script>

<template>
  <template v-if="schema && getShowState.ifShow">
    <a-col v-show="getShowState.show" v-bind="getColProps">
      <a-form-item
        v-bind="mergedItemProps"
        :name="schema.field"
        :rules="getRulesValue"
      >
        <template #label>
          <span
            class="inline-flex flex-wrap items-center break-all whitespace-normal"
          >
            {{ schema.label }}
            <a-tooltip
              v-if="schema.helpMessage"
              placement="top"
              :get-popup-container="bodyContainer"
              :overlay-style="{ maxWidth: '280px', wordBreak: 'break-word' }"
            >
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
          <slot :name="schema.slot" :model="formModel" :field="schema.field"></slot>
        </template>

        <template v-else-if="getComponentInstance">
          <component
            :is="getComponentInstance"
            v-bind="getComponentPropsValue"
            :disabled="getDisabled"
            :value="formModel[schema.field]"
            @update:value="handleValueChange"
          >
            <template v-if="getSuffixValue" #suffix>
              <span class="ml-2 text-gray-500 dark:text-gray-400">{{
                getSuffixValue
              }}</span>
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
