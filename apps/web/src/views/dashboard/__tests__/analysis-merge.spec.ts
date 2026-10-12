import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 分析面板合并「工作台」后要守住的三条契约。
 *
 * 之所以打在源码而不是挂载组件：分析页有 7 张 echarts + ResizeObserver + 3.5s
 * 轮询，jsdom 里挂载它得到的是一堆 stub，验证不了真实行为；而这三条恰恰是
 * "静态数据写错就永远坏"的类型，源码断言最直接。
 *
 * 1. 快捷操作必须落在真实存在的业务路由上 —— 原工作台的四个格子是
 *    `cursor-pointer` 却不可点的 div（光标在撒谎），合并时不能把谎言搬过来；
 *    菜单种子（`apps/backend-mock/server/api/menus.get.ts`）同时是路由表和权限来源，
 *    所以拿它的 `path` 当唯一真相；
 * 2. `menuName` 是侧栏/标签页/面包屑的文案来源，删页面必须连种子一起删，
 *    否则留下一条点不动的菜单；
 * 3. 两边都有「今日访问」，同页重复等于自打自。
 */

const ANALYSIS_SOURCE = readFileSync(
  resolve(process.cwd(), 'src/views/dashboard/analysis/index.vue'),
  'utf8',
);

const MENU_SEED_SOURCE = readFileSync(
  resolve(process.cwd(), '../../apps/backend-mock/server/api/menus.get.ts'),
  'utf8',
);

/** 菜单种子里的绝对路径 —— 前端路由表和 allowedPaths 都由它生成 */
const menuPaths = new Set(
  [...MENU_SEED_SOURCE.matchAll(/path:\s*'(\/[^']*)'/gu)].map((m) => m[1]!),
);

/** 分析页 quickActions 里声明的跳转目标 */
const quickActionPaths = [
  ...ANALYSIS_SOURCE.matchAll(/path:\s*'(\/[^']*)'/gu),
].map((m) => m[1]!);

describe('分析面板（合并工作台后）', () => {
  it('快捷操作的每个跳转目标都是菜单里真实存在的页面', () => {
    // 先确认抓到了东西，否则空数组会让下面每条断言空跑通过
    expect(quickActionPaths.length).toBeGreaterThanOrEqual(4);
    for (const path of quickActionPaths) {
      expect(menuPaths.has(path), `${path} 不在菜单种子里`).toBe(true);
    }
  });

  it('工作台已从菜单种子和分析页一起下线', () => {
    expect(MENU_SEED_SOURCE).not.toContain('工作台');
    expect(MENU_SEED_SOURCE).not.toContain('Workbench');
    expect(menuPaths.has('/dashboard/workbench')).toBe(false);
    expect(ANALYSIS_SOURCE).not.toContain('/dashboard/workbench');
  });

  it('kPI 标题不重复（两边都有的「今日访问」只留一条）', () => {
    const titles = [
      ...ANALYSIS_SOURCE.matchAll(/title:\s*'([^']*?)',\s*\n\s*value:/gu),
    ].map((m) => m[1]!);
    expect(titles.length).toBeGreaterThanOrEqual(6);
    expect(new Set(titles).size).toBe(titles.length);
    expect(titles.filter((t) => t === '今日访问')).toHaveLength(1);
  });

  it('合并进来的两块内容用真链接，而不是会骗人的 cursor-pointer', () => {
    expect(ANALYSIS_SOURCE).toContain(
      "import { RouterLink } from 'vue-router'",
    );
    // 快捷操作整段就是那个 v-for 的 RouterLink，直接按元素取，别用 indexOf 截字符串
    const linkBlock = ANALYSIS_SOURCE.match(
      /<RouterLink[\s\S]*?<\/RouterLink>/u,
    )?.[0];
    expect(linkBlock, '模板里没有 RouterLink 快捷操作').toBeTruthy();
    expect(linkBlock).toContain(':to="action.path"');
    expect(linkBlock).not.toContain('cursor-pointer');
  });

  it('页面根容器自己不加 padding（内边距归布局的滚动容器管）', () => {
    const template = ANALYSIS_SOURCE.slice(
      ANALYSIS_SOURCE.indexOf('<template>'),
    );
    const rootTag =
      template.match(/^<template>\s*\n?\s*<div[^>]*>/u)?.[0] ?? '';
    expect(rootTag).not.toMatch(/\bp-[\w-]*/u);
  });
});
