import dayjs from "dayjs";
import type { PermissionRecord, PermissionScope, RawPermissionRecord, ResourceType } from "./types";

/**
 * 从权限编码推断级别
 * - 以 `platform:` 开头 → platform
 * - 其他 → business
 */
export function getScopeByCode(code: string): PermissionScope {
  return code.startsWith("platform:") ? "platform" : "business";
}

/**
 * 判断该资源类型是否需要「动作」字段
 *
 * - data 类型不需要（数据权限靠"范围"描述，无动作语义）
 * - api / other 需要
 */
export function needAction(resourceType: ResourceType | string): boolean {
  return resourceType !== "data";
}

/**
 * 把后端原始记录映射为前端 PermissionRecord
 */
export function mapPermissionRecord(item: RawPermissionRecord): PermissionRecord {
  return {
    permId: item.permId,
    permCode: item.permCode,
    permName: item.permName,
    resourceType: item.resourceType,
    action: item.action,
    description: item.description,
    status: String(item.status),
    createdAt: item.createdAt ? dayjs(item.createdAt).format("YYYY-MM-DD HH:mm:ss") : "",
    updatedAt: item.updatedAt ? dayjs(item.updatedAt).format("YYYY-MM-DD HH:mm:ss") : "",
  };
}
