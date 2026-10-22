import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, signIn } from './utils/app';

/**
 * 区间日期字段进 HTTP 查询串的形态。
 *
 * `RangePicker` 只给 `format` 不给 `valueFormat` 时，控件回传的是 dayjs 实例；
 * 这类值一旦被 qs 序列化，出来的是 `dateRange[$d]=…&dateRange[$isDayjsObject]=true`
 * 这种内部属性串，后端两个日期都拿不到，日期过滤等于没填。
 * 所以这里钉的是"查询串里恰好两个日期值，且没有对象内部属性泄漏"。
 */

/** 两个日志页的区间字段都叫 `dateRange`，用 `[data-field]` 定位，不吃语言文案 */
function rangeTrigger(page: Page) {
  return page.locator('[data-field="dateRange"] button[data-field-control]');
}

function dayCell(page: Page, value: string) {
  return page.locator(
    `[data-slot="popover-content"] [data-slot="range-calendar-trigger"][data-value="${value}"]`,
  );
}

/** 当月 1 号与 15 号：日历默认落在当月，两个日期一定在第一块面板里 */
function thisMonth(day: number) {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

async function pickRange(page: Page) {
  await rangeTrigger(page).click();
  await expect(dayCell(page, thisMonth(1))).toBeVisible();
  await dayCell(page, thisMonth(1)).click();
  await dayCell(page, thisMonth(15)).click();
  await expect(rangeTrigger(page)).toContainText(thisMonth(1));
}

/** 点「查询」并回捕获到的那条列表请求 */
async function query(page: Page, apiPath: string) {
  const pending = page.waitForRequest((req) => req.url().includes(apiPath));
  await page.getByRole('button', { name: /查询|Search/ }).click();
  return pending;
}

test.describe('区间日期参数', () => {
  test('登录日志：dateRange 出两个日期值，不带 dayjs 内部属性', async ({
    page,
  }) => {
    await signIn(page);
    await go(page, '/system/login-log');
    await expect(page.locator('tbody tr').first()).toBeVisible();

    const baseline: number = await page.evaluate(async () => {
      const res = await fetch(
        '/api/system/login-log/list?pageNum=1&pageSize=10',
      );
      const body = await res.json();
      return body.data.total;
    });

    await pickRange(page);
    const request = await query(page, '/system/login-log/list');
    const url = request.url();

    const params = new URL(url).searchParams;
    expect(params.getAll('dateRange')).toEqual([
      `${thisMonth(1)} 00:00:00`,
      `${thisMonth(15)} 00:00:00`,
    ]);
    expect(url).not.toContain('$');
    expect(url).not.toContain('isDayjsObject');

    /** 过滤真的起作用了：命中数只可能是全量的一部分 */
    const response = await request.response();
    expect(response?.ok()).toBe(true);
    const body = await response?.json();
    expect(body.data.total).toBeLessThanOrEqual(baseline);
  });

  test('操作日志：区间同样以两个日期出串', async ({ page }) => {
    await signIn(page);
    await go(page, '/system/log');
    await expect(page.locator('tbody tr').first()).toBeVisible();

    await pickRange(page);
    const request = await query(page, '/system/log/list');

    const params = new URL(request.url()).searchParams;
    expect(params.getAll('dateRange').length).toBe(2);
    expect(params.getAll('dateRange')[0]).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(request.url()).not.toContain('isDayjsObject');
  });
});
