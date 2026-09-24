// src/utils/dict.ts
import { useDictStore } from '~/stores'

/**
 * 根据字典类型和值获取 label
 */
export function getDictLabel(dictType: string, value: any): string {
  if (value === undefined || value === null || value === '') return '-'
  const dictStore = useDictStore()
  const options = dictStore.getOptions(dictType)
  const match = options.find((opt: any) => String(opt.value) === String(value))
  return match?.label ?? String(value)
}

/**
 * 批量获取（多个值用逗号分隔时）
 */
export function getDictLabels(dictType: string, value: string | string[]): string {
  if (!value) return '-'
  const values = Array.isArray(value) ? value : String(value).split(',')
  return values.map((v) => getDictLabel(dictType, v)).join('、')
}
