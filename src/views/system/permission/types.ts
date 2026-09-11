/** 权限级别 */
export type PermissionScope = "platform" | "business";

/** 资源类型 */
export type ResourceType = "menu" | "button" | "api" | "data" | "other";

/** 权限记录 */
export interface PermissionRecord {
  permId: string;
  permCode: string;
  permName: string;
  /** 从 permCode 前缀推断 */
  scope: PermissionScope;
  resourceType: ResourceType;
  action?: string | null;
  description?: string | null;
  /** '0'-禁用 '1'-启用 */
  status: string;
  createdAt: string;
  updatedAt: string;
}

/** 后端原始记录（映射前） */
export interface RawPermissionRecord {
  permId: string;
  permCode: string;
  permName: string;
  resourceType: ResourceType;
  action?: string | null;
  description?: string | null;
  status: number | string;
  createdAt?: string;
  updatedAt?: string;
}
