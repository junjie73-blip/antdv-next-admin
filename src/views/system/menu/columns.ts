import type { BasicColumn } from "@/components/business/Table";
import type { MenuRecord } from "./types";

/** 菜单表格列 */
export const menuColumns: BasicColumn[] = [
  { title: "菜单名称", dataIndex: "menuName", key: "menuName", width: 200 },
  { title: "图标", dataIndex: "icon", key: "icon", width: 70, align: "center" },
  { title: "排序", dataIndex: "sortOrder", key: "sortOrder", width: 70, align: "center" },
  { title: "权限标识", dataIndex: "permission", key: "permission", width: 180, ellipsis: true },
  { title: "路由地址", dataIndex: "path", key: "path", width: 160, ellipsis: true },
  { title: "组件路径", dataIndex: "component", key: "component", width: 180, ellipsis: true },
  { title: "类型", dataIndex: "menuType", key: "menuType", width: 80, align: "center" },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 180, align: "center" },
];

/** 操作列配置 */
export const menuActionColumn = {
  width: 400,
  title: "操作",
  fixed: "right" as const,
};

/** 滚动配置 */
export const menuScroll = { y: 9999999 } as const;

/** 行 key 提取 */
export const menuRowKey = (record: MenuRecord) => record.menuId;
