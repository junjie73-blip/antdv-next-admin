<script setup lang="ts">
import type { FormInstance } from 'antdv-next'
import type { FormActionType, FormProps, FormSchema, NamePath, Recordable } from './types'
import { computed, onMounted, provide, reactive, ref, unref, watch } from 'vue'
import IconifyIcon from '@/components/common/Icon/IconifyIcon.vue'
import { cn } from '@/utils/cn'
import FormItem from './FormItem.vue'
import { deepMerge, formatDateFields, handleRangeValue } from './helper'

interface Props extends Partial<FormProps> {}

const props = withDefaults(defineProps<FormProps>(), {
  showActionButtonGroup: true,
  showResetButton: true,
  showSubmitButton: true,
  submitOnReset: true,
  autoSubmitOnEnter: true,
  labelAlign: 'right',
})

const emit = defineEmits<{
  register: [instance: FormActionType]
  submit: [values: Recordable]
  reset: [values: Recordable]
}>()

const formModel = reactive<Recordable>({})
const schemaRef = ref<FormSchema[]>([])
const formRef = ref<FormInstance>()
const propsRef = ref<Partial<FormProps>>({})
const isAdvanced = ref(false)

// 向子组件（FormItem）提供 grid 布局上下文
const formGridContext = computed(() => getProps.value.grid)
provide('formGridContext', formGridContext)

const getProps = computed(() => {
  return deepMerge({ ...props }, { ...unref(propsRef), schemas: unref(schemaRef) })
})

const getAlwaysShowLines = computed(() => {
  return getProps.value.alwaysShowLines || 3
})

// 基础 schemas 过滤 + 高级按钮折叠
const getSchemas = computed(() => {
  const schemas = unref(schemaRef) || []
  const filtered = schemas.filter(schema => schema.component !== 'Divider')

  if (!getProps.value.showAdvancedButton || unref(isAdvanced)) {
    return filtered
  }

  const lineCount = getAlwaysShowLines.value
  let currentLine = 0
  let currentRowSpan = 0
  const result: FormSchema[] = []

  for (const schema of filtered) {
    const span = schema.colProps?.span || 24
    currentRowSpan += span

    if (currentRowSpan > 24) {
      currentLine++
      currentRowSpan = span
    }

    if (currentLine >= lineCount) {
      break
    }

    result.push(schema)
  }

  return result
})

const getGridColSpan = computed(() => {
  const grid = getProps.value.grid
  if (!grid?.cols || grid.cols < 1 || grid.cols > 4)
    return null
  return Math.floor(24 / grid.cols)
})

// 根据 grid 配置自动计算每个字段的 colProps
const getProcessedSchemas = computed(() => {
  const gridSpan = getGridColSpan.value
  const schemas = getSchemas.value

  if (gridSpan === null)
    return schemas

  return schemas.map((schema) => {
    const userSpan = schema.colProps?.span
    return {
      ...schema,
      colProps: {
        span: userSpan ?? gridSpan,
        ...schema.colProps,
      },
    }
  })
})

const getDividerSchemas = computed(() => {
  const schemas = unref(schemaRef) || []
  return schemas.filter(schema => schema.component === 'Divider')
})

const getRowProps = computed(() => {
  const grid = getProps.value.grid
  return {
    gutter: grid?.gutter ?? 24,
    ...getProps.value.baseRowStyle,
  }
})

const getBaseColProps = computed(() => {
  return {
    span: 24,
    ...getProps.value.baseColProps,
  }
})

const getLabelCol = computed(() => {
  const labelWidth = getProps.value.labelWidth
  if (labelWidth) {
    return { style: { width: `${labelWidth}px` } }
  }
  return getProps.value.labelCol || { span: 6 }
})

const getWrapperCol = computed(() => {
  return getProps.value.wrapperCol || { span: 18 }
})

const getActionColOptions = computed(() => {
  return {
    span: 24,
    ...getProps.value.actionColOptions,
  }
})

const getSubmitButtonOptions = computed(() => {
  return {
    text: '查询',
    preIcon: 'carbon:search',
    ...getProps.value.submitButtonOptions,
  }
})

const getResetButtonOptions = computed(() => {
  return {
    text: '重置',
    preIcon: 'carbon:restart',
    ...getProps.value.resetButtonOptions,
  }
})

const getAdvancedButtonOptions = computed(() => {
  return {
    text: unref(isAdvanced) ? '收起' : '展开',
    icon: unref(isAdvanced) ? 'carbon:chevron-up' : 'carbon:chevron-down',
  }
})

const needCollapse = computed(() => {
  const schemas = getProcessedSchemas.value
  let totalSpan = 0
  for (const schema of schemas) {
    totalSpan += schema.colProps?.span || 24
    if (totalSpan > 24)
      return true
  }
  return false
})

const showExpandButton = computed(() => {
  return getProps.value.showAdvancedButton && unref(needCollapse)
})

function setFormModel(key: string, value: any) {
  formModel[key] = value
}

function initFormModel() {
  const schemas = unref(schemaRef) || []
  schemas.forEach((schema) => {
    if (schema.field && schema.defaultValue !== undefined) {
      formModel[schema.field] = schema.defaultValue
    }
  })
}

async function handleSubmit() {
  try {
    const values = await validate()
    if (values) {
      let processedValues = { ...values }

      // 格式化日期字段
      const schemas = getProps.value.schemas || []
      processedValues = formatDateFields(processedValues, schemas)

      // 处理 fieldMapToTime 转换
      const fieldMapToTime = getProps.value.fieldMapToTime
      if (fieldMapToTime) {
        processedValues = handleRangeValue(processedValues, fieldMapToTime)
      }

      if (getProps.value.submitFunc) {
        await getProps.value.submitFunc()
      }
      else {
        emit('submit', processedValues)
      }
    }
  }
  catch (error) {
    console.error('Form submit error:', error)
  }
}

async function handleReset() {
  const values = { ...formModel }
  await resetFields()
  if (getProps.value.submitOnReset) {
    await handleSubmit()
  }
  else {
    emit('reset', values)
  }
}

function toggleAdvanced() {
  isAdvanced.value = !unref(isAdvanced)
}

async function validate(): Promise<Recordable> {
  let values = await formRef.value?.validate?.() || {}

  // 格式化日期字段
  const schemas = getProps.value.schemas || []
  values = formatDateFields(values, schemas)

  // 处理 fieldMapToTime 转换
  const fieldMapToTime = getProps.value.fieldMapToTime
  return fieldMapToTime ? handleRangeValue(values, fieldMapToTime) : values
}

async function validateFields(nameList?: NamePath[]): Promise<Recordable> {
  let values = await formRef.value?.validateFields?.(nameList as any) || {}

  // 格式化日期字段
  const schemas = getProps.value.schemas || []
  values = formatDateFields(values, schemas)

  // 处理 fieldMapToTime 转换
  const fieldMapToTime = getProps.value.fieldMapToTime
  return fieldMapToTime ? handleRangeValue(values, fieldMapToTime) : values
}

async function resetFields() {
  await formRef.value?.resetFields?.()
  Object.keys(formModel).forEach((key) => {
    const schema = unref(schemaRef)?.find(s => s.field === key)
    if (schema?.defaultValue !== undefined) {
      formModel[key] = schema.defaultValue
    }
    else {
      formModel[key] = undefined
    }
  })
}

async function setFieldsValue<T>(values: T) {
  Object.keys(values as any).forEach((key) => {
    formModel[key] = (values as any)[key]
  })
}

function getFieldsValue(): Recordable {
  return { ...formModel }
}

async function clearValidate(name?: string | string[]) {
  if (name) {
    const names = Array.isArray(name) ? name : [name]
    await formRef.value?.clearValidate?.(names as any)
  }
  else {
    await formRef.value?.clearValidate?.()
  }
}

async function scrollToField(name: NamePath, options?: ScrollIntoViewOptions) {
  await formRef.value?.scrollToField?.(name as any, options)
}

async function updateSchema(data: Partial<FormSchema> | Partial<FormSchema>[]) {
  const updateData = Array.isArray(data) ? data : [data]
  updateData.forEach((item) => {
    if (item.field) {
      const index = schemaRef.value.findIndex(s => s.field === item.field)
      if (index !== -1 && schemaRef.value[index]) {
        schemaRef.value[index] = deepMerge(schemaRef.value[index], item) as FormSchema
      }
    }
  })
}

async function removeSchemaByField(field: string | string[]) {
  const fields = Array.isArray(field) ? field : [field]
  schemaRef.value = schemaRef.value.filter(s => !fields.includes(s.field))
}

async function appendSchemaByField(schema: FormSchema, prefixField?: string, first?: boolean) {
  if (prefixField) {
    const index = schemaRef.value.findIndex(s => s.field === prefixField)
    if (index !== -1) {
      if (first) {
        schemaRef.value.splice(index, 0, schema)
      }
      else {
        schemaRef.value.splice(index + 1, 0, schema)
      }
    }
  }
  else {
    if (first) {
      schemaRef.value.unshift(schema)
    }
    else {
      schemaRef.value.push(schema)
    }
  }
}

async function setProps(newProps: Partial<FormProps>) {
  propsRef.value = deepMerge(unref(propsRef) || {}, newProps)
  if (newProps.schemas) {
    schemaRef.value = newProps.schemas
    initFormModel()
  }
}

function getForm(): FormInstance | null {
  return formRef.value || null
}

const formActionType: FormActionType = {
  getFieldsValue,
  setFieldsValue,
  resetFields,
  validate,
  validateFields,
  submit: handleSubmit,
  clearValidate,
  scrollToField,
  updateSchema,
  removeSchemaByField,
  appendSchemaByField,
  setProps,
  getForm,
}

watch(
  () => props.schemas,
  (schemas) => {
    if (schemas) {
      schemaRef.value = schemas
      initFormModel()
    }
  },
  { immediate: true, deep: true },
)

onMounted(() => {
  emit('register', formActionType)
})

defineExpose(formActionType)
</script>

<template>
  <a-form
    ref="formRef"
    :model="formModel"
    :label-align="getProps.labelAlign || 'right'"
    :label-col="getLabelCol"
    :wrapper-col="getWrapperCol"
    :disabled="getProps.disabled"
    :size="getProps.size as any"
    @finish="handleSubmit"
  >
    <a-row v-bind="getRowProps">
      <template
        v-for="(schema, idx) in getProcessedSchemas"
        :key="schema.field"
      >
        <FormItem
          v-if="schema.component !== 'Divider'"
          :schema="schema"
          :form-model="formModel"
          :form-action-type="formActionType"
          :set-form-model="setFormModel"
        >
          <template
            v-for="(_, slotName) in $slots"
            :key="slotName"
            #[slotName]="slotProps"
          >
            <slot
              :name="slotName"
              v-bind="slotProps"
            />
          </template>
        </FormItem>
      </template>

      <template
        v-for="(schema, index) in getDividerSchemas"
        :key="`divider-${index}`"
      >
        <a-col :span="24">
          <a-divider v-bind="schema.componentProps">
            {{ schema.label }}
          </a-divider>
        </a-col>
      </template>

      <a-col
        v-if="getProps.showActionButtonGroup"
        :span="unref(needCollapse) ? 24 : undefined"
        :class="cn(
          'flex justify-end',
          !unref(needCollapse) && 'flex-1',
        )"
      >
        <div class="flex gap-2 flex-wrap">
          <slot name="submitBefore" />
          <a-button
            v-if="getProps.showSubmitButton"
            type="primary"
            html-type="submit"
          >
            <template
              v-if="getSubmitButtonOptions.preIcon"
              #icon
            >
              <IconifyIcon :icon="getSubmitButtonOptions.preIcon" />
            </template>
            {{ getSubmitButtonOptions.text }}
          </a-button>
          <slot name="resetBefore" />
          <a-button
            v-if="getProps.showResetButton"
            @click="handleReset"
          >
            <template
              v-if="getResetButtonOptions.preIcon"
              #icon
            >
              <IconifyIcon :icon="getResetButtonOptions.preIcon" />
            </template>
            {{ getResetButtonOptions.text }}
          </a-button>
          <a-button
            v-if="showExpandButton"
            type="link"
            @click="toggleAdvanced"
          >
            <IconifyIcon
              :icon="getAdvancedButtonOptions.icon"
              class="mr-1"
            />
            {{ getAdvancedButtonOptions.text }}
          </a-button>
          <slot name="actionAfter" />
        </div>
      </a-col>
    </a-row>
  </a-form>
</template>
