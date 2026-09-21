import { formatSize } from "./utils";

import type { FileRecord } from "./types";

import type { BasicColumn } from "~/components/business/Table";

/** 文件表格列 */
export const fileColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    dataIndex: "fileId",
    align: "center",
    customRender: ({ index }) => index + 1,
  },
  { title: "文件名", dataIndex: "filename", key: "filename", width: 260, ellipsis: true },
  {
    title: "大小",
    dataIndex: "size",
    key: "size",
    width: 110,
    align: "center",
    customRender: ({ record }: any) => formatSize(record.size),
  },
  {
    title: "文件路径",
    dataIndex: "url",
    key: "url",
    width: 300,
    ellipsis: true,
  },
  { title: "MIME 类型", dataIndex: "mimeType", key: "mimeType", width: 180, ellipsis: true },
  { title: "上传者", dataIndex: "uploader", key: "uploader", width: 120, align: "center" },
  { title: "上传时间", dataIndex: "createdAt", key: "createdAt", width: 170, align: "center" },
];

/** 操作列配置 */
export const fileActionColumn = {
  width: 250,
  title: "操作",
  fixed: "right" as const,
};

/** 分页配置 */
export const filePagination = {
  showSizeChanger: true,
  pageSizeOptions: ["10", "20", "50"],
};

/** 滚动配置 */
export const fileScroll = { x: 800 } as const;

/** 行 key 提取 */
export const fileRowKey = (record: FileRecord) => record.fileId;
