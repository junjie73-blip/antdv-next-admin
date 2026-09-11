import type { ActionItem } from "@/components/business/Table";
import { markNoticeRead } from "./api";
import { NOTICE_READ_STATUS } from "./constants";
import type { NoticeRecord } from "./types";

/** getActions 上下文（由调用方提供副作用处理） */
export interface NoticeActionContext {
  /** 标记成功回调（由组件刷新表格 / 提示） */
  onSuccess?: (record: NoticeRecord) => void;
  /** 失败回调 */
  onError?: (error: unknown, record: NoticeRecord) => void;
}

/**
 * 生成消息行的操作项
 * 说明：抽离后本函数保持无状态；副作用通过 ctx 回调交给调用方处理
 */
export function getNoticeActions(
  record: NoticeRecord,
  ctx: NoticeActionContext = {},
): ActionItem[] {
  const { onSuccess, onError } = ctx;

  return [
    {
      label: "已读",
      icon: "at-icons:checkmark",
      danger: true,
      disabled: record.isRead === NOTICE_READ_STATUS.READ,
      popConfirm: {
        title: "标记已读",
        confirm: async () => {
          try {
            await markNoticeRead(record.noticeId);
            onSuccess?.(record);
          } catch (e) {
            onError?.(e, record);
          }
        },
      },
    },
  ];
}
