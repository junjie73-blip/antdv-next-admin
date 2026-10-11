import { expect, test } from '@playwright/test';

import { go, region, setLayout, signIn } from './utils/app';

/**
 * 分析面板吸收工作台（`/dashboard/workbench` 已下线）。
 *
 * 合并最容易留下两种"看不见的坏"：菜单里残留一条点不动的工作台，
 * 以及原工作台那种 `cursor-pointer` 却压根不可点的格子被原样搬过来 ——
 * 静态检查发现不了（都是合法 DOM），只有真的点一下才知道。
 */

test.describe('仪表盘合并', () => {
  test('导航里再无工作台，仪表盘只剩分析面板与监控大屏', async ({ page }) => {
    await signIn(page);
    // vertical：侧栏是一整棵菜单树，父子节点一次看全，不必先点一级
    await setLayout(page, 'vertical');
    await go(page, '/dashboard/analysis');

    const sidebar = region(page, 'sidebar');
    await expect(sidebar.getByText('分析面板')).toBeVisible();
    await expect(sidebar.getByText('实时监控大屏')).toBeVisible();
    await expect(sidebar.getByText('工作台')).toHaveCount(0);
  });

  test('快捷操作是真的能点：从分析面板跳进监控大屏', async ({ page }) => {
    await signIn(page);
    await go(page, '/dashboard/analysis');

    // 旧形态在这里是 <div>，getByRole('link') 直接查不到 —— 这条断言就是回归闸门
    await expect(page.getByRole('link', { name: /监控大屏/ })).toBeVisible();

    /**
     * 点击后不能用裸 `expect(tab(...))`（默认 10s）等结果：
     * dev 下第一次进 `/system/user` 要现场编译整棵子树，WebKit 冷跑实测超过 10s，
     * 会把"跳转成功、只是慢"读成假红。`go()` 的幂等重设 + 最后一次 20s 正好治这个。
     */
    await page.getByRole('link', { name: /用户管理/ }).first().click();
    await go(page, '/system/user');

    await go(page, '/dashboard/analysis');
    await page.getByRole('link', { name: /监控大屏/ }).click();
    await go(page, '/screen/monitor');
  });

  test('合并进来的两个区块真的渲染出来', async ({ page }) => {
    await signIn(page);
    await go(page, '/dashboard/analysis');

    await expect(page.getByRole('heading', { name: '快捷操作' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '最近动态' })).toBeVisible();
    await expect(page.getByRole('heading', { name: '分析面板' })).toBeVisible();
    // 5 条动态照搬过来，条目数变了说明数据被改写
    await expect(
      page.getByRole('listitem').filter({ hasText: /分钟前|小时前/ }),
    ).toHaveCount(5);
  });
});
