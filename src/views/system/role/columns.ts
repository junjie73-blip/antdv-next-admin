import type { RoleRecord } from "./types";

import type { BasicColumn } from "@/components/business/Table";

/** 角色表格列 */
export const roleColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "角色名称", dataIndex: "roleName", key: "roleName", width: 140 },
  { title: "角色编码", dataIndex: "roleCode", key: "roleCode", width: 150 },
  { title: "描述", dataIndex: "description", key: "description", ellipsis: true, width: 300 },
  { title: "排序", dataIndex: "sortOrder", key: "sortOrder", width: 70, align: "center" },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 170 },
];

/** 操作列配置 */
export const roleActionColumn = {
  width: 280,
  title: "操作",
  fixed: "right" as const,
};

/** 分页配置 */
export const rolePagination = {
  showSizeChanger: true,
  pageSizeOptions: ["10", "20", "50"],
};

/** 行选择配置 */
export const roleRowSelection = { type: "checkbox" as const };

/** 行 key 提取 */
export const roleRowKey = (record: RoleRecord) => record.roleId;
