import type { Page } from '@playwright/test';

import { test } from '@playwright/test';

import { go, signIn } from './utils/app';

test.setTimeout(120_000);

function cardByTitle(page: Page, prefix: string) {
  return page
    .locator('[data-slot="card"]')
    .filter({
      has: page
        .locator('[data-slot="card-title"]')
        .filter({ hasText: prefix }),
    });
}

test('probe closeFunc', async ({ page }) => {
  await signIn(page);
  await go(page, '/components/modal-drawer');
  const box = cardByTitle(page, '嵌套与关闭拦截');
  const say = async (tag: string) => {
    const lines = await box
      .getByText(/拦截|关闭请求/)
      .allTextContents()
      .catch(() => []);
    console.log('PROBE', tag, JSON.stringify(lines));
  };

  await box.getByRole('button', { name: '打开可编辑抽屉' }).click();
  const drawer = page
    .locator('.basic-drawer')
    .filter({ has: page.getByText('草稿编辑（关闭前会过 closeFunc）') });
  await expect2(drawer);
  await say('opened');

  await drawer.getByRole('button', { name: /关闭抽屉/ }).click();
  await page.waitForTimeout(600);
  await say('after-clean-close');

  await box.getByRole('button', { name: '打开可编辑抽屉' }).click();
  await drawer.locator('textarea').fill('又改了几个字');
  await say('dirty');

  const confirm = page
    .locator('.basic-modal')
    .filter({ has: page.getByText('关闭被拦截了', { exact: true }) });

  await drawer.getByRole('button', { name: /关闭抽屉/ }).click();
  await page.waitForTimeout(400);
  await say('intercept-1');
  console.log('PROBE confirm-visible-1', await confirm.isVisible());
  await confirm.getByRole('button', { name: /留在页面/ }).click();
  await page.waitForTimeout(400);
  console.log('PROBE confirm-visible-after-stay', await confirm.isVisible());

  await drawer.locator('button[aria-label^="关闭"]').click();
  await page.waitForTimeout(400);
  await say('intercept-2');
  console.log('PROBE confirm-visible-2', await confirm.isVisible());
  await confirm.getByRole('button', { name: /留在页面/ }).click();
  await page.waitForTimeout(400);

  await page.locator('[data-slot="sheet-overlay"]').last().click();
  await page.waitForTimeout(400);
  await say('intercept-3');
  console.log('PROBE confirm-visible-3', await confirm.isVisible());
  console.log(
    'PROBE overlay-count',
    await page.locator('[data-slot="sheet-overlay"]').count(),
  );
});

async function expect2(locator: any) {
  await locator.waitFor({ state: 'visible', timeout: 15_000 });
}
