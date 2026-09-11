import type { BasicColumn } from "@/components/business/Table";

/** 按钮权限表格列 */
export const permissionColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "按钮名称", dataIndex: "menuName", key: "menuName", width: 200 },
  { title: "权限标识", dataIndex: "permission", key: "permission", width: 240, ellipsis: true },
  { title: "排序", dataIndex: "sortOrder", key: "sortOrder", width: 100, align: "center" },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
];

/** 操作列配置 */
export const permissionActionColumn = {
  width: 180,
  title: "操作",
  fixed: "right" as const,
};

/** 分页配置 */
export const permissionPagination = { pageSize: 10 };

/** 滚动配置 */
export const permissionScroll = { x: 400 } as const;

/** 行 key 提取 */
export const permissionRowKey = (record: { menuId: string }) => record.menuId;
