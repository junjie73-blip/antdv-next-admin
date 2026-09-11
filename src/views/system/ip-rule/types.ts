/** IP 规则类型 */
export type IpRuleType = "white" | "black";

/** 规则状态 */
export type IpRuleStatus = "0" | "1";

/** IP 规则记录 */
export interface IpRuleRecord {
  ruleId: string;
  ruleType: IpRuleType;
  /** IP 或 CIDR，如 192.168.1.1 / 192.168.1.0/24 */
  ipPattern: string;
  /** '0'-停用 '1'-启用 */
  status: IpRuleStatus;
  remark?: string;
  createdAt: string;
}
