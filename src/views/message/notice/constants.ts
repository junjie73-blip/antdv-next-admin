import type { NoticeStatus, NoticeType } from "./types";

/** 通知类型映射 */
export const NOTICE_TYPE_MAP: Record<number, { label: string; color: string }> = {
  1: { label: "通知", color: "blue" },
  2: { label: "公告", color: "green" },
  3: { label: "提醒", color: "orange" },
};

/** 通知状态映射 */
export const NOTICE_STATUS_MAP: Record<string, { label: string; color: string }> = {
  "0": { label: "草稿", color: "gray" },
  "1": { label: "已发布", color: "green" },
};

/** 通知类型下拉选项 */
export const NOTICE_TYPE_OPTIONS = [
  { label: "通知", value: 1 as NoticeType },
  { label: "公告", value: 2 as NoticeType },
  { label: "提醒", value: 3 as NoticeType },
];

/** 通知状态下拉选项 */
export const NOTICE_STATUS_OPTIONS = [
  { label: "草稿", value: "0" as NoticeStatus },
  { label: "已发布", value: "1" as NoticeStatus },
];

/** 弹窗表单状态（发布用） */
export const NOTICE_PUBLISH_OPTIONS = [
  { label: "草稿", value: "0" as NoticeStatus },
  { label: "发布", value: "1" as NoticeStatus },
];

export const NOTICE_PRIORITY_OPTIONS = [
  { label: "普通", value: 0 },
  { label: "重要", value: 1 },
  { label: "紧急", value: 2 },
];

export const NOTICE_IS_TOP_OPTIONS = [
  { label: "否", value: 0 },
  { label: "是", value: 1 },
];
// 映射关系
export const NOTICE_PRIORITY_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "普通", color: "blue" },
  1: { label: "重要", color: "orange" },
  2: { label: "紧急", color: "red" },
};
export const NOTICE_IS_TOP_MAP: Record<number, { label: string; color: string }> = {
  0: { label: "否", color: "gray" },
  1: { label: "是", color: "green" },
};
