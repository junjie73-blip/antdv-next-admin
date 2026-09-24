import type { IpRuleStatus, IpRuleType } from './types'

/** 规则类型选项 */
export const IP_RULE_TYPE_OPTIONS = [
  { label: '白名单', value: 'white' as IpRuleType },
  { label: '黑名单', value: 'black' as IpRuleType },
]

/** 状态选项 */
export const IP_RULE_STATUS_OPTIONS = [
  { label: '启用', value: '1' as IpRuleStatus },
  { label: '停用', value: '0' as IpRuleStatus },
]

/** 状态颜色映射 */
export const IP_RULE_STATUS_COLOR_MAP: Record<string, string> = {
  '1': 'green',
  '0': 'red',
}

/** 状态文案映射 */
export const IP_RULE_STATUS_LABEL_MAP: Record<string, string> = {
  '1': '启用',
  '0': '停用',
}

/** Tab → ruleType 映射 */
export const TAB_TO_RULE_TYPE: Record<string, IpRuleType> = {
  white: 'white',
  black: 'black',
}
