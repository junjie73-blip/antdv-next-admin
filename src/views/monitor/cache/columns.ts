import type { BasicColumn } from "@/components/business/Table";
import { formatTtl } from "./utils";

/** 缓存 Key 列表列定义 */
export const cacheColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }: any) => index + 1,
  },
  { title: "Key", dataIndex: "key", key: "key", ellipsis: true },
  { title: "类型", dataIndex: "type", key: "type", width: 100, align: "center" },
  {
    title: "TTL",
    dataIndex: "ttl",
    key: "ttl",
    width: 120,
    align: "center",
    customRender: ({ record }: any) => formatTtl(record.ttl),
  },
];

/** 操作列配置 */
export const cacheActionColumn = {
  width: 100,
  title: "操作",
  fixed: "right" as const,
};
