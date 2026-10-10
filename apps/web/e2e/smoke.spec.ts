import { expect, test } from '@playwright/test';

import {
  expectActivePath,
  fillAccount,
  go,
  HOME_PATH,
  signIn,
  submitLogin,
  tab,
  watchErrors,
} from './utils/app';

/**
 * 冒烟链路：守卫 → 登录 → 布局外壳 → 菜单/标签页联动。
 *
 * 覆盖的是"架构拼装对不对"这一层：hash 路由、路由守卫、Nitro mock 接口、
 * 菜单 store、标签页 store、布局外壳，任何一环没接上这里就红。
 */
test.describe('应用冒烟', () => {
  test('未登录访问受保护页面会被守卫送回登录页', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/#/system/user');

    await expect(page).toHaveURL(/#\/login/);
    await expect(page.getByPlaceholder('请输入用户名')).toBeVisible();
    expect(errors.errors).toEqual([]);
  });

  test('登录后进入首页并渲染出布局外壳', async ({ page }) => {
    const errors = watchErrors(page);
    await page.goto('/#/login');
    await fillAccount(page);
    await submitLogin(page);

    // 登录成功后由 HOME_PATH 常量决定落点，不是写死的 /dashboard（那是个没有组件的目录）
    await expectActivePath(page, HOME_PATH);
    await expect(page.locator('.tab-item').first()).toBeVisible();
    // 菜单来自 Nitro 的 /menus，能渲染出条目说明前后端接通了
    await expect(page.locator('.ant-menu-root li').first()).toBeVisible();
    expect(errors.errors).toEqual([]);
  });

  test('打开业务页面：新增标签且激活态唯一', async ({ page }) => {
    await signIn(page);
    const errors = watchErrors(page);

    await go(page, '/system/user');

    await expect(tab(page, '/system/user')).toBeVisible();
    // 「点一个菜单出多个选中」的回归保护：激活标签只能有一个
    await expect(page.locator('.tab-item[data-active="true"]')).toHaveCount(1);
    expect(errors.errors).toEqual([]);
  });

  test('菜单选中态唯一：每个菜单根节点下最多一个 selected', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/role');

    const roots = page.locator('.ant-menu-root');
    const total = await roots.count();
    expect(total).toBeGreaterThan(0);
    for (let i = 0; i < total; i += 1) {
      await expect(roots.nth(i).locator('.ant-menu-item-selected')).toHaveCount(
        1,
        { timeout: 10_000 },
      );
    }
  });

  test('窄视口下外壳仍然可用（响应式）', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);

    await page.setViewportSize({ height: 720, width: 375 });
    await go(page, '/system/user');

    await expect(tab(page, '/system/user')).toBeVisible();
    // 手机端不该出现横向滚动的整页
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth + 1,
    );
    expect(overflow).toBe(true);
    expect(errors.errors).toEqual([]);
  });
});
