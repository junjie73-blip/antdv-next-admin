import { Tag } from "antdv-next";
import { h } from "vue";

import type { BasicColumn } from "~/components/business/Table/types";

/** 生成表列表的列定义 */
export function getTableColumns(): BasicColumn[] {
  return [
    { title: "表名", dataIndex: "tableName", key: "tableName", width: 220 },
    {
      title: "表描述",
      dataIndex: "tableComment",
      key: "tableComment",
      ellipsis: true,
    },
    { title: "实体类", dataIndex: "className", key: "className", width: 160 },
    {
      title: "模板",
      dataIndex: "tplCategory",
      key: "tplCategory",
      width: 110,
      customRender: ({ text }: { text: string }) =>
        h(Tag, { color: text === "tree" ? "purple" : "blue" }, () =>
          text === "tree" ? "树形表" : "单表",
        ),
    },
    {
      title: "状态",
      dataIndex: "tableStatus",
      key: "tableStatus",
      width: 100,
      customRender: ({ text }: { text: string }) =>
        h(Tag, { color: text === "created" ? "green" : "orange" }, () =>
          text === "created" ? "已建表" : "待建表",
        ),
    },
    { title: "创建时间", dataIndex: "createdAt", key: "createdAt", width: 180 },
  ];
}
