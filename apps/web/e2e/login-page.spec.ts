import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import {
  closePreferenceDrawer,
  openPreferenceDrawer,
  signIn,
} from './utils/app';

function auth(page: Page, hook: string): Locator {
  return page.locator(`[data-auth="${hook}"]`).first();
}

function backgroundColor(locator: Locator) {
  return locator.evaluate((node) => getComputedStyle(node).backgroundColor);
}

function textColor(locator: Locator) {
  return locator.evaluate((node) => getComputedStyle(node).color);
}

/**
 * 偏好只能在登录后改，改完还得回到"未登录"的登录页才看得到效果。
 *
 * 清 storage 时保留 `appSetting`（那就是偏好本身）和它的 `bootTheme` 首屏快照，
 * 其余（token、用户信息、标签页
 * 状态）当作登出。然后**整页 reload**：只换 hash 不会重启应用，pinia 里的登录态
 * 还在，路由守卫会立刻把 `/#/login` 弹回首页 —— 少了这一步，断言的是后台页面。
 */
async function signInThenApply(page: Page, labels: string[]) {
  await signIn(page);
  await openPreferenceDrawer(page, '外观');
  for (const label of labels) {
    await page
      .getByRole('button', { name: label, exact: true })
      .first()
      .click();
    await page.waitForTimeout(300);
  }
  await closePreferenceDrawer(page);
  await page.evaluate(() => {
    for (const key of Object.keys(localStorage)) {
      // appSetting 是偏好本身，bootTheme 是它的首屏快照，两者都要留
      if (!/appSetting|bootTheme/.test(key)) localStorage.removeItem(key);
    }
  });
  await page.goto('/#/login');
  await page.reload();
  await expect(
    page.getByPlaceholder('请输入用户名'),
    '登录后改完偏好回登录页，被守卫挡回了后台',
  ).toBeVisible();
}

test.describe('登录页的样式', () => {
  test('主色和深色偏好真的落到登录页上', async ({ page }) => {
    await page.goto('/#/login');
    // 反证用：默认主色就是 antd 那支蓝，改完必须不再是它
    const defaultBlue = await backgroundColor(auth(page, 'submit'));
    expect(defaultBlue).toBe('rgb(22, 119, 255)');

    await signInThenApply(page, ['深色', '橙黄色']);

    await expect
      .poll(() =>
        page.evaluate(() =>
          document.documentElement.classList.contains('dark'),
        ),
      )
      .toBe(true);

    /*
     * 认证外壳的强调色全部挂在 app 主色 token 上（`--primary`）：预设档由
     * `@antdv/design` 的 `[data-theme]` 色板给值，取色器选的自定义色才内联写在 `<html>`。
     * 同一颗主色在明暗两套色板里的取值本来就不同（橙黄在暗底上要单独调一档），
     * 所以这里不钉色值，只钉两件事：
     * 1. 确实离开了默认那支蓝；
     * 2. 主按钮底色与品牌侧的 logo 方块取到同一个主色 —— 一条链路没接上两者就会分开。
     */
    await expect
      .poll(() => backgroundColor(auth(page, 'submit')))
      .not.toBe(defaultBlue);
    await expect
      .poll(
        async () =>
          (await backgroundColor(auth(page, 'submit'))) ===
          (await backgroundColor(auth(page, 'slogan-mark'))),
      )
      .toBe(true);

    // 中性色：右栏和页面底都脱离白色，否则就是"整站黑了、登录页还白着"
    await expect
      .poll(() => backgroundColor(auth(page, 'panel')))
      .not.toBe('rgb(255, 255, 255)');
    await expect
      .poll(() => backgroundColor(auth(page, 'page')))
      .not.toBe('rgb(255, 255, 255)');
  });

  test('窄屏收成单列，宽屏才有品牌区', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/login');
    await expect(auth(page, 'brand')).toBeVisible();
    await expect(auth(page, 'logo')).toBeVisible();
    await expect(auth(page, 'toolbar')).toBeVisible();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(auth(page, 'brand')).toBeHidden();
    // 表单列不随断点消失，只是从半屏宽收成整屏
    await expect(auth(page, 'panel')).toBeVisible();
    await expect(auth(page, 'submit')).toBeVisible();
    // 装饰层溢出过一整次横向滚动条，这里钉住"不溢出视口"
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      '390px 下登录页出现横向溢出',
    ).toBe(true);
  });

  test('切换手机登录后，链接按钮同样跟随主色', async ({ page }) => {
    await page.goto('/#/login');
    await auth(page, 'mode-mobile').click();
    await expect(page.getByPlaceholder('请输入手机号')).toBeVisible();

    // 不写死色值：链接色与主按钮底色同源，两者相等就说明都挂在主色上
    const submit = backgroundColor(auth(page, 'submit'));
    await expect
      .poll(() => textColor(auth(page, 'send-code')))
      .toBe(await submit);
  });

  test('右上角主题色面板改了主色，登录页立刻跟着换', async ({ page }) => {
    await page.goto('/#/login');
    const before = await backgroundColor(auth(page, 'submit'));

    await auth(page, 'color-presets-trigger').click();
    await auth(page, 'color-preset-violet').click();

    await expect
      .poll(() => backgroundColor(auth(page, 'submit')))
      .not.toBe(before);
  });

  test('官方 logo 与侧栏同一档规格，品牌栏结构齐全', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/login');

    // 官方 logo 是应用里的图片资源，不是内联占位图形 —— 必须真的解码成功
    const logo = auth(page, 'logo-img');
    await expect(logo).toBeVisible();
    await expect
      .poll(() =>
        logo.evaluate((node) => (node as HTMLImageElement).naturalWidth),
      )
      .toBeGreaterThan(0);
    // h-8 w-8 + object-contain：32px 见方，不拉伸不裁切
    const box = await logo.boundingBox();
    expect(box?.width).toBeCloseTo(32, 0);
    expect(box?.height).toBeCloseTo(32, 0);

    await expect(auth(page, 'brand-title')).toBeVisible();
    await expect(auth(page, 'brand-desc')).toBeVisible();
    await expect.poll(() => auth(page, 'brand-features').count()).toBe(1);
    expect(
      await page.locator('[data-auth="brand-feature"]').count(),
    ).toBeGreaterThanOrEqual(3);

    // 表单徽标跟着登录方式换字，和下方的切换按钮同源
    await expect(auth(page, 'form-badge')).toContainText('账号登录');
    await auth(page, 'mode-mobile').click();
    await expect(auth(page, 'form-badge')).toContainText('手机号登录');

    // 卡片居中版式不允许挤出横向滚动
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      '1440px 下登录页出现横向溢出',
    ).toBe(true);
  });

  test('整屏左右分栏：两栏铺满视口宽度，表单列不被挤成窄条', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/login');

    const card = await auth(page, 'card').boundingBox();
    const brand = await auth(page, 'brand').boundingBox();
    const panel = await auth(page, 'panel').boundingBox();
    if (!card || !brand || !panel) throw new Error('分栏三块容器没有全部渲染');
    // 版式从"视口正中一张卡片"换成了整屏分栏，容器宽度不再由 max-w 决定，而是跟着视口走
    expect(card.width).toBeCloseTo(1440, 0);
    // 品牌栏 52% / 表单栏 48%，两栏加起来正好铺满整屏
    expect(brand.width / card.width).toBeGreaterThanOrEqual(0.5);
    expect(panel.width / card.width).toBeGreaterThanOrEqual(0.45);
    expect(brand.width + panel.width).toBeCloseTo(card.width, 0);
    // 两栏顶边对齐且等高，否则分栏接缝会斜
    expect(Math.abs(brand.y - panel.y)).toBeLessThan(1);
    expect(Math.abs(brand.height - panel.height)).toBeLessThan(1);
    // 表单列留出可用的输入宽度（AuthFormPanel 收口在 max-w-md，两边还要放得下内边距）
    expect(panel.width).toBeGreaterThan(560);
  });
});
