/** 消息记录 */
export interface NoticeRecord {
  noticeId: string;
  noticeType: number;
  title: string;
  content: string;
  /** 0 未读 / 1 已读 */
  isRead: number;
  publishTime: string;
}

/** 消息 Tab */
export type NoticeTabKey = "all" | "unread" | "read";

/** 表格查询参数 */
export interface NoticeQueryParams {
  pageNum?: number;
  pageSize?: number;
  isRead?: number;
}
