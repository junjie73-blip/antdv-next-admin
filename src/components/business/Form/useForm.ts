import type { FormActionType, FormProps, FormSchema, NamePath, UseFormReturnType } from './types'
import { ref, unref } from 'vue'
import { deepMerge } from './helper'

export function useForm(props?: Partial<FormProps>): UseFormReturnType {
  const formRef = ref<FormActionType | null>(null)
  const formProps = ref<Partial<FormProps>>(props || {})

  function register(instance: FormActionType) {
    if (instance) {
      formRef.value = instance
      instance.setProps(unref(formProps))
    }
  }

  function getFormInstance(): FormActionType | null {
    return unref(formRef)
  }

  const methods: FormActionType = {
    getFieldsValue: () => {
      const instance = getFormInstance()
      return instance?.getFieldsValue() || {}
    },

    setFieldsValue: async <T>(values: T) => {
      const instance = getFormInstance()
      if (instance) {
        await instance.setFieldsValue(values)
      }
    },

    resetFields: async () => {
      const instance = getFormInstance()
      if (instance) {
        await instance.resetFields()
      }
    },

    validate: async (nameList?: NamePath[]) => {
      const instance = getFormInstance()
      if (instance) {
        return instance.validate(nameList)
      }
      return {}
    },

    validateFields: async (nameList?: NamePath[]) => {
      const instance = getFormInstance()
      if (instance) {
        return instance.validateFields(nameList)
      }
      return {}
    },

    submit: async () => {
      const instance = getFormInstance()
      if (instance) {
        await instance.submit()
      }
    },

    clearValidate: async (name?: string | string[]) => {
      const instance = getFormInstance()
      if (instance) {
        await instance.clearValidate(name)
      }
    },

    scrollToField: async (name: NamePath, options?: ScrollIntoViewOptions) => {
      const instance = getFormInstance()
      if (instance) {
        await instance.scrollToField(name, options)
      }
    },

    updateSchema: async (data: Partial<FormSchema> | Partial<FormSchema>[]) => {
      const instance = getFormInstance()
      if (instance) {
        await instance.updateSchema(data)
      }
    },

    removeSchemaByField: async (field: string | string[]) => {
      const instance = getFormInstance()
      if (instance) {
        await instance.removeSchemaByField(field)
      }
    },

    appendSchemaByField: async (schema: FormSchema, prefixField?: string, first?: boolean) => {
      const instance = getFormInstance()
      if (instance) {
        await instance.appendSchemaByField(schema, prefixField, first)
      }
    },

    setProps: async (newProps: Partial<FormProps>) => {
      const instance = getFormInstance()
      if (instance) {
        await instance.setProps(newProps)
      }
      formProps.value = deepMerge(formProps.value || {}, newProps)
    },

    getForm: () => {
      const instance = getFormInstance()
      return instance?.getForm() || null
    },
  }

  return [register, methods]
}
