import type { AuditLogRecord } from "./types";

import type { BasicColumn } from "@/components/business/Table";

/** 审计日志表格列 */
export const auditLogColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "操作描述", dataIndex: "operation", key: "operation", width: 200, ellipsis: true },
  { title: "操作人", dataIndex: "username", key: "username", width: 100, align: "center" },
  { title: "IP地址", dataIndex: "ipAddress", key: "ipAddress", width: 140, ellipsis: true },
  { title: "状态", dataIndex: "status", key: "status", width: 80, align: "center" },
  { title: "耗时(ms)", dataIndex: "executeTime", key: "executeTime", width: 90, align: "center" },
  { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 170 },
];

/** 操作列配置 */
export const auditLogActionColumn = {
  width: 80,
  title: "操作",
  fixed: "right" as const,
};

/** 分页配置 */
export const auditLogPagination = {
  showSizeChanger: true,
  pageSizeOptions: ["10", "20", "50"],
};

/** 滚动配置 */
export const auditLogScroll = { x: 1200 } as const;

/** 行 key 提取 */
export const auditLogRowKey = (record: AuditLogRecord) => record.logId;
