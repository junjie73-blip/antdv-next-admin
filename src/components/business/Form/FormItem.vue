<script setup lang="ts">
import type { FormSchema, Recordable, RenderCallbackParams } from './types'
import { isFunction } from 'es-toolkit'
import { computed, unref } from 'vue'
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
  transform?: (value: any) => any
  type?: RuleType
  whitespace?: boolean
  trigger?: TriggerType | TriggerType[]
  validateTrigger?: TriggerType | TriggerType[]
  validator?: (rule: any, value: any, callback: (error?: string) => void) => Promise<void | string> | void
}

interface Props {
  schema: FormSchema
  formModel: Recordable
  formActionType: any
  setFormModel: (key: string, value: any) => void
}

const props = defineProps<Props>()

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
    span: 24,
    ...props.schema.colProps,
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
        v-bind="schema.itemProps"
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
