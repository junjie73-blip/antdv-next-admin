import type { Locator, Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

function auth(page: Page, hook: string): Locator {
  return page.locator(`[data-auth="${hook}"]`).first();
}

function errorOf(page: Page, field: string) {
  return auth(page, `error-${field}`);
}

test.describe('注册页', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/#/register');
  });

  test('与登录页同一套认证外壳，字段齐全', async ({ page }) => {
    for (const hook of ['page', 'brand', 'panel', 'form-panel', 'toolbar']) {
      await expect(auth(page, hook)).toBeVisible();
    }
    await expect(auth(page, 'username')).toBeVisible();
    await expect(auth(page, 'email')).toBeVisible();
    await expect(auth(page, 'password')).toBeVisible();
    await expect(auth(page, 'confirm-password')).toBeVisible();
    await expect(auth(page, 'agreement')).toBeVisible();
    await expect(auth(page, 'social')).toBeVisible();
  });

  test('必填与格式规则逐项拦住提交', async ({ page }) => {
    await auth(page, 'submit').click();

    await expect(errorOf(page, 'username')).toContainText('请输入用户名');
    await expect(errorOf(page, 'email')).toContainText('请输入邮箱');
    await expect(errorOf(page, 'password')).toContainText('请输入密码');

    await auth(page, 'username').fill('ab');
    await auth(page, 'username').blur();
    await expect(errorOf(page, 'username')).toContainText('3-20');

    await auth(page, 'email').fill('not-an-email');
    await auth(page, 'email').blur();
    await expect(errorOf(page, 'email')).toContainText('邮箱格式不正确');

    await auth(page, 'password').fill('secret123');
    await auth(page, 'confirm-password').fill('secret12');
    await auth(page, 'confirm-password').blur();
    await expect(errorOf(page, 'confirm-password')).toContainText('不一致');
  });

  test('不勾用户协议就不能注册', async ({ page }) => {
    await auth(page, 'username').fill('tester_01');
    await auth(page, 'email').fill('tester@example.com');
    await auth(page, 'password').fill('secret123');
    await auth(page, 'confirm-password').fill('secret123');

    await auth(page, 'submit').click();
    await expect(errorOf(page, 'agreement')).toContainText('用户协议');

    await auth(page, 'agreement').check();
    await auth(page, 'submit').click();

    await expect(page).toHaveURL(/#\/login/);
  });

  test('底部链接回到登录页', async ({ page }) => {
    await auth(page, 'to-login').click();
    await expect(page.getByPlaceholder('请输入用户名')).toBeVisible();
  });
});
