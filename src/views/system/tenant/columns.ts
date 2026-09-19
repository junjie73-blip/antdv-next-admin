import dayjs from "dayjs";

import type { TenantRecord } from "./types";

import type { BasicColumn } from "~/components/business/Table";

/** 租户表格列 */
export const tenantColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    dataIndex: "tenantId",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "租户编码", dataIndex: "tenantCode", key: "tenantCode", width: 140 },
  { title: "租户名称", dataIndex: "tenantName", key: "tenantName", width: 200, ellipsis: true },
  { title: "联系人", dataIndex: "contactName", key: "contactName", width: 100, align: "center" },
  {
    title: "联系电话",
    dataIndex: "contactPhone",
    key: "contactPhone",
    width: 140,
    align: "center",
  },
  { title: "联系邮箱", dataIndex: "contactEmail", key: "contactEmail", width: 200, ellipsis: true },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  {
    title: "过期时间",
    dataIndex: "expireTime",
    key: "expireTime",
    width: 170,
    align: "center",
    customRender: ({ record }: any) =>
      record.expireTime ? dayjs(record.expireTime).format("YYYY-MM-DD HH:mm") : "永久",
  },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 170, align: "center" },
];

/** 操作列配置 */
export const tenantActionColumn = {
  width: 250,
  title: "操作",
  fixed: "right" as const,
};

/** 分页配置 */
export const tenantPagination = {
  showSizeChanger: true,
  pageSizeOptions: ["10", "20", "50"],
};

/** 行选择配置 */
export const tenantRowSelection = { type: "checkbox" as const };

/** 滚动配置 */
export const tenantScroll = { x: 1400 } as const;

/** 行 key 提取 */
export const tenantRowKey = (record: TenantRecord) => record.tenantId;
