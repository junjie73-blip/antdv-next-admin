/** 定时任务记录 */
export interface JobRecord {
  jobId: string;
  jobName: string;
  jobGroup: string;
  invokeTarget: string;
  cronExpression: string;
  /** '0'-停用 '1'-启用 */
  status: string;
  remark?: string;
}

/** 执行日志记录 */
export interface JobLogRecord {
  logId: string;
  jobName: string;
  invokeTarget: string;
  /** '0'-失败 '1'-成功 */
  status: string;
  jobMessage: string;
  createdAt: string;
}

/** 任务状态 */
export type JobStatus = "0" | "1";

/** Tab 类型 */
export type JobTabKey = "job" | "log";
