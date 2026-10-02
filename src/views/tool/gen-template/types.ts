import type { GenTemplateRecord } from './api'

export type {
  GenTemplateRecord,
  GenTemplateDetail,
  GenTemplateVersion,
  GenTemplateListParams,
  GenTemplateCreateParams,
  GenTemplateUpdateParams,
  TemplateCategory,
} from './api'

export interface TemplateActionContext {
  onEdit: (record: GenTemplateRecord) => void
  onVersions: (record: GenTemplateRecord) => void
  onDelete: (record: GenTemplateRecord) => void | Promise<void>
}
