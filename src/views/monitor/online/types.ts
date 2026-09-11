/** 在线用户记录 */
export interface OnlineUserRecord {
  userId: string;
  username: string;
  realName?: string;
  ip: string;
  loginTime: string;
  /** 会话剩余秒数，负数表示永久 */
  ttl: number;
}
