import type { BasicColumn } from "~/components/business/Table";

/** 消息表格列定义 */
export const noticeColumns: BasicColumn[] = [
  { title: "类型", key: "noticeType", width: 90, align: "center" },
  { title: "标题", dataIndex: "title", key: "title", width: 240, ellipsis: true },
  { title: "内容", dataIndex: "content", key: "content", ellipsis: true },
  { title: "状态", key: "isRead", width: 90, align: "center" },
  { title: "发布时间", dataIndex: "publishTime", key: "publishTime", width: 180 },
];

/** 表格滚动配置 */
export const noticeScroll = { x: 1000 } as const;

/** 操作列配置 */
export const noticeActionColumn = {
  width: 120,
  title: "操作",
  fixed: "right" as const,
};

/** 行 key 提取函数 */
export const noticeRowKey = (record: { noticeId: string }) => record.noticeId;
