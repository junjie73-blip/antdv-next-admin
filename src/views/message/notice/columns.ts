import type { BasicColumn } from "@/components/business/Table";
import dayjs from "dayjs";

/** 通知表格列 */
export const noticeColumns: BasicColumn[] = [
  {
    title: "#",
    key: "index",
    dataIndex: "noticeId",
    width: 60,
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "标题", dataIndex: "title", key: "title", width: 240, ellipsis: true },
  { title: "类型", dataIndex: "noticeType", key: "noticeType", width: 80, align: "center" },
  { title: "状态", dataIndex: "status", key: "status", width: 90, align: "center" },
  {
    title: "发布时间",
    dataIndex: "publishTime",
    key: "publishTime",
    width: 180,
    customRender: ({ record }: any) =>
      record.publishTime ? dayjs(record.publishTime).format("YYYY-MM-DD HH:mm") : "未设置",
  },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 180,
    customRender: ({ record }: any) => dayjs(record.createdAt).format("YYYY-MM-DD HH:mm"),
  },
];

/** 操作列配置 */
export const noticeActionColumn = {
  width: 220,
  title: "操作",
  fixed: "right" as const,
};

/** 分页配置 */
export const noticePagination = {
  showSizeChanger: true,
  pageSizeOptions: ["10", "20", "50"],
};

/** 行 key */
export const noticeRowKey = (record: { noticeId: string }) => record.noticeId;
