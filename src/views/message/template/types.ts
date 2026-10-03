export type ChannelType = 'email' | 'sms' | 'webhook' | 'wechat_work' | 'dingtalk'
export type EditorType = 'markdown' | 'richtext' | 'html'
export interface TemplateParam {
  name: string
  label: string
  type: 'string' | 'number' | 'date' | 'boolean'
  required?: boolean
  defaultValue?: unknown
  description?: string
}

export interface TemplateRecord {
  templateId: string
  templateCode: string
  templateName: string
  channelType: ChannelType
  title: string | null
  content: string
  params: TemplateParam[] | null
  remark: string | null
  status: string
  createdAt: string
  updatedAt: string
  editorType: EditorType
  contentFormat: string
}

export interface TemplateFormValues {
  templateCode: string
  templateName: string
  channelType: ChannelType
  title?: string
  content: string
  params: TemplateParam[]
  remark?: string
  status: string
  editorType: EditorType
}

export interface TemplateActionContext {
  onEdit: (record: TemplateRecord) => void
  onPreview: (record: TemplateRecord) => void
  onTest: (record: TemplateRecord) => void
  onDelete: (record: TemplateRecord) => void | Promise<void>
  onCopy: (record: TemplateRecord) => void
}
