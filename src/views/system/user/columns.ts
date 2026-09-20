import type { UserRecord } from "./types";

import type { BasicColumn } from "~/components/business/Table";
import type { TemplateColumn } from "~/utils/template";

/** 用户表格列：总宽约 1250px，小屏横向滚动 */
export const userColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  {
    title: "用户名",
    dataIndex: "username",
    key: "username",
    width: 120,
    ellipsis: true,
  },
  {
    title: "真实姓名",
    dataIndex: "realName",
    key: "realName",
    width: 110,
    ellipsis: true,
  },
  {
    title: "邮箱",
    dataIndex: "email",
    key: "email",
    width: 200,
    ellipsis: true,
  },
  {
    title: "手机号",
    dataIndex: "phone",
    key: "phone",
    width: 130,
    align: "center",
  },
  {
    title: "部门",
    dataIndex: "deptName",
    key: "deptName",
    width: 120,
    ellipsis: true,
  },
  {
    title: "角色",
    dataIndex: "roles",
    key: "roles",
    width: 150,
    ellipsis: true,
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 90,
    align: "center",
  },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 170,
    align: "center",
  },
];

/** 操作列：紧凑到 260px */
export const userActionColumn = {
  width: 350,
  title: "操作",
  fixed: "right" as const,
  align: "center" as const,
};

/** 分页 */
export const userPagination = {
  showSizeChanger: true,
  pageSizeOptions: ["10", "20", "50"],
  size: "small" as const,
  showTotal: (total: number) => `共 ${total} 条`,
};

/** 行选择 */
export const userRowSelection = {
  type: "checkbox" as const,
  columnWidth: 48,
};

/** 滚动：总宽 1250 + 操作列 260 = 1510 */
export const userScroll = { x: 1300 } as const;

/** 行 key */
export const userRowKey = (record: UserRecord) => record.userId;

/** 导入模板 */
export const USER_IMPORT_TEMPLATE: TemplateColumn[] = [
  { header: "用户名", key: "username", width: 16, example: "zhangsan" },
  { header: "真实姓名", key: "real_name", width: 16, example: "张三" },
  { header: "邮箱", key: "email", width: 30, example: "zhangsan@example.com" },
  { header: "手机号", key: "phone", width: 16, example: "13800000000" },
  { header: "部门编码", key: "deptCode", width: 40, example: "dept1" },
  { header: "角色编码", key: "roleCode", width: 40, example: "SUPER_ADMIN" },
  { header: "性别", key: "gender", width: 8, example: 0 },
  { header: "状态", key: "status", width: 8, example: "1" },
];
