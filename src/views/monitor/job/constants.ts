import type { JobStatus } from "./types";

/** 任务状态映射 */
export const JOB_STATUS_MAP: Record<string, { label: string; color: string }> = {
  "0": { label: "停用", color: "default" },
  "1": { label: "启用", color: "green" },
};

/** 日志状态映射 */
export const LOG_STATUS_MAP: Record<string, { label: string; color: string }> = {
  "0": { label: "失败", color: "red" },
  "1": { label: "成功", color: "green" },
};

/** 任务状态表单选项 */
export const JOB_STATUS_OPTIONS = [
  { label: "启用", value: "1" as JobStatus },
  { label: "停用", value: "0" as JobStatus },
];

/** 执行目标选项 */
export const INVOKE_TARGET_OPTIONS = [
  { label: "发布到期通知 (notice:publish)", value: "notice:publish" },
  { label: "清理过期日志 (log:clean)", value: "log:clean" },
  { label: "待办逾期提醒 (todo:overdue-notify)", value: "todo:overdue-notify" },
];

/** 默认分组 */
export const DEFAULT_JOB_GROUP = "DEFAULT";

/** 默认执行目标 */
export const DEFAULT_INVOKE_TARGET = "notice:publish";
