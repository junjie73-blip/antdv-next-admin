/**
 * 统一 id / 时间工具。
 *
 * `genId()` 返回 cuid2：时间序 + 随机串，跨重启唯一、不可遍历，
 * 用于物理主键 `_pk` 与关联表主键。业务侧对外 id 仍沿用 number 契约，
 * 由 `nextBizId()` 在库内取 max+1（不再是模块级自增变量，重启不会撞号）。
 */

import { createId } from '@paralleldrive/cuid2';

export function genId(): string {
  return createId();
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** 业务 id 归一化为可比较的字符串（number / string / cuid 都吃） */
export function idKey(id: unknown): string {
  return id === undefined || id === null ? '' : String(id);
}
