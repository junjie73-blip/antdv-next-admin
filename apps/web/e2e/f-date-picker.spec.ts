import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, signIn, watchErrors } from './utils/app';

/**
 * `FDatePicker` 的占位文案契约。
 *
 * 全站四处区间用法传的都是 `['开始时间', '结束时间']` 这种数组，而 prop 曾经声明成
 * `string` —— 运行时只打一条 Vue 告警（`Invalid prop: type check failed`），文字照旧显示，
 * 构建、类型检查和"看着对不对"都发现不了它。
 * 现在 `placeholder?: string | string[]`：数组按两端合成 `开始时间 - 结束时间`，
 * 空串/空数组才回落到内置文案（区间是 `开始日期 - 结束日期`）。
 * 两条用例的文案互不相同，本身就是判据的反证 —— 传入值被忽略会掉回内置文案，
 * 合成写错（少个空格、接成逗号）也不会等于任何一侧的默认串。
 */
const FORM_BASIC = '/components/form/basic';

function control(page: Page, field: string) {
  return page.locator(`[data-field="${field}"] [data-field-control]`);
}

/**
 * 这个示例页开了折叠（`alwaysShowLines: 2`），第 3 行之后的字段是 `v-if` 掉的，
 * 不点「展开」就根本不在 DOM 里 —— 用例先把它拉出来。
 */
async function expand(page: Page) {
  const btn = page
    .locator('[data-form-actions] button')
    .filter({ hasText: '展开' })
    .first();
  await expect(btn).toBeVisible();
  await btn.click();
}

test.describe('FDatePicker 占位文案', () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test('区间字段传数组占位：显示合成文案，且不产生 prop 类型告警', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await go(page, FORM_BASIC);
    await expand(page);

    await expect(control(page, 'timeRange')).toHaveText('开始时间 - 结束时间');

    expect(errors.errors, errors.errors.join('\n')).toEqual([]);
    expect(
      errors.warnings.filter((w) => w.includes('Invalid prop')),
      '数组占位又打回了 Vue 的类型告警',
    ).toEqual([]);
    errors.stop();
  });

  test('单值字段传字符串占位：原样显示', async ({ page }) => {
    await go(page, FORM_BASIC);
    await expand(page);
    await expect(control(page, 'birthday')).toHaveText('请选择日期');
  });
});
