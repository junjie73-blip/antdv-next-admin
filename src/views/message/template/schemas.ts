import { computed, type ComputedRef } from 'vue'

import type { FormSchema } from '~/components/business/Form'

import { CHANNEL_OPTIONS, TEMPLATE_STATUS_MAP } from './constants'

export const searchSchemas: FormSchema[] = [
  {
    field: 'keyword',
    label: '关键词',
    component: 'Input',
    colProps: { span: 6 },
    componentProps: { placeholder: '搜索模板名称/编码', allowClear: true },
  },

  {
    field: 'channelType',
    label: '渠道',
    component: 'Select',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '全部渠道',
      allowClear: true,
      options: CHANNEL_OPTIONS.map((c) => ({ label: c.label, value: c.value })),
    },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    colProps: { span: 6 },
    componentProps: {
      placeholder: '全部状态',
      allowClear: true,
      options: Object.entries(TEMPLATE_STATUS_MAP).map(([value, meta]) => ({
        label: meta.label,
        value,
      })),
    },
  },
]

export function useTemplateFormSchemas(isEditing: ComputedRef<boolean>): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'templateCode',
      label: '模板编码',
      component: 'Input',
      required: true,
      colProps: { span: 12 },
      componentProps: {
        placeholder: '字母/数字/下划线，如 welcome_email',
        maxlength: 64,
        disabled: isEditing.value,
      },
      helpMessage: isEditing.value ? '编码创建后不可修改' : undefined,
    },
    {
      field: 'templateName',
      label: '模板名称',
      component: 'Input',
      required: true,
      colProps: { span: 12 },
      componentProps: { placeholder: '如 欢迎邮件', maxlength: 128 },
    },
    {
      field: 'channelType',
      label: '渠道类型',
      component: 'Select',
      required: true,
      colProps: { span: 12 },
      componentProps: {
        placeholder: '选择渠道',
        options: CHANNEL_OPTIONS.map((c) => ({ label: c.label, value: c.value })),
      },
    },
    {
      field: 'status',
      label: '状态',
      component: 'RadioGroup',
      defaultValue: '1',
      colProps: { span: 12 },
      componentProps: {
        optionType: 'button',
        buttonStyle: 'solid',
        options: Object.entries(TEMPLATE_STATUS_MAP).map(([value, meta]) => ({
          label: meta.label,
          value,
        })),
      },
    },
    {
      field: 'title',
      label: '模板标题',
      component: 'Input',
      colProps: { span: 24 },
      componentProps: { placeholder: '如「欢迎加入 ${appName}」，可包含变量', maxlength: 256 },
    },
    {
      field: 'content',
      label: '模板内容',
      slot: 'templateEditor',
      colProps: { span: 24 },
      required: true,
      componentProps: { placeholder: '模板内容，可包含变量', rows: 2, maxlength: 512 },
    },
    {
      field: 'contentFormat',
      label: '__hidden__',
      component: 'Input',
      hidden: true,
      colProps: { span: 0 },
      defaultValue: 'markdown',
    },
    {
      field: 'params',
      label: '__hidden__',
      component: 'Input',
      hidden: true,
      colProps: { span: 0 },
      defaultValue: [],
    },

    {
      field: 'remark',
      label: '备注',
      component: 'InputTextArea',
      colProps: { span: 24 },
      componentProps: { placeholder: '模板说明，便于团队理解', rows: 2, maxlength: 512 },
    },
  ])
}
