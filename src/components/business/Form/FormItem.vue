<script setup lang="ts">
import type { FormSchema, Recordable, RenderCallbackParams } from './types'
import { isFunction } from 'es-toolkit'
import { computed, inject, unref } from 'vue'
import IconifyIcon from '@/components/common/Icon/IconifyIcon.vue'
import { getComponent } from './componentMap'
import { getDynamicDisabled, getDynamicRules, getShow, setComponentProps } from './helper'

type RuleType = 'string' | 'number' | 'boolean' | 'method' | 'regexp' | 'integer' | 'float' | 'object' | 'enum' | 'date' | 'url' | 'hex' | 'email' | 'tel'
type TriggerType = 'change' | 'blur' | 'focus'

interface FormItemRule {
  warningOnly?: boolean
  enum?: any[]
  len?: number
  max?: number
  message?: string
  min?: number
  pattern?: RegExp
  required?: boolean
  transform?: (value: any) => (error?: string) => Promise<void> | string | void
  type?: RuleType
  whitespace?: boolean
  trigger?: TriggerType | TriggerType[]
  validateTrigger?: TriggerType | TriggerType[]
  validator?: (rule: any, value: any, callback: (error?: string) => void) => Promise<void | string> | void
}

// 注入父级 grid 布局上下文
type GridContext = { cols?: number, gutter?: number | [number, number] } | undefined | null
const props = defineProps<Props>()

const gridConfig = inject<GridContext>('formGridContext', null)

interface Props {
  schema: FormSchema
  formModel: Recordable
  formActionType: any
  setFormModel: (key: string, value: any) => void
}

const getShowState = computed(() => {
  return getShow(props.schema, unref(props.formModel), props.formActionType)
})

const getDisabled = computed(() => {
  return getDynamicDisabled(props.schema, unref(props.formModel), props.formActionType)
})

const getComponentPropsValue = computed(() => {
  return setComponentProps(props.schema, unref(props.formModel), props.formActionType)
})

const getRulesValue = computed((): FormItemRule[] | undefined => {
  const rules = getDynamicRules(props.schema, unref(props.formModel), props.formActionType)
  if (!rules)
    return undefined
  return rules as FormItemRule[]
})

const getComponentInstance = computed(() => {
  const { component } = props.schema
  if (!component)
    return null
  return getComponent(component)
})

const getSuffixValue = computed(() => {
  const { suffix } = props.schema
  if (!suffix)
    return null

  const values = unref(props.formModel) || {}
  const params: RenderCallbackParams = {
    schema: props.schema,
    values,
    model: props.formModel,
    field: props.schema.field,
  }

  if (isFunction(suffix)) {
    return suffix(params)
  }

  return suffix
})

const getColProps = computed(() => {
  return {
    span: 6,
    ...props.schema.colProps,
  }
})

// 全行对齐：当字段独占一行(span=24)且处于多列布局时，限制输入框宽度对齐多列总宽度
const mergedItemProps = computed(() => {
  const base = { ...props.schema.itemProps }
  const cols = gridConfig?.value?.cols
  if (!cols || cols <= 1)
    return base

  const span = props.schema.colProps?.span ?? 24
  const isFullRow = span === 24 || props.schema.fullRowAlign
  if (!isFullRow)
    return base

  // N 列布局中，span=24 字段的 wrapper 比 N 个小列 wrapper 总和更宽（label 占比差异）
  // 通过约束 wrapperCol 的 max-width 实现视觉对齐
  const gutterPx = Array.isArray(gridConfig.value.gutter)
    ? gridConfig.value.gutter[0]
    : (gridConfig.value.gutter ?? 24)

  const existingStyle = typeof base.style === 'object' ? base.style : {}
  const existingWrapperCol = typeof base.wrapperCol === 'object' ? base.wrapperCol : {}
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
        ...(existingWrapperCol as any)?.style || {},
      },
    },
  }
})

const getHelpMessage = computed(() => {
  const { helpMessage } = props.schema
  if (Array.isArray(helpMessage)) {
    return helpMessage.join('\n')
  }
  return helpMessage
})

function handleValueChange(value: any) {
  props.setFormModel(props.schema.field, value)
}
</script>

<template>
  <template v-if="getShowState.ifShow">
    <a-col
      v-show="getShowState.show"
      v-bind="getColProps"
    >
      <a-form-item
        :name="schema.field"
        :rules="getRulesValue as any"
        v-bind="mergedItemProps"
      >
        <template #label>
          <span class="form-item-label">
            {{ schema.label }}
            <a-tooltip
              v-if="schema.helpMessage"
              placement="top"
            >
              <template #title>
                <span>{{ getHelpMessage }}</span>
              </template>
              <IconifyIcon
                icon="carbon:information"
                class="help-icon"
              />
            </a-tooltip>
          </span>
        </template>
        <template v-if="schema.slot">
          <slot
            :name="schema.slot"
            :model="formModel"
            :field="schema.field"
          />
        </template>

        <template v-else-if="getComponentInstance">
          <component
            :is="getComponentInstance"
            v-bind="getComponentPropsValue"
            :disabled="getDisabled"
            :value="formModel[schema.field]"
            @update:value="handleValueChange"
          >
            <template
              v-if="getSuffixValue"
              #suffix
            >
              <span class="ml-2 text-gray-500">{{ getSuffixValue }}</span>
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

<style scoped>
.form-item-label {
  display: inline-flex;
  align-items: center;
  flex-wrap: wrap;
  word-break: break-all;
  white-space: normal;
}

.help-icon {
  margin-left: 4px;
  color: rgba(0, 0, 0, 0.45);
  cursor: help;
  font-size: 14px;
}

.help-icon:hover {
  color: rgba(0, 0, 0, 0.65);
}
</style>
