import type { BasicColumn } from "@/components/business/Table";
import dayjs from "dayjs";
import type { OnlineUserRecord } from "./types";
import { formatSessionTtl } from "./utils";

/** 在线用户表格列 */
export const onlineColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }: any) => index + 1,
  },
  { title: "用户名", dataIndex: "username", key: "username", width: 140 },
  { title: "真实姓名", dataIndex: "realName", key: "realName", width: 140 },
  { title: "登录IP", dataIndex: "ip", key: "ip", width: 160 },
  {
    title: "登录时间",
    dataIndex: "loginTime",
    key: "loginTime",
    width: 180,
    customRender: ({ record }: any) =>
      record.loginTime ? dayjs(record.loginTime).format("YYYY-MM-DD HH:mm:ss") : "-",
  },
  {
    title: "会话剩余",
    dataIndex: "ttl",
    key: "ttl",
    width: 120,
    align: "center",
    customRender: ({ record }: any) => formatSessionTtl(record.ttl),
  },
];

/** 操作列配置 */
export const onlineActionColumn = {
  width: 140,
  title: "操作",
  fixed: "right" as const,
};

/** 滚动配置 */
export const onlineScroll = { x: 1000 } as const;

/** 行 key 提取 */
export const onlineRowKey = (record: OnlineUserRecord) => record.userId;
