import type { TemplateColumn } from '../src/template';

import { describe, expect, it, vi } from 'vitest';

import { generateTemplate } from '../src/template';

const writes = vi.hoisted(() => [] as { filename: string; workbook: unknown }[]);
const sheets = vi.hoisted(() => [] as { rows: unknown[][]; sheetName: string }[]);

/**
 * xlsx 只做「组装 + 写盘」，真正要验证的是我们喂给它的数据结构，
 * 因此这里整体打桩，避免测试依赖文件系统与浏览器下载。
 */
vi.mock('xlsx', () => ({
  utils: {
    aoa_to_sheet: (rows: unknown[][]) => {
      sheets.push({ rows, sheetName: '' });
      return { __rows: rows } as Record<string, unknown>;
    },
    book_new: () => ({ SheetNames: [], Sheets: {} }),
    book_append_sheet: (
      wb: { SheetNames: string[]; Sheets: Record<string, unknown> },
      ws: Record<string, unknown>,
      name: string,
    ) => {
      wb.SheetNames.push(name);
      wb.Sheets[name] = ws;
      const last = sheets.at(-1);
      if (last) last.sheetName = name;
    },
  },
  writeFile: (workbook: unknown, filename: string) => {
    writes.push({ filename, workbook });
  },
}));

describe('generateTemplate', () => {
  it('第一行是表头，第二行是示例，缺省示例为空串', () => {
    const columns: TemplateColumn[] = [
      { header: '用户名*', example: 'zhangsan', width: 16, key: 'username' },
      { header: '邮箱', key: 'email' },
    ];
    generateTemplate('用户导入模板', columns);

    expect(sheets).toHaveLength(1);
    expect(sheets[0]!.rows).toEqual([
      ['用户名*', '邮箱'],
      ['zhangsan', ''],
    ]);
  });

  it('文件名自动补 .xlsx，工作表名可自定义', () => {
    generateTemplate('A 表', [{ header: 'x' }], '数据');
    expect(writes.at(-1)!.filename).toBe('A 表.xlsx');
    expect(sheets.at(-1)!.sheetName).toBe('数据');

    generateTemplate('B 表', [{ header: 'x' }]);
    expect(sheets.at(-1)!.sheetName).toBe('Sheet1');
  });

  it('列宽缺省为 18 字符', () => {
    generateTemplate('C 表', [
      { header: 'a', width: 8 },
      { header: 'b' },
    ]);
    const wb = writes.at(-1)!.workbook as {
      Sheets: Record<string, { '!cols'?: { wch: number }[] }>;
    };
    expect(wb.Sheets.Sheet1!['!cols']).toEqual([{ wch: 8 }, { wch: 18 }]);
  });

  it('空列定义不抛异常，生成两行空表', () => {
    expect(() => generateTemplate('D 表', [])).not.toThrow();
    expect(sheets.at(-1)!.rows).toEqual([[], []]);
  });
});
