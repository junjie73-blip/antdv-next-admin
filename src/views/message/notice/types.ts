/** 通知记录 */
export interface NoticeRecord {
  noticeId: string;
  title: string;
  content: string;
  /** 1-通知 2-公告 3-提醒 */
  noticeType: number;
  /** '0'-草稿 '1'-发布 */
  status: string;
  publishTime?: string | null;
  createdAt: string;
  targetUserIds?: string[];
  /** '0'-未发送 '1'-已发送 */
  sendStatus: string;
  sendTime?: string | null;
}

/** 用户选项 */
export interface UserOption {
  label: string;
  value: string;
}

/** 通知保存 payload */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface NoticeSavePayload extends Omit<NoticeRecord, "noticeId" | "createdAt"> {}

/** 通知类型 */
export type NoticeType = 1 | 2 | 3;

/** 通知状态 */
export type NoticeStatus = "0" | "1";
