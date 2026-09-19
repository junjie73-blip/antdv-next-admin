import { del, get, put } from "~/api/request";

export type ChannelType = "in_app" | "email" | "sms" | "webhook";

export interface NoticeChannel {
  channelType: ChannelType;
  enabled: 0 | 1;
  config?: Record<string, unknown>;
  remark?: string;
}

/** 渠道列表 */
export function getNoticeChannels() {
  return get<NoticeChannel[]>("/notice-channel/list");
}

/** 新增 / 更新渠道配置 */
export function upsertNoticeChannel(data: NoticeChannel) {
  return put<void>("/notice-channel", data as any);
}

/** 删除渠道配置 */
export function deleteNoticeChannel(type: ChannelType) {
  return del<void>(`/notice-channel/${type}`);
}
export const CHANNEL_LABEL: Record<ChannelType, string> = {
  in_app: "站内信",
  email: "邮件",
  sms: "短信",
  webhook: "Webhook",
};
