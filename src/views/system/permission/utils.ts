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
 * - menu / data 类型不依赖动作
 * - button / api / other 类型需要动作
 */
export function needAction(resourceType: ResourceType | string): boolean {
  return resourceType !== "menu" && resourceType !== "data";
}

/**
 * 把后端原始记录映射为前端 PermissionRecord
 */
export function mapPermissionRecord(item: RawPermissionRecord): PermissionRecord {
  return {
    permId: item.permId,
    permCode: item.permCode,
    permName: item.permName,
    scope: getScopeByCode(item.permCode),
    resourceType: item.resourceType,
    action: item.action,
    description: item.description,
    status: String(item.status),
    createdAt: item.createdAt ? dayjs(item.createdAt).format("YYYY-MM-DD HH:mm:ss") : "",
    updatedAt: item.updatedAt ? dayjs(item.updatedAt).format("YYYY-MM-DD HH:mm:ss") : "",
  };
}

/**
 * 按「是否平台超管」过滤记录
 * 非超管只能看到 business 级别的权限
 */
export function filterByPlatformAdmin(
  records: PermissionRecord[],
  isPlatformAdmin: boolean,
): PermissionRecord[] {
  return isPlatformAdmin ? records : records.filter((r) => r.scope === "business");
}

/**
 * 把表单值转换为后端提交 payload
 * - status 由字符串转为数字
 * - 根据 resourceType 决定是否包含 action
 */
export function buildPermissionPayload(values: {
  permCode: string;
  permName: string;
  resourceType: ResourceType | string;
  action?: string;
  status: string;
  description?: string;
}) {
  const payload: Record<string, any> = {
    permCode: values.permCode,
    permName: values.permName,
    resourceType: values.resourceType,
    status: values.status === "1" ? 1 : 0,
    description: values.description,
  };

  if (needAction(values.resourceType)) {
    payload.action = values.action;
  } else {
    payload.action = null;
  }

  return payload;
}
