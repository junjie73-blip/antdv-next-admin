import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { closePreferenceDrawer, go, openPreferenceDrawer, signIn } from './utils/app';

/**
 * 主题色要**真的生效**。
 *
 * 原缺陷：偏好里换了主色，只有 CSS 变量跟着动，antd 侧一片纹丝不动 ——
 * 侧栏"选中父级"的字色、表格里 `type="link"` 的操作按钮、输入框聚焦光晕全还是蓝的。
 * 根因不在设置面板，而在 `@antdv/preferences` 的主题常量：
 * 那批本该由算法从种子色派生的键（`colorPrimaryHover`、`controlItemBgActive`、
 * `Menu.itemSelectedColor`、`colorLink*` …）被按 Tailwind 蓝写死了，
 * 覆盖在用户选的颜色之上。
 *
 * 所以这里不测"设置面板有没有把值存进去"（那层一直是好的），
 * 测**浏览器实际算出来的颜色**：计算样式是唯一能同时穿过 token、CSS 变量、
 * 组件样式三层说话的判据。
 */

/** 元素的实际字色，`rgb(r, g, b)` 形式 */
function colorOf(locator: Locator) {
  return locator.evaluate((node) => getComputedStyle(node).color);
}

/** 写在 `html` 上的主色变量（Tailwind 的 `*-ant-primary` 系列读它） */
function cssPrimary(page: Page) {
  return page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--ant-color-primary').trim(),
  );
}

const PICKED = '#FA541C';
/** 计算样式里的写法 */
const PICKED_RGB = 'rgb(250, 84, 28)';

/**
 * 列表操作列里的「详情」按钮。
 * 显式点名而不是 `.ant-btn-link.first()`：同一格里紧跟其后的「删除」是 danger，
 * 走 colorError 派生链，拿它当主色判据会假红。
 */
function linkButton(page: Page) {
  return page.getByRole('button', { name: '详情', exact: true }).first();
}

test.describe('主题色真的生效', () => {
  test('换主色后，选中父级菜单、link 按钮与 CSS 变量一起跟过去', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');

    const selectedParent = page
      .locator('.ant-menu-submenu-selected > .ant-menu-submenu-title')
      .first();
    const detailButton = linkButton(page);
    await expect(selectedParent).toBeVisible();
    await expect(detailButton).toBeVisible();

    const before = { link: await colorOf(detailButton), menu: await colorOf(selectedParent) };

    const drawer = await openPreferenceDrawer(page, '外观');
    await drawer.getByRole('button', { name: '橙黄色' }).click();
    await closePreferenceDrawer(page);

    /**
     * 三条链一起断：
     * - CSS 变量：偏好 → DOM（原本就是通的，留着当基准）；
     * - 选中父级：`Menu.itemSelectedColor` / `subMenuItemSelectedColor` → colorPrimary；
     * - link 按钮：`colorLink` → 主色（antd 默认把它绑在自己的 `#1677ff` 上，
     *   不显式接就永远不跟主题，这条正是用户点名的那个失效点）。
     */
    await expect.poll(() => cssPrimary(page), { message: '主色变量没换' }).toBe(PICKED);
    await expect
      .poll(() => colorOf(selectedParent), { message: '选中的父级菜单还是原色' })
      .toBe(PICKED_RGB);
    await expect
      .poll(() => colorOf(detailButton), { message: 'link 按钮还是原色' })
      .toBe(PICKED_RGB);

    // 反证：换之前它们确实不是这个颜色，否则上面两条断言是空过
    expect(before.menu).not.toBe(PICKED_RGB);
    expect(before.link).not.toBe(PICKED_RGB);
  });

  test('刷新后主色仍然生效（偏好持久化不只是存下来）', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');

    const drawer = await openPreferenceDrawer(page, '外观');
    await drawer.getByRole('button', { name: '樱花粉' }).click();
    await closePreferenceDrawer(page);

    await page.reload();
    await expect(linkButton(page)).toBeVisible();

    // #EB2F96 → rgb(235, 47, 150)
    await expect.poll(() => colorOf(linkButton(page))).toBe('rgb(235, 47, 150)');
  });
});
