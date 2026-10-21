import { expect, test } from '@playwright/test';

import { go, HOME_PATH, signIn } from './utils/app';

test('probe: select 先行后再开 popover', async ({ page }) => {
  await signIn(page);
  await go(page, '/components/loading');
  const sel = page.locator('[data-slot="select-trigger"]').first();
  await sel.click();
  const selContent = page.locator('[data-slot="select-content"]').last();
  await expect(selContent).toBeVisible();
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await go(page, '/components/icon-picker');
  const trigger = page
    .locator('[data-slot="card"]')
    .filter({ has: page.getByText('基础用法', { exact: true }) })
    .locator('button[role="combobox"]');
  await trigger.click();
  const content = page.locator('[data-slot="popover-content"]').last();
  await expect(content).toBeVisible();
  await content.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)).then(() => null),
  );
  const info = await content.evaluate((el) => {
    const r = el.getBoundingClientRect();
    const all = [...document.querySelectorAll('[data-slot="popover-content"]')];
    return {
      count: all.length,
      inner: { h: innerHeight, w: innerWidth },
      r: {
        bottom: r.bottom,
        height: r.height,
        left: r.left,
        right: r.right,
        top: r.top,
        width: r.width,
      },
      state: el.dataset.state,
      side: el.dataset.side,
      hidden: el.getAttribute('hidden'),
      scroll: { left: scrollX, top: scrollY },
    };
  });
  console.log(JSON.stringify(info));

  await page.keyboard.press('Escape');
  await go(page, HOME_PATH);
  await page.getByRole('button', { name: '标签页操作' }).click();
  const dd = page.locator('[data-slot="dropdown-menu-content"]').last();
  await expect(dd).toBeVisible();
  await dd.evaluate((el) =>
    Promise.all(el.getAnimations().map((a) => a.finished)).then(() => null),
  );
  const ddInfo = await dd.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      inner: { h: innerHeight, w: innerWidth },
      r: { bottom: r.bottom, left: r.left, right: r.right, top: r.top },
      z: getComputedStyle(el).zIndex,
      shadow: getComputedStyle(el).boxShadow.slice(0, 40),
    };
  });
  console.log(JSON.stringify(ddInfo));
});
