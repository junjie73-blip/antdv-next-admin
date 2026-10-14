import type { BasicColumn } from '../src/types';

import { h } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import {
  convertColumns,
  deepMerge,
  filterVisibleColumns,
  formatCellValue,
  formatCurrency,
  formatDate,
  formatNumber,
  formatPercent,
  generateRowKey,
  getColumnId,
  getColumnValue,
  getTotalColumnWidth,
  isImageList,
  readCellText,
  setColumnValue,
  sortColumns,
  truncateText,
} from '../src/helper';

describe('formatCellValue', () => {
  it('替换模板里的 text / index / 其它字段', () => {
    expect(formatCellValue('{{text}}-{{index}}', 'a', { id: 1 }, 2)).toBe(
      'a-2',
    );
    expect(formatCellValue('{{name}}/{{text}}', 'v', { name: 'n' }, 0)).toBe(
      'n/v',
    );
    // 缺失字段退化成空串，而不是 undefined
    expect(formatCellValue('[{{missing}}]', 'v', {}, 0)).toBe('[]');
  });

  it('支持函数格式，函数可返回 VNode', () => {
    const fn = vi.fn((text: any, record: any) => `${text}#${record.id}`);
    expect(formatCellValue(fn, 'x', { id: 9 }, 0)).toBe('x#9');
    expect(fn).toHaveBeenCalledWith('x', { id: 9 }, 0);
    const vnode = h('b', 'bold');
    expect(formatCellValue(() => vnode, 'x', {}, 0)).toBe(vnode);
  });

  it('空 format 退回文本本体', () => {
    expect(formatCellValue('', 'raw', {}, 0)).toBe('raw');
    expect(formatCellValue('', null, {}, 0)).toBe('');
  });
});

describe('generateRowKey', () => {
  it('字符串 rowKey 取字段，缺失时用行号兜底', () => {
    expect(generateRowKey({ id: 7 }, 'id', 0)).toBe('7');
    expect(generateRowKey({ name: 'a' }, 'id', 3)).toBe('row-3');
  });

  it('函数 rowKey 直接采用返回值', () => {
    expect(generateRowKey({ id: 1 }, (r) => `k-${r.id}`, 0)).toBe('k-1');
  });

  it('默认取 id', () => {
    expect(generateRowKey({ id: 'x' }, undefined, 0)).toBe('x');
  });
});

describe('取数与读写', () => {
  it('readCellText：字符串 dataIndex 是单键名，数组才是路径（与 antd 一致）', () => {
    const record = { 'a.b': 1, a: { b: 2 } };
    expect(readCellText(record, { dataIndex: 'a.b' } as BasicColumn)).toBe(1);
    expect(
      readCellText(record, { dataIndex: ['a', 'b'] } as BasicColumn),
    ).toBe(2);
    expect(readCellText(record, {} as BasicColumn)).toBeUndefined();
  });

  it('getColumnValue 按路径穿透', () => {
    expect(getColumnValue({ a: { b: { c: 3 } } }, ['a', 'b', 'c'])).toBe(3);
    expect(getColumnValue({ a: { b: 1 } }, 'a.b')).toBe(1);
    expect(getColumnValue(undefined as any, 'a')).toBeUndefined();
  });

  it('setColumnValue 写嵌套路径并补齐中间层', () => {
    const record: Record<string, any> = {};
    setColumnValue(record, ['a', 'b'], 5);
    expect(record.a.b).toBe(5);
    setColumnValue(record, 'c.d', 6);
    expect(record.c.d).toBe(6);
  });
});

describe('isImageList', () => {
  it('识别图片数组', () => {
    expect(isImageList(['a.png', 'b.jpg'])).toBe(true);
    expect(isImageList(['https://x/y.webp'])).toBe(true);
  });

  it('非图片 / 空数组 / 非字符串一律 false', () => {
    expect(isImageList([])).toBe(false);
    expect(isImageList(['a.txt'])).toBe(false);
    expect(isImageList([1])).toBe(false);
    expect(isImageList('a.png')).toBe(false);
  });
});

describe('格式化助手', () => {
  it('formatDate 走 dayjs，非法值原样返回', () => {
    expect(formatDate('2026-01-02', 'YYYY-MM-DD')).toBe('2026-01-02');
    expect(formatDate(null)).toBe('');
    expect(formatDate('not-a-date')).toBe('not-a-date');
  });

  it('formatNumber / formatCurrency / formatPercent', () => {
    expect(formatNumber(1234.567, { decimals: 2 })).toBe('1234.57');
    expect(formatNumber(null)).toBe('');
    expect(formatNumber('abc')).toBe('abc');
    expect(formatCurrency(12)).toBe('¥12.00');
    expect(formatPercent(0.5)).toBe('0.50%');
  });

  it('truncateText 只在超长时加后缀', () => {
    expect(truncateText('abc', 5)).toBe('abc');
    expect(truncateText('abcdefg', 3)).toBe('abc...');
  });
});

describe('列工具', () => {
  const cols = [
    { dataIndex: 'a', key: 'a', title: 'A' },
    { dataIndex: 'b', key: 'b', title: 'B', ifShow: false },
    { dataIndex: 'c', key: 'c', title: 'C', ifShow: () => false },
    { dataIndex: 'd', key: 'd', title: 'D', width: 100 },
  ] as BasicColumn[];

  it('filterVisibleColumns 兼容布尔与函数 ifShow', () => {
    expect(filterVisibleColumns(cols).map((c) => c.key)).toEqual(['a', 'd']);
  });

  it('getColumnId：key 优先，数组 dataIndex 拼点号', () => {
    expect(getColumnId({ key: 'k', dataIndex: 'x' } as BasicColumn)).toBe('k');
    expect(getColumnId({ dataIndex: ['a', 'b'] } as BasicColumn)).toBe('a.b');
    expect(getColumnId({ title: '无 id' } as BasicColumn)).toBe('');
  });

  it('sortColumns 按给定顺序重排，未列出的追加在尾部', () => {
    const list = [
      { key: 'a', title: 'A' },
      { key: 'b', title: 'B' },
      { key: 'c', title: 'C' },
    ] as BasicColumn[];
    expect(sortColumns(list, ['c', 'a']).map((c) => c.key)).toEqual([
      'c',
      'a',
      'b',
    ]);
  });

  it('getTotalColumnWidth 支持数字与带单位字符串', () => {
    expect(
      getTotalColumnWidth([
        { width: 100 },
        { width: '50px' },
        {},
      ] as BasicColumn[]),
    ).toBe(150);
  });

  it('deepMerge 不改目标对象', () => {
    const target = { a: { b: 1 }, c: 2 };
    const result = deepMerge(target, { a: { d: 3 } } as any);
    expect(result).toEqual({ a: { b: 1, d: 3 }, c: 2 });
    expect(target).toEqual({ a: { b: 1 }, c: 2 });
  });
});

describe('convertColumns', () => {
  // ColumnDef 是联合类型（Display / Group / Accessor），测试里按实际产出的
  // accessor 形状读取，统一转成本地类型别名。
  interface FlatColumnDef {
    accessorFn?: (row: any) => any;
    cell?: (info: any) => any;
    enableResizing?: boolean;
    enableSorting?: boolean;
    filterFn?: (row: any, columnId: string, value: any) => boolean;
    header?: (ctx: any) => any;
    meta?: { basicColumn: BasicColumn };
    sortFn?: (rowA: any, rowB: any, columnId: string) => number;
  }

  const first = (columns: BasicColumn[]): FlatColumnDef =>
    convertColumns(columns)[0] as unknown as FlatColumnDef;

  it('accessorFn 复刻 antd 的 dataIndex 取数语义', () => {
    const def = first([{ dataIndex: 'a.b', key: 'ab', title: 'AB' }]);
    expect(def.accessorFn!({ 'a.b': 1, a: { b: 2 } })).toBe(1);
  });

  it('隐藏列不进入行模型', () => {
    expect(
      convertColumns([
        { dataIndex: 'a', key: 'a' },
        { dataIndex: 'b', ifShow: false, key: 'b' },
      ] as BasicColumn[]),
    ).toHaveLength(1);
  });

  it('sorter 函数 → 本地比较 row.original；sorter:true → 不动数据', () => {
    const def = first([
      { dataIndex: 'n', key: 'n', sorter: (a: any, b: any) => a.n - b.n },
    ] as BasicColumn[]);
    const rows = [{ original: { n: 2 } }, { original: { n: 1 } }];
    expect(def.sortFn!(rows[0], rows[1], 'n')).toBe(1);

    const serverSort = first([
      { dataIndex: 'n', key: 'n', sorter: true },
    ] as BasicColumn[]);
    expect(serverSort.sortFn!(rows[0], rows[1], 'n')).toBe(0);
    expect(serverSort.enableSorting).toBe(true);
  });

  it('sorter 对象形式取 compare', () => {
    const def = first([
      {
        dataIndex: 'n',
        key: 'n',
        sorter: { compare: (a: any, b: any) => b.n - a.n },
      },
    ] as BasicColumn[]);
    expect(def.sortFn!({ original: { n: 1 } }, { original: { n: 2 } }, 'n')).toBe(
      1,
    );
  });

  it('enableSorting / enableResizing 跟着声明走', () => {
    const def = first([
      { dataIndex: 'n', key: 'n', resizable: true },
    ] as BasicColumn[]);
    expect(def.enableSorting).toBe(false);
    expect(def.enableResizing).toBe(true);
  });

  it('只有声明了 onFilter 的列才真正过滤，且多值之间是"或"', () => {
    const withFilter = first([
      {
        dataIndex: 'name',
        key: 'name',
        onFilter: (value: any, row: any) => row.name === value,
      },
    ] as BasicColumn[]);
    const row = { original: { name: 'bob' } };
    expect(withFilter.filterFn!(row, 'name', ['bob', 'amy'])).toBe(true);
    expect(withFilter.filterFn!(row, 'name', ['amy'])).toBe(false);
    // 空筛选值不过滤
    expect(withFilter.filterFn!(row, 'name', [])).toBe(true);
    expect(withFilter.filterFn!(row, 'name', undefined)).toBe(true);

    const displayOnly = first([
      {
        dataIndex: 'st',
        filters: [{ text: 'A', value: 'a' }],
        key: 'st',
      },
    ] as BasicColumn[]);
    expect(displayOnly.filterFn!(row, 'st', ['a'])).toBe(true);
  });

  it('meta.basicColumn 保留原始列，供 BasicTable 手工渲染', () => {
    const col = { dataIndex: 'a', key: 'a', title: 'A' } as BasicColumn;
    const def = first([col]);
    expect(def.meta!.basicColumn).toBe(col);
    expect(def.header!({})).toBe('A');
  });
});

