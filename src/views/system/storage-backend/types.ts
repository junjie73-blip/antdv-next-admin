import type { StorageBackendRecord } from './api'

export type {
  StorageBackendRecord,
  StorageBackendListParams,
  StorageBackendCreateParams,
  StorageBackendUpdateParams,
  BackendType,
} from './api'

export interface StorageBackendActionContext {
  onEdit: (record: StorageBackendRecord) => void
  onActivate: (record: StorageBackendRecord) => void | Promise<void>
  onCheck: (record: StorageBackendRecord) => void | Promise<void>
  onDelete: (record: StorageBackendRecord) => void | Promise<void>
}
