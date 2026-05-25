import type { Ref } from 'vue'
import type { FormActionType, FormProps, FormSchema } from '../../Form/types'
import type { BasicTableProps, Recordable } from '../types'
import { computed, ref, unref, watch } from 'vue'
import { useForm } from '../../Form/useForm'

interface UseTableFormOptions {
  propsRef?: Ref<BasicTableProps>
  formConfig?: Partial<FormProps>
  useSearchForm?: boolean
  fieldMapToTime?: [string, [string, string], string?][]
  fetch?: (opt?: { searchInfo?: Recordable }) => Promise<void>
  getFormValues?: () => Recordable
}

interface UseTableFormReturn {
  getForm: () => FormActionType | null
  getFormProps: ComputedRef<Partial<FormProps>>
  handleSearchInfoFn: (info: Recordable) => Recordable
  replaceFormSchemaKey: (values: Recordable, schemas: FormSchema[]) => Recordable
  processFormSchema: (schemas: FormSchema[]) => FormSchema[]
}

/**
 * 处理时间字段映射
 * 将时间范围字段拆分为开始和结束字段
 */
function handleRangeTimeValue(values: Recordable, fieldMapToTime?: [string, [string, string], string?][]): Recordable {
  if (!fieldMapToTime || !Array.isArray(fieldMapToTime)) {
    return values
  }

  const result = { ...values }

  fieldMapToTime.forEach(([field, [startKey, endKey], format = 'YYYY-MM-DD']) => {
    const value = result[field]
    if (value && Array.isArray(value) && value.length === 2) {
      const [start, end] = value

      // 处理 dayjs 对象或 Date 对象
      const formatValue = (v: any): string | null => {
        if (!v)
          return null
        if (v instanceof Date) {
          return formatDate(v, format)
        }
        if (typeof v === 'object' && 'format' in v && typeof v.format === 'function') {
          return v.format(format)
        }
        return String(v)
      }

      result[startKey] = formatValue(start)
      result[endKey] = formatValue(end)

      // 删除原始字段
      delete result[field]
    }
  })

  return result
}

/**
 * 格式化日期
 */
function formatDate(date: Date, format: string): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds)
}

/**
 * 处理表单字段名替换
 * 支持将表单字段名映射为 API 参数名
 */
function replaceSchemaKey(values: Recordable, schemas: FormSchema[]): Recordable {
  const result: Recordable = {}

  Object.keys(values).forEach((key) => {
    const schema = schemas.find(s => s.field === key)
    const value = values[key]

    if (schema && value !== undefined && value !== null && value !== '') {
      result[key] = value
    }
    else if (value !== undefined && value !== null && value !== '') {
      result[key] = value
    }
  })

  return result
}

/**
 * 处理搜索表单相关逻辑
 * 集成 BasicForm 组件，处理搜索参数转换和提交
 */
export function useTableForm(options?: UseTableFormOptions): UseTableFormReturn {
  const {
    propsRef,
    formConfig: formConfigOption,
    useSearchForm: useSearchFormOption,
    fieldMapToTime: fieldMapToTimeOption,
    fetch: fetchOption,
    getFormValues: getFormValuesOption,
  } = options || {}

  // 表单实例
  const formRef = ref<FormActionType | null>(null)

  // 使用 useForm 获取表单方法
  const [registerForm, formMethods] = useForm()

  /**
   * 获取表格 props
   * 优先从 options 获取，其次从 propsRef 获取
   */
  const getProps = (): Partial<BasicTableProps> => {
    if (propsRef) {
      return unref(propsRef) || {}
    }
    return {}
  }

  /**
   * 获取表单配置
   * 优先从 options 获取，其次从 props 获取
   */
  const getFormProps = computed<Partial<FormProps>>(() => {
    const props = getProps()
    const formConfig = formConfigOption || props.formConfig
    const useSearchForm = useSearchFormOption ?? props.useSearchForm

    const defaultFormProps: Partial<FormProps> = {
      showActionButtonGroup: true,
      showResetButton: true,
      showSubmitButton: true,
      submitOnReset: true,
      autoSubmitOnEnter: true,
      ...formConfig,
    }

    // 如果启用了搜索表单，设置默认的提交和重置回调
    if (useSearchForm) {
      defaultFormProps.submitFunc = handleSubmit
      defaultFormProps.resetFunc = handleReset
    }

    return defaultFormProps
  })

  /**
   * 获取表单 schemas
   */
  const getFormSchemas = (): FormSchema[] => {
    const { formConfig } = getProps()
    return formConfig?.schemas || []
  }

  /**
   * 处理搜索参数
   * 转换时间字段、处理字段映射等
   */
  const handleSearchInfoFn = (info: Recordable): Recordable => {
    const props = getProps()
    const schemas = getFormSchemas()

    // 处理字段映射
    let result = replaceSchemaKey(info, schemas)

    // 处理时间范围字段（优先从 options 获取，其次从 props 获取）
    const fieldMapToTime = fieldMapToTimeOption || props.formConfig?.fieldMapToTime
    if (fieldMapToTime) {
      result = handleRangeTimeValue(result, fieldMapToTime)
    }

    return result
  }

  /**
   * 替换表单 schema 中的 key
   */
  const replaceFormSchemaKey = (values: Recordable, schemas: FormSchema[]): Recordable => {
    return replaceSchemaKey(values, schemas)
  }

  /**
   * 处理表单 schema
   * 应用动态规则、禁用状态等
   */
  const processFormSchema = (schemas: FormSchema[]): FormSchema[] => {
    return schemas.map((schema) => {
      const newSchema = { ...schema }

      // 处理动态禁用状态
      if (typeof newSchema.dynamicDisabled === 'function') {
        const formValues = getFormValuesOption ? getFormValuesOption() : {}
        const params = {
          schema: newSchema,
          values: formValues,
          model: formValues,
          field: newSchema.field,
        }
        const disabled = newSchema.dynamicDisabled(params as any)
        newSchema.componentProps = {
          ...newSchema.componentProps,
          disabled,
        }
      }

      // 处理动态规则
      if (typeof newSchema.dynamicRules === 'function') {
        const formValues = getFormValuesOption ? getFormValuesOption() : {}
        const params = {
          schema: newSchema,
          values: formValues,
          model: formValues,
          field: newSchema.field,
        }
        newSchema.rules = newSchema.dynamicRules(params as any)
      }

      return newSchema
    })
  }

  /**
   * 处理表单提交
   */
  async function handleSubmit(): Promise<void> {
    const values = await formMethods.validate()
    const searchInfo = handleSearchInfoFn(values)

    if (fetchOption) {
      await fetchOption({ searchInfo })
    }
  }

  /**
   * 处理表单重置
   */
  async function handleReset(): Promise<void> {
    await formMethods.resetFields()

    const { submitOnReset } = unref(getFormProps)
    if (submitOnReset && fetchOption) {
      const values = formMethods.getFieldsValue()
      const searchInfo = handleSearchInfoFn(values)
      await fetchOption({ searchInfo })
    }
  }

  /**
   * 获取表单实例
   */
  const getForm = (): FormActionType | null => {
    return (formRef.value || formMethods) as FormActionType | null
  }

  // 监听表单配置变化，更新表单
  watch(
    () => getProps().formConfig,
    (newConfig) => {
      if (newConfig && formRef.value) {
        formMethods.setProps(newConfig)
      }
    },
    { deep: true },
  )

  return {
    getForm,
    getFormProps,
    handleSearchInfoFn,
    replaceFormSchemaKey,
    processFormSchema,
  }
}
