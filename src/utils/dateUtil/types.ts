import type { Dayjs } from 'dayjs'

export type DateInput = string | number | Date | Dayjs

export interface DateUtilOptions {
  format?: string
  locale?: string
}
