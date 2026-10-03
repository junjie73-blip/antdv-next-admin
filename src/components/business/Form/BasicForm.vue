<script setup lang="ts">
import type { FormInstance } from 'antdv-next'

import { breakpointsTailwind, useBreakpoints } from '@vueuse/core'
import { computed, onMounted, provide, reactive, ref, unref, useAttrs, watch } from 'vue'

import IconifyIcon from '~/components/common/Icon/IconifyIcon.vue'
import { cn } from '~/utils/cn'

import type { FormActionType, FormProps, FormSchema, NamePath, Recordable } from './types'

import FormItem from './components/FormItem.vue'
import { deepMerge, formatDateFields, handleRangeValue } from './helper'

defineOptions({
  name: 'BasicForm',
})

const props = withDefaults(defineProps<FormProps>(), {
  showActionButtonGroup: true,
  showResetButton: true,
  showSubmitButton: true,
  submitOnReset: true,
  autoSubmitOnEnter: true,
  labelAlign: 'right',
  colon: false,
  scrollToFirstError: true,
})

const emit = defineEmits<{
  register: [instance: FormActionType]
  submit: [values: Recordable]
  reset: [values: Recordable]
}>()

const attrs = useAttrs()

// ============================================================
// 响应式断点（Tailwind 约定）
//   < 640px  → 1 列
//   < 768px  → 2 列
//   < 1280px → 3 列
//   ≥ 1280px → 4 列
// 若外部显式传 grid.cols，则优先用外部配置
// ============================================================
const breakpoints = useBreakpoints(breakpointsTailwind)

const responsiveCols = computed(() => {
  if (breakpoints.smaller('sm').value) return 1
  if (breakpoints.smaller('md').value) return 2
  if (breakpoints.smaller('xl').value) return 3
  return 4
})

// ============ 表单状态 ============
const formModel = reactive<Recordable>({})
const schemaRef = ref<FormSchema[]>([])
const formRef = ref<FormInstance>()
const propsRef = ref<Partial<FormProps>>({})
const isAdvanced = ref(false)

// ============ 合并 props（schemas 不参与合并） ============
const getProps = computed(() => {
  const merged = deepMerge({ ...props }, { ...unref(propsRef) }) as FormProps
  // schemas 永远以 schemaRef 为准，绕开任何合并逻辑
  merged.schemas = unref(schemaRef)
  return merged
})

// ============ 透传 a-form 原生属性 ============
const aFormAttrs = computed(() => {
  const { class: _class, style: _style, ...rest } = attrs
  return rest
})

// ============ 实际生效的列数 ============
const effectiveCols = computed(() => {
  const configured = getProps.value.grid?.cols
  if (configured != null && configured >= 1 && configured <= 4) return configured
  return responsiveCols.value
})

// ============ 每个字段的默认 span ============
const gridColSpan = computed(() => Math.floor(24 / effectiveCols.value))

// ============ 把布局信息 provide 给 FormItem ============
provide('formGridContext', {
  cols: effectiveCols,
  span: gridColSpan,
  gutter: computed(() => getProps.value.grid?.gutter ?? 24),
})

// ============ 折叠行数 ============
const alwaysShowLines = computed(() => getProps.value.alwaysShowLines ?? 3)

// ============ 核心：按行分组 ============
const allRows = computed<FormSchema[][]>(() => {
  const schemas = unref(schemaRef) || []
  const defaultSpan = gridColSpan.value
  const rows: FormSchema[][] = []
  let currentRow: FormSchema[] = []
  let currentSpan = 0

  for (const schema of schemas) {
    // ★ 跳过空值元素
    if (!schema) continue
    if (!schema.field && schema.component !== 'Divider') continue

    // Divider 独占一行
    if (schema.component === 'Divider') {
      if (currentRow.length) {
        rows.push(currentRow)
        currentRow = []
        currentSpan = 0
      }
      rows.push([schema])
      continue
    }

    const span = (schema.colProps?.span ?? defaultSpan) as number
    if (currentSpan + span > 24) {
      if (currentRow.length) rows.push(currentRow)
      currentRow = [schema]
      currentSpan = span
    } else {
      currentRow.push(schema)
      currentSpan += span
    }
  }
  if (currentRow.length) rows.push(currentRow)
  return rows
})

// ============ 是否需要折叠 ============
const needCollapse = computed(() => {
  return !!getProps.value.showAdvancedButton && allRows.value.length > alwaysShowLines.value
})

// ============ 当前显示的 schemas（含 Divider） ============
const displaySchemas = computed<FormSchema[]>(() => {
  const rows = allRows.value
  let visibleRows = rows
  if (needCollapse.value && !unref(isAdvanced)) {
    visibleRows = rows.slice(0, alwaysShowLines.value)
  }

  // ★ flat 后再过滤一遍空值
  const flat = visibleRows.flat().filter((s): s is FormSchema => !!s)
  const defaultSpan = gridColSpan.value

  return flat.map((schema) => {
    if (schema.component === 'Divider') return schema
    return {
      ...schema,
      colProps: {
        span: defaultSpan,
        ...schema.colProps,
      },
    }
  })
})

const displayFields = computed(() =>
  displaySchemas.value.filter((s): s is FormSchema => !!s && s.component !== 'Divider'),
)

const displayDividers = computed(() =>
  displaySchemas.value.filter((s): s is FormSchema => !!s && s.component === 'Divider'),
)

// ============ 布局 ============
const getRowProps = computed(() => {
  const grid = getProps.value.grid
  return {
    gutter: grid?.gutter ?? 24,
    ...getProps.value.baseRowStyle,
  }
})

const getLabelCol = computed(() => {
  const labelWidth = getProps.value.labelWidth
  if (labelWidth) {
    return { style: { width: `${labelWidth}px` } }
  }
  return getProps.value.labelCol || { span: 4 }
})

const getWrapperCol = computed(() => {
  const gridCols = effectiveCols.value
  if (gridCols <= 1) {
    if (getProps.value.labelWidth) {
      return { style: { flex: 1, maxWidth: '100%' } }
    }
    return { span: 24, offset: 0 }
  }
  return getProps.value.wrapperCol || { span: 18 }
})

// ============ 按钮配置 ============
const getSubmitButtonOptions = computed(() => ({
  text: '查询',
  preIcon: 'carbon:search',
  ...getProps.value.submitButtonOptions,
}))

const getResetButtonOptions = computed(() => ({
  text: '重置',
  preIcon: 'carbon:restart',
  ...getProps.value.resetButtonOptions,
}))

const getAdvancedButtonOptions = computed(() => ({
  text: unref(isAdvanced) ? '收起' : '展开',
  icon: unref(isAdvanced) ? 'carbon:chevron-up' : 'carbon:chevron-down',
}))

// ============ 表单模型操作 ============
function setFormModel(key: string, value: any) {
  formModel[key] = value
}

function initFormModel() {
  const schemas = unref(schemaRef) || []
  schemas.forEach((schema) => {
    if (!schema) return
    if (schema.field && schema.defaultValue !== undefined) {
      formModel[schema.field] = schema.defaultValue
    }
  })
}

// ============ 表单验证 ============
async function validate(nameList?: NamePath[]): Promise<Recordable> {
  let values = (await formRef.value?.validate?.(nameList as any)) || {}
  const schemas = getProps.value.schemas || []
  values = formatDateFields(values, schemas)
  const fieldMapToTime = getProps.value.fieldMapToTime
  return fieldMapToTime ? handleRangeValue(values, fieldMapToTime) : values
}

async function validateFields(nameList?: NamePath[]): Promise<Recordable> {
  let values = (await formRef.value?.validateFields?.(nameList as any)) || {}
  const schemas = getProps.value.schemas || []
  values = formatDateFields(values, schemas)
  const fieldMapToTime = getProps.value.fieldMapToTime
  return fieldMapToTime ? handleRangeValue(values, fieldMapToTime) : values
}

// ============ 提交 ============
async function handleSubmit() {
  try {
    const values = await validate()
    if (values) {
      let processed = { ...values }
      const schemas = getProps.value.schemas || []
      processed = formatDateFields(processed, schemas)

      if (aFormAttrs.value.onFinish) {
        aFormAttrs.value.onFinish?.(processed)
      } else if (getProps.value.submitFunc) {
        await getProps.value.submitFunc()
      } else {
        emit('submit', processed)
      }
    }
  } catch (error) {
    console.error('Form submit error:', error)
  }
}

// ============ 重置 ============
async function handleReset() {
  const values = { ...formModel }
  await resetFields()
  if (getProps.value.submitOnReset) {
    await handleSubmit()
  } else {
    emit('reset', values)
  }
}

// ============ 展开/收缩 ============
function toggleAdvanced() {
  isAdvanced.value = !unref(isAdvanced)
}

// ============ 字段操作 ============
async function resetFields() {
  await formRef.value?.resetFields?.()
  Object.keys(formModel).forEach((key) => {
    const schema = unref(schemaRef)?.find((s) => s && s.field === key)
    formModel[key] = schema?.defaultValue !== undefined ? schema.defaultValue : undefined
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
  } else {
    await formRef.value?.clearValidate?.()
  }
}

async function scrollToField(name: NamePath, options?: ScrollIntoViewOptions) {
  await formRef.value?.scrollToField?.(name as any, options)
}

async function updateSchema(data: Partial<FormSchema> | Partial<FormSchema>[]) {
  const updateData = Array.isArray(data) ? data : [data]
  updateData.forEach((item) => {
    if (!item || !item.field) return
    const index = schemaRef.value.findIndex((s) => s && s.field === item.field)
    if (index !== -1 && schemaRef.value[index]) {
      schemaRef.value[index] = deepMerge(schemaRef.value[index], item) as FormSchema
    }
  })
}

async function removeSchemaByField(field: string | string[]) {
  const fields = Array.isArray(field) ? field : [field]
  schemaRef.value = schemaRef.value.filter((s) => s && !fields.includes(s.field))
}

async function appendSchemaByField(schema: FormSchema, prefixField?: string, first?: boolean) {
  if (!schema) return
  if (prefixField) {
    const index = schemaRef.value.findIndex((s) => s && s.field === prefixField)
    if (index !== -1) {
      schemaRef.value.splice(first ? index : index + 1, 0, schema)
    }
  } else {
    if (first) schemaRef.value.unshift(schema)
    else schemaRef.value.push(schema)
  }
}

async function setProps(newProps: Partial<FormProps>) {
  // schemas 单独处理，绝不进入 propsRef，避免合并时数组被拼接
  const { schemas, ...rest } = newProps
  propsRef.value = deepMerge(unref(propsRef) || {}, rest)
  if (schemas) {
    schemaRef.value = schemas
    initFormModel()
  }
}

function getForm(): FormInstance | null {
  return formRef.value || null
}

// ============ 暴露给外部的 API ============
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

// 去掉 deep: true，避免深层监听引起重复触发
// 外部若需原地修改 schema，请改用 setProps / updateSchema
watch(
  () => props.schemas,
  (schemas) => {
    if (schemas) {
      schemaRef.value = schemas
      initFormModel()
    }
  },
  { immediate: true },
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
    :colon="false"
    v-bind="aFormAttrs"
    @finish="handleSubmit"
  >
    <a-row v-bind="getRowProps">
      <!-- 普通字段 -->
      <template v-for="schema in displayFields" :key="schema.field">
        <FormItem
          :schema="schema"
          :form-model="formModel"
          :form-action-type="formActionType"
          :set-form-model="setFormModel"
        >
          <template v-for="(_, slotName) in $slots" :key="slotName" #[slotName]="slotProps">
            <slot :name="slotName" v-bind="slotProps" />
          </template>
        </FormItem>
      </template>

      <!-- 分割线 -->
      <template v-for="(schema, index) in displayDividers" :key="`divider-${index}`">
        <a-col :span="24">
          <a-divider v-bind="schema.componentProps">
            {{ schema.label }}
          </a-divider>
        </a-col>
      </template>

      <!-- 操作按钮 -->
      <a-col
        v-if="getProps.showActionButtonGroup"
        :span="needCollapse ? 24 : undefined"
        :class="cn('flex justify-end', !needCollapse && 'flex-1')"
      >
        <div class="flex flex-wrap gap-2">
          <slot name="submitBefore" />
          <a-button v-if="getProps.showSubmitButton" type="primary" html-type="submit">
            <template v-if="getSubmitButtonOptions.preIcon" #icon>
              <IconifyIcon :icon="getSubmitButtonOptions.preIcon" />
            </template>
            {{ getSubmitButtonOptions.text }}
          </a-button>
          <slot name="resetBefore" />
          <a-button v-if="getProps.showResetButton" @click="handleReset">
            <template v-if="getResetButtonOptions.preIcon" #icon>
              <IconifyIcon :icon="getResetButtonOptions.preIcon" />
            </template>
            {{ getResetButtonOptions.text }}
          </a-button>
          <a-button v-if="needCollapse" type="link" @click="toggleAdvanced">
            <IconifyIcon :icon="getAdvancedButtonOptions.icon" class="mr-1" />
            {{ getAdvancedButtonOptions.text }}
          </a-button>
          <slot name="actionAfter" />
        </div>
      </a-col>
    </a-row>
  </a-form>
</template>
