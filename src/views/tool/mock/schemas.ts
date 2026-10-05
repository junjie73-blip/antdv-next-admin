import type { ComputedRef, Ref } from 'vue'

import { computed } from 'vue'

import type { MockTemplatePreset } from '~/api/mock'
import type { FormSchema, Rule } from '~/components/business/Form'

import { FAIL_RATE_PRESETS, METHOD_OPTIONS } from './constants'

interface SelectOption {
  label: string
  value: string
}

const ID_PATTERN = /^[a-z][a-z0-9-]{1,63}$/
const PATH_PATTERN = /^\/[A-Za-z0-9\-/:._]*$/

/** 必填 + 正则：用 validator 而不是 pattern，提示语才能完全可控 */
function patternRule(pattern: RegExp, message: string, required = true): Rule {
  return {
    required,
    validator: (_rule, value: unknown) => {
      const text = typeof value === 'string' ? value.trim() : ''
      if (!text) return Promise.reject(new Error('该项为必填'))
      if (!pattern.test(text)) return Promise.reject(new Error(message))
      return Promise.resolve()
    },
  }
}

/** 模板必须是合法 JSON，且顶层为对象或数组，与 mockjs 的渲染入口一致 */
const templateRule: Rule = {
  required: true,
  validator: (_rule, value: unknown) => {
    const text = typeof value === 'string' ? value.trim() : ''
    if (!text) return Promise.reject(new Error('响应模板不能为空'))
    try {
      const parsed: unknown = JSON.parse(text)
      if (parsed === null || typeof parsed !== 'object')
        return Promise.reject(new Error('模板需为 JSON 对象或数组'))
      return Promise.resolve()
    } catch {
      return Promise.reject(new Error('不是合法 JSON，请检查引号与逗号'))
    }
  },
}

/** 接口清单筛选表单 */
export function useRouteSearchSchemas(
  modules: ComputedRef<SelectOption[]>,
  sourceOptions: ComputedRef<SelectOption[]>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'keyword',
      label: '关键字',
      component: 'Input',
      colProps: { span: 6 },
      componentProps: {
        allowClear: true,
        placeholder: '搜索地址 / 展示名 / 文件名',
      },
    },
    {
      field: 'module',
      label: '分组',
      component: 'Select',
      colProps: { span: 5 },
      componentProps: () => ({
        allowClear: true,
        options: modules.value,
        placeholder: '全部分组',
      }),
    },
    {
      field: 'source',
      label: '来源',
      component: 'Select',
      colProps: { span: 5 },
      componentProps: () => ({
        allowClear: true,
        options: sourceOptions.value,
        placeholder: '全部来源',
      }),
    },
  ])
}

/**
 * 自定义接口定义表单（新增 / 编辑）。
 * 地址拆成方法 + 路径两个字段，保存时再拼回 `[GET]/path`，避免用户手写中括号。
 */
export function useDefinitionSchemas(
  presets: ComputedRef<MockTemplatePreset[]>,
  isEditing: Ref<boolean>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'id',
      label: '接口标识',
      component: 'Input',
      colProps: { span: 12 },
      componentProps: () => ({
        disabled: isEditing.value,
        placeholder: 'demo-user-list',
      }),
      dynamicRules: (): Rule[] => [
        patternRule(
          ID_PATTERN,
          '小写字母开头，2-64 位，仅允许小写字母、数字与短横线',
        ),
      ],
      helpMessage: '同时作为 mock/generated 下的文件名，保存后不可更换',
    },
    {
      field: 'title',
      label: '展示名',
      component: 'Input',
      colProps: { span: 12 },
      componentProps: { placeholder: '留空则使用接口标识' },
    },
    {
      field: 'method',
      label: '请求方法',
      component: 'Select',
      defaultValue: 'GET',
      colProps: { span: 12 },
      componentProps: () => ({ options: METHOD_OPTIONS }),
      dynamicRules: (): Rule[] => [
        { required: true, message: '请选择请求方法' },
      ],
    },
    {
      field: 'path',
      label: '请求地址',
      component: 'Input',
      colProps: { span: 12 },
      componentProps: { placeholder: '/demo/user/list，支持 /demo/user/:id' },
      dynamicRules: (): Rule[] => [
        patternRule(PATH_PATTERN, '地址需以 / 开头，且不含空格、中文与查询串'),
      ],
    },
    {
      field: 'message',
      label: '成功提示',
      component: 'Input',
      defaultValue: '获取数据成功',
      colProps: { span: 12 },
      componentProps: { placeholder: '返回信封里的 message' },
    },
    {
      field: 'preset',
      label: '套用模板',
      component: 'Select',
      colProps: { span: 12 },
      componentProps: () => ({
        options: presets.value.map((preset) => ({
          label: preset.name,
          value: preset.name,
        })),
        placeholder: '从预置模板开始（可选）',
      }),
      suffix: '选择后覆盖下方模板',
    },
    {
      field: 'template',
      label: '响应模板',
      component: 'InputTextArea',
      colProps: { span: 24 },
      componentProps: {
        placeholder:
          '{ "list|10": [{ "id|+": 1, "name": "@cname" }], "total": 100 }',
        rows: 12,
      },
      dynamicRules: (): Rule[] => [templateRule],
    },
  ])
}

/** 运行时配置抽屉：停用 / 延迟 / 失败注入 */
export function useRuntimeSchemas(): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'disabled',
      label: '停用该接口',
      component: 'Switch',
      colProps: { span: 24 },
      helpMessage: '停用后返回 404 信封，前端走统一的接口异常分支',
    },
    {
      field: 'useCustomDelay',
      label: '单独设置延迟',
      component: 'Switch',
      colProps: { span: 24 },
      helpMessage: '关闭时跟随全局默认延迟',
    },
    {
      field: 'delay',
      label: '响应延迟',
      component: 'Slider',
      colProps: { span: 24 },
      ifShow: ({ values }) => values.useCustomDelay === true,
      componentProps: {
        marks: { 0: '0', 500: '500', 1000: '1s', 3000: '3s', 10000: '10s' },
        max: 10000,
        step: 50,
      },
      suffix: 'ms',
    },
    {
      field: 'useCustomFailRate',
      label: '单独注入失败',
      component: 'Switch',
      colProps: { span: 24 },
      helpMessage: '关闭时跟随全局失败率',
    },
    {
      field: 'failRate',
      label: '失败率',
      component: 'Select',
      colProps: { span: 12 },
      ifShow: ({ values }) => values.useCustomFailRate === true,
      componentProps: () => ({
        options: FAIL_RATE_PRESETS.map((value) => ({
          label: `${value}%`,
          value,
        })),
      }),
    },
    {
      field: 'status',
      label: '注入状态码',
      component: 'InputNumber',
      colProps: { span: 12 },
      ifShow: ({ values }) =>
        values.useCustomFailRate === true && Number(values.failRate) > 0,
      componentProps: {
        max: 599,
        min: 400,
        placeholder: '默认 500',
        style: { width: '100%' },
      },
    },
  ])
}
