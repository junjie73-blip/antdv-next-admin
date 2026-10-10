import { describe, expect, it } from 'vitest';

import {
  countUnread,
  mapNotice,
  mapNoticeList,
  NOTICE_TYPE_LABELS,
} from '../widgets/notice';

/**
 * 顶栏铃铛的数据层测试。
 *
 * 这个模块存在的全部理由就是"以前它不存在"：组件直接按另一套字段名读响应，
 * 于是列表恒空、角标恒为 0，而接口一直是 200。这里把三类契约钉住：
 * 信封形态、已读语义、字段别名。
 */

describe('mapNoticeList：响应形态', () => {
  const raw = { id: 1, title: '系统升级维护通知', status: 0, sendTime: 'x' };

  it('信封 { code, data: { list } }', () => {
    expect(mapNoticeList({ code: 200, data: { list: [raw] } })).toHaveLength(1);
  });

  it('已解包的 { list }', () => {
    expect(mapNoticeList({ list: [raw] })).toHaveLength(1);
  });

  it('直接给数组', () => {
    expect(mapNoticeList([raw])).toHaveLength(1);
  });

  it('信封里没有 list 字段时给空数组，而不是抛错（顶栏不能因为接口形状变了就崩）', () => {
    expect(mapNoticeList({ code: 200, data: null })).toEqual([]);
    expect(mapNoticeList({ code: 200, message: 'ok' })).toEqual([]);
  });

  it('脏数据不进列表：null / 非数组 / 数组里的非对象项', () => {
    expect(mapNoticeList(null)).toEqual([]);
    expect(mapNoticeList('nope')).toEqual([]);
    expect(mapNoticeList({ list: 'nope' })).toEqual([]);
    expect(mapNoticeList([null, 1, 'x', raw])).toHaveLength(1);
  });
});

describe('mapNotice：字段别名与已读语义', () => {
  it('status 0 是未读、1 是已读（与通知管理页同一套语义）', () => {
    expect(mapNotice({ id: 1, status: 0 }).read).toBe(false);
    expect(mapNotice({ id: 1, status: 1 }).read).toBe(true);
    expect(mapNotice({ id: 1, status: '1' }).read).toBe(true);
  });

  it('没有 status 时退回布尔 isRead（历史契约）', () => {
    expect(mapNotice({ id: 1, isRead: true }).read).toBe(true);
    expect(mapNotice({ id: 1, isRead: false }).read).toBe(false);
    // 两个都没有才算未读
    expect(mapNotice({ id: 1 }).read).toBe(false);
  });

  it('id 支持字符串与 noticeId 别名，取不到给 -1', () => {
    expect(mapNotice({ id: '12' }).id).toBe(12);
    expect(mapNotice({ noticeId: 7 }).id).toBe(7);
    expect(mapNotice({}).id).toBe(-1);
  });

  it('类型取 type，退回 noticeType，再退回 1（通知）', () => {
    expect(mapNotice({ type: 2 }).type).toBe(2);
    expect(mapNotice({ noticeType: 3 }).type).toBe(3);
    expect(mapNotice({}).type).toBe(1);
    expect(NOTICE_TYPE_LABELS[mapNotice({ type: 9 }).type]).toBeUndefined();
  });

  it('优先级只接受 0 / 1 / 2，其余归为普通', () => {
    expect(mapNotice({ priority: 2 }).priority).toBe(2);
    for (const value of [-1, 3, Number.NaN, 'x', undefined]) {
      expect(mapNotice({ priority: value as unknown }).priority).toBe(0);
    }
  });

  it('时间按 sendTime → publishTime → createdAt 取值，缺省为空串', () => {
    expect(mapNotice({ sendTime: 'a' }).sendTime).toBe('a');
    expect(mapNotice({ publishTime: 'b' }).sendTime).toBe('b');
    expect(mapNotice({ createdAt: 'c' }).sendTime).toBe('c');
    expect(mapNotice({}).sendTime).toBe('');
  });

  it('标题缺省给占位，内容缺省给空串', () => {
    expect(mapNotice({}).title).toBe('(无标题)');
    expect(mapNotice({}).content).toBe('');
  });
});

describe('countUnread', () => {
  it('只数未读，列表为空给 0', () => {
    expect(countUnread([])).toBe(0);
    expect(
      countUnread([
        mapNotice({ id: 1, status: 0 }),
        mapNotice({ id: 2, status: 1 }),
        mapNotice({ id: 3, status: 0 }),
      ]),
    ).toBe(2);
  });

  it('全部标记已读后角标归零（乐观更新的落点）', () => {
    const list = [mapNotice({ id: 1, status: 0 })];
    list[0]!.read = true;
    expect(countUnread(list)).toBe(0);
  });
});
