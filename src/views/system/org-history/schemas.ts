import { computed, type ComputedRef } from 'vue'

import type { FormSchema } from '~/components/business/Form'

import { CHANGE_TYPE_OPTIONS, ENTITY_TYPE_OPTIONS, SCOPE_OPTIONS } from './constants'

export const orgHistorySearchSchemas: FormSchema[] = [
  {
    field: 'entityType',
    label: '实体类型',
    component: 'Select',
    componentProps: { options: ENTITY_TYPE_OPTIONS, allowClear: true, placeholder: '全部' },
    colProps: {
      span: 4,
    },
  },
  {
    field: 'scope',
    label: '范围',
    component: 'Select',
    componentProps: { options: SCOPE_OPTIONS, allowClear: true, placeholder: '全部' },
    colProps: {
      span: 4,
    },
  },
  {
    field: 'changeType',
    label: '变更类型',
    component: 'Select',
    componentProps: { options: CHANGE_TYPE_OPTIONS, allowClear: true, placeholder: '全部' },
    colProps: {
      span: 4,
    },
  },
  {
    field: 'timeRange',
    label: '时间范围',
    component: 'RangePicker',
    componentProps: { showTime: true, valueFormat: 'YYYY-MM-DDTHH:mm:ss.SSS[Z]' },
    colProps: {
      span: 8,
    },
  },
]

/** 若后续接入字典，按开发文档 §13 用 computed 工厂 */
export function useOrgHistorySearchSchemas(
  entityOptions: ComputedRef<Array<{ label: string; value: string }>>,
): ComputedRef<FormSchema[]> {
  return computed<FormSchema[]>(() => [
    {
      field: 'entityType',
      label: '实体类型',
      component: 'Select',
      componentProps: () => ({ options: entityOptions.value, allowClear: true }),
    },
    ...orgHistorySearchSchemas.slice(1),
  ])
}
