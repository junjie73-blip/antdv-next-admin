import type { FormSchema } from '~/components/business/Form'

import { REJECT_REASON_OPTIONS, STATUS_MAP } from './constants'

export const searchSchemas: FormSchema[] = [
  {
    field: 'title',
    label: '申请标题',
    component: 'Input',
    componentProps: { placeholder: '请输入标题', allowClear: true },
  },
  {
    field: 'status',
    label: '状态',
    component: 'Select',
    componentProps: {
      placeholder: '请选择状态',
      allowClear: true,
      options: Object.entries(STATUS_MAP).map(([value, meta]) => ({
        value,
        label: meta.label,
      })),
    },
  },
]

/** 发起/重新提交表单 */
export function useApprovalFormSchemas(isEditing: ComputedRef<boolean>): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'title',
      label: '申请标题',
      component: 'Input',
      required: true,
      componentProps: { maxlength: 256, showCount: true, placeholder: '请输入申请标题' },
    },
    {
      field: 'content',
      label: '申请说明',
      component: 'InputTextArea',
      componentProps: {
        rows: 4,
        maxlength: 1000,
        showCount: true,
        placeholder: '请描述本次申请的背景、金额、用途等',
      },
    },
    {
      field: 'formData',
      label: '业务数据 (JSON)',
      component: 'InputTextArea',
      ifShow: () => !isEditing.value,
      componentProps: {
        rows: 3,
        placeholder: '{"amount": 4000}',
      },
    },
  ])
}

/** 驳回表单 */
export function useRejectSchemas(): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'reasonType',
      label: '驳回原因分类',
      component: 'Select',
      required: true,
      componentProps: {
        placeholder: '请选择分类',
        options: REJECT_REASON_OPTIONS.map((item) => ({
          label: item.label,
          value: item.value,
        })),
      },
    },
    {
      field: 'remark',
      label: '详细说明',
      component: 'InputTextArea',
      required: true,
      componentProps: {
        rows: 4,
        maxlength: 500,
        showCount: true,
        placeholder: '请填写驳回的详细说明（至少 5 个字）',
      },
      rules: [{ min: 5, message: '至少 5 个字' }],
    },
  ])
}
