import type { BasicColumn } from "~/components/business/Table";

/** 字典项表格列 */
export const dictItemColumns: BasicColumn[] = [
  {
    title: "字典标签",
    dataIndex: "dictLabel",
    key: "dictLabel",
    width: 120,
    align: "center",
  },
  {
    title: "字典编码",
    dataIndex: "dictValue",
    key: "dictValue",
    width: 120,
    align: "center",
  },
  {
    title: "排序",
    dataIndex: "sortOrder",
    key: "sortOrder",
    width: 80,
    align: "center",
  },
  {
    title: "状态",
    dataIndex: "status",
    key: "status",
    width: 80,
    align: "center",
  },
  {
    title: "备注",
    dataIndex: "remark",
    key: "remark",
    width: 200,
    align: "center",
  },
  {
    title: "创建时间",
    dataIndex: "createdAt",
    key: "createdAt",
    width: 180,
    align: "center",
  },
];

/** 字典项操作列配置 */
export const dictItemActionColumn = {
  width: 180,
  title: "操作",
  fixed: "right" as const,
};

/** 字典项分页配置 */
export const dictItemPagination = {
  showSizeChanger: true,
  pageSizeOptions: ["10", "20", "50"],
};

export const dictTypeRowSelection = { type: "checkbox" as const };
export const dictTypeRowKey = (record: { dictTypeId: string }) => record.dictTypeId;
