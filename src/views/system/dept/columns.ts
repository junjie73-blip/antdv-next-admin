import type { DeptRecord } from "./types";

import type { BasicColumn } from "~/components/business/Table";

/** 部门表格列 */
export const deptColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "部门名称", dataIndex: "deptName", key: "deptName", width: 160 },
  { title: "部门编码", dataIndex: "deptCode", key: "deptCode", width: 200, align: "center" },
  { title: "负责人", dataIndex: "leader", key: "leader", width: 120, align: "center" },
  { title: "联系电话", dataIndex: "phone", key: "phone", width: 140, align: "center" },
  { title: "邮箱", dataIndex: "email", key: "email", width: 180, align: "center" },
  { title: "排序号", dataIndex: "sortOrder", key: "sortOrder", width: 80, align: "center" },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 170, align: "center" },
];

/** 操作列配置 */
export const deptActionColumn = {
  width: 280,
  title: "操作",
  fixed: "right" as const,
};

/** 滚动配置 */
export const deptScroll = { x: 1400 } as const;

/** 行 key 提取 */
export const deptRowKey = (record: DeptRecord) => record.deptId;
