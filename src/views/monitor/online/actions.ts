import type { OnlineUserRecord } from "./types";

import type { ActionItem } from "~/components/business/Table";

/** 操作回调上下文 */
export interface OnlineActionContext {
  /** 强制下线（确认由 popConfirm 处理） */
  onKick: (record: OnlineUserRecord) => void | Promise<void>;
}

/**
 * 生成在线用户行操作项
 * 保持无状态：副作用由 ctx 注入
 */
export function getOnlineActions(record: OnlineUserRecord, ctx: OnlineActionContext): ActionItem[] {
  return [
    {
      label: "强制下线",
      danger: true,
      popConfirm: {
        title: "强制下线",
        content: `确定要强制用户「${record.username}」下线吗？`,
        confirm: () => ctx.onKick(record),
      },
    },
  ];
}
