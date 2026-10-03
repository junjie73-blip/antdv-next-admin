export const CHANNEL_OPTIONS = [
  { label: '邮件', value: 'email', color: 'blue', icon: 'carbon:email' },
  { label: '短信', value: 'sms', color: 'green', icon: 'carbon:mobile' },
  { label: 'Webhook', value: 'webhook', color: 'purple', icon: 'carbon:webhook' },
  { label: '企业微信', value: 'wechat_work', color: 'cyan', icon: 'carbon:chat' },
  { label: '钉钉', value: 'dingtalk', color: 'orange', icon: 'carbon:chat-bot' },
] as const

export const CHANNEL_MAP: Record<string, { label: string; color: string; icon: string }> = Object.fromEntries(
  CHANNEL_OPTIONS.map((c) => [c.value, c]),
) as never

export const TEMPLATE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  '1': { label: '启用', color: 'green' },
  '0': { label: '禁用', color: 'red' },
}

export const PARAM_TYPE_OPTIONS = [
  { label: '字符串', value: 'string' },
  { label: '数字', value: 'number' },
  { label: '日期', value: 'date' },
  { label: '布尔', value: 'boolean' },
]

export const containerClassName = 'space-y-4'
export const EDITOR_TYPE_OPTIONS = [
  {
    label: '可视化编辑',
    value: 'richtext',
    icon: 'carbon:edit',
    tip: '富文本，所见即所得',
    color: 'blue',
  },
  {
    label: 'Markdown',
    value: 'markdown',
    icon: 'carbon:markdown',
    tip: 'Markdown 源文本',
    color: 'green',
  },
  { label: 'HTML', value: 'html', icon: 'carbon:code', tip: 'HTML 源码', color: 'orange' },
] as const

export const EDITOR_TYPE_MAP = Object.fromEntries(EDITOR_TYPE_OPTIONS.map((o) => [o.value, o])) as Record<
  string,
  { label: string; value: string; icon: string; tip: string; color: string }
>

/** editorType → contentFormat 映射 */
export const EDITOR_FORMAT_MAP: Record<string, 'markdown' | 'html' | 'text'> = {
  markdown: 'markdown',
  richtext: 'html',
  html: 'html',
}
