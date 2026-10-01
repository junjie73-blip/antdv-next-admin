export interface DefinitionRecord {
  def_id: string
  def_key: string
  def_name: string
  version: number
  category?: string | null
  description?: string | null
  status: string
  created_at: string
  updated_at: string
}

export interface DefinitionActionContext {
  onEdit: (record: DefinitionRecord) => void
  onPublish: (record: DefinitionRecord) => void | Promise<void>
  onDelete: (record: DefinitionRecord) => void | Promise<void>
  onNewVersion: (record: DefinitionRecord) => void | Promise<void>
}
