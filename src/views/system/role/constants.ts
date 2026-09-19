import { cn } from "~/utils/cn";

// ========== 样式类名 ==========
export const containerClassName = cn("space-y-4");
export const cardClassName = cn("shadow-sm");

// ========== 状态映射 ==========
export const ROLE_STATUS_COLOR_MAP: Record<string, string> = {
  "1": "green",
  "0": "red",
};

export const ROLE_STATUS_LABEL_MAP: Record<string, string> = {
  "1": "正常",
  "0": "停用",
};

// ========== 新增/编辑时的空表单值 ==========
export const ROLE_EMPTY_VALUES = {
  roleName: "",
  roleCode: "",
  description: "",
  sortOrder: 0,
  status: "1",
  dataScope: "1",
};

// ========== 导出配置 ==========
export const ROLE_EXPORT_FILE_NAME = "角色列表";
export const ROLE_EXPORT_SHEET_NAME = "角色管理";

export const ROLE_EXPORT_COLUMNS = [
  { header: "ID", key: "roleId", width: 8 },
  { header: "角色名称", key: "roleName", width: 15 },
  { header: "角色编码", key: "roleCode", width: 18 },
  { header: "描述", key: "description", width: 30 },
  { header: "排序", key: "sortOrder", width: 8 },
  { header: "状态", key: "status", width: 8 },
  { header: "创建时间", key: "createdAt", width: 20 },
];
