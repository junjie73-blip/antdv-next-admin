import type { PermissionRecord } from "./types";

import type { BasicColumn } from "@/components/business/Table";

/** 权限表格列 */
export const permissionColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    dataIndex: "permId",
    customRender: ({ index }) => index + 1,
  },
  {
    title: "资源类型",
    dataIndex: "resourceType",
    key: "resourceType",
    width: 100,
    align: "center",
  },
  { title: "权限编码", dataIndex: "permCode", key: "permCode", width: 240, ellipsis: true },
  { title: "权限名称", dataIndex: "permName", key: "permName", width: 160 },
  {
    title: "动作",
    dataIndex: "permAction",
    key: "permAction",
    width: 100,
    align: "center",
  },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "描述", dataIndex: "description", key: "description", ellipsis: true },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 170, align: "center" },
];

/** 操作列配置 */
export const permissionActionColumn = {
  width: 220,
  title: "操作",
  fixed: "right" as const,
};

/** 分页配置 */
export const permissionPagination = {
  showSizeChanger: true,
  pageSizeOptions: ["10", "20", "50"],
};

/** 滚动配置 */
export const permissionScroll = { x: 1400 } as const;

/** 行 key 提取 */
export const permissionRowKey = (record: PermissionRecord) => record.permId;
