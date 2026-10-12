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
 * 清 storage 时保留 `appSetting`（那就是偏好本身），其余（token、用户信息、标签页
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
      if (!key.includes('appSetting')) localStorage.removeItem(key);
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
     * 深色下 antd 会把主色按暗底重算一档（#FA541C 落到 rgb(216, 74, 27)），
     * 而且这个值是写在 `.ant-app` 的 `--ant-color-primary` 上的，作用域比偏好
     * 写在 `<html>` 上的那一份更近，模板里的 `*-ant-primary` 读到的就是重算后的。
     * 所以这里不钉色值，只钉两件事：
     * 1. 确实离开了默认那支蓝；
     * 2. 工具类与 antd 主按钮取到同一个主色 —— 只要有一条链路没接上，两者就会分开。
     */
    await expect
      .poll(() => backgroundColor(auth(page, 'submit')))
      .not.toBe(defaultBlue);
    await expect
      .poll(
        async () =>
          (await backgroundColor(auth(page, 'submit'))) ===
          (await textColor(auth(page, 'brand').locator('h1 span'))),
      )
      .toBe(true);

    // 中性色：卡片和页面底都脱离白色，否则就是"整站黑了、登录页还白着"
    await expect
      .poll(() => backgroundColor(auth(page, 'card')))
      .not.toBe('rgb(255, 255, 255)');
    await expect
      .poll(() => backgroundColor(auth(page, 'page')))
      .not.toBe('rgb(255, 255, 255)');
  });

  test('窄屏收成单列，宽屏才有品牌区', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/#/login');
    await expect(auth(page, 'brand')).toBeVisible();
    await expect(auth(page, 'mobile-brand')).toBeHidden();

    await page.setViewportSize({ width: 390, height: 844 });
    await expect(auth(page, 'brand')).toBeHidden();
    await expect(auth(page, 'mobile-brand')).toBeVisible();
    await expect(auth(page, 'card')).toBeVisible();
    // 装饰光斑溢出过一整次横向滚动条，这里钉住"不溢出视口"
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
      '390px 下登录页出现横向溢出',
    ).toBe(true);
  });

  test('手机登录里的链接按钮同样跟随主色', async ({ page }) => {
    await page.goto('/#/login');
    await page.getByRole('tab', { name: '手机登录' }).click();
    await expect(page.getByPlaceholder('请输入手机号')).toBeVisible();

    // 不写死色值：链接色与主按钮底色同源，两者相等就说明都挂在主色上
    const submit = backgroundColor(auth(page, 'submit'));
    await expect
      .poll(() => textColor(auth(page, 'send-code')))
      .toBe(await submit);
  });
});
