import type { GanttChangePayload } from '@antdv/common-ui/report';

import type { QueuedGanttChange } from '../change-batch';

import { describe, expect, it } from 'vitest';

import { dedupeGanttChanges, isProgressOnly } from '../change-batch';

function change(
  id: string,
  start: string,
  end: string,
  progress = 50,
): GanttChangePayload {
  return { end, id, name: id, progress, start };
}

function date(id: string, start: string, end: string): QueuedGanttChange {
  return { channel: 'date', payload: change(id, start, end) };
}

function progress(id: string, value: number): QueuedGanttChange {
  return {
    channel: 'progress',
    payload: change(id, '2026-01-01', '2026-01-02', value),
  };
}

describe('甘特拖拽批次去重', () => {
  it('一次拖阶段条触发的多个回调收敛成单条提交，不再冒三条 message', () => {
    // frappe 一次拖拽：阶段改期 + 依赖联动任务改期 + 并出的进度手柄回调 + 结束补发
    const raw: QueuedGanttChange[] = [
      date('p1', '2026-01-01', '2026-01-10'),
      date('t3', '2026-01-02', '2026-01-09'),
      progress('p1', 50),
      date('p1', '2026-01-01', '2026-01-10'), // 重复补发，同值
    ];
    const batch = dedupeGanttChanges(raw);
    expect(batch).toHaveLength(3);
    expect(batch.map((item) => `${item.channel}:${item.payload.id}`)).toEqual([
      'date:p1',
      'date:t3',
      'progress:p1',
    ]);
  });

  it('同一条同一通道只保留最后一次的值（拖拽中的中间态被覆盖）', () => {
    const batch = dedupeGanttChanges([
      date('p1', '2026-01-01', '2026-01-05'),
      date('p1', '2026-01-01', '2026-01-10'),
    ]);
    expect(batch).toHaveLength(1);
    expect(batch[0]!.payload.end).toBe('2026-01-10');
  });

  it('date 与 progress 通道互不覆盖（同一 id 各留一条）', () => {
    const batch = dedupeGanttChanges([
      date('t3', '2026-01-02', '2026-01-09'),
      progress('t3', 80),
      progress('t3', 80),
    ]);
    expect(batch.map((item) => item.channel)).toEqual(['date', 'progress']);
  });

  it('传入 seen 可跨批次抑制 frappe 结束时的补发回调', () => {
    const seen = new Set(['date:p1']);
    const batch = dedupeGanttChanges(
      [
        date('p1', '2026-01-01', '2026-01-10'),
        date('t3', '2026-01-02', '2026-01-09'),
      ],
      seen,
    );
    expect(batch.map((item) => item.payload.id)).toEqual(['t3']);
  });

  it('isProgressOnly 区分「只拖进度手柄」和「拖了排期」', () => {
    expect(isProgressOnly([progress('p1', 50), progress('t3', 80)])).toBe(true);
    expect(
      isProgressOnly([
        progress('p1', 50),
        date('t3', '2026-01-01', '2026-01-09'),
      ]),
    ).toBe(false);
    expect(isProgressOnly([])).toBe(false);
  });

  it('空批次与全重复批次返回空数组', () => {
    expect(dedupeGanttChanges([])).toEqual([]);
    const one = date('p1', '2026-01-01', '2026-01-10');
    expect(dedupeGanttChanges([one, one, { ...one }])).toHaveLength(1);
  });
});
