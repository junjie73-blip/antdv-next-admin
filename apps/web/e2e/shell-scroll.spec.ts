import type { Page } from '@playwright/test';

import { expect, test } from '@playwright/test';

import { go, region, setLayout, signIn } from './utils/app';

/**
 * 全站滚动条不变量：凡是我们写得着的滚动区域，一律用 `@antdv/ui` 的 `<Scrollbar>`，
 * 不许露出操作系统那条滚动条。
 *
 * 这条需求是"观感"级别的，靠肉眼验收很容易漏（某处滚动条只在内容超长时才出现），
 * 所以把它翻译成两个可执行的物理量：
 *
 * 1. **外壳的滚动区必须是封装组件的 DOM**。`<Scrollbar>` 会留下
 *    `.scrollbar__wrap`（真正的滚动元素）+ `.scrollbar__bar`（自绘条），
 *    并且默认带 `scrollbar__wrap--hidden-default` 把原生条藏掉。
 *    侧栏菜单、标签栏、内容区这三处以前各自写过 `overflow: auto`，
 *    是最容易"退回系统滚动条"的地方。
 * 2. **页面上任何元素的原生滚动槽（gutter）不得宽于全局兜底给出的宽度**。
 *    包不住的第三方滚动区（antd 表格体、虚拟列表、textarea）由
 *    `@antdv/styles` 的 base 层统一压细，Windows 上从 17px 变成 8px；
 *    真正"露出系统滚动条"的特征就是 gutter 又变回浏览器的默认宽度。
 *
 * 第 2 条的阈值不写死数字：先在当前页面插一个探针元素，量出"这个引擎 + 我们的全局 CSS"
 * 实际渲染出来的滚动槽宽度，再拿它当基准。换引擎（Chromium 8px / Firefox thin ~11px /
 * macOS WebKit overlay 0px）阈值自动跟着变，而系统默认那条 15-17px 的粗杠一定超标。
 */

/** 探针：同样吃全局样式，但不带任何自定义宽度 */
const PROBE_STYLE_ID = 'e2e-scrollbar-probe';

interface ScrollGutter {
  /** 垂直方向的滚动槽宽度（offsetWidth - clientWidth） */
  vertical: number;
  /** 水平方向的滚动槽高度 */
  horizontal: number;
}

/**
 * 在当前文档里量出"全局兜底后的滚动槽宽度"。
 *
 * 探针必须挂进真实 DOM（不是在隔离 world 里），否则吃不到页面的 `@layer base` 规则。
 */
async function nativeGutter(page: Page): Promise<number> {
  return page.evaluate((probeId) => {
    const existing = document.getElementById(probeId);
    if (existing) {
      const box = existing as HTMLElement;
      const width = box.offsetWidth - box.clientWidth;
      box.remove();
      return width;
    }
    const box = document.createElement('div');
    box.id = probeId;
    box.style.cssText =
      'position:absolute;top:-9999px;left:-9999px;width:100px;height:100px;overflow:scroll';
    const inner = document.createElement('div');
    inner.style.cssText = 'width:200px;height:200px';
    box.append(inner);
    document.body.append(box);
    const width = box.offsetWidth - box.clientWidth;
    box.remove();
    return width;
  }, PROBE_STYLE_ID);
}

/**
 * 扫描页面上所有"真的在滚"的元素，量出它们的原生滚动槽。
 *
 * 只统计 `overflow: auto|scroll` 且该方向确实溢出的元素 —— `overflow: hidden`
 * 的容器虽然 clientWidth 更小，但那是裁剪不是滚动条，算进来会全是假阳性。
 */
async function wideScrollAreas(
  page: Page,
  budget: number,
): Promise<Array<ScrollGutter & { selector: string }>> {
  return page.evaluate((limit) => {
    const offenders: Array<ScrollGutter & { selector: string }> = [];

    const describe = (el: Element) => {
      const tag = el.tagName.toLowerCase();
      const cls = [...el.classList]
        .filter((c) => !c.startsWith('e2e-'))
        .slice(0, 3)
        .join('.');
      const parent = el.parentElement;
      const hint =
        parent && parent.id
          ? `#${parent.id}>`
          : parent?.className
            ? `.${[...parent.classList][0] ?? ''}>`
            : '';
      return `${hint}${tag}${cls ? `.${cls}` : ''}`;
    };

    for (const el of [...document.querySelectorAll('*')]) {
      const box = el as HTMLElement;
      const style = getComputedStyle(el);
      const rects = box.getBoundingClientRect();
      // 没上屏的元素（display:none / 0 尺寸）不参与：它们永远不会露滚动条
      if (!rects.width || !rects.height) continue;

      const canVertical = /auto|scroll/.test(style.overflowY);
      const canHorizontal = /auto|scroll/.test(style.overflowX);
      if (!canVertical && !canHorizontal) continue;

      const vertical = canVertical && box.scrollHeight > box.clientHeight + 1
        ? box.offsetWidth - box.clientWidth
        : 0;
      const horizontal =
        canHorizontal && box.scrollWidth > box.clientWidth + 1
          ? box.offsetHeight - box.clientHeight
          : 0;

      if (vertical > limit || horizontal > limit) {
        offenders.push({ horizontal, selector: describe(el), vertical });
      }
    }
    return offenders;
  }, budget);
}

test.describe('全站滚动条：用封装组件，不用系统内置', () => {
  test('外壳三处滚动区都是 <Scrollbar>，并真的藏掉了原生条', async ({ page }) => {
    await signIn(page);
    await setLayout(page, 'vertical');
    await go(page, '/system/user');

    /**
     * 侧栏 / 内容区 / 标签栏。
     * 每处都同时断言两件事：滚动元素是 `.scrollbar__wrap`，
     * 且它带 `--hidden-default`（自绘模式）—— 少了后者就是"两条滚动条"。
     *
     * 直接拿到 wrap 本身而不是"容器里的 wrap"：标签栏的 `.tab-scroll` 是
     * `<Scrollbar>` 的 `wrap-class`，它和 `.scrollbar__wrap` 是同一个元素，
     * 当成父级去找子元素会永远找不到。
     */
    const shells = [
      {
        name: '侧栏菜单',
        wrap: region(page, 'sidebar')
          .locator('.scrollbar__wrap')
          .first(),
      },
      {
        name: '内容区',
        wrap: page
          .locator('main .scrollbar__wrap, [data-layout-region="content"] .scrollbar__wrap')
          .first(),
      },
      {
        name: '标签栏',
        wrap: page.locator('.scrollbar__wrap.tab-scroll').first(),
      },
    ];

    for (const { name, wrap } of shells) {
      await expect(wrap, `${name} 的滚动区应该是封装 Scrollbar`).toBeVisible();
      await expect(
        wrap,
        `${name} 的原生滚动条必须被藏掉，否则和自绘条并存`,
      ).toHaveClass(/scrollbar__wrap--hidden-default/);
    }

    /**
     * 内容区超长时自绘条要出现（.scrollbar__bar.is-vertical）。
     * 这是"封装组件真的在干活"的证据 —— 只有 wrap 没有 bar 就等于
     * 既藏了原生条又没给用户任何滚动指示。
     */
    const contentWrap = page
      .locator('main .scrollbar__wrap')
      .first();
    const overflows = await contentWrap.evaluate(
      (el) => el.scrollHeight > el.clientHeight + 1,
    );
    if (overflows) {
      await expect(
        page.locator('main .scrollbar__bar.is-vertical').first(),
      ).toBeAttached();
    }
  });

  test('任何滚动区的原生滚动槽都不宽于全局兜底宽度', async ({ page }) => {
    await signIn(page);

    const gutter = await nativeGutter(page);
    /**
     * 阈值 = 探针宽度 + 2px 容差（四舍五入与 zoom 差异）。
     * 探针为 0（macOS overlay 滚动条）时页面本来就没有槽，条件天然成立。
     */
    const budget = gutter + 2;

    const pages = [
      '/system/user',
      '/dashboard/analysis',
      '/demo/table-pagination-test',
    ];
    const offenders: Array<{ page: string; items: unknown[] }> = [];

    for (const path of pages) {
      await go(page, path);
      // 表格页要滚到底才有横向滚动条；先滚一下把懒渲染的内容带出来
      await page.mouse.wheel(0, 400);
      await page.waitForTimeout(200);
      const items = await wideScrollAreas(page, budget);
      if (items.length > 0) offenders.push({ items, page: path });
    }

    expect(
      offenders,
      `检测到系统滚动条（全局兜底宽度 ${gutter}px，容差 2px）：\n${JSON.stringify(offenders, null, 2)}`,
    ).toEqual([]);
  });
});
