import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, signIn, watchErrors } from './utils/app';

/**
 * 表单动作区的栅格归属，读的是浏览器最终算出来的包围盒。
 *
 * 单测跑在 jsdom 上，没有排版引擎，只能断言内联 `style` 字符串；而这条规则的价值恰恰在
 * 真实排版：剩余栅格够不够、`min-width: max-content` 有没有把按钮挤变形、折叠与展开是不是
 * 走同一套定位。所以这里全部用 `getBoundingClientRect()`。
 *
 * 页面 `#/components/form/basic`：14 个字段，`colProps.span` 为 12 或 24，
 * `showAdvancedButton` 开、`alwaysShowLines: 2`。折叠时最后一个可见行（邮箱 + 年龄）正好
 * 占满 24，动作区退回独占一行；展开后末行是 `timeRange`（占 12），动作区吃掉剩下 12。
 * 一个页面同时压到两条分支，不需要再造第二份 schema。
 */
interface Snapshot {
  actions: { height: number; left: number; top: number; width: number };
  btnTexts: string[];
  cells: Array<{ field: string; left: number; right: number; top: number }>;
  rowCount: number;
  row: { left: number; right: number };
}

/**
 * 坐标一律换算成**相对 `<form>` 左上角** —— 不是视口坐标，也不是 `+ window.scrollY`。
 *
 * 视口坐标里混着两种与栅格无关的位移：表单里的按钮是 `type=submit`，点它会触发聚焦与
 * 滚动；外壳内容区自己带滚动，实测同一个折叠态两次读取，整个 `<form>` 的 `top` 相差
 * 12px，而 `window.scrollY` 全程是 0 —— 动的是内层容器，窗口没动，加 `scrollY` 抵消不了。
 * 逐像素比较视口坐标会把「容器位移」读成「布局抖了 12px」，既假红也会掩盖真问题。
 * 减掉 form 原点之后位移自动抵消，剩下的才是要验的相对关系；宽高不受平移影响。
 */
function snapshot(page: Page) {
  return page.evaluate((): Snapshot => {
    const actionsEl = document.querySelector('[data-form-actions]');
    if (!actionsEl) throw new Error('动作区 [data-form-actions] 没渲染');
    const rowEl = actionsEl.closest('.form-row');
    if (!rowEl) throw new Error('动作区不在任何 .form-row 里');
    const base = (actionsEl.closest('form') ?? rowEl).getBoundingClientRect();
    const round = (r: DOMRect) => ({
      height: Math.round(r.height),
      left: Math.round(r.left - base.left),
      top: Math.round(r.top - base.top),
      width: Math.round(r.width),
    });
    const rowRect = rowEl.getBoundingClientRect();
    return {
      actions: round(actionsEl.getBoundingClientRect()),
      btnTexts: [...actionsEl.querySelectorAll('button')].map((b) =>
        (b.textContent ?? '').trim(),
      ),
      cells: [...rowEl.querySelectorAll<HTMLElement>('[data-field]')].map(
        (el) => {
          const r = el.getBoundingClientRect();
          return {
            field: el.dataset.field ?? '',
            left: Math.round(r.left - base.left),
            right: Math.round(r.right - base.left),
            top: Math.round(r.top - base.top),
          };
        },
      ),
      rowCount: document.querySelectorAll('.form-row').length,
      row: {
        left: Math.round(rowRect.left - base.left),
        right: Math.round(rowRect.right - base.left),
      },
    };
  });
}

/** 动作区里的按钮，按文案取（折叠态没有「收起」，展开态没有「展开」） */
async function clickActionButton(page: Page, text: string) {
  const btn = page
    .locator('[data-form-actions] button')
    .filter({ hasText: text })
    .first();
  await expect(btn).toBeVisible();
  await btn.click();
}

test.describe('表单动作区的栅格归属', () => {
  test.use({ viewport: { height: 900, width: 1440 } });

  test('折叠态末行被字段占满时，动作区吃满 24 栅格、右对齐并独占一行', async ({
    page,
  }) => {
    const errors = watchErrors(page);
    await signIn(page);
    await go(page, '/components/form/basic');
    await expect(page.locator('[data-form-actions]')).toBeVisible();

    const snap = await snapshot(page);
    expect(snap.rowCount).toBe(2);
    /** 末行两个字段各占 12，已经被占满 → 动作区拿满 24 */
    expect(snap.cells.map((c) => c.field)).toEqual(['email', 'age']);
    expect(snap.actions.width).toBe(snap.row.right - snap.row.left);
    expect(snap.actions.left).toBe(snap.row.left);
    /** 独占一行 ⇒ 同一基线上没有字段 */
    expect(snap.cells.filter((c) => c.top === snap.actions.top)).toHaveLength(
      0,
    );
    expect(snap.btnTexts).toEqual(['查询', '重置', '展开']);
    expect(errors.errors).toEqual([]);
  });

  test('展开后动作区并进末行剩余栅格，贴着最后一个字段而不是另起一行', async ({
    page,
  }) => {
    await signIn(page);
    await go(page, '/components/form/basic');
    await expect(page.locator('[data-form-actions]')).toBeVisible();

    await clickActionButton(page, '展开');
    await expect(page.locator('.form-row')).toHaveCount(9);

    const snap = await snapshot(page);
    const last = snap.cells.at(-1);
    expect(last?.field).toBe('timeRange');
    /** 行内的判据：与最后一个字段同一条基线，且左边界贴它的右边界 */
    expect(snap.actions.top).toBe(last?.top);
    expect(snap.actions.left).toBe(last?.right);
    /** 末行已占 12 → 动作区吃掉剩下的 12，恰好半行 */
    expect(snap.actions.width).toBe(
      Math.round((snap.row.right - snap.row.left) / 2),
    );
    expect(snap.btnTexts).toEqual(['查询', '重置', '收起']);
  });

  test('收起后与初始折叠态逐像素相同（折叠与展开共用一条规则，切换不抖动）', async ({
    page,
  }) => {
    await signIn(page);
    await go(page, '/components/form/basic');
    await expect(page.locator('[data-form-actions]')).toBeVisible();

    const collapsed = await snapshot(page);
    await clickActionButton(page, '展开');
    await expect(page.locator('.form-row')).toHaveCount(9);
    await clickActionButton(page, '收起');
    await expect(page.locator('.form-row')).toHaveCount(2);

    expect(await snapshot(page)).toEqual(collapsed);
  });

  test('断点扫描：行内时必有同行字段，独占时贴齐行宽，按钮始终不被压扁', async ({
    page,
  }) => {
    await signIn(page);
    await go(page, '/components/form/basic');
    await expect(page.locator('[data-form-actions]')).toBeVisible();
    await clickActionButton(page, '展开');
    await expect(page.locator('.form-row')).toHaveCount(9);

    for (const width of [1440, 1100, 900, 640]) {
      await page.setViewportSize({ height: 900, width });
      /** 列数由 `useBreakpoints` 驱动，重排要等一帧 */
      await page.waitForTimeout(200);
      const snap = await snapshot(page);
      const rowWidth = snap.row.right - snap.row.left;

      expect(snap.actions.left, `vw=${width}`).toBeGreaterThanOrEqual(
        snap.row.left,
      );
      expect(
        snap.actions.left + snap.actions.width,
        `vw=${width} 动作区超出宿主行`,
      ).toBeLessThanOrEqual(snap.row.right + 1);

      if (snap.actions.width < rowWidth - 1) {
        expect(
          snap.cells.filter((c) => c.top === snap.actions.top).length,
          `vw=${width} 行内排布却找不到同行字段`,
        ).toBeGreaterThan(0);
      } else {
        expect(snap.actions.left, `vw=${width} 独占一行却没贴左`).toBe(
          snap.row.left,
        );
      }

      /** 剩余栅格放不下时整块换行，靠的是 `min-width: max-content`，按钮不该被压变形 */
      const buttons = await page
        .locator('[data-form-actions] button')
        .evaluateAll((els) =>
          els.map((el) => ({
            text: (el.textContent ?? '').trim(),
            width: Math.round(el.getBoundingClientRect().width),
          })),
        );
      expect(buttons.length, `vw=${width}`).toBeGreaterThan(0);
      for (const btn of buttons) {
        expect(
          btn.width,
          `vw=${width} 按钮「${btn.text}」被压扁`,
        ).toBeGreaterThanOrEqual(60);
      }
    }
  });
});
