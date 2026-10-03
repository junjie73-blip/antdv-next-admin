import type { FieldDiff, OrgHistoryEvent } from './types'

/** 字段级 diff */
export function getFieldDiff(record: Pick<OrgHistoryEvent, 'beforeData' | 'afterData'>): FieldDiff[] {
  const before = record.beforeData ?? {}
  const after = record.afterData ?? {}
  const keys = new Set([...Object.keys(before), ...Object.keys(after)])
  const result: FieldDiff[] = []
  for (const key of keys) {
    const b = (before as Record<string, unknown>)[key]
    const a = (after as Record<string, unknown>)[key]
    if (JSON.stringify(b) !== JSON.stringify(a)) {
      result.push({ field: key, before: b, after: a })
    }
  }
  return result
}

export function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}
