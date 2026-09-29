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
