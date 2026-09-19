import dayjs from "dayjs";

import type { IpRuleRecord } from "./types";

import type { BasicColumn } from "~/components/business/Table";

/** IP 规则表格列 */
export const ipRuleColumns: BasicColumn[] = [
  {
    title: "序号",
    key: "index",
    width: 60,
    align: "center",
    customRender: ({ index }: any) => index + 1,
  },
  { title: "IP / CIDR", dataIndex: "ipPattern", key: "ipPattern", width: 200 },
  { title: "状态", key: "status", width: 80, align: "center" },
  { title: "备注", dataIndex: "remark", key: "remark", ellipsis: true },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 170,
    customRender: ({ record }: any) => dayjs(record.createdAt).format("YYYY-MM-DD HH:mm:ss"),
  },
];

/** 操作列配置 */
export const ipRuleActionColumn = {
  width: 160,
  title: "操作",
  fixed: "right" as const,
};

/** 滚动配置 */
export const ipRuleScroll = { x: 800 } as const;

/** 行 key 提取 */
export const ipRuleRowKey = (record: IpRuleRecord) => record.ruleId;
