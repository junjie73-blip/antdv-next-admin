/** 租户记录 */
export interface TenantRecord {
  tenantId: string
  tenantCode: string
  tenantName: string
  contactName?: string | null
  contactPhone?: string | null
  contactEmail?: string | null
  /** '0'-禁用 '1'-启用 */
  status: string
  expireTime?: string | null
  createdAt: string
  updatedAt: string
}
