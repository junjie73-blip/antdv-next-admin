import type { ComputedRef } from 'vue'

import { computed } from 'vue'

import type { FormSchema } from '~/components/business/Form'

import { EXPORT_STATUS_FILTER_OPTIONS } from './constants'

/** 导出中心搜索表单 schema */
export function useExportSearchSchemas(): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'status',
      label: '状态',
      component: 'Select',
      colProps: { span: 6 },
      componentProps: {
        placeholder: '全部状态',
        allowClear: true,
        options: EXPORT_STATUS_FILTER_OPTIONS,
      },
    },
  ])
}
