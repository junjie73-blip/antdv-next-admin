export type ChannelType = 'email' | 'sms' | 'webhook' | 'wechat_work' | 'dingtalk'

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
}

export interface TemplateActionContext {
  onEdit: (record: TemplateRecord) => void
  onPreview: (record: TemplateRecord) => void
  onTest: (record: TemplateRecord) => void
  onDelete: (record: TemplateRecord) => void | Promise<void>
  onCopy: (record: TemplateRecord) => void
}
