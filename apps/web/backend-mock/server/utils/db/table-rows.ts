/**
 * 表格演示页的内置数据（init data）。
 *
 * 旧实现每次请求现造 `pageSize` 行，刷新即变、total 恒为 100 却从不分页。
 * 现在改为一次性写入真实存储的 100 条固定记录，接口按 pageNum/pageSize
 * 做真实分页查询，`total` 来自实际行数 —— 字段与类型保持完全一致。
 */

import { builtin } from '../builtin-data';
import { defineCollection } from './sqlite';

export interface TableDemoRow {
  id: string;
  name: string;
  age: number;
  address: string;
  email: string;
  phone: string;
  status: 'error' | 'processing' | 'success';
  createdAt: string;
}

const STATUSES: TableDemoRow['status'][] = ['success', 'processing', 'error'];

/** 确定性初始数据：100 行，取值全部来自内置常量表 */
function initialRows(): TableDemoRow[] {
  return Array.from({ length: 100 }, (_, index) => ({
    id: `row-${String(index + 1).padStart(3, '0')}-${builtin.string.uuid().slice(0, 8)}`,
    name: builtin.person.fullName(),
    age: 18 + (index % 43),
    address: builtin.location.streetAddress(),
    email: builtin.internet.email(),
    phone: builtin.phone.number(),
    status: STATUSES[index % STATUSES.length]!,
    createdAt: new Date(
      Date.parse('2026-11-01T00:00:00.000Z') - index * 86_400_000,
    ).toISOString(),
  }));
}

export const TABLE_DEMO_DB: TableDemoRow[] = defineCollection<TableDemoRow>({
  seed: initialRows,
  table: 'tb_table_demo',
});
