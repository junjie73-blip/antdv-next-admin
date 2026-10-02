import type { FieldMaskRecord } from './api'

export type {
  FieldMaskRecord,
  FieldMaskListParams,
  FieldMaskCreateParams,
  FieldMaskUpdateParams,
  MaskType,
} from './api'

export interface FieldMaskActionContext {
  onEdit: (record: FieldMaskRecord) => void
  onDelete: (record: FieldMaskRecord) => void | Promise<void>
}
