import type { RoleRecord } from "./types";
import { ROLE_STATUS_LABEL_MAP } from "./constants";

/**
 * 把角色记录映射为导出用的行数据
 * - status 从 '0' / '1' 转为文案
 */
export function mapRoleForExport(record: RoleRecord) {
  return {
    ...record,
    status: ROLE_STATUS_LABEL_MAP[record.status] || record.status,
  };
}
