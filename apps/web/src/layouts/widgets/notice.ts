/**
 * 顶栏通知铃铛的数据层（纯函数）。
 *
 * 单列成模块的原因不是"整洁"，而是这套字段真的踩过坑：
 * 1. **信封少解一层**。`~/api/system` 有的调用返回 `{ code, data: { list } }`，
 *    有的（走了拦截器）直接给 `{ list }`。通知管理页用 `res?.data ?? res` 兜，
 *    铃铛以前抄的是另一套写法，于是列表永远空。
 * 2. **字段名不一致**。后端契约是 `id / status / sendTime / noticeType`，
 *    而早期铃铛按 `noticeId / isRead / createdAt` 读（那是另一套工作流模型），
 *    结果 `isRead` 恒为 undefined，未读角标算不出来。
 * 3. `status` 在通知域里就是"已读/未读"（0 未读、1 已读），
 *    和「发布状态」无关，也和用户管理里的 `status`（1 正常 / 0 禁用）方向相反。
 *
 * 所以映射只在这里做一次，组件只做展示，未读判定也只有一个出口。
 */

export interface BellNotice {
  content: string;
  id: number;
  /** 0 普通 / 1 重要 / 2 紧急 */
  priority: 0 | 1 | 2;
  /** true = 已读 */
  read: boolean;
  sender: string;
  /** 原始时间串，展示时再格式化 */
  sendTime: string;
  /** 1 通知 / 2 公告 / 3 提醒 */
  type: number;
  title: string;
}

export const NOTICE_TYPE_LABELS: Record<number, string> = {
  1: '通知',
  2: '公告',
  3: '提醒',
};

function toId(value: unknown): number {
  const id = Number(value);
  return Number.isNaN(id) ? -1 : id;
}

/** mock 与真实后端都可能出现 `noticeType` / `type` 两种写法 */
function toType(raw: Record<string, unknown>): number {
  return Number(raw.type ?? raw.noticeType ?? 1) || 1;
}

function toPriority(raw: Record<string, unknown>): 0 | 1 | 2 {
  const priority = Number(raw.priority ?? 0);
  return priority === 1 || priority === 2 ? priority : 0;
}

export function mapNotice(raw: Record<string, unknown>): BellNotice {
  return {
    content: String(raw.content ?? ''),
    id: toId(raw.id ?? raw.noticeId),
    priority: toPriority(raw),
    // `isRead`（布尔）与 `status`（0/1）都接受：前者是历史契约，后者是现在的 mock 契约
    read: raw.status === undefined ? Boolean(raw.isRead) : Number(raw.status) === 1,
    sender: String(raw.sender ?? ''),
    sendTime: String(raw.sendTime ?? raw.publishTime ?? raw.createdAt ?? ''),
    title: String(raw.title ?? '(无标题)'),
    type: toType(raw),
  };
}

/**
 * 兼容三种响应形态：信封 `{ code, data: { list } }`、裸 `{ list }`、直接数组。
 * 取不到列表时返回空数组而不是抛错——铃铛是顶栏常驻控件，接口挂了也不该把布局带崩。
 */
export function mapNoticeList(payload: unknown): BellNotice[] {
  const unwrapped =
    payload && typeof payload === 'object' && 'data' in payload
      ? (payload as { data: unknown }).data
      : payload;
  const source =
    unwrapped && typeof unwrapped === 'object' && 'list' in unwrapped
      ? (unwrapped as { list: unknown }).list
      : unwrapped;

  if (!Array.isArray(source)) return [];
  return source
    .filter((item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === 'object',
    )
    .map((item) => mapNotice(item));
}

export function countUnread(list: BellNotice[]): number {
  return list.filter((item) => !item.read).length;
}
