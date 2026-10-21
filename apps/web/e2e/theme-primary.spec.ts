import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  closePreferenceDrawer,
  go,
  openPreferenceDrawer,
  settingControl,
  signIn,
} from './utils/app';

/**
 * 主题色要**真的生效**。
 *
 * 原缺陷：偏好里换了主色，只有 CSS 变量跟着动，组件侧一片纹丝不动 ——
 * 侧栏"选中父级"的字色、表格里 link 型操作按钮、输入框聚焦光晕全还是蓝的。
 * 根因是当初有两条互不相干的主色链路：设计 token 读自己那组变量，
 * 而组件那侧的值被按 Tailwind 蓝写死（`colorPrimaryHover`、`Menu.itemSelectedColor`、
 * `colorLink*` 这些本该由算法从种子色派生的键），盖在用户选的颜色之上。
 * 现在全站只有一条链路：预设色 = `[data-theme]` 色板，自定义色 = `html` 上的内联
 * `--primary`，组件一律读 `bg-primary` / `text-primary` 这一类语义 token。
 *
 * 所以这里不测"设置面板有没有把值存进去"（那层一直是好的），
 * 测**浏览器实际算出来的颜色**：计算样式是唯一能同时穿过 token、CSS 变量、
 * 组件样式三层说话的判据。
 */

/** 元素的实际字色，`rgb(r, g, b)` 形式 */
function colorOf(locator: Locator) {
  return locator.evaluate((node) => getComputedStyle(node).color);
}

/**
 * 设计规范自己那条主色链路（`@antdv/design` 的 `[data-theme]` 色板 → `--primary`）。
 *
 * 预设档不内联变量，值从色板里来；取色器选的自定义色才写在 `html` 的 style 上。
 * 变量存的是 HSL 三段（`215.02 100% 54.31%`），不是能直接比的字符串 ——
 * 所以挂一枚探针元素让浏览器把 `hsl(var(--primary))` 算成实际颜色，
 * 预设档与自定义档于是有同一个口径，也跟组件那侧的 `colorOf` 可比。
 */
function cssPrimary(page: Page) {
  return page.evaluate(() => {
    const probe = document.createElement('i');
    probe.style.color = 'hsl(var(--primary))';
    document.documentElement.append(probe);
    const rgb = getComputedStyle(probe).color;
    probe.remove();
    return rgb;
  });
}

/** 偏好面板里那颗「橙黄色」预设 */
const PICKED_RGB = 'rgb(250, 84, 28)';

/**
 * 列表操作列里的「详情」按钮。
 * 显式点名而不是"取第一个 link 按钮"：同一格里紧跟其后的「删除」是 danger 档，
 * 走破坏色那条派生链，拿它当主色判据会假红。
 */
function linkButton(page: Page) {
  return page.getByRole('button', { name: '详情', exact: true }).first();
}

test.describe('主题色真的生效', () => {
  test('换主色后，选中父级菜单、link 按钮与 CSS 变量一起跟过去', async ({
    page,
  }) => {
    await signIn(page);
    await go(page, '/system/user');

    // 侧栏里当前页所在子树的父级（menu-ui 的 `data-menu-state="ancestor"`）
    const selectedParent = page.locator('[data-menu-state="ancestor"]').first();
    const detailButton = linkButton(page);
    await expect(selectedParent).toBeVisible();
    await expect(detailButton).toBeVisible();

    const before = {
      link: await colorOf(detailButton),
      menu: await colorOf(selectedParent),
    };

    const drawer = await openPreferenceDrawer(page, '外观');
    await drawer.getByRole('button', { name: '橙黄色' }).click();
    await closePreferenceDrawer(page);

    /**
     * 三条链一起断：
     * - CSS 变量：偏好 → `[data-theme]` 档位（设计规范的取色入口）；
     * - 选中父级：menu-ui 的 `text-primary`；
     * - 操作列按钮：table-ui 的 link 型按钮同样落回 `text-primary`。
     *   这三处以前各自有各自的写死值，所以必须一起测 —— 漏一条就是"换了主题，某处还是蓝的"。
     */
    await expect
      .poll(() => cssPrimary(page), { message: '主色变量没换' })
      .toBe(PICKED_RGB);
    await expect
      .poll(() => colorOf(selectedParent), {
        message: '选中的父级菜单还是原色',
      })
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
    await expect
      .poll(() => colorOf(linkButton(page)))
      .toBe('rgb(235, 47, 150)');
  });

  test('时区小部件的选中态跟着主色走（这里曾经写死蓝色）', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/user');

    const drawer = await openPreferenceDrawer(page, '外观');
    await drawer.getByRole('button', { name: '橙黄色' }).click();
    await closePreferenceDrawer(page);

    // 时区小部件默认关掉，先在「布局 · 小部件」里打开它
    const layout = await openPreferenceDrawer(page, '布局');
    await settingControl(layout, '时区小部件').click();
    await closePreferenceDrawer(page);

    await page.getByTestId('timezone-widget').click();
    // 当前时区那一项由 `aria-current` 标出来，不靠顺序猜
    const activeOption = page
      .locator('[data-testid^="timezone-option-"][aria-current="true"]')
      .first();
    await expect(activeOption).toBeVisible();

    await expect
      .poll(() => colorOf(activeOption), {
        message: '选中项的字色还是写死的蓝',
      })
      .toBe(PICKED_RGB);
    // 底色是主色的 10% 淡染，算出来一定不是原来那支 blue-50
    await expect
      .poll(() =>
        activeOption.evaluate((node) => getComputedStyle(node).backgroundColor),
      )
      .not.toBe('rgb(239, 246, 255)');
  });
});
