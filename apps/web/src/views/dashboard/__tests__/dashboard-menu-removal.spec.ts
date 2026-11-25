import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * 任务中心 / 工单是静态演示页，已随菜单一起下线。
 *
 * 菜单种子同时是路由表和权限来源：只要节点还在，直达链接、标签页和
 * keep-alive 就都会把它带回来。所以用源码断言守住「菜单 + 页面」两侧。
 */
const MENU_SEED_SOURCE = readFileSync(
  resolve(process.cwd(), '../../apps/backend-mock/server/api/menus.get.ts'),
  'utf8',
);

describe('任务中心 / 工单已下线', () => {
  it('菜单种子里没有这两个节点', () => {
    for (const token of [
      '任务中心',
      '工单',
      'DashboardTasks',
      'DashboardTickets',
      '/dashboard/tasks',
      '/dashboard/tickets',
    ]) {
      expect(MENU_SEED_SOURCE, `${token} 不应回到菜单种子`).not.toContain(
        token,
      );
    }
  });

  it('对应页面目录已删除', () => {
    expect(
      existsSync(resolve(process.cwd(), 'src/views/dashboard/tasks')),
    ).toBe(false);
    expect(
      existsSync(resolve(process.cwd(), 'src/views/dashboard/tickets')),
    ).toBe(false);
  });
});
