import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, HOME_PATH, setPreference, signIn, watchErrors } from './utils/app';

/**
 * `@antdv/common-ui` 的 ConfigProvider 在真实应用里的四条链路。
 *
 * 单测（`packages/core/ui-kit/common-ui/__tests__/config-provider.test.ts`）验的是
 * "provider 把 props 展开成注入值与 DOM 属性"这一半；这里验的是另一半 ——
 * 装配层（`apps/web/src/App.vue`）把偏好接进去之后，链路上每一个消费点真的跟着动了：
 *
 * 1. 偏好的 `locale` / `componentSize` 落到宿主元素的 `data-*`，且这层包裹不改布局
 *    （`display: contents` 不生成盒子，所以宽度/高度都是 0）；
 * 2. 包内组件的内置文案（Popconfirm 的确定/取消）经 `useGlobalConfig()` 跟随语言；
 * 3. reka 原语的日期排版经 **注入** 跟随语言（`CalendarRoot` 里 `useLocale(props.locale)`
 *    的兜底就是 provider 的值）—— 这条同时钉住 `FDatePicker` 不许再写死 `locale="zh-CN"`，
 *    写死之后"切了语言、日历还是中文"；
 * 4. 子树换色靠 CSS 变量沿 DOM 树继承，而不是往 `<html>` 再写一份主色。
 *
 * 全程只有 `setPreference` 一个写侧：它就是往 pinia 的 `app` store 写，
 * 与用户在界面上操作偏好是同一条形变，不存在"用例 special path"。
 */

/** 读 `[data-common-config-provider]` 宿主的自述：属性 + 内联变量 + 盒子 */
function readHost(page: Page) {
  return page.evaluate(() => {
    const host = document.querySelector(
      '[data-common-config-provider]',
    ) as HTMLElement | null;
    if (!host) throw new Error('应用根部没有挂 ConfigProvider');
    const rect = host.getBoundingClientRect();
    return {
      display: getComputedStyle(host).display,
      hasInlinePrimary: host.style.getPropertyValue('--app-primary'),
      height: rect.height,
      locale: host.dataset.configLocale ?? '',
      size: host.dataset.configSize ?? '',
      width: rect.width,
      dir: host.getAttribute('dir') ?? '',
    };
  });
}

/** 打开"出生日期"的日历，回读标题与星期表头 */
async function readCalendar(page: Page) {
  const trigger = page.locator('[data-field=birthday] [data-field-control]');
  await trigger.click();
  const heading = page.locator('[data-slot=calendar-heading]');
  await expect(heading).toBeVisible();
  const headingText = await heading.innerText();
  const weekdays = await page
    .locator('[data-slot=calendar-head-cell]')
    .allInnerTexts();
  await page.keyboard.press('Escape');
  return { text: headingText.replaceAll(/\s+/g, ' ').trim(), weekdays };
}

test.describe('ConfigProvider 装配后的四条链路', () => {
  test('偏好的语言与尺寸落到宿主，且这层包裹不产生盒子', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, HOME_PATH);

    await page.waitForSelector('[data-common-config-provider]');
    const before = await readHost(page);
    expect(before.locale, '默认偏好是中文').toBe('zh-CN');
    expect(before.size, '默认尺寸档是 medium').toBe('medium');
    expect(before.dir).toBe('ltr');
    /**
     * 容器必须是 `display: contents`：它只是变量与属性的载体，
     * 一旦生成盒子就多出一层 flex/块级容器，页面版式会跟"没有这层"不一样。
     */
    expect(before.display).toBe('contents');
    expect(
      [before.width, before.height],
      'contents 不生成盒子，尺寸应为 0',
    ).toEqual([0, 0]);
    /**
     * 全站主色只有偏好一个写侧（`applyPreferencesToDom` 写 `<html>`）。
     * 根部这里没传 `theme`，所以宿主上不该出现第二条 `--app-primary`。
     */
    expect(before.hasInlinePrimary, '根 provider 不该写主色').toBe('');

    await setPreference(page, { locale: 'en-US' });
    const afterLocale = await readHost(page);
    expect(afterLocale.locale).toBe('en-US');
    // 同一条偏好的另外两个效应：`<html lang>` 与宿主上的 dir
    await expect(page.locator('html')).toHaveAttribute('lang', 'en-US');
    expect(afterLocale.dir).toBe('ltr');

    await setPreference(page, { componentSize: 'large' });
    const afterSize = await readHost(page);
    expect(afterSize.size).toBe('large');

    expect(errors.errors).toEqual([]);
  });

  test('尺寸档位不只是属性：Segmented 的行高跟着换档', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/components/description');

    const segmented = page.locator('[data-common-segmented]').first();
    await expect(segmented).toBeVisible();
    const medium = await segmented.evaluate(
      (el) => el.getBoundingClientRect().height,
    );

    await setPreference(page, { componentSize: 'large' });
    await expect
      .poll(() => segmented.evaluate((el) => el.getBoundingClientRect().height))
      .toBeGreaterThan(medium);

    await setPreference(page, { componentSize: 'small' });
    await expect
      .poll(() => segmented.evaluate((el) => el.getBoundingClientRect().height))
      .toBeLessThan(medium);

    expect(errors.errors).toEqual([]);
  });

  test('包内组件的内置文案跟随 provider 的语言', async ({ page }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/system/post');

    const trigger = page.getByRole('button', { name: '删除' }).first();
    await trigger.click();
    const panel = page.locator('[data-common-popconfirm]');
    await expect(panel).toBeVisible();
    // 用例只点了确认框的触发器，不提交，所以不会真的删数据
    await expect(panel.getByRole('button', { name: '取消' })).toBeVisible();
    await expect(panel.getByRole('button', { name: '确定' })).toBeVisible();
    await panel.getByRole('button', { name: '取消' }).click();

    await setPreference(page, { locale: 'en-US' });
    await trigger.click();
    await expect(panel).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Cancel' })).toBeVisible();
    await expect(panel.getByRole('button', { name: 'OK' })).toBeVisible();
    await panel.getByRole('button', { name: 'Cancel' }).click();

    expect(errors.errors).toEqual([]);
  });

  test('reka 的日期排版走注入的 locale，字段壳不再写死中文', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/components/form/basic');
    /** 折叠态只渲两行，出生日期在收起的那几行里 */
    await page.getByRole('button', { name: '展开' }).click();
    await expect(page.locator('[data-field=birthday]')).toBeVisible();

    const zh = await readCalendar(page);
    expect(zh.text).toMatch(/^\d{4}年\d{1,2}月$/);
    /** 周一开头是 zh-CN 数据里的 weekStartDay，不是代码里排的顺序 */
    expect(zh.weekdays).toEqual(['一', '二', '三', '四', '五', '六', '日']);

    await setPreference(page, { locale: 'en-US' });
    const en = await readCalendar(page);
    expect(en.text).toMatch(/^[A-Za-z]+ \d{4}$/);
    expect(en.weekdays).toEqual(['S', 'M', 'T', 'W', 'T', 'F', 'S']);

    expect(errors.errors).toEqual([]);
  });

  test('子树换色靠变量继承：宿主不生成盒子也能把主色下发给子节点', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, HOME_PATH);
    await page.waitForSelector('[data-common-config-provider]');

    const result = await page.evaluate(() => {
      const host = document.querySelector(
        '[data-common-config-provider]',
      ) as HTMLElement;
      const htmlPrimary = getComputedStyle(document.documentElement)
        .getPropertyValue('--app-primary')
        .trim();

      // 子节点与对照节点用同一个工具类，差别只在是否位于 provider 子树内
      const inside = document.createElement('div');
      inside.className = 'bg-primary';
      const outside = document.createElement('div');
      outside.className = 'bg-primary';
      host.append(inside);
      document.body.append(outside);

      const inherited = getComputedStyle(inside).backgroundColor;
      // 这一步就是 `:theme="{ primary: ... }"` 落地后发生的事
      host.style.setProperty('--app-primary', 'rgb(0, 0, 255)');
      const afterInside = getComputedStyle(inside).backgroundColor;
      const afterOutside = getComputedStyle(outside).backgroundColor;
      /*
       * shadcn 规范名的别名层（`--primary: var(--app-primary)`）声明在
       * `:root, .app-theme-scope` 上，`.app-theme-scope` 就是这一层宿主。
       * 少写这半条选择器时子树里的官方格式组件会拿到 `<html>` 的旧值，
       * 表现是"子树里工具类变色了、按规范名取值的样式没变"。
       */
      const aliasInside = getComputedStyle(inside)
        .getPropertyValue('--primary')
        .trim();
      const aliasOutside = getComputedStyle(outside)
        .getPropertyValue('--primary')
        .trim();

      host.style.removeProperty('--app-primary');
      inside.remove();
      outside.remove();
      return {
        afterInside,
        afterOutside,
        aliasInside,
        aliasOutside,
        htmlPrimary,
        inherited,
        restored: getComputedStyle(document.documentElement)
          .getPropertyValue('--app-primary')
          .trim(),
      };
    });

    // 继承链在 provider 处成立：`@theme inline` 把 `bg-primary` 编成 `var(--app-primary)`，
    // 变量按 DOM 树继承，所以 `display: contents` 的宿主照样能下发。
    expect(result.afterInside).toBe('rgb(0, 0, 255)');
    // 覆盖只吃这棵子树：`<html>` 上的全站主色不动，子树外的同一工具类不变色。
    expect(result.afterOutside).not.toBe('rgb(0, 0, 255)');
    expect(result.inherited).toBe(result.afterOutside);
    expect(result.htmlPrimary).not.toBe('');
    expect(result.restored).toBe(result.htmlPrimary);
    // 规范名跟着子树重算，子树外仍是全站那份
    expect(result.aliasInside, '别名层没覆盖到 .app-theme-scope 子树').toBe(
      'rgb(0, 0, 255)',
    );
    expect(result.aliasOutside).not.toBe('rgb(0, 0, 255)');

    expect(errors.errors).toEqual([]);
  });
});
