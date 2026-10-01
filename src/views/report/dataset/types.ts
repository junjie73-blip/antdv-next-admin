export interface DatasetRecord {
  dataset_id: string
  dataset_code: string
  dataset_name: string
  description?: string | null
  category?: string | null
  dataset_type: string
  status: string
  updated_at: string
  params?: any[] | null
}

export interface DatasetActionContext {
  onEdit: (record: DatasetRecord) => void
  onPreview: (record: DatasetRecord) => void
  onDelete: (record: DatasetRecord) => void | Promise<void>
}
