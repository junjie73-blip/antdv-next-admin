import type { GanttChangePayload } from '@antdv/common-ui/report';

/**
 * 甘特拖拽变更的批次去重：一次用户拖拽可能被 frappe 拆成多个回调
 * （改期条自身 + 依赖联动的下游条 + 并出的进度手柄回调），旧实现逐个回调整改接口、
 * 逐个弹 message，结果拖一次看到三条提示。
 *
 * 这里把「同一批次内的变更」收敛成一份去重后的提交清单：
 * - 用 `channel:id` 做 key，同一条同一通道只保留最后一次（frappe 拖拽结束会补发同值回调）；
 * - 值完全相同的重复回调直接丢弃；
 * - 进度通道的条目原样保留（供宿主触发重绘），但由调用方决定是否写接口。
 *
 * 纯函数，不碰 DOM / 计时器 / 接口，便于单测穷举回调乱序与重复场景。
 */
export type GanttChangeChannel = 'date' | 'progress';

export interface QueuedGanttChange {
  channel: GanttChangeChannel;
  payload: GanttChangePayload;
}

/**
 * 把一串带通道的回调收敛成去重后的稳定清单（按 key 字典序，保证提交顺序可预期）。
 * `seen` 可选：传入已完成批次的 key，用于跨批次抑制 frappe 的补发回调。
 */
export function dedupeGanttChanges(
  changes: readonly QueuedGanttChange[],
  seen?: ReadonlySet<string>,
): QueuedGanttChange[] {
  const merged = new Map<string, GanttChangePayload>();
  for (const { channel, payload } of changes) {
    const key = `${channel}:${payload.id}`;
    if (seen?.has(key)) continue;
    const prev = merged.get(key);
    if (
      prev &&
      prev.start === payload.start &&
      prev.end === payload.end &&
      prev.progress === payload.progress
    )
      continue;
    merged.set(key, payload);
  }
  return [...merged.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, payload]) => ({
      channel: key.startsWith('progress:') ? 'progress' : 'date',
      payload,
    }));
}

/** 批次里只有进度通道的条目 = 用户只拖了进度手柄（无实质排期改动） */
export function isProgressOnly(changes: readonly QueuedGanttChange[]): boolean {
  return (
    changes.length > 0 && changes.every((item) => item.channel === 'progress')
  );
}
